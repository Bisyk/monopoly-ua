import type { BotDifficulty, GameState, Player, Tile, Trade } from "~/types";
import { isTradePreviouslyDeclined } from "~/shared/utils/tradeSignature";
import { getPlayerTradableProperties } from "~/utils/getPlayerTradableProperties";
import {
  getFullSetGroupIds,
  getGroupStrategicMultiplier,
  getGroupTiles,
  getSafetyReserve,
  isOwnableTile,
} from "./valuation";

export interface TradeEvaluationResult {
  accept: boolean;
  score: number;
  reason: string;
}

export function buildOwnershipMap(game: GameState): Map<number, string> {
  const map = new Map<number, string>();
  for (const tile of game.board.tiles) {
    if (isOwnableTile(tile) && tile.owner) {
      map.set(tile.id, tile.owner);
    }
  }
  return map;
}

export function applyTradeToOwnershipMap(
  baseOwnership: Map<number, string>,
  trade: Pick<Trade, "from" | "to" | "given" | "received">
): Map<number, string> {
  const next = new Map(baseOwnership);
  if (trade.to) {
    for (const tileId of trade.given ?? []) {
      next.set(tileId, trade.to);
    }
  }
  if (trade.from) {
    for (const tileId of trade.received ?? []) {
      next.set(tileId, trade.from);
    }
  }
  return next;
}

export function getFullSetsFromOwnership(
  game: GameState,
  ownership: Map<number, string>,
  username: string
): number[] {
  const fullSets: number[] = [];

  for (const group of game.board.groups) {
    if (!group.properties.length) {
      continue;
    }
    const ownsAll = group.properties.every(
      (id) => ownership.get(id) === username
    );
    if (ownsAll) {
      fullSets.push(group.groupId);
    }
  }

  return fullSets;
}

export function computeGroupMonopolyPower(
  game: GameState,
  groupId: number
): number {
  const group = game.board.groups.find((g) => g.groupId === groupId);
  if (!group) {
    return 0;
  }

  const groupTiles = getGroupTiles(game, group);
  const totalFaceValue = groupTiles.reduce(
    (sum, tile) => sum + (tile.price ?? 0),
    0
  );
  const mult = getGroupStrategicMultiplier(groupId);
  return Math.round(totalFaceValue * mult * mult);
}

/**
 * Deterministic total portfolio valuation of a player's holdings + cash buildability
 * under a given ownership map (used for HARD trade evaluation and trade proposal ranking).
 */
export function computePlayerPortfolioValue(
  game: GameState,
  ownership: Map<number, string>,
  username: string,
  cash: number,
  safetyReserve: number
): number {
  let total = 0;

  // 1. Property groups (monopoly completion premiums, partial synergy, buildability)
  for (const group of game.board.groups) {
    const groupTiles = getGroupTiles(game, group);
    if (!groupTiles.length) {
      continue;
    }

    const mult = getGroupStrategicMultiplier(group.groupId);
    const ownedTiles = groupTiles.filter(
      (t) => ownership.get(t.id) === username
    );
    if (!ownedTiles.length) {
      continue;
    }

    const groupFaceSum = ownedTiles.reduce((s, t) => s + (t.price ?? 0), 0);
    const groupSize = groupTiles.length;

    if (ownedTiles.length === groupSize) {
      // Full monopoly: base ROI + substantial monopoly premium
      total += groupFaceSum * mult * 1.65;

      // Immediate buildability bonus if player retains cash above reserve to build houses
      const upgradePrice = group.upgradePrice ?? 100;
      const anyMortgaged = ownedTiles.some((t) => Boolean(t.mortgaged));
      if (!anyMortgaged && upgradePrice > 0) {
        const spendableCash = Math.max(0, cash - safetyReserve * 0.75);
        const buildableHouses = Math.min(
          groupSize * 3,
          Math.floor(spendableCash / upgradePrice)
        );
        total += buildableHouses * upgradePrice * 0.35 * mult;
      }
    } else if (groupSize === 3 && ownedTiles.length === 2) {
      // 2 of 3: meaningful set-advancement synergy
      total += groupFaceSum * mult * 1.18;
    } else {
      // Singleton in a group; check if it blocks an opponent holding all other tiles
      const otherTiles = groupTiles.filter(
        (t) => ownership.get(t.id) !== username
      );
      const oppOwners = otherTiles
        .map((t) => ownership.get(t.id))
        .filter((o): o is string => Boolean(o));
      const blocksOpponentMonopoly =
        otherTiles.length > 0 &&
        oppOwners.length === otherTiles.length &&
        oppOwners.every((o) => o === oppOwners[0]);

      total +=
        groupFaceSum * mult * (blocksOpponentMonopoly ? 1.25 : 0.95);
    }

    // Account for mortgage penalties and existing upgrades
    for (const tile of ownedTiles) {
      if ((tile.rentLevel ?? 0) > 0 && group.upgradePrice) {
        total += (tile.rentLevel ?? 0) * group.upgradePrice * 0.85;
      }
      if (tile.mortgaged) {
        const buyback = tile.buybackPrice ?? Math.round((tile.price ?? 0) * 0.6);
        total -= buyback * 0.85;
      }
    }
  }

  // 2. Cars (non-linear scaling 1 -> 4)
  const ownedCars = game.board.tiles.filter(
    (t) => t.type === "car" && ownership.get(t.id) === username
  );
  if (ownedCars.length > 0) {
    const carMultipliers = [1.0, 1.2, 1.45, 1.75];
    const mult = carMultipliers[Math.min(4, ownedCars.length) - 1] ?? 1.0;
    const faceSum = ownedCars.reduce((s, t) => s + (t.price ?? 0), 0);
    total += faceSum * mult;
  }

  // 3. Utilities / bonus-properties (scaling 1 -> 2)
  const ownedUtils = game.board.tiles.filter(
    (t) => t.type === "bonus-property" && ownership.get(t.id) === username
  );
  if (ownedUtils.length > 0) {
    const mult = ownedUtils.length >= 2 ? 1.3 : 0.9;
    const faceSum = ownedUtils.reduce((s, t) => s + (t.price ?? 0), 0);
    total += faceSum * mult;
  }

  return Math.round(total);
}

