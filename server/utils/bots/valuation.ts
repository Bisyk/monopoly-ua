import type { BotDifficulty, GameState, Group, Player, Tile } from "~/types";

export const OWNABLE_TILE_TYPES = new Set([
  "property",
  "car",
  "bonus-property",
]);

/**
 * Strategic group multipliers reflecting classic Monopoly landing probability
 * and house-upgrade ROI across defaultPropertyGroups (groups 1..8).
 */
export const GROUP_STRATEGIC_MULTIPLIERS: Record<number, number> = {
  1: 1.05, // tiles 2, 4 (2-tile set, low rent ceiling)
  2: 1.12, // tiles 7, 9, 10 (cheap upgrades, solid early ROI)
  3: 1.2, // tiles 12, 14, 15 (post-jail strong landing rate)
  4: 1.35, // tiles 17, 19, 20 (orange-equivalent, highest ROI)
  5: 1.3, // tiles 22, 24, 25 (red-equivalent, top-tier landing rate)
  6: 1.2, // tiles 27, 28, 30 (yellow-equivalent, strong mid/late rent)
  7: 1.12, // tiles 32, 33, 35 (green-equivalent, high rent, expensive builds)
  8: 1.1, // tiles 38, 40 (2-tile set, lethal late game, lower hit rate)
};

export type GameStage = "early" | "mid" | "late";

export interface OpponentRentThreat {
  maxRent: number;
  averageRent: number;
  expectedLandingRent: number;
}

export interface LiquidationPlan {
  action: "SELL_PROPERTY" | "MORTGAGE_PROPERTY";
  propertyId: number;
  cashGained: number;
}

export function isOwnableTile(tile: Tile): boolean {
  return OWNABLE_TILE_TYPES.has(tile.type);
}

export function getOwnableTiles(game: GameState): Tile[] {
  return game.board.tiles.filter(isOwnableTile);
}

export function getGroupStrategicMultiplier(groupId?: number | null): number {
  if (groupId == null) {
    return 1.0;
  }
  return GROUP_STRATEGIC_MULTIPLIERS[groupId] ?? 1.0;
}

export function getGroupTiles(game: GameState, group: Group): Tile[] {
  return group.properties
    .map((id) => game.board.tiles.find((t) => t.id === id))
    .filter((t): t is Tile => Boolean(t));
}

/**
 * Returns all group IDs where every tile in the group is owned by the same player
 * (or marked isFullSet on the board state).
 */
export function getFullSetGroupIds(game: GameState): number[] {
  const fullSetIds: number[] = [];

  for (const group of game.board.groups) {
    const tiles = getGroupTiles(game, group);
    if (!tiles.length) {
      continue;
    }

    const firstOwner = tiles[0].owner;
    const allOwnedBySame =
      Boolean(firstOwner) && tiles.every((t) => t.owner === firstOwner);

    if (allOwnedBySame || group.isFullSet) {
      fullSetIds.push(group.groupId);
    }
  }

  return fullSetIds;
}

/**
 * Returns group IDs where `username` owns every tile in the group.
 */
export function getPlayerFullSetGroupIds(
  game: GameState,
  username: string
): number[] {
  const result: number[] = [];

  for (const group of game.board.groups) {
    const tiles = getGroupTiles(game, group);
    if (tiles.length > 0 && tiles.every((t) => t.owner === username)) {
      result.push(group.groupId);
    }
  }

  return result;
}

export function getUnownedTileFraction(game: GameState): number {
  const ownable = getOwnableTiles(game);
  if (!ownable.length) {
    return 0;
  }
  const unownedCount = ownable.filter((t) => !t.owner).length;
  return unownedCount / ownable.length;
}

export function getGameStage(game: GameState): GameStage {
  const unownedFraction = getUnownedTileFraction(game);

  let upgradedTiles = 0;
  let totalHouses = 0;
  for (const tile of game.board.tiles) {
    if (tile.type === "property" && (tile.rentLevel ?? 0) > 0) {
      upgradedTiles += 1;
      totalHouses += tile.rentLevel ?? 0;
    }
  }

  const fullSetCount = getFullSetGroupIds(game).length;

  if (
    totalHouses >= 4 ||
    upgradedTiles >= 3 ||
    (unownedFraction <= 0.15 && (fullSetCount >= 1 || totalHouses >= 1))
  ) {
    return "late";
  }

  if (unownedFraction >= 0.45 && totalHouses === 0) {
    return "early";
  }

  return "mid";
}

export function getTileActiveRent(
  tile: Tile,
  diceSum: number = 7
): number {
  if (!tile.owner || tile.mortgaged || !tile.rentLevels?.length) {
    return 0;
  }

  const level = Math.max(
    0,
    Math.min(tile.rentLevel ?? 0, tile.rentLevels.length - 1)
  );
  const baseRent = tile.rentLevels[level] ?? 0;

  if (tile.type === "bonus-property") {
    return baseRent * diceSum;
  }

  return baseRent;
}

