import type { BotDifficulty, GameState, Player, Tile, Trade } from "~/types";
import { isTradePreviouslyDeclined } from "~/shared/utils/tradeSignature";
import { getPlayerTradableProperties } from "~/utils/getPlayerTradableProperties";
import {
  getActionReserve,
  getFullSetGroupIds,
  getGroupStrategicMultiplier,
  getGroupTiles,
  getSafetyReserve,
  isOpponentLeading,
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

  // 2. Cars (non-linear scaling 1 -> 4; 3–4 cars are high-impact rent engines)
  const ownedCars = game.board.tiles.filter(
    (t) => t.type === "car" && ownership.get(t.id) === username
  );
  if (ownedCars.length > 0) {
    const carMultipliers = [1.1, 1.35, 1.75, 2.25];
    const mult = carMultipliers[Math.min(4, ownedCars.length) - 1] ?? 1.1;
    const faceSum = ownedCars.reduce((s, t) => s + (t.price ?? 0), 0);
    total += faceSum * mult;
  }

  // 3. Utilities / bonus-properties (scaling 1 -> 2; 2/2 = 10x dice roll rent)
  const ownedUtils = game.board.tiles.filter(
    (t) => t.type === "bonus-property" && ownership.get(t.id) === username
  );
  if (ownedUtils.length > 0) {
    const mult = ownedUtils.length >= 2 ? 1.85 : 1.1;
    const faceSum = ownedUtils.reduce((s, t) => s + (t.price ?? 0), 0);
    total += faceSum * mult;
  }

  return Math.round(total);
}

export function countSpecialTilesFromOwnership(
  game: GameState,
  ownership: Map<number, string>,
  username: string,
  tileType: "car" | "bonus-property"
): number {
  let count = 0;
  for (const tile of game.board.tiles) {
    if (tile.type === tileType && ownership.get(tile.id) === username) {
      count += 1;
    }
  }
  return count;
}

/**
 * Protects high-value special sets (2/2 Energy Utilities = 10x dice rent,
 * and 3–4 Cars = $100–$200 rent across 3–4 board tiles) on MEDIUM and HARD
 * from being sold/broken or gifted to opponents for cash alone.
 */