function getTileById(game: GameState, id: number): Tile | undefined {
  return game.board.tiles.find((t) => t.id === id);
}

/**
 * STRICTLY DETERMINISTIC (ZERO RANDOMNESS across EASY, MEDIUM, HARD) trade evaluator.
 *
 * Perspective in `Trade`:
 *   - `trade.from` GIVES `trade.given` + `trade.givenMoney` to `trade.to` (the bot).
 *   - `trade.from` RECEIVES `trade.received` + `trade.receivedMoney` from `trade.to` (the bot).
 * Therefore, from `bot` (`trade.to`)'s perspective:
 *   - Bot GAINS: `trade.given` (tiles) + `trade.givenMoney` (cash)
 *   - Bot LOSES: `trade.received` (tiles) + `trade.receivedMoney` (cash)
 */
export function evaluateIncomingTrade(
  game: GameState,
  bot: Player,
  trade: Trade
): TradeEvaluationResult {
  // 1. Validate participants
  if (!trade || trade.to !== bot.username || !trade.from || trade.from === bot.username) {
    return { accept: false, score: -Infinity, reason: "invalid_participants" };
  }

  const eliminated = new Set(game.eliminatedPlayers ?? []);
  if (eliminated.has(bot.username) || eliminated.has(trade.from)) {
    return { accept: false, score: -Infinity, reason: "eliminated_participant" };
  }

  const fromPlayer = game.players.find((p) => p.username === trade.from);
  if (!fromPlayer) {
    return { accept: false, score: -Infinity, reason: "sender_not_found" };
  }

  // 2. Validate payload structure, money bounds, and non-empty trade
  const given = Array.isArray(trade.given) ? trade.given : [];
  const received = Array.isArray(trade.received) ? trade.received : [];
  const givenMoney = Number(trade.givenMoney ?? 0);
  const receivedMoney = Number(trade.receivedMoney ?? 0);

  if (
    !Number.isFinite(givenMoney) ||
    !Number.isFinite(receivedMoney) ||
    givenMoney < 0 ||
    receivedMoney < 0
  ) {
    return { accept: false, score: -Infinity, reason: "invalid_money" };
  }

  if (fromPlayer.balance < givenMoney || bot.balance < receivedMoney) {
    return { accept: false, score: -Infinity, reason: "insufficient_funds" };
  }

  if (
    given.length === 0 &&
    received.length === 0 &&
    givenMoney === 0 &&
    receivedMoney === 0
  ) {
    return { accept: false, score: -Infinity, reason: "empty_trade" };
  }

  const givenSet = new Set(given);
  const receivedSet = new Set(received);
  if (givenSet.size !== given.length || receivedSet.size !== received.length) {
    return { accept: false, score: -Infinity, reason: "duplicate_tile_ids" };
  }
  for (const id of givenSet) {
    if (receivedSet.has(id)) {
      return { accept: false, score: -Infinity, reason: "overlapping_tile_ids" };
    }
  }

  // 3. Validate ownership & tradability (not mortgaged, not in an upgraded full set)
  const fullSetGroupIds = getFullSetGroupIds(game);
  const fromTradable = new Set(
    getPlayerTradableProperties(
      game.board.tiles,
      fullSetGroupIds,
      fromPlayer.username
    )
  );
  const botTradable = new Set(
    getPlayerTradableProperties(game.board.tiles, fullSetGroupIds, bot.username)
  );

  for (const tileId of given) {
    if (!fromTradable.has(tileId)) {
      return {
        accept: false,
        score: -Infinity,
        reason: "sender_property_not_tradable",
      };
    }
  }

  for (const tileId of received) {
    if (!botTradable.has(tileId)) {
      return {
        accept: false,
        score: -Infinity,
        reason: "bot_property_not_tradable",
      };
    }
  }

  // 4. Previously declined trade check (deterministic memory keyed by trade signature + board hash)
  if (isTradePreviouslyDeclined(game, trade)) {
    return { accept: false, score: -Infinity, reason: "previously_declined" };
  }

  const difficulty: BotDifficulty = bot.botDifficulty ?? "MEDIUM";
  const postBotBalance = bot.balance - receivedMoney + givenMoney;
  const postFromBalance = fromPlayer.balance - givenMoney + receivedMoney;

  // 5. Tier-specific deterministic evaluation
  if (difficulty === "EASY") {
    return evaluateEasyTrade(
      game,
      given,
      received,
      givenMoney,
      receivedMoney,
      postBotBalance
    );
  }

  if (difficulty === "MEDIUM") {
    return evaluateMediumTrade(
      game,
      bot,
      fromPlayer,
      given,
      received,
      givenMoney,
      receivedMoney,
      postBotBalance
    );
  }

  return evaluateHardTrade(
    game,
    bot,
    fromPlayer,
    trade,
    givenMoney,
    receivedMoney,
    postBotBalance,
    postFromBalance
  );
}