export function getMaxOpponentRent(
  game: GameState,
  username: string
): OpponentRentThreat {
  const eliminated = new Set(game.eliminatedPlayers ?? []);
  let maxRent = 0;
  let totalRent = 0;
  let activeCount = 0;

  for (const tile of game.board.tiles) {
    if (
      !isOwnableTile(tile) ||
      !tile.owner ||
      tile.owner === username ||
      eliminated.has(tile.owner) ||
      tile.mortgaged
    ) {
      continue;
    }

    const rent = getTileActiveRent(tile, 7);
    if (rent > maxRent) {
      maxRent = rent;
    }
    totalRent += rent;
    activeCount += 1;
  }

  const averageRent = activeCount > 0 ? Math.round(totalRent / activeCount) : 0;
  const expectedLandingRent = Math.round(totalRent / 40);

  return {
    maxRent,
    averageRent,
    expectedLandingRent,
  };
}

export const DICE_2D6_PROB: Record<number, number> = {
  2: 1 / 36,
  3: 2 / 36,
  4: 3 / 36,
  5: 4 / 36,
  6: 5 / 36,
  7: 6 / 36,
  8: 5 / 36,
  9: 4 / 36,
  10: 3 / 36,
  11: 2 / 36,
  12: 1 / 36,
};

export interface ForwardBoardRisk {
  expectedRentAhead: number;
  maxRentAhead: number;
  probPassGo: number;
  expectedUnownedAhead: number;
}

export type ReservePurpose =
  | "upgrade"
  | "unmortgage_full_set"
  | "unmortgage"
  | "buy"
  | "auction"
  | "trade";

export function getBotRiskLevel(bot: Player): number {
  if (typeof bot.botRiskLevel === "number" && Number.isFinite(bot.botRiskLevel)) {
    return Math.max(0, Math.min(1, bot.botRiskLevel));
  }
  return 0.5;
}

export function getForwardBoardRisk(
  game: GameState,
  bot: Player,
  fromPosition?: number
): ForwardBoardRisk {
  const pos = fromPosition ?? bot.position ?? 1;
  const eliminated = new Set(game.eliminatedPlayers ?? []);
  const tileById = new Map<number, Tile>();
  for (const tile of game.board.tiles) {
    tileById.set(tile.id, tile);
  }

  let expectedRentAhead = 0;
  let maxRentAhead = 0;
  let probPassGo = 0;
  let expectedUnownedAhead = 0;

  for (let steps = 2; steps <= 12; steps++) {
    const prob = DICE_2D6_PROB[steps] ?? 0;
    if (pos + steps > 40) {
      probPassGo += prob;
    }

    const landingId = ((pos - 1 + steps) % 40) + 1;
    const tile = tileById.get(landingId);
    if (!tile) {
      continue;
    }

    if (tile.type === "tax" && typeof tile.taxAmount === "number") {
      expectedRentAhead += prob * tile.taxAmount;
      if (tile.taxAmount > maxRentAhead) {
        maxRentAhead = tile.taxAmount;
      }
      continue;
    }

    if (!isOwnableTile(tile)) {
      continue;
    }

    if (!tile.owner) {
      expectedUnownedAhead += prob;
      continue;
    }

    if (
      tile.owner !== bot.username &&
      !eliminated.has(tile.owner) &&
      !tile.mortgaged
    ) {
      const rent = getTileActiveRent(tile, steps);
      expectedRentAhead += prob * rent;
      if (rent > maxRentAhead) {
        maxRentAhead = rent;
      }
    }
  }

  return {
    expectedRentAhead: Math.round(expectedRentAhead),
    maxRentAhead,
    probPassGo,
    expectedUnownedAhead,
  };
}

export function getOpponentLandingProbabilityOnTile(
  game: GameState,
  tileId: number,
  ownerUsername: string
): number {
  const eliminated = new Set(game.eliminatedPlayers ?? []);
  let totalProb = 0;

  for (const player of game.players) {
    if (
      player.username === ownerUsername ||
      eliminated.has(player.username)
    ) {
      continue;
    }

    const dist = (tileId - player.position + 40) % 40;
    if (dist < 2 || dist > 12) {
      continue;
    }

    const baseProb = DICE_2D6_PROB[dist] ?? 0;
    // Jailed opponents may pay out or roll doubles onto tiles 13..23; discount moderately
    totalProb += player.jailed ? baseProb * 0.45 : baseProb;
  }

  return totalProb;
}

export function getGroupIncomingOpponentThreat(
  game: GameState,
  groupId: number | null | undefined,
  ownerUsername: string
): number {
  if (groupId == null) {
    return 0;
  }
  const group = game.board.groups.find((g) => g.groupId === groupId);
  if (!group) {
    return 0;
  }

  let total = 0;
  for (const tileId of group.properties) {
    total += getOpponentLandingProbabilityOnTile(game, tileId, ownerUsername);
  }
  return total;
}

