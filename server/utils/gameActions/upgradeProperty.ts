import type { GameState, Player } from "~/types";

export const upgradeProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;
  const propertyGroup = game.board.groups.find((g) =>
    g.properties.includes(propertyId)
  );

  const propertyToUpgrade = game.board.tiles.find((t) => t.id === propertyId);

  if (
    !propertyToUpgrade ||
    !propertyGroup ||
    propertyToUpgrade.type !== "property"
  ) {
    return;
  }

  if (propertyToUpgrade.owner !== currentTurnPlayer.username) {
    return;
  }

  if (
    !propertyGroup.isFullSet ||
    !propertyGroup.isUpgradeAvailable ||
    propertyGroup.upgradePrice == null
  ) {
    return;
  }

  if (currentTurnPlayer.balance < propertyGroup.upgradePrice) {
    return;
  }

  const currentLevel = propertyToUpgrade.rentLevel ?? 0;
  if (currentLevel >= 5) {
    return;
  }

  const groupTiles = game.board.tiles.filter((t) =>
    propertyGroup.properties.includes(t.id)
  );

  if (
    groupTiles.length !== propertyGroup.properties.length ||
    !groupTiles.every((t) => t.owner === currentTurnPlayer.username)
  ) {
    return;
  }

  if (groupTiles.some((t) => t.mortgaged)) {
    return;
  }

  if (!groupTiles.every((t) => (t.rentLevel ?? 0) >= currentLevel)) {
    return;
  }

  propertyToUpgrade.rentLevel = currentLevel + 1;
  currentTurnPlayer.balance -= propertyGroup.upgradePrice;
  propertyGroup.isUpgradeAvailable = false;
  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `upgraded ${propertyToUpgrade.name} to level ${propertyToUpgrade.rentLevel} for $${propertyGroup.upgradePrice}`,
  });
  return;
};
