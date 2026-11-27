import type { Tile } from "~/types";

export const getPlayerTradableProperties = (
  tiles: Tile[],
  fullSetsGroups: number[],
  username: string
) => {
  const ownedProperties = tiles.filter(
    (t: Tile) =>
      t.owner === username &&
      ["car", "property", "bonus-property"].includes(t.type)
  );

  const tradeable = ownedProperties.filter((t: Tile) => {
    if (t.type !== "property" || t.groupId == null) {
      return true;
    }

    const isFullSet = fullSetsGroups.includes(t.groupId);
    const isAnyTileInFullSetUpgraded = tiles.some(
      (tile: Tile) => tile.groupId === t.groupId && (tile.rentLevel ?? 0) > 0
    );

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false;
    }

    return true;
  });

  return tradeable.map((t: Tile) => t.id);
};
