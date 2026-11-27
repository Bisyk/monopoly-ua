import type { BotDifficulty, GameState, Player, Tile, Trade } from "~/types";
import { GAME_RULES } from "~/shared/constants/gameRules";
import { rollDice } from "~/utils/gameFunctions";
import { evaluateIncomingTrade } from "./tradeEvaluator";
import {
  findBestPreMortgageTradeOffer,
  findBestTradeProposal,
  findPreMortgageTradeOffer,
} from "./tradeProposer";
import {
  canSurviveWithoutTile,
  doesTileBlockOpponentSet,
  doesTileCompleteOrBlockSet,
  doesTileCompleteSet,
  evaluateTileStrategicValue,
  findBestUnmortgageTile,
  findBestUpgradeTile,
  findProactiveMortgageForUpgrade,
  getActionReserve,
  getAmountOwedForCurrentAction,
  getBotRiskLevel,
  getEligibleMortgageTilesForTrade,
  getForwardBoardRisk,
  getGameStage,
  getLegalLiquidationCandidates,
  getLegalUpgradeCandidates,
  getUnownedTileFraction,
  planNextLiquidationAction,
} from "./valuation";

export interface BotTurnContext {
  proposedTradeThisTurn: boolean;
  proposedLiquidationTradeThisTurn?: boolean;
  mortgagedTileIdsThisTurn?: number[];
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

function buildTradeDecision(bot: Player, proposal: Trade): BotDecision {
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
 * - `HARD` NEVER calls `rng` on any strategic decision (its per-game `botRiskLevel`
 *   is rolled once at game start; only dice rolls use randomness via `rollDice()`).
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
    proposedLiquidationTradeThisTurn:
      context?.proposedLiquidationTradeThisTurn ?? false,
    mortgagedTileIdsThisTurn: context?.mortgagedTileIdsThisTurn ?? [],
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
  const risk = getBotRiskLevel(bot);

  if (difficulty === "HARD") {
    const strategicValue = evaluateTileStrategicValue(game, tile, bot.username);
    const auctionReserve = getActionReserve(game, bot, "HARD", "auction");
    const highPriority = doesTileCompleteOrBlockSet(game, tile, bot.username);
    // Aggressive bots & set-completing/blocking auctions drop reserve close to $0
    const reserveForTile = highPriority
      ? Math.round(auctionReserve * (1 - risk) * 0.4)
      : auctionReserve;
    const maxBid = Math.min(
      bot.balance - reserveForTile,
      Math.round(strategicValue * 1.15)
    );
    shouldBid = nextBid <= maxBid;
  } else if (difficulty === "MEDIUM") {
    const completes = doesTileCompleteSet(game, tile, bot.username);
    const blocks = doesTileBlockOpponentSet(game, tile, bot.username);
    const mult = completes ? 1.35 : blocks ? 1.25 : 1.08;
    const noise = 0.95 + rng() * 0.15;
    const auctionReserve = getActionReserve(game, bot, "MEDIUM", "auction");
    const reserve =
      completes || blocks
        ? Math.round((1 - risk) * 40)
        : auctionReserve;
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
        // Before mortgaging, scan ALL mortgageable non-set tiles for a "good moment" to offer
        // up to 2x face price to an opponent who genuinely needs one (instead of mortgaging for 0.5x).
        // Do not let normal roll-phase trade cooldown block an actual liquidation offer;
        // `isTradePreviouslyDeclined` and `proposedLiquidationTradeThisTurn` still prevent spam.
        if (
          plan.action === "MORTGAGE_PROPERTY" &&
          !ctx.proposedLiquidationTradeThisTurn
        ) {
          const amountNeeded = Math.max(0, owed - bot.balance);
          const nonSetMortgageables = getEligibleMortgageTilesForTrade(
            game,
            bot,
            false
          );
          let preMortgageOffer = findBestPreMortgageTradeOffer(
            game,
            bot,
            nonSetMortgageables,
            {
              cooldownByTarget: {},
              isBankruptcyEmergency: false,
              amountNeeded,
            }
          );

          if (!preMortgageOffer) {
            const tileToMortgage = game.board.tiles.find(
              (t) => t.id === plan.propertyId
            );
            if (
              tileToMortgage &&
              !canSurviveWithoutTile(game, bot, tileToMortgage.id, owed)
            ) {
              preMortgageOffer = findPreMortgageTradeOffer(
                game,
                bot,
                tileToMortgage,
                {
                  cooldownByTarget: {},
                  isBankruptcyEmergency: true,
                  amountNeeded,
                }
              );
            }
          }

          if (preMortgageOffer && preMortgageOffer.to) {
            return buildTradeDecision(bot, preMortgageOffer);
          }
        }

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
          candidates[
            Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
          ];
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
  const risk = getBotRiskLevel(bot);

  if (difficulty === "HARD") {
    const buyReserve = getActionReserve(game, bot, "HARD", "buy");
    const stage = getGameStage(game);
    const completesOrBlocks = doesTileCompleteOrBlockSet(
      game,
      tile,
      bot.username
    );
    const strategicValue = evaluateTileStrategicValue(game, tile, bot.username);

    shouldBuy =
      completesOrBlocks ||
      remainingCash >= buyReserve ||
      (stage === "early" && remainingCash >= Math.round((1 - risk) * 35)) ||
      (strategicValue >= price * 1.15 &&
        remainingCash >= Math.round((1 - risk) * 60));
  } else if (difficulty === "MEDIUM") {
    const completesOrBlocks = doesTileCompleteOrBlockSet(
      game,
      tile,
      bot.username
    );
    const buyReserve = getActionReserve(game, bot, "MEDIUM", "buy");
    if (completesOrBlocks || remainingCash >= buyReserve) {
      shouldBuy = true;
    } else if (remainingCash >= Math.round((1 - risk) * 80)) {
      shouldBuy = rng() < 0.8 + risk * 0.15;
    } else {
      shouldBuy = rng() < 0.25 + risk * 0.35;
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
  const risk = getBotRiskLevel(bot);

  // --- Pre-roll asset management & proactive trading ---
  if (ctx.turnStepCount < 8) {
    const mortgagedThisTurn = ctx.mortgagedTileIdsThisTurn ?? [];

    // 1. Unmortgage blocked FULL-SET tiles first (unlocking building beats everything else)
    if (difficulty === "HARD") {
      const fullSetReserve = getActionReserve(
        game,
        bot,
        "HARD",
        "unmortgage_full_set"
      );
      const unmortgageFullSet = findBestUnmortgageTile(
        game,
        bot,
        fullSetReserve,
        fullSetReserve,
        { onlyFullSet: true, excludeTileIds: mortgagedThisTurn }
      );
      if (unmortgageFullSet) {
        return {
          action: "BUY_BACK_PROPERTY",
          payload: { username: bot.username, propertyId: unmortgageFullSet.id },
        };
      }
    } else if (difficulty === "MEDIUM") {
      const fullSetReserve = getActionReserve(
        game,
        bot,
        "MEDIUM",
        "unmortgage_full_set"
      );
      const unmortgageFullSet = findBestUnmortgageTile(
        game,
        bot,
        fullSetReserve,
        fullSetReserve,
        { onlyFullSet: true, excludeTileIds: mortgagedThisTurn }
      );
      if (unmortgageFullSet && (risk >= 0.5 || rng() < 0.9)) {
        return {
          action: "BUY_BACK_PROPERTY",
          payload: { username: bot.username, propertyId: unmortgageFullSet.id },
        };
      }
    } else {
      const unmortgageFullSet = findBestUnmortgageTile(game, bot, 40, 40, {
        onlyFullSet: true,
        excludeTileIds: mortgagedThisTurn,
      });
      if (unmortgageFullSet && rng() < 0.25) {
        return {
          action: "BUY_BACK_PROPERTY",
          payload: { username: bot.username, propertyId: unmortgageFullSet.id },
        };
      }
    }

    // 2. Upgrade (risk- & board-aware reserve down to $0, trap-based tile priority)
    if (difficulty === "HARD") {
      const upgradeReserve = getActionReserve(game, bot, "HARD", "upgrade");
      const upgradeTile = findBestUpgradeTile(
        game,
        bot,
        "HARD",
        upgradeReserve
      );
      if (upgradeTile) {
        return {
          action: "UPGRADE_PROPERTY",
          payload: { username: bot.username, propertyId: upgradeTile.id },
        };
      }
    } else if (difficulty === "MEDIUM") {
      const upgradeReserve = getActionReserve(game, bot, "MEDIUM", "upgrade");
      const upgradeTile = findBestUpgradeTile(
        game,
        bot,
        "MEDIUM",
        upgradeReserve
      );
      if (upgradeTile && (risk >= 0.6 || rng() < 0.92)) {
        return {
          action: "UPGRADE_PROPERTY",
          payload: { username: bot.username, propertyId: upgradeTile.id },
        };
      }
    } else {
      const candidates = getLegalUpgradeCandidates(game, bot, 50);
      if (candidates.length > 0 && rng() < 0.4) {
        const picked =
          candidates[
            Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
          ];
        return {
          action: "UPGRADE_PROPERTY",
          payload: { username: bot.username, propertyId: picked.id },
        };
      }
    }

    // 3. Proactive mortgage of weak non-set singletons to fund full-set upgrades
    //    (preceded by a multi-tile pre-mortgage 1.4x–2.0x offer scan if someone genuinely needs one!)
    if (difficulty === "HARD" || difficulty === "MEDIUM") {
      const proactivePlan = findProactiveMortgageForUpgrade(
        game,
        bot,
        difficulty
      );
      if (proactivePlan) {
        if (!ctx.proposedTradeThisTurn && !ctx.proposedLiquidationTradeThisTurn) {
          const preMortgageOffer = findBestPreMortgageTradeOffer(
            game,
            bot,
            proactivePlan.eligibleTiles,
            {
              cooldownByTarget: {},
              isBankruptcyEmergency: false,
              amountNeeded: Math.max(0, proactivePlan.upgradePrice - bot.balance),
            }
          );
          if (preMortgageOffer && preMortgageOffer.to) {
            return buildTradeDecision(bot, preMortgageOffer);
          }
        }

        return {
          action: "MORTGAGE_PROPERTY",
          payload: {
            username: bot.username,
            propertyId: proactivePlan.tileToMortgage.id,
          },
        };
      }
    }

    // 4. Unmortgage non-set tiles (only when we did NOT proactively mortgage this turn
    //    and no upgradeable full set needed the cash first)
    if (mortgagedThisTurn.length === 0) {
      if (difficulty === "HARD") {
        const normalReserve = getActionReserve(game, bot, "HARD", "unmortgage");
        const unmortgageTile = findBestUnmortgageTile(
          game,
          bot,
          normalReserve,
          normalReserve,
          { excludeTileIds: mortgagedThisTurn }
        );
        if (unmortgageTile) {
          return {
            action: "BUY_BACK_PROPERTY",
            payload: { username: bot.username, propertyId: unmortgageTile.id },
          };
        }
      } else if (difficulty === "MEDIUM") {
        const normalReserve = getActionReserve(game, bot, "MEDIUM", "unmortgage");
        const unmortgageTile = findBestUnmortgageTile(
          game,
          bot,
          normalReserve,
          normalReserve,
          { excludeTileIds: mortgagedThisTurn }
        );
        if (unmortgageTile && (risk >= 0.5 || rng() < 0.9)) {
          return {
            action: "BUY_BACK_PROPERTY",
            payload: { username: bot.username, propertyId: unmortgageTile.id },
          };
        }
      } else {
        const unmortgageTile = findBestUnmortgageTile(game, bot, 100, 40, {
          excludeTileIds: mortgagedThisTurn,
        });
        if (unmortgageTile && rng() < 0.25) {
          return {
            action: "BUY_BACK_PROPERTY",
            payload: { username: bot.username, propertyId: unmortgageTile.id },
          };
        }
      }
    }

    // 5. Proactive Trade
    if (!ctx.proposedTradeThisTurn) {
      const shouldTryTrade =
        difficulty === "HARD"
          ? true
          : difficulty === "MEDIUM"
            ? rng() < 0.85
            : rng() < 0.25;

      if (shouldTryTrade) {
        const proposal = findBestTradeProposal(
          game,
          bot,
          ctx.tradeCooldownByTarget
        );
        if (proposal && proposal.to) {
          return buildTradeDecision(bot, proposal);
        }
      }
    }
  }

  // --- Board-aware Jail decision (inspect actual tiles 2..12 steps outside Jail = pos 11) ---
  if (bot.jailed && bot.balance >= GAME_RULES.JAIL_FINE) {
    let shouldPayJail = false;
    const jailExitRisk = getForwardBoardRisk(game, bot, 11);

    if (difficulty === "HARD") {
      const stage = getGameStage(game);
      const unownedFraction = getUnownedTileFraction(game);
      const safeExit =
        jailExitRisk.maxRentAhead < 250 && jailExitRisk.expectedRentAhead < 45;
      const juicyUnownedExit =
        (jailExitRisk.expectedUnownedAhead >= 0.25 || unownedFraction >= 0.35) &&
        jailExitRisk.maxRentAhead < 300;
      const minCashAfterFine = Math.round((1 - risk) * 60);

      shouldPayJail =
        (juicyUnownedExit || (stage !== "late" && safeExit)) &&
        bot.balance - GAME_RULES.JAIL_FINE >= minCashAfterFine;
    } else if (difficulty === "MEDIUM") {
      const stage = getGameStage(game);
      const exitNotLethal = jailExitRisk.maxRentAhead < 300;
      shouldPayJail =
        stage !== "late" &&
        exitNotLethal &&
        bot.balance >= Math.round(180 - risk * 80) &&
        rng() < 0.85;
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