export function getPlayerNetWorth(game: GameState, username: string): number {
  const player = game.players.find((p) => p.username === username);
  if (!player) {
    return 0;
  }

  let worth = player.balance;
  const fullSets = new Set(getPlayerFullSetGroupIds(game, username));

  for (const tile of game.board.tiles) {
    if (tile.owner !== username || !isOwnableTile(tile)) {
      continue;
    }
    const basePrice = tile.price ?? 0;
    worth += tile.mortgaged
      ? tile.mortgagePrice ?? Math.round(basePrice * 0.5)
      : basePrice;

    if (tile.type === "property" && (tile.rentLevel ?? 0) > 0) {
      const group = game.board.groups.find((g) => g.groupId === tile.groupId);
      worth += (tile.rentLevel ?? 0) * (group?.upgradePrice ?? 100);
    }
  }

  for (const groupId of fullSets) {
    worth += Math.round(300 * getGroupStrategicMultiplier(groupId));
  }

  return Math.round(worth);
}

export function isOpponentLeading(
  game: GameState,
  botUsername: string,
  oppUsername: string
): boolean {
  const eliminated = new Set(game.eliminatedPlayers ?? []);
  const activePlayers = game.players.filter((p) => !eliminated.has(p.username));
  if (activePlayers.length < 2) {
    return false;
  }

  let topUsername = "";
  let topWorth = -Infinity;
  let botWorth = 0;
  let oppWorth = 0;

  for (const p of activePlayers) {
    const w = getPlayerNetWorth(game, p.username);
    if (w > topWorth) {
      topWorth = w;
      topUsername = p.username;
    }
    if (p.username === botUsername) {
      botWorth = w;
    }
    if (p.username === oppUsername) {
      oppWorth = w;
    }
  }

  if (topUsername !== oppUsername) {
    return false;
  }

  const botMonos = getPlayerFullSetGroupIds(game, botUsername).length;
  const oppMonos = getPlayerFullSetGroupIds(game, oppUsername).length;

  return (
    (oppMonos >= 1 && oppMonos > botMonos) ||
    oppWorth >= Math.max(botWorth * 1.2, botWorth + 350)
  );
}

export function getMortgageableNonSetValue(
  game: GameState,
  bot: Player
): number {
  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));
  let total = 0;

  for (const tile of game.board.tiles) {
    if (
      tile.owner !== bot.username ||
      !isOwnableTile(tile) ||
      tile.mortgaged ||
      typeof tile.mortgagePrice !== "number" ||
      tile.mortgagePrice <= 0
    ) {
      continue;
    }
    if (
      tile.type === "property" &&
      tile.groupId != null &&
      botFullSets.has(tile.groupId)
    ) {
      continue;
    }
    total += tile.mortgagePrice;
  }

  return total;
}

export function getSafetyReserve(
  game: GameState,
  bot: Player,
  difficulty: BotDifficulty
): number {
  if (difficulty === "EASY") {
    return 50;
  }

  const risk = getBotRiskLevel(bot);

  if (difficulty === "MEDIUM") {
    // 0.0 cautious -> ~175, 0.5 balanced -> ~115, 1.0 reckless -> ~30
    return Math.max(20, Math.round(175 - risk * 145));
  }

  const stage = getGameStage(game);
  const { maxRent } = getMaxOpponentRent(game, bot.username);

  let baseReserve: number;
  if (stage === "early") {
    baseReserve = Math.min(160, Math.max(90, Math.round(maxRent * 0.35)));
  } else if (stage === "mid") {
    baseReserve = Math.min(300, Math.max(120, Math.round(maxRent * 0.42)));
  } else {
    baseReserve = Math.min(440, Math.max(160, Math.round(maxRent * 0.52)));
  }

  // Risk factor: 0.0 cautious -> 1.15x, 0.5 balanced -> 0.725x, 1.0 reckless -> 0.30x
  const riskScale = 1.15 - risk * 0.85;
  return Math.max(20, Math.round(baseReserve * riskScale));
}

export function getActionReserve(
  game: GameState,
  bot: Player,
  difficulty: BotDifficulty,
  purpose: ReservePurpose
): number {
  if (difficulty === "EASY") {
    return purpose === "unmortgage_full_set" ? 20 : 50;
  }

  const risk = getBotRiskLevel(bot);
  const baseReserve = getSafetyReserve(game, bot, difficulty);
  const forward = getForwardBoardRisk(game, bot);
  const goCushion = Math.round(forward.probPassGo * 150);

  if (purpose === "unmortgage_full_set") {
    // Unlocking a full set for building is top priority; keep only a tiny floor
    return Math.max(0, Math.round((1 - risk) * 60 - goCushion * 0.5));
  }

  if (purpose === "upgrade") {
    const fallbackMortgage = getMortgageableNonSetValue(game, bot);
    const immediateDanger = Math.max(
      forward.expectedRentAhead,
      Math.round(forward.maxRentAhead * 0.4)
    );

    // High-risk bots spend right down to $0 on upgrades when ahead looks survivable or GO is near
    if (
      risk >= 0.7 ||
      (risk >= 0.55 && (forward.maxRentAhead <= 160 || forward.probPassGo >= 0.35))
    ) {
      if (
        forward.maxRentAhead <= 180 ||
        forward.probPassGo >= 0.4 ||
        fallbackMortgage >= immediateDanger
      ) {
        return 0;
      }
      return Math.max(0, Math.round(immediateDanger * (1 - risk) - goCushion));
    }

    // Balanced / cautious bots still build much faster than static hoarding, modulated by forward risk
    const dynamicNeed = Math.round(
      immediateDanger * (1.25 - risk * 0.9) - goCushion
    );
    const floor =
      risk < 0.25 && forward.maxRentAhead >= 200
        ? Math.round(baseReserve * 0.65)
        : 0;
    return Math.max(floor, Math.min(baseReserve, Math.max(0, dynamicNeed)));
  }

  if (purpose === "buy" || purpose === "auction") {
    const stage = getGameStage(game);
    if (stage === "early") {
      return Math.max(0, Math.round((1 - risk) * 65 - goCushion * 0.4));
    }
    if (stage === "mid") {
      return Math.max(
        0,
        Math.round(baseReserve * (0.55 - risk * 0.4) - goCushion * 0.4)
      );
    }
    return Math.max(
      0,
      Math.round(baseReserve * (0.75 - risk * 0.45) - goCushion * 0.4)
    );
  }

  if (purpose === "unmortgage") {
    return Math.max(20, Math.round(baseReserve * (0.85 - risk * 0.3)));
  }

  return baseReserve;
}

