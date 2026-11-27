import type { BotDifficulty, GameState, Player, Tile } from "~/types";
import { GAME_RULES } from "~/shared/constants/gameRules";
import { rollDice } from "~/utils/gameFunctions";
import { evaluateIncomingTrade } from "./tradeEvaluator";
import { findBestTradeProposal } from "./tradeProposer";
import {
  doesTileBlockOpponentSet,
  doesTileCompleteOrBlockSet,
  doesTileCompleteSet,
  evaluateTileStrategicValue,
  findBestUnmortgageTile,
  findBestUpgradeTile,
  getAmountOwedForCurrentAction,
  getGameStage,
  getLegalLiquidationCandidates,
  getLegalUpgradeCandidates,
  getMaxOpponentRent,
  getSafetyReserve,
  getUnownedTileFraction,
  planNextLiquidationAction,
} from "./valuation";

export interface BotTurnContext {
  proposedTradeThisTurn: boolean;
  turnStepCount: number;
  tradeCooldownByTarget: Record<string, number>;
}

export interface BotDecision {
  action:
    | "ROLL_DICE"
    | "JAIL_PAY"
    | "BUY_PROPERTY"
    | "PASS_PROPERTY"
    | "BID_AUCTION_PROPERTY"
    | "PASS_AUCTION_PROPERTY"
    | "PAY_RENT"
    | "PAY_TAX"
    | "PAY_CHANCE"
    | "MORTGAGE_PROPERTY"
    | "BUY_BACK_PROPERTY"
    | "UPGRADE_PROPERTY"
    | "SELL_PROPERTY"
    | "TRADE"
    | "ACCEPT_TRADE"
    | "DECLINE_TRADE";
  payload: Record<string, any>;
}

function findActiveBotByUsername(
  game: GameState,
  username?: string | null
): Player | null {
  if (!username) {
    return null;
  }

  if ((game.eliminatedPlayers ?? []).includes(username)) {
    return null;
  }

  const player = game.players.find((p) => p.username === username);
  if (!player || !player.isBot) {
    return null;
  }

  return player;
}

/**
 * Determines which bot (if any) must act next for the given game state.
 * Priority:
 *  1. Pending incoming trade recipient (`activeTrade.to`)
 *  2. Active auction bidder (`activeAuctionBidder`)
 *  3. Current turn player (`currentTurn`)
 */
export function getActingBot(game: GameState): Player | null {
  if (game.status === "ENDED") {
    return null;
  }

  if (game.currentAction === "trade") {
    return findActiveBotByUsername(game, game.activeTrade?.to);
  }

  if (game.currentAction === "auction") {
    return findActiveBotByUsername(game, game.activeAuctionBidder);
  }

  return findActiveBotByUsername(game, game.currentTurn);
}

/**
 * Computes the next action for `bot` given the current `game` state.
 *
 * Determinism guarantees:
 * - Incoming trade evaluation (`ACCEPT_TRADE` / `DECLINE_TRADE`) NEVER calls `rng`
 *   across ANY difficulty (`EASY`, `MEDIUM`, `HARD`).
 * - `HARD` NEVER calls `rng` on any strategic decision (only dice rolls are random
 *   via `rollDice()`).
 * - `MEDIUM` uses mild noise on non-trade decisions.
 * - `EASY` uses higher randomness on non-trade decisions.
 */