function evaluateEasyTrade(
  game: GameState,
  given: number[],
  received: number[],
  givenMoney: number,
  receivedMoney: number,
  postBotBalance: number
): TradeEvaluationResult {
  const gainedFaceValue = given.reduce(
    (sum, id) => sum + (getTileById(game, id)?.price ?? 0),
    0
  );
  const lostFaceValue = received.reduce(
    (sum, id) => sum + (getTileById(game, id)?.price ?? 0),
    0
  );

  const gainedTotal = gainedFaceValue + givenMoney;
  const lostTotal = lostFaceValue + receivedMoney;
  const threshold = lostTotal * 0.95;
  const score = Math.round(gainedTotal - threshold);

  const accept = postBotBalance >= 0 && gainedTotal > 0 && gainedTotal >= threshold;

  return {
    accept,
    score,
    reason: accept
      ? "easy_face_value_acceptable"
      : "easy_face_value_insufficient",
  };
}

function evaluateMediumTrade(
  game: GameState,
  bot: Player,
  fromPlayer: Player,
  given: number[],
  received: number[],
  givenMoney: number,
  receivedMoney: number,
  postBotBalance: number
): TradeEvaluationResult {
  const ownershipBefore = buildOwnershipMap(game);
  const ownershipAfter = applyTradeToOwnershipMap(ownershipBefore, {
    from: fromPlayer.username,
    to: bot.username,
    given,
    received,
  });

  const botFullBefore = new Set(
    getFullSetsFromOwnership(game, ownershipBefore, bot.username)
  );
  const botFullAfter = new Set(
    getFullSetsFromOwnership(game, ownershipAfter, bot.username)
  );
  const fromFullBefore = new Set(
    getFullSetsFromOwnership(game, ownershipBefore, fromPlayer.username)
  );
  const fromFullAfter = new Set(
    getFullSetsFromOwnership(game, ownershipAfter, fromPlayer.username)
  );

  let gainedTileValue = 0;
  for (const id of given) {
    const tile = getTileById(game, id);
    const price = tile?.price ?? 0;
    if (!tile || price <= 0) {
      continue;
    }

    let multiplier = 1.0;
    if (tile.type === "property" && tile.groupId != null) {
      const group = game.board.groups.find((g) => g.groupId === tile.groupId);
      if (group) {
        const countBefore = group.properties.filter(
          (pid) => ownershipBefore.get(pid) === bot.username
        ).length;
        const countAfter = group.properties.filter(
          (pid) => ownershipAfter.get(pid) === bot.username
        ).length;

        if (
          botFullAfter.has(tile.groupId) &&
          !botFullBefore.has(tile.groupId)
        ) {
          multiplier += 0.35;
        } else if (
          countAfter >= group.properties.length - 1 &&
          countBefore < group.properties.length - 1
        ) {
          multiplier += 0.15;
        }
      }
    } else if (tile.type === "car") {
      const carsAfter = game.board.tiles.filter(
        (t) => t.type === "car" && ownershipAfter.get(t.id) === bot.username
      ).length;
      if (carsAfter >= 2) {
        multiplier += 0.15;
      }
    } else if (tile.type === "bonus-property") {
      const utilsAfter = game.board.tiles.filter(
        (t) =>
          t.type === "bonus-property" &&
          ownershipAfter.get(t.id) === bot.username
      ).length;
      if (utilsAfter >= 2) {
        multiplier += 0.15;
      }
    }

    gainedTileValue += price * multiplier;
  }

  let lostTileValue = 0;
  for (const id of received) {
    const tile = getTileById(game, id);
    const price = tile?.price ?? 0;
    if (!tile || price <= 0) {
      continue;
    }

    let multiplier = 1.0;
    if (tile.type === "property" && tile.groupId != null) {
      const group = game.board.groups.find((g) => g.groupId === tile.groupId);
      if (group) {
        if (
          botFullBefore.has(tile.groupId) &&
          !botFullAfter.has(tile.groupId)
        ) {
          multiplier += 0.4;
        } else {
          const countBefore = group.properties.filter(
            (pid) => ownershipBefore.get(pid) === bot.username
          ).length;
          const countAfter = group.properties.filter(
            (pid) => ownershipAfter.get(pid) === bot.username
          ).length;
          if (
            countBefore >= group.properties.length - 1 &&
            countAfter < group.properties.length - 1
          ) {
            multiplier += 0.15;
          }
        }

        // Opponent set-completion penalty (-30% on lost tile price)
        if (
          fromFullAfter.has(tile.groupId) &&
          !fromFullBefore.has(tile.groupId)
        ) {
          multiplier += 0.3;
        }
      }
    }

    lostTileValue += price * multiplier;
  }

  const gainedTotal = gainedTileValue + givenMoney;
  const lostTotal = lostTileValue + receivedMoney;
  const score = Math.round(gainedTotal - lostTotal);

  const helpsLowCashBot = givenMoney > receivedMoney && postBotBalance >= 0;
  const hasLiquidity = postBotBalance >= 50 || helpsLowCashBot;

  if (!hasLiquidity) {
    return {
      accept: false,
      score: Math.min(score, -1),
      reason: "medium_insufficient_post_trade_cash",
    };
  }

  const accept = gainedTotal > 0 && score >= 0;
  return {
    accept,
    score,
    reason: accept ? "medium_favorable_trade" : "medium_unfavorable_trade",
  };
}