export function doesTileCompleteSet(
  game: GameState,
  tile: Tile,
  username: string
): boolean {
  if (tile.type !== "property" || tile.groupId == null) {
    return false;
  }

  const group = game.board.groups.find((g) => g.groupId === tile.groupId);
  if (!group) {
    return false;
  }

  const otherIds = group.properties.filter((id) => id !== tile.id);
  if (!otherIds.length) {
    return false;
  }

  return otherIds.every((id) => {
    const other = game.board.tiles.find((t) => t.id === id);
    return other?.owner === username;
  });
}

export function doesTileBlockOpponentSet(
  game: GameState,
  tile: Tile,
  username: string
): boolean {
  if (tile.type !== "property" || tile.groupId == null) {
    return false;
  }

  const group = game.board.groups.find((g) => g.groupId === tile.groupId);
  if (!group) {
    return false;
  }

  const otherTiles = group.properties
    .filter((id) => id !== tile.id)
    .map((id) => game.board.tiles.find((t) => t.id === id))
    .filter((t): t is Tile => Boolean(t));

  if (!otherTiles.length) {
    return false;
  }

  const firstOwner = otherTiles[0].owner;
  return (
    Boolean(firstOwner) &&
    firstOwner !== username &&
    otherTiles.every((t) => t.owner === firstOwner)
  );
}

export function doesTileCompleteOrBlockSet(
  game: GameState,
  tile: Tile,
  username: string
): boolean {
  return (
    doesTileCompleteSet(game, tile, username) ||
    doesTileBlockOpponentSet(game, tile, username)
  );
}

/**
 * Deterministic intrinsic + synergy strategic value of a tile from `perspectiveUsername`'s view.
 */
export function evaluateTileStrategicValue(
  game: GameState,
  tile: Tile,
  perspectiveUsername: string
): number {
  const basePrice = tile.price ?? 0;
  if (!isOwnableTile(tile) || basePrice <= 0) {
    return 0;
  }

  let value = basePrice;

  if (tile.type === "property") {
    const mult = getGroupStrategicMultiplier(tile.groupId);
    value = basePrice * mult;

    const group = game.board.groups.find((g) => g.groupId === tile.groupId);
    if (group) {
      const otherTiles = group.properties
        .filter((id) => id !== tile.id)
        .map((id) => game.board.tiles.find((t) => t.id === id))
        .filter((t): t is Tile => Boolean(t));

      const otherCount = otherTiles.length;
      const ownedByMeOther = otherTiles.filter(
        (t) => t.owner === perspectiveUsername
      ).length;

      // Synergy / full-set completion bonus
      if (otherCount > 0 && ownedByMeOther === otherCount) {
        value += basePrice * 0.95 * mult;
      } else if (otherCount >= 2 && ownedByMeOther === 1) {
        value += basePrice * 0.3 * mult;
      }

      // Blocking bonus if a single opponent owns all other tiles in this group
      const opponentOwners = otherTiles
        .map((t) => t.owner)
        .filter((owner): owner is string => Boolean(owner) && owner !== perspectiveUsername);

      if (
        otherCount > 0 &&
        opponentOwners.length === otherCount &&
        opponentOwners.every((owner) => owner === opponentOwners[0])
      ) {
        value += basePrice * 0.55 * mult;
      } else if (
        otherCount >= 2 &&
        new Set(opponentOwners).size >= 2 &&
        ownedByMeOther === 0
      ) {
        // Split across multiple opponents — harder to turn into a monopoly
        value -= basePrice * 0.1;
      }

      // Account for existing upgrades on the tile
      if ((tile.rentLevel ?? 0) > 0 && group.upgradePrice) {
        value += (tile.rentLevel ?? 0) * group.upgradePrice * 0.85;
      }
    }
  } else if (tile.type === "car") {
    const otherCars = game.board.tiles.filter(
      (t) => t.type === "car" && t.id !== tile.id
    );
    const ownedByMeOther = otherCars.filter(
      (t) => t.owner === perspectiveUsername
    ).length;

    const resultingCount = Math.min(4, ownedByMeOther + 1);
    const carMultipliers = [1.1, 1.35, 1.75, 2.25];
    value = basePrice * (carMultipliers[resultingCount - 1] ?? 1.1);

    // Blocking bonus if a single opponent already holds 1–3 other cars
    const oppCounts = new Map<string, number>();
    for (const c of otherCars) {
      if (c.owner && c.owner !== perspectiveUsername) {
        oppCounts.set(c.owner, (oppCounts.get(c.owner) ?? 0) + 1);
      }
    }
    const maxOppCars = Math.max(0, ...oppCounts.values());
    if (maxOppCars >= 3) {
      value += basePrice * 0.75;
    } else if (maxOppCars === 2) {
      value += basePrice * 0.45;
    } else if (maxOppCars === 1) {
      value += basePrice * 0.15;
    }
  } else if (tile.type === "bonus-property") {
    const otherUtils = game.board.tiles.filter(
      (t) => t.type === "bonus-property" && t.id !== tile.id
    );
    const ownedByMeOther = otherUtils.filter(
      (t) => t.owner === perspectiveUsername
    ).length;

    // 2/2 Energy Utilities = 10x dice roll rent (~$70 avg, unmortgageable powerhouse)
    value = basePrice * (ownedByMeOther >= 1 ? 1.85 : 1.1);

    const opponentOwnsOther = otherUtils.some(
      (t) => Boolean(t.owner) && t.owner !== perspectiveUsername
    );
    if (opponentOwnsOther) {
      value += basePrice * 0.45;
    }
  }

  if (tile.mortgaged) {
    const buybackCost = tile.buybackPrice ?? Math.round(basePrice * 0.6);
    value = Math.max(basePrice * 0.25, value - buybackCost * 0.85);
  }

  return Math.round(value);
}