export function decideBotAction(
  game: GameState,
  bot: Player,
  context?: BotTurnContext,
  rng: () => number = Math.random
): BotDecision | null {
  if (
    game.status === "ENDED" ||
    !bot.isBot ||
    (game.eliminatedPlayers ?? []).includes(bot.username)
  ) {
    return null;
  }

  const difficulty: BotDifficulty = bot.botDifficulty ?? "MEDIUM";
  const ctx: BotTurnContext = {
    proposedTradeThisTurn: context?.proposedTradeThisTurn ?? false,
    turnStepCount: context?.turnStepCount ?? 0,
    tradeCooldownByTarget: context?.tradeCooldownByTarget ?? {},
  };

  // --- 1. Incoming Trade (STRICTLY DETERMINISTIC for all difficulties) ---
  if (game.currentAction === "trade") {
    if (!game.activeTrade || game.activeTrade.to !== bot.username) {
      return null;
    }

    const evaluation = evaluateIncomingTrade(game, bot, game.activeTrade);
    return {
      action: evaluation.accept ? "ACCEPT_TRADE" : "DECLINE_TRADE",
      payload: { username: bot.username },
    };
  }

  // --- 2. Auction ---
  if (game.currentAction === "auction") {
    if (game.activeAuctionBidder !== bot.username) {
      return null;
    }

    const tile = game.board.tiles.find((t) => t.id === game.auctionedTileId);
    if (!tile) {
      return {
        action: "PASS_AUCTION_PROPERTY",
        payload: {
          username: bot.username,
          propertyId: game.auctionedTileId,
        },
      };
    }

    return decideAuctionAction(game, bot, tile, difficulty, rng);
  }

  // All remaining actions belong strictly to `game.currentTurn`
  if (game.currentTurn !== bot.username) {
    return null;
  }

  // --- 3. Mandatory Payments (Rent / Tax / Chance minusBalance) ---
  if (
    game.currentAction === "payRent" ||
    game.currentAction === "payTax" ||
    (game.currentAction === "chance" &&
      game.activeChance?.type === "minusBalance")
  ) {
    return decidePaymentAction(game, bot, difficulty, ctx, rng);
  }

  // --- 4. Unowned Property Buy / Pass ---
  if (game.currentAction === "buy") {
    const tile = game.board.tiles.find((t) => t.id === bot.position);
    if (!tile || tile.price == null) {
      return null;
    }
    return decideBuyAction(game, bot, tile, difficulty, rng);
  }

  // --- 5. Turn Roll Phase (Pre-roll management -> Jail -> Roll Dice) ---
  if (game.currentAction === "roll") {
    return decideRollPhaseAction(game, bot, difficulty, ctx, rng);
  }

  return null;
}

function decideAuctionAction(
  game: GameState,
  bot: Player,
  tile: Tile,
  difficulty: BotDifficulty,
  rng: () => number
): BotDecision {
  const basePrice = tile.price ?? 100;
  const nextBid =
    (game.auctionBidAmount ?? basePrice) + GAME_RULES.AUCTION_BID_INCREMENT;

  if (bot.balance < nextBid) {
    return {
      action: "PASS_AUCTION_PROPERTY",
      payload: { username: bot.username, propertyId: tile.id },
    };
  }

  let shouldBid = false;

  if (difficulty === "HARD") {
    const strategicValue = evaluateTileStrategicValue(game, tile, bot.username);
    const reserve = getSafetyReserve(game, bot, "HARD");
    const highPriority = doesTileCompleteOrBlockSet(game, tile, bot.username);
    const reserveForTile = highPriority ? Math.round(reserve * 0.5) : reserve;
    const maxBid = Math.min(
      bot.balance - reserveForTile,
      Math.round(strategicValue * 1.15)
    );
    shouldBid = nextBid <= maxBid;
  } else if (difficulty === "MEDIUM") {
    const completes = doesTileCompleteSet(game, tile, bot.username);
    const blocks = doesTileBlockOpponentSet(game, tile, bot.username);
    const mult = completes ? 1.3 : blocks ? 1.18 : 1.05;
    const noise = 0.95 + rng() * 0.15;
    const reserve = completes ? 60 : getSafetyReserve(game, bot, "MEDIUM");
    const maxBid = Math.min(
      bot.balance - reserve,
      Math.round(basePrice * mult * noise)
    );
    shouldBid = nextBid <= maxBid;
  } else {
    // EASY: probabilistic bidding that falls off as price climbs
    const ratio = nextBid / Math.max(1, basePrice);
    const bidProb = Math.max(0.05, Math.min(0.85, 1.35 - ratio * 0.75));
    shouldBid = bot.balance - nextBid >= 50 && rng() < bidProb;
  }

  return {
    action: shouldBid ? "BID_AUCTION_PROPERTY" : "PASS_AUCTION_PROPERTY",
    payload: { username: bot.username, propertyId: tile.id },
  };
}

