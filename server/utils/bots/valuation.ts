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

export function getSafetyReserve(
  game: GameState,
  bot: Player,
  difficulty: BotDifficulty
): number {
  if (difficulty === "EASY") {
    return 50;
  }

  if (difficulty === "MEDIUM") {
    return 150;
  }

  const stage = getGameStage(game);
  const { maxRent } = getMaxOpponentRent(game, bot.username);

  if (stage === "early") {
    return Math.min(200, Math.max(120, Math.round(maxRent * 0.4)));
  }

  if (stage === "mid") {
    return Math.min(450, Math.max(180, Math.round(maxRent * 0.5)));
  }

  return Math.min(700, Math.max(250, Math.round(maxRent * 0.75)));
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
    const carMultipliers = [1.0, 1.2, 1.45, 1.75];
    value = basePrice * (carMultipliers[resultingCount - 1] ?? 1.0);

    // Blocking bonus if a single opponent already holds 2 or 3 other cars
    const oppCounts = new Map<string, number>();
    for (const c of otherCars) {
      if (c.owner && c.owner !== perspectiveUsername) {
        oppCounts.set(c.owner, (oppCounts.get(c.owner) ?? 0) + 1);
      }
    }
    const maxOppCars = Math.max(0, ...oppCounts.values());
    if (maxOppCars >= 3) {
      value += basePrice * 0.45;
    } else if (maxOppCars === 2) {
      value += basePrice * 0.2;
    }
  } else if (tile.type === "bonus-property") {
    const otherUtils = game.board.tiles.filter(
      (t) => t.type === "bonus-property" && t.id !== tile.id
    );
    const ownedByMeOther = otherUtils.filter(
      (t) => t.owner === perspectiveUsername
    ).length;

    value = basePrice * (ownedByMeOther >= 1 ? 1.3 : 0.9);

    const opponentOwnsOther = otherUtils.some(
      (t) => Boolean(t.owner) && t.owner !== perspectiveUsername
    );
    if (opponentOwnsOther) {
      value += basePrice * 0.2;
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
        candidates.push({
          action: "SELL_PROPERTY",
          propertyId: tile.id,
          cashGained,
          tier: 4,
          // Sell lowest-ROI group first, then higher rentLevel, then lower price
          tieScore: groupMult * 1000 - level * 50 + (tile.price ?? 0) * 0.1,
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
      } else {
        // Cars / utilities (if mortgagePrice is configured)
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
 * Finds the single best next liquidation step (SELL_PROPERTY or MORTGAGE_PROPERTY)
 * to raise cash while preserving highest-ROI monopolies.
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
      nextLevel === 3 ? 1.18 : nextLevel <= 3 ? 1.08 : 1.0;

    const roiScore = (rentDelta / upgradePrice) * groupMult * sweetSpotBonus;

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

export function findBestUnmortgageTile(
  game: GameState,
  bot: Player,
  reserve: number
): Tile | null {
  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));

  const candidates = game.board.tiles.filter(
    (tile) =>
      tile.owner === bot.username &&
      isOwnableTile(tile) &&
      Boolean(tile.mortgaged) &&
      typeof tile.buybackPrice === "number" &&
      tile.buybackPrice > 0 &&
      bot.balance - tile.buybackPrice >= reserve
  );

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
    const priority = inFullSet
      ? 10000 + groupMult * 1000 + strategicValue
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