export function getAmountOwedForCurrentAction(
  game: GameState,
  player: Player
): number {
  if (game.currentAction === "payRent") {
    const tile = game.board.tiles.find((t) => t.id === player.position);
    if (!tile || !tile.rentLevels?.length) {
      return 0;
    }

    const level = Math.max(
      0,
      Math.min(tile.rentLevel ?? 0, tile.rentLevels.length - 1)
    );
    const baseRent = tile.rentLevels[level] ?? 0;

    if (tile.type === "bonus-property") {
      const diceSum = game.lastDiceRoll
        ? game.lastDiceRoll.left + game.lastDiceRoll.right
        : 7;
      return baseRent * diceSum;
    }

    return baseRent;
  }

  if (game.currentAction === "payTax") {
    const tile = game.board.tiles.find((t) => t.id === player.position);
    return tile?.taxAmount ?? 0;
  }

  if (
    game.currentAction === "chance" &&
    game.activeChance?.type === "minusBalance"
  ) {
    return game.activeChance.amount ?? 0;
  }

  return 0;
}

interface RankedLiquidationCandidate extends LiquidationPlan {
  tier: number;
  tieScore: number;
}

export function getLegalLiquidationCandidates(
  game: GameState,
  bot: Player
): LiquidationPlan[] {
  return buildRankedLiquidationCandidates(game, bot).map(
    ({ action, propertyId, cashGained }) => ({
      action,
      propertyId,
      cashGained,
    })
  );
}

function buildRankedLiquidationCandidates(
  game: GameState,
  bot: Player
): RankedLiquidationCandidate[] {
  const candidates: RankedLiquidationCandidate[] = [];
  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));

  for (const tile of game.board.tiles) {
    if (tile.owner !== bot.username || !isOwnableTile(tile)) {
      continue;
    }

    // 1. Check SELL_PROPERTY eligibility (must obey even-selling rule)
    if (tile.type === "property" && (tile.rentLevel ?? 0) >= 1) {
      const group = game.board.groups.find((g) => g.groupId === tile.groupId);
      const groupTiles = group ? getGroupTiles(game, group) : [tile];
      const level = tile.rentLevel ?? 0;
      const obeysEvenSelling = groupTiles.every(
        (p) => (p.rentLevel ?? 0) <= level
      );

      if (obeysEvenSelling) {
        const rentAtLevel = tile.rentLevels?.[level] ?? 0;
        const cashGained = rentAtLevel / 2;
        const groupMult = getGroupStrategicMultiplier(tile.groupId);
        // Preserve houses where opponents are actively approaching (2..12 tiles upstream)
        const incomingThreat = getGroupIncomingOpponentThreat(
          game,
          tile.groupId,
          bot.username
        );
        candidates.push({
          action: "SELL_PROPERTY",
          propertyId: tile.id,
          cashGained,
          tier: 4,
          // Sell from cold/low-ROI groups first; preserve kill-zone houses
          tieScore:
            groupMult * 1000 +
            incomingThreat * 1500 -
            level * 50 +
            (tile.price ?? 0) * 0.1,
        });
      }
    }

    // 2. Check MORTGAGE_PROPERTY eligibility
    if (
      !tile.mortgaged &&
      typeof tile.mortgagePrice === "number" &&
      tile.mortgagePrice > 0
    ) {
      let canMortgage = true;
      let tier = 1;

      if (tile.type === "property" && tile.groupId != null) {
        const group = game.board.groups.find((g) => g.groupId === tile.groupId);
        const groupTiles = group ? getGroupTiles(game, group) : [tile];
        const anyUpgradedInGroup = groupTiles.some(
          (p) => (p.rentLevel ?? 0) > 0
        );

        if (anyUpgradedInGroup) {
          canMortgage = false;
        } else {
          const isFullSet = botFullSets.has(tile.groupId);
          const ownedInGroup = groupTiles.filter(
            (p) => p.owner === bot.username
          ).length;
          const isBlocking = doesTileBlockOpponentSet(game, tile, bot.username);

          if (isFullSet) {
            tier = 5; // Preserve full monopolies last
          } else if (ownedInGroup >= 2 || isBlocking) {
            tier = 3; // Partial sets / blocking tiles
          } else {
            tier = 1; // Weak ungrouped singletons first
          }
        }
      } else if (tile.type === "car") {
        const ownedCars = game.board.tiles.filter(
          (t) => t.type === "car" && t.owner === bot.username && !t.mortgaged
        ).length;
        tier = ownedCars >= 3 ? 3 : 2;
      } else if (tile.type === "bonus-property") {
        const ownedUtils = game.board.tiles.filter(
          (t) =>
            t.type === "bonus-property" &&
            t.owner === bot.username &&
            !t.mortgaged
        ).length;
        tier = ownedUtils >= 2 ? 3 : 2;
      } else {
        tier = 2;
      }

      if (canMortgage) {
        const strategicValue = evaluateTileStrategicValue(
          game,
          tile,
          bot.username
        );
        candidates.push({
          action: "MORTGAGE_PROPERTY",
          propertyId: tile.id,
          cashGained: tile.mortgagePrice,
          tier,
          tieScore: strategicValue,
        });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    if (a.tieScore !== b.tieScore) {
      return a.tieScore - b.tieScore;
    }
    return a.propertyId - b.propertyId;
  });

  return candidates;
}