function evaluateHardTrade(
  game: GameState,
  bot: Player,
  fromPlayer: Player,
  trade: Trade,
  givenMoney: number,
  receivedMoney: number,
  postBotBalance: number,
  postFromBalance: number
): TradeEvaluationResult {
  const ownershipBefore = buildOwnershipMap(game);
  const ownershipAfter = applyTradeToOwnershipMap(ownershipBefore, trade);

  const botFullBefore = getFullSetsFromOwnership(
    game,
    ownershipBefore,
    bot.username
  );
  const botFullAfter = getFullSetsFromOwnership(
    game,
    ownershipAfter,
    bot.username
  );
  const fromFullBefore = getFullSetsFromOwnership(
    game,
    ownershipBefore,
    fromPlayer.username
  );
  const fromFullAfter = getFullSetsFromOwnership(
    game,
    ownershipAfter,
    fromPlayer.username
  );

  const botNewMonopolies = botFullAfter.filter(
    (g) => !botFullBefore.includes(g)
  );
  const botBrokenMonopolies = botFullBefore.filter(
    (g) => !botFullAfter.includes(g)
  );
  const fromNewMonopolies = fromFullAfter.filter(
    (g) => !fromFullBefore.includes(g)
  );

  const safetyReserve = getSafetyReserve(game, bot, "HARD");
  const fromSafetyReserve = getSafetyReserve(game, fromPlayer, "HARD");

  // Rule A: Never break an existing full set the bot owns unless getting a strictly superior full set + cash
  if (botBrokenMonopolies.length > 0) {
    const brokenPower = botBrokenMonopolies.reduce(
      (sum, g) => sum + computeGroupMonopolyPower(game, g),
      0
    );
    const newPower = botNewMonopolies.reduce(
      (sum, g) => sum + computeGroupMonopolyPower(game, g),
      0
    );
    const getsStrictlySuperiorSetAndCash =
      botNewMonopolies.length > 0 &&
      newPower > brokenPower &&
      givenMoney > receivedMoney;

    if (!getsStrictlySuperiorSetAndCash) {
      return {
        accept: false,
        score: -Math.max(100, brokenPower - newPower),
        reason: "hard_protects_existing_monopoly",
      };
    }
  }

  // Rule B: Opponent monopoly gate
  if (fromNewMonopolies.length > 0) {
    const fromMonoPower = fromNewMonopolies.reduce(
      (sum, g) => sum + computeGroupMonopolyPower(game, g),
      0
    );
    const botMonoPower = botNewMonopolies.reduce(
      (sum, g) => sum + computeGroupMonopolyPower(game, g),
      0
    );

    if (botNewMonopolies.length === 0) {
      return {
        accept: false,
        score: -Math.max(100, fromMonoPower),
        reason: "hard_refuses_opponent_monopoly",
      };
    }

    if (botMonoPower < fromMonoPower * 0.9) {
      return {
        accept: false,
        score: Math.round(botMonoPower - fromMonoPower),
        reason: "hard_opponent_monopoly_stronger",
      };
    }

    if (postBotBalance < safetyReserve) {
      return {
        accept: false,
        score: postBotBalance - safetyReserve,
        reason: "hard_insufficient_cash_to_upgrade_after_mutual_monopoly",
      };
    }
  }

  // Rule C: Liquidity protection
  if (postBotBalance < 0) {
    return {
      accept: false,
      score: postBotBalance,
      reason: "hard_negative_balance",
    };
  }

  if (receivedMoney > givenMoney) {
    const minCashAfterSpending =
      botNewMonopolies.length > 0
        ? Math.min(safetyReserve, Math.max(80, Math.round(safetyReserve * 0.6)))
        : safetyReserve;

    if (postBotBalance < minCashAfterSpending) {
      return {
        accept: false,
        score: postBotBalance - minCashAfterSpending,
        reason: "hard_below_safety_reserve",
      };
    }
  }

  // Rule D: Full portfolio strategic delta (bot gain minus weighted opponent strategic gain)
  const botPortfolioBefore = computePlayerPortfolioValue(
    game,
    ownershipBefore,
    bot.username,
    bot.balance,
    safetyReserve
  );
  const botPortfolioAfter = computePlayerPortfolioValue(
    game,
    ownershipAfter,
    bot.username,
    postBotBalance,
    safetyReserve
  );

  const fromPortfolioBefore = computePlayerPortfolioValue(
    game,
    ownershipBefore,
    fromPlayer.username,
    fromPlayer.balance,
    fromSafetyReserve
  );
  const fromPortfolioAfter = computePlayerPortfolioValue(
    game,
    ownershipAfter,
    fromPlayer.username,
    postFromBalance,
    fromSafetyReserve
  );

  const botDelta =
    botPortfolioAfter + postBotBalance - (botPortfolioBefore + bot.balance);
  const fromDelta =
    fromPortfolioAfter +
    postFromBalance -
    (fromPortfolioBefore + fromPlayer.balance);

  const opponentWeight = fromNewMonopolies.length > 0 ? 0.5 : 0.35;
  const netScore = Math.round(botDelta - opponentWeight * Math.max(0, fromDelta));

  const accept = netScore > 0;
  return {
    accept,
    score: netScore,
    reason: accept ? "hard_strategic_advantage" : "hard_insufficient_advantage",
  };
}