function decidePaymentAction(
  game: GameState,
  bot: Player,
  difficulty: BotDifficulty,
  ctx: BotTurnContext,
  rng: () => number
): BotDecision | null {
  const owed = getAmountOwedForCurrentAction(game, bot);

  if (bot.balance < owed && ctx.turnStepCount < 12) {
    if (difficulty === "HARD" || difficulty === "MEDIUM") {
      const plan = planNextLiquidationAction(game, bot);
      if (plan) {
        return {
          action: plan.action,
          payload: { username: bot.username, propertyId: plan.propertyId },
        };
      }
    } else {
      // EASY: 55% chance to liquidate a random eligible asset, otherwise accepts bankruptcy
      const candidates = getLegalLiquidationCandidates(game, bot);
      if (candidates.length > 0 && rng() < 0.55) {
        const picked =
          candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
        return {
          action: picked.action,
          payload: { username: bot.username, propertyId: picked.propertyId },
        };
      }
    }
  }

  if (game.currentAction === "payRent") {
    const tile = game.board.tiles.find((t) => t.id === bot.position);
    if (!tile) {
      return null;
    }
    const payload: Record<string, any> = {
      username: bot.username,
      propertyId: tile.id,
    };
    if (tile.type === "bonus-property") {
      payload.turnResult = game.lastDiceRoll ?? { left: 3, right: 4 };
    }
    return { action: "PAY_RENT", payload };
  }

  if (game.currentAction === "payTax") {
    const tile = game.board.tiles.find((t) => t.id === bot.position);
    return {
      action: "PAY_TAX",
      payload: {
        username: bot.username,
        tax: tile?.taxAmount ?? 0,
      },
    };
  }

  if (game.currentAction === "chance") {
    return {
      action: "PAY_CHANCE",
      payload: {
        username: bot.username,
        amount: game.activeChance?.amount ?? 0,
      },
    };
  }

  return null;
}

function decideBuyAction(
  game: GameState,
  bot: Player,
  tile: Tile,
  difficulty: BotDifficulty,
  rng: () => number
): BotDecision {
  const price = tile.price ?? 0;
  if (bot.balance < price) {
    return {
      action: "PASS_PROPERTY",
      payload: { username: bot.username, propertyId: tile.id },
    };
  }

  let shouldBuy = false;
  const remainingCash = bot.balance - price;

  if (difficulty === "HARD") {
    const reserve = getSafetyReserve(game, bot, "HARD");
    const stage = getGameStage(game);
    const completesOrBlocks = doesTileCompleteOrBlockSet(
      game,
      tile,
      bot.username
    );
    const strategicValue = evaluateTileStrategicValue(game, tile, bot.username);

    shouldBuy =
      completesOrBlocks ||
      remainingCash >= Math.round(reserve * 0.7) ||
      (stage === "early" && remainingCash >= 50) ||
      (strategicValue >= price * 1.2 && remainingCash >= 80);
  } else if (difficulty === "MEDIUM") {
    const completes = doesTileCompleteSet(game, tile, bot.username);
    if (completes) {
      shouldBuy = true;
    } else if (remainingCash >= 180) {
      shouldBuy = true;
    } else if (remainingCash >= 100) {
      shouldBuy = rng() < 0.85;
    } else {
      shouldBuy = rng() < 0.2;
    }
  } else {
    // EASY: ~65% buy when affordable
    shouldBuy = rng() < 0.65;
  }

  return {
    action: shouldBuy ? "BUY_PROPERTY" : "PASS_PROPERTY",
    payload: { username: bot.username, propertyId: tile.id },
  };
}