/**
 * Estimates whether the bot can raise enough cash to pay `owed` without selling `excludeTileId`,
 * considering all other houses (even-sold down to 0) and all other mortgageable assets.
 * Used to identify literal bankruptcy emergencies.
 */
export function canSurviveWithoutTile(
  game: GameState,
  bot: Player,
  excludeTileId: number,
  owed: number
): boolean {
  let maxCash = bot.balance;

  for (const tile of game.board.tiles) {
    if (
      tile.owner !== bot.username ||
      tile.id === excludeTileId ||
      !isOwnableTile(tile)
    ) {
      continue;
    }

    if (tile.type === "property" && (tile.rentLevel ?? 0) > 0) {
      for (let lvl = tile.rentLevel ?? 0; lvl >= 1; lvl--) {
        maxCash += (tile.rentLevels?.[lvl] ?? 0) / 2;
      }
    }

    if (
      !tile.mortgaged &&
      typeof tile.mortgagePrice === "number" &&
      tile.mortgagePrice > 0
    ) {
      maxCash += tile.mortgagePrice;
    }
  }

  return maxCash >= owed;
}

/**
 * Finds the single best next liquidation step (SELL_PROPERTY or MORTGAGE_PROPERTY)
 * to raise cash while preserving highest-ROI & kill-zone monopolies.
 */
export function planNextLiquidationAction(
  game: GameState,
  bot: Player
): LiquidationPlan | null {
  const ranked = buildRankedLiquidationCandidates(game, bot);
  if (!ranked.length) {
    return null;
  }

  const best = ranked[0];
  return {
    action: best.action,
    propertyId: best.propertyId,
    cashGained: best.cashGained,
  };
}

/**
 * Returns all currently mortgageable tiles owned by `bot` in liquidation priority order.
 * Used before mortgaging so the bot can check if ANY mortgageable tile has a high-value
 * buyer (1.4x–2.0x) instead of only checking the single weakest tile.
 */
export function getEligibleMortgageTilesForTrade(
  game: GameState,
  bot: Player,
  includeFullSets: boolean = false
): Tile[] {
  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));
  const ranked = buildRankedLiquidationCandidates(game, bot);
  const result: Tile[] = [];

  for (const item of ranked) {
    if (item.action !== "MORTGAGE_PROPERTY") {
      continue;
    }
    const tile = game.board.tiles.find((t) => t.id === item.propertyId);
    if (!tile) {
      continue;
    }
    if (
      !includeFullSets &&
      tile.type === "property" &&
      tile.groupId != null &&
      botFullSets.has(tile.groupId)
    ) {
      continue;
    }
    result.push(tile);
  }

  return result;
}

