import type { Tile } from "~/types";

export const getPlayerTradableProperties = (
  tilesState: Tile[],
  fullSetsGroups: number[],
  username: string
) => {
  const ownedAndNotMortgaged = tilesState.filter(
    (t: Tile) =>
      t.owner === username &&
      ["car", "property", "bonus-property"].includes(t.type) &&
      !t.mortgaged
  );

  const tradeable = ownedAndNotMortgaged.filter((t: Tile) => {
    const isFullSet = fullSetsGroups.includes(t.groupId!);
    const isAnyTileInFullSetUpgraded = tilesState.some(
      (tile: Tile) => tile.groupId === t.groupId && tile.rentLevel! > 0
    );

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false;
    }

    return true;
  });

  return tradeable.map((t: Tile) => t.id);
};