function decideRollPhaseAction(
  game: GameState,
  bot: Player,
  difficulty: BotDifficulty,
  ctx: BotTurnContext,
  rng: () => number
): BotDecision {
  // --- Pre-roll asset management & proactive trading ---
  if (ctx.turnStepCount < 6) {
    // 1. Unmortgage
    if (difficulty === "HARD") {
      const reserve = getSafetyReserve(game, bot, "HARD");
      const unmortgageTile = findBestUnmortgageTile(game, bot, reserve);
      if (unmortgageTile) {
        return {
          action: "BUY_BACK_PROPERTY",
          payload: { username: bot.username, propertyId: unmortgageTile.id },
        };
      }
    } else if (difficulty === "MEDIUM") {
      const unmortgageTile = findBestUnmortgageTile(game, bot, 250);
      if (unmortgageTile && rng() < 0.85) {
        return {
          action: "BUY_BACK_PROPERTY",
          payload: { username: bot.username, propertyId: unmortgageTile.id },
        };
      }
    } else {
      const unmortgageTile = findBestUnmortgageTile(game, bot, 100);
      if (unmortgageTile && rng() < 0.25) {
        return {
          action: "BUY_BACK_PROPERTY",
          payload: { username: bot.username, propertyId: unmortgageTile.id },
        };
      }
    }

    // 2. Upgrade
    if (difficulty === "HARD") {
      const reserve = getSafetyReserve(game, bot, "HARD");
      const upgradeTile = findBestUpgradeTile(game, bot, "HARD", reserve);
      if (upgradeTile) {
        return {
          action: "UPGRADE_PROPERTY",
          payload: { username: bot.username, propertyId: upgradeTile.id },
        };
      }
    } else if (difficulty === "MEDIUM") {
      const upgradeTile = findBestUpgradeTile(game, bot, "MEDIUM", 180);
      if (upgradeTile && rng() < 0.85) {
        return {
          action: "UPGRADE_PROPERTY",
          payload: { username: bot.username, propertyId: upgradeTile.id },
        };
      }
    } else {
      const candidates = getLegalUpgradeCandidates(game, bot, 50);
      if (candidates.length > 0 && rng() < 0.4) {
        const picked =
          candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
        return {
          action: "UPGRADE_PROPERTY",
          payload: { username: bot.username, propertyId: picked.id },
        };
      }
    }

    // 3. Proactive Trade
    if (!ctx.proposedTradeThisTurn) {
      const shouldTryTrade =
        difficulty === "HARD"
          ? true
          : difficulty === "MEDIUM"
            ? rng() < 0.8
            : rng() < 0.25;

      if (shouldTryTrade) {
        const proposal = findBestTradeProposal(
          game,
          bot,
          ctx.tradeCooldownByTarget
        );
        if (proposal && proposal.to) {
          return {
            action: "TRADE",
            payload: {
              username: bot.username,
              tradePlayerUsername: proposal.to,
              tradeTiles: {
                given: proposal.given,
                received: proposal.received,
                givenMoney: proposal.givenMoney ?? 0,
                receivedMoney: proposal.receivedMoney ?? 0,
              },
            },
          };
        }
      }
    }
  }

  // --- Jail decision ---
  if (bot.jailed && bot.balance >= GAME_RULES.JAIL_FINE) {
    let shouldPayJail = false;

    if (difficulty === "HARD") {
      const stage = getGameStage(game);
      const unownedFraction = getUnownedTileFraction(game);
      const { maxRent } = getMaxOpponentRent(game, bot.username);
      const safeToLeaveJail =
        unownedFraction >= 0.35 || (stage !== "late" && maxRent < 250);
      shouldPayJail =
        safeToLeaveJail && bot.balance - GAME_RULES.JAIL_FINE >= 80;
    } else if (difficulty === "MEDIUM") {
      const stage = getGameStage(game);
      shouldPayJail =
        stage !== "late" && bot.balance >= 200 && rng() < 0.85;
    } else {
      shouldPayJail = rng() < 0.5;
    }

    if (shouldPayJail) {
      return {
        action: "JAIL_PAY",
        payload: { username: bot.username },
      };
    }
  }

  // --- Default: Roll Dice ---
  return {
    action: "ROLL_DICE",
    payload: {
      username: bot.username,
      turnResult: rollDice(),
    },
  };
}