export function getLegalUpgradeCandidates(
  game: GameState,
  bot: Player,
  reserve: number
): Tile[] {
  const candidates: Tile[] = [];

  for (const group of game.board.groups) {
    if (!group.isUpgradeAvailable) {
      continue;
    }
    if (typeof group.upgradePrice !== "number" || group.upgradePrice <= 0) {
      continue;
    }
    if (bot.balance - group.upgradePrice < reserve) {
      continue;
    }

    const groupTiles = getGroupTiles(game, group);
    if (!groupTiles.length) {
      continue;
    }

    const ownsFullSet = groupTiles.every(
      (t) => t.type === "property" && t.owner === bot.username
    );
    if (!ownsFullSet) {
      continue;
    }

    const anyMortgaged = groupTiles.some((t) => Boolean(t.mortgaged));
    if (anyMortgaged) {
      continue;
    }

    for (const tile of groupTiles) {
      const level = tile.rentLevel ?? 0;
      if (level >= 5) {
        continue;
      }

      // Even-building rule: cannot build on a tile ahead of siblings in the same group
      const obeysEvenBuilding = groupTiles.every(
        (sibling) => (sibling.rentLevel ?? 0) >= level
      );
      if (obeysEvenBuilding) {
        candidates.push(tile);
      }
    }
  }

  candidates.sort((a, b) => a.id - b.id);
  return candidates;
}

export function findBestUpgradeTile(
  game: GameState,
  bot: Player,
  _difficulty: BotDifficulty,
  reserve: number
): Tile | null {
  const candidates = getLegalUpgradeCandidates(game, bot, reserve);
  if (!candidates.length) {
    return null;
  }

  const scored = candidates.map((tile) => {
    const group = game.board.groups.find((g) => g.groupId === tile.groupId);
    const upgradePrice = group?.upgradePrice ?? 100;
    const currentLevel = tile.rentLevel ?? 0;
    const nextLevel = Math.min(5, currentLevel + 1);
    const currentRent = tile.rentLevels?.[currentLevel] ?? 0;
    const nextRent = tile.rentLevels?.[nextLevel] ?? currentRent;
    const rentDelta = Math.max(0, nextRent - currentRent);

    const groupMult = getGroupStrategicMultiplier(tile.groupId);
    // 3rd house is the highest marginal ROI inflection point in Monopoly
    const sweetSpotBonus =
      nextLevel === 3 ? 1.22 : nextLevel <= 3 ? 1.1 : 1.0;

    // Trap-based upgrading: strongly prioritize tiles & sets opponents are 2..12 steps upstream from
    const tileLandingProb = getOpponentLandingProbabilityOnTile(
      game,
      tile.id,
      bot.username
    );
    const groupLandingProb = getGroupIncomingOpponentThreat(
      game,
      tile.groupId,
      bot.username
    );
    const trapMultiplier = 1 + tileLandingProb * 4.5 + groupLandingProb * 1.4;

    const roiScore =
      (rentDelta / upgradePrice) * groupMult * sweetSpotBonus * trapMultiplier;

    return { tile, roiScore };
  });

  scored.sort((a, b) => {
    if (b.roiScore !== a.roiScore) {
      return b.roiScore - a.roiScore;
    }
    if ((b.tile.price ?? 0) !== (a.tile.price ?? 0)) {
      return (b.tile.price ?? 0) - (a.tile.price ?? 0);
    }
    return a.tile.id - b.tile.id;
  });

  return scored[0].tile;
}

export interface UnmortgageOptions {
  onlyFullSet?: boolean;
  excludeTileIds?: number[];
}

export function findBestUnmortgageTile(
  game: GameState,
  bot: Player,
  reserve: number,
  fullSetReserve: number = reserve,
  options: UnmortgageOptions = {}
): Tile | null {
  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));
  const excluded = new Set(options.excludeTileIds ?? []);

  const candidates = game.board.tiles.filter((tile) => {
    if (
      tile.owner !== bot.username ||
      !isOwnableTile(tile) ||
      !tile.mortgaged ||
      excluded.has(tile.id) ||
      typeof tile.buybackPrice !== "number" ||
      tile.buybackPrice <= 0
    ) {
      return false;
    }

    const inFullSet =
      tile.type === "property" &&
      tile.groupId != null &&
      botFullSets.has(tile.groupId);
    if (options.onlyFullSet && !inFullSet) {
      return false;
    }
    const effectiveReserve = inFullSet ? fullSetReserve : reserve;
    return bot.balance - tile.buybackPrice >= effectiveReserve;
  });

  if (!candidates.length) {
    return null;
  }

  const scored = candidates.map((tile) => {
    const inFullSet =
      tile.type === "property" &&
      tile.groupId != null &&
      botFullSets.has(tile.groupId);

    const unmortgagedTile: Tile = { ...tile, mortgaged: false };
    const strategicValue = evaluateTileStrategicValue(
      game,
      unmortgagedTile,
      bot.username
    );
    const groupMult = getGroupStrategicMultiplier(tile.groupId);
    const groupThreat = inFullSet
      ? getGroupIncomingOpponentThreat(game, tile.groupId, bot.username)
      : 0;
    const priority = inFullSet
      ? 10000 + groupMult * 1000 + groupThreat * 1500 + strategicValue
      : strategicValue;

    return { tile, priority };
  });

  scored.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.tile.id - b.tile.id;
  });

  return scored[0].tile;
}

export interface ProactiveMortgagePlan {
  tileToMortgage: Tile;
  eligibleTiles: Tile[];
  targetUpgradeGroupId: number;
  upgradePrice: number;
}

/**
 * Checks if a bot should proactively mortgage a weak non-set singleton before rolling
 * in order to immediately afford upgrading an active full set (up to level 3 sweet spot,
 * or level 4 for reckless bots).
 */
