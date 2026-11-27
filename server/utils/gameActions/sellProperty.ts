import type { GameState, Player } from "~/types";

// same as downgrade property
export const sellProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToSell = game.board.tiles.find((t) => t.id === propertyId);

  const propertyGroup = game.board.groups.find((g) =>
    g.properties.includes(propertyId)
  );

  if (!propertyToSell || !propertyGroup || propertyToSell.type !== "property") {
    return;
  }

  if (propertyToSell.owner !== currentTurnPlayer.username) {
    return;
  }

  const currentLevel = propertyToSell.rentLevel ?? 0;
  if (currentLevel < 1) {
    return;
  }

  const groupTiles = game.board.tiles.filter((t) =>
    propertyGroup.properties.includes(t.id)
  );

  if (!groupTiles.every((t) => (t.rentLevel ?? 0) <= currentLevel)) {
    return;
  }

  const refund = (propertyToSell.rentLevels?.[currentLevel] ?? 0) / 2;
  currentTurnPlayer.balance += refund;
  propertyToSell.rentLevel = currentLevel - 1;
  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `downgraded ${propertyToSell.name} to level ${propertyToSell.rentLevel} for $${refund}`,
  });
  return;
};
