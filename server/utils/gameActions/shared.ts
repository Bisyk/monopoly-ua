import type { GameState, Player, Tile } from "~/types";

export const recalculateSpecialPropertyRentLevels = (game: GameState) => {
  const ownedCarsCount: Record<string, number> = {};
  const ownedBonusPropertiesCount: Record<string, number> = {};

  game.board.tiles.forEach((tile) => {
    if (!tile.owner) {
      return;
    }

    if (tile.type === "car") {
      ownedCarsCount[tile.owner] = (ownedCarsCount[tile.owner] || 0) + 1;
    }

    if (tile.type === "bonus-property") {
      ownedBonusPropertiesCount[tile.owner] =
        (ownedBonusPropertiesCount[tile.owner] || 0) + 1;
    }
  });

  game.board.tiles.forEach((tile) => {
    if (tile.type === "car") {
      const maxLevel = Math.max(0, (tile.rentLevels?.length ?? 1) - 1);
      tile.rentLevel = tile.owner
        ? Math.min(ownedCarsCount[tile.owner] - 1, maxLevel)
        : 0;
    }

    if (tile.type === "bonus-property") {
      const maxLevel = Math.max(0, (tile.rentLevels?.length ?? 1) - 1);
      tile.rentLevel = tile.owner
        ? Math.min(ownedBonusPropertiesCount[tile.owner] - 1, maxLevel)
        : 0;
    }
  });
};

export const syncPropertySets = (game: GameState) => {
  const playerOwnedGroups = new Map<string, number[]>();
  game.players.forEach((player) => {
    playerOwnedGroups.set(player.username, []);
  });

  game.board.groups.forEach((group) => {
    const groupedTiles = game.board.tiles.filter((tile) =>
      group.properties.includes(tile.id)
    );
    const tileOwners = groupedTiles
      .map((tile) => tile.owner)
      .filter((owner): owner is string => Boolean(owner));

    const hasSingleOwner =
      groupedTiles.length > 0 &&
      tileOwners.length === groupedTiles.length &&
      new Set(tileOwners).size === 1;

    if (group.isFullSet && !hasSingleOwner) {
      groupedTiles.forEach((tile) => {
        if (tile.rentLevels?.length) {
          tile.rentLevels[0] = tile.rentLevels[0] / 2;
        }
      });
    }

    if (!group.isFullSet && hasSingleOwner) {
      groupedTiles.forEach((tile) => {
        if (tile.rentLevels?.length) {
          tile.rentLevels[0] = tile.rentLevels[0] * 2;
        }
      });
    }

    group.isFullSet = hasSingleOwner;

    if (hasSingleOwner) {
      const owner = tileOwners[0];
      const groups = playerOwnedGroups.get(owner);
      if (groups && !groups.includes(group.groupId)) {
        groups.push(group.groupId);
      }
    }
  });

  game.players.forEach((player) => {
    player.ownedPropertyGroupIds =
      playerOwnedGroups.get(player.username) ?? [];
  });
};

export const assignPropertyToPlayer = (
  game: GameState,
  property: Tile,
  player: Player,
  purchasePrice: number
) => {
  player.balance -= purchasePrice;
  if (!player.properties.includes(property.id)) {
    player.properties.push(property.id);
  }
  property.owner = player.username;

  syncPropertySets(game);
  recalculateSpecialPropertyRentLevels(game);
};