export function findProactiveMortgageForUpgrade(
  game: GameState,
  bot: Player,
  difficulty: BotDifficulty
): ProactiveMortgagePlan | null {
  if (difficulty === "EASY") {
    return null;
  }

  const risk = getBotRiskLevel(bot);
  if (difficulty === "MEDIUM" && risk < 0.45) {
    return null;
  }

  const maxTargetLevel = risk >= 0.75 ? 4 : 3;
  const upgradeReserve = getActionReserve(game, bot, difficulty, "upgrade");

  // Find best upgradeable full set that bot cannot currently afford with cash alone
  let bestTarget: { groupId: number; upgradePrice: number; score: number } | null =
    null;

  for (const group of game.board.groups) {
    if (!group.isUpgradeAvailable) {
      continue;
    }
    if (typeof group.upgradePrice !== "number" || group.upgradePrice <= 0) {
      continue;
    }

    const groupTiles = getGroupTiles(game, group);
    if (!groupTiles.length) {
      continue;
    }

    const ownsFullSet = groupTiles.every(
      (t) => t.type === "property" && t.owner === bot.username
    );
    if (!ownsFullSet || groupTiles.some((t) => Boolean(t.mortgaged))) {
      continue;
    }

    const minLevel = Math.min(...groupTiles.map((t) => t.rentLevel ?? 0));
    if (minLevel >= maxTargetLevel) {
      continue;
    }

    // Only needed when cash alone cannot cover upgrade + reserve
    if (bot.balance - group.upgradePrice >= upgradeReserve) {
      continue;
    }

    const mult = getGroupStrategicMultiplier(group.groupId);
    const threat = getGroupIncomingOpponentThreat(
      game,
      group.groupId,
      bot.username
    );

    // Cautious HARD bots only proactively mortgage if an opponent is approaching the set
    if (risk < 0.25 && threat < 0.14) {
      continue;
    }

    const score = mult * (1 + threat * 2) * (maxTargetLevel - minLevel);
    if (!bestTarget || score > bestTarget.score) {
      bestTarget = {
        groupId: group.groupId,
        upgradePrice: group.upgradePrice,
        score,
      };
    }
  }

  if (!bestTarget) {
    return null;
  }

  const shortfall = bestTarget.upgradePrice + upgradeReserve - bot.balance;
  if (shortfall <= 0) {
    return null;
  }

  // Only mortgage weak non-set tiles (tier 1 singletons; aggressive bots may include tier 2/non-set tier 3)
  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));
  const ranked = buildRankedLiquidationCandidates(game, bot).filter((c) => {
    if (c.action !== "MORTGAGE_PROPERTY") {
      return false;
    }
    const tile = game.board.tiles.find((t) => t.id === c.propertyId);
    if (!tile) {
      return false;
    }
    if (
      tile.type === "property" &&
      tile.groupId != null &&
      botFullSets.has(tile.groupId)
    ) {
      return false;
    }
    if (c.tier === 1) {
      return true;
    }
    if (c.tier === 2 && risk >= 0.5) {
      return true;
    }
    // Tier 3 (2-of-3 partial or blocking tile): only for very aggressive bots when set is hot
    if (c.tier === 3 && risk >= 0.8) {
      return true;
    }
    return false;
  });

  if (!ranked.length) {
    return null;
  }

  // Verify mortgaging 1 or 2 eligible tiles genuinely covers the upgrade AFTER accounting
  // for any change in post-mortgage `upgradeReserve` (since `fallbackMortgage` shrinks!).
  const stepTiles = ranked
    .slice(0, 2)
    .map((item) => ({
      item,
      tile: game.board.tiles.find((t) => t.id === item.propertyId),
    }))
    .filter((entry): entry is { item: RankedLiquidationCandidate; tile: Tile } =>
      Boolean(entry.tile)
    );

  let canActuallyUpgrade = false;
  let simBalance = bot.balance;
  const mortgagedIds = new Set<number>();

  for (const { item, tile } of stepTiles) {
    simBalance += item.cashGained;
    mortgagedIds.add(tile.id);

    const simGame: GameState = {
      ...game,
      board: {
        ...game.board,
        tiles: game.board.tiles.map((t) =>
          mortgagedIds.has(t.id) ? { ...t, mortgaged: true } : t
        ),
      },
    };
    const simBot: Player = { ...bot, balance: simBalance };
    const postReserve = getActionReserve(simGame, simBot, difficulty, "upgrade");
    if (simBalance - bestTarget.upgradePrice >= postReserve) {
      canActuallyUpgrade = true;
      break;
    }
  }

  if (!canActuallyUpgrade) {
    return null;
  }

  const eligibleTiles = ranked
    .map((item) => game.board.tiles.find((t) => t.id === item.propertyId))
    .filter((t): t is Tile => Boolean(t));

  if (!eligibleTiles.length) {
    return null;
  }

  return {
    tileToMortgage: eligibleTiles[0],
    eligibleTiles,
    targetUpgradeGroupId: bestTarget.groupId,
    upgradePrice: bestTarget.upgradePrice,
  };
}