function evaluateSpecialSetGate(
  game: GameState,
  ownershipBefore: Map<number, string>,
  ownershipAfter: Map<number, string>,
  botUsername: string,
  fromUsername: string,
  botNewMonopolies: number[],
  difficultyPrefix: "medium" | "hard"
): TradeEvaluationResult | null {
  const botUtilsBefore = countSpecialTilesFromOwnership(
    game,
    ownershipBefore,
    botUsername,
    "bonus-property"
  );
  const botUtilsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    botUsername,
    "bonus-property"
  );
  const fromUtilsBefore = countSpecialTilesFromOwnership(
    game,
    ownershipBefore,
    fromUsername,
    "bonus-property"
  );
  const fromUtilsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    fromUsername,
    "bonus-property"
  );

  const botCarsBefore = countSpecialTilesFromOwnership(
    game,
    ownershipBefore,
    botUsername,
    "car"
  );
  const botCarsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    botUsername,
    "car"
  );
  const fromCarsBefore = countSpecialTilesFromOwnership(
    game,
    ownershipBefore,
    fromUsername,
    "car"
  );
  const fromCarsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    fromUsername,
    "car"
  );

  const botGainsColorMono = botNewMonopolies.length > 0;
  const botGainsStrongCars =
    botCarsAfter >= 3 && botCarsAfter > botCarsBefore;

  // 1. Never break/sell bot's own 2/2 Energy Utilities (10x) without receiving a color monopoly or 3+ Cars
  if (botUtilsBefore >= 2 && botUtilsAfter < 2) {
    if (!botGainsColorMono && !botGainsStrongCars) {
      return {
        accept: false,
        score: -300,
        reason: `${difficultyPrefix}_protects_utility_set`,
      };
    }
  }

  // 2. Never break/sell bot's own 3–4 Car stack without receiving a color monopoly
  if (botCarsBefore >= 3 && botCarsAfter < botCarsBefore) {
    if (!botGainsColorMono) {
      return {
        accept: false,
        score: -400,
        reason: `${difficultyPrefix}_protects_car_set`,
      };
    }
  }

  // 3. Never gift opponent 3–4 Cars unless bot receives a color monopoly
  if (fromCarsAfter >= 3 && fromCarsAfter > fromCarsBefore) {
    if (!botGainsColorMono) {
      return {
        accept: false,
        score: -400,
        reason: `${difficultyPrefix}_refuses_opponent_car_set`,
      };
    }
  }

  // 4. Never gift opponent 2/2 Energy Utilities (10x) unless bot receives a color monopoly or 3+ Cars
  if (fromUtilsBefore < 2 && fromUtilsAfter >= 2) {
    if (!botGainsColorMono && !botGainsStrongCars) {
      return {
        accept: false,
        score: -300,
        reason: `${difficultyPrefix}_refuses_opponent_utility_set`,
      };
    }
  }

  return null;
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

  const botNewMonopolies = [...botFullAfter].filter((g) => !botFullBefore.has(g));
  const botBrokenMonopolies = [...botFullBefore].filter((g) => !botFullAfter.has(g));
  const fromNewMonopolies = [...fromFullAfter].filter((g) => !fromFullBefore.has(g));

  // Strict monopoly gate (Idea A): MEDIUM bots never break a full set for cash only (even 2x+)
  if (botBrokenMonopolies.length > 0) {
    const brokenPower = botBrokenMonopolies.reduce(
      (sum, g) => sum + computeGroupMonopolyPower(game, g),
      0
    );
    const newPower = botNewMonopolies.reduce(
      (sum, g) => sum + computeGroupMonopolyPower(game, g),
      0
    );
    const netCash = givenMoney - receivedMoney;
    const gainsComparableSet =
      botNewMonopolies.length > 0 &&
      newPower + Math.max(0, netCash) * 1.2 >= brokenPower;

    if (!gainsComparableSet) {
      return {
        accept: false,
        score: -Math.max(100, brokenPower - newPower),
        reason: "medium_protects_existing_monopoly",
      };
    }
  }

  // Strict monopoly gate (Idea A): MEDIUM bots never sell a set-completing tile for cash only (even 2x+)
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
        reason: "medium_refuses_opponent_monopoly",
      };
    }

    const netCash = givenMoney - receivedMoney;
    const extraToBotVal = given.reduce((sum, id) => {
      const t = getTileById(game, id);
      if (!t || (t.type === "property" && t.groupId != null && botNewMonopolies.includes(t.groupId))) {
        return sum;
      }
      return sum + (t.price ?? 0);
    }, 0);
    const extraToFromVal = received.reduce((sum, id) => {
      const t = getTileById(game, id);
      if (!t || (t.type === "property" && t.groupId != null && fromNewMonopolies.includes(t.groupId))) {
        return sum;
      }
      return sum + (t.price ?? 0);
    }, 0);
    const effectiveBotPower =
      botMonoPower + Math.max(0, netCash) * 1.25 + extraToBotVal * 0.9;
    const effectiveFromPower =
      fromMonoPower + Math.max(0, -netCash) * 1.1 + extraToFromVal * 0.85;
    if (effectiveBotPower < effectiveFromPower * 0.85) {
      return {
        accept: false,
        score: Math.round(effectiveBotPower - effectiveFromPower),
        reason: "medium_opponent_monopoly_stronger",
      };
    }
  }

  const specialGateResult = evaluateSpecialSetGate(
    game,
    ownershipBefore,
    ownershipAfter,
    bot.username,
    fromPlayer.username,
    botNewMonopolies,
    "medium"
  );
  if (specialGateResult) {
    return specialGateResult;
  }

  const botCarsBefore = countSpecialTilesFromOwnership(
    game,
    ownershipBefore,
    bot.username,
    "car"
  );
  const botCarsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    bot.username,
    "car"
  );
  const fromCarsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    fromPlayer.username,
    "car"
  );
  const botUtilsBefore = countSpecialTilesFromOwnership(
    game,
    ownershipBefore,
    bot.username,
    "bonus-property"
  );
  const botUtilsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    bot.username,
    "bonus-property"
  );
  const fromUtilsAfter = countSpecialTilesFromOwnership(
    game,
    ownershipAfter,
    fromPlayer.username,
    "bonus-property"
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
      if (botCarsAfter >= 4) {
        multiplier += 0.45;
      } else if (botCarsAfter >= 3) {
        multiplier += 0.3;
      } else if (botCarsAfter >= 2) {
        multiplier += 0.18;
      }
    } else if (tile.type === "bonus-property") {
      if (botUtilsAfter >= 2) {
        multiplier += 0.35;
      } else {
        multiplier += 0.1;
      }
    }

    gainedTileValue += price * multiplier;
  }

  const isPureCashSale = given.length === 0 && received.length > 0;
  const mediumSafetyReserve = getSafetyReserve(game, bot, "MEDIUM");
  const botIsCashComfortable = bot.balance >= mediumSafetyReserve;

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

        const fromCountBefore = group.properties.filter(
          (pid) => ownershipBefore.get(pid) === fromPlayer.username
        ).length;
        const fromCountAfter = group.properties.filter(
          (pid) => ownershipAfter.get(pid) === fromPlayer.username
        ).length;

        // Opponent set-completion penalty (-30% on lost tile price)
        if (
          fromFullAfter.has(tile.groupId) &&
          !fromFullBefore.has(tile.groupId)
        ) {
          multiplier += 0.3;
        } else if (
          fromCountAfter >= 2 &&
          fromCountAfter > fromCountBefore
        ) {
          // Opponent advancing from 1/3 -> 2/3 (dangerous set buildup)
          multiplier += isPureCashSale && botIsCashComfortable ? 0.55 : 0.2;
        }

        // Rich bots don't dump color deeds for small pure-cash markups (+$20)
        if (isPureCashSale && botIsCashComfortable && multiplier < 1.35) {
          multiplier = 1.35;
        }
      }
    } else if (tile.type === "car") {
      // Cars scale non-linearly ($25/$50/$100/$200) — never sell cheaply at 1.0x face value
      multiplier = 1.25;
      if (botCarsBefore >= 3) {
        multiplier += 0.45;
      } else if (botCarsBefore >= 2) {
        multiplier += 0.25;
      }
      if (fromCarsAfter >= 3) {
        multiplier += 0.55;
      } else if (fromCarsAfter >= 2) {
        multiplier += 0.3;
      }
      if (isPureCashSale && botIsCashComfortable && multiplier < 1.45) {
        multiplier = 1.45;
      }
    } else if (tile.type === "bonus-property") {
      // Energy Utilities (4x -> 10x dice) are high-value special tiles
      multiplier = 1.25;
      if (botUtilsBefore >= 2) {
        multiplier += 0.55;
      }
      if (fromUtilsAfter >= 2) {
        multiplier += 0.55;
      }
      if (isPureCashSale && botIsCashComfortable && multiplier < 1.45) {
        multiplier = 1.45;
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
  const tradeReserve = getActionReserve(game, bot, "HARD", "trade");
  const fromSafetyReserve = getSafetyReserve(game, fromPlayer, "HARD");
  const oppIsLeader = isOpponentLeading(game, bot.username, fromPlayer.username);

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

  // Rule B: Opponent monopoly gate (with cash-balanced mutual swaps & leader awareness)
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

    // Allow cash and sweetener properties to balance unequal mutual monopoly swaps
    const netCashGain = givenMoney - receivedMoney;
    const extraToBotVal = trade.given.reduce((sum, id) => {
      const t = getTileById(game, id);
      if (!t || (t.type === "property" && t.groupId != null && botNewMonopolies.includes(t.groupId))) {
        return sum;
      }
      return sum + (t.price ?? 0);
    }, 0);
    const extraToFromVal = trade.received.reduce((sum, id) => {
      const t = getTileById(game, id);
      if (!t || (t.type === "property" && t.groupId != null && fromNewMonopolies.includes(t.groupId))) {
        return sum;
      }
      return sum + (t.price ?? 0);
    }, 0);
    const effectiveBotPower =
      botMonoPower + Math.max(0, netCashGain) * 1.35 + extraToBotVal * 0.95;
    const effectiveFromPower =
      fromMonoPower + Math.max(0, -netCashGain) * 1.15 + extraToFromVal * 0.9;

    // Do not feed a runaway leader who already holds a monopoly unless clearly winning the swap
    const oppIsRunawayLeader = oppIsLeader && fromFullBefore.length >= 1;
    const requiredRatio = oppIsRunawayLeader ? 1.15 : 0.9;

    if (effectiveBotPower < effectiveFromPower * requiredRatio) {
      return {
        accept: false,
        score: Math.round(effectiveBotPower - effectiveFromPower),
        reason: oppIsRunawayLeader
          ? "hard_refuses_feeding_leader"
          : "hard_opponent_monopoly_stronger",
      };
    }

    // Require enough cash to immediately start building houses on the new monopoly
    const cheapestNewSetUpgrade = Math.min(
      ...botNewMonopolies.map(
        (g) =>
          game.board.groups.find((gr) => gr.groupId === g)?.upgradePrice ?? 100
      )
    );
    const minUpgradeCash = Math.min(
      safetyReserve,
      Math.max(100, cheapestNewSetUpgrade)
    );
    if (postBotBalance < minUpgradeCash) {
      return {
        accept: false,
        score: postBotBalance - minUpgradeCash,
        reason: "hard_insufficient_cash_to_upgrade_after_mutual_monopoly",
      };
    }
  }

  // Rule B2: Special-set protection (2/2 Energy Utilities = 10x, 3–4 Cars = $100–$200)
  const specialGateResult = evaluateSpecialSetGate(
    game,
    ownershipBefore,
    ownershipAfter,
    bot.username,
    fromPlayer.username,
    botNewMonopolies,
    "hard"
  );
  if (specialGateResult) {
    return specialGateResult;
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
        ? Math.min(tradeReserve, Math.max(50, Math.round(tradeReserve * 0.45)))
        : tradeReserve;

    if (postBotBalance < minCashAfterSpending) {
      return {
        accept: false,
        score: postBotBalance - minCashAfterSpending,
        reason: "hard_below_safety_reserve",
      };
    }
  }

  // Rule C2: Financially comfortable HARD bots refuse cheap pure-cash buyouts (e.g. $120 for a $100 deed)
  if (
    trade.given.length === 0 &&
    trade.received.length > 0 &&
    bot.balance >= safetyReserve
  ) {
    let minPureCashRequired = 0;
    for (const id of trade.received) {
      const tile = getTileById(game, id);
      const price = tile?.price ?? 0;
      if (!tile || price <= 0) {
        continue;
      }

      let requiredMult = 1.4;
      if (tile.type === "property" && tile.groupId != null) {
        const group = game.board.groups.find((g) => g.groupId === tile.groupId);
        if (group) {
          const fromCountBefore = group.properties.filter(
            (pid) => ownershipBefore.get(pid) === fromPlayer.username
          ).length;
          const fromCountAfter = group.properties.filter(
            (pid) => ownershipAfter.get(pid) === fromPlayer.username
          ).length;
          if (fromCountAfter >= 2 && fromCountAfter > fromCountBefore) {
            // Advancing opponent to 2/3 of a color set for pure cash requires a real premium
            requiredMult = 1.6;
          }
        }
      } else if (tile.type === "car" || tile.type === "bonus-property") {
        requiredMult = 1.55;
      }

      minPureCashRequired += price * requiredMult;
    }

    if (givenMoney < minPureCashRequired) {
      return {
        accept: false,
        score: Math.round(givenMoney - minPureCashRequired),
        reason: "hard_refuses_cheap_cash_buyout",
      };
    }
  }

  // Rule D: Full portfolio strategic delta (bot gain minus leader-aware opponent strategic gain)
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

  const opponentWeight =
    fromNewMonopolies.length > 0
      ? oppIsLeader
        ? 0.65
        : 0.5
      : oppIsLeader
        ? 0.45
        : 0.35;
  const netScore = Math.round(botDelta - opponentWeight * Math.max(0, fromDelta));

  const accept = netScore > 0;
  return {
    accept,
    score: netScore,
    reason: accept ? "hard_strategic_advantage" : "hard_insufficient_advantage",
  };
}
