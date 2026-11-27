import type { GameState, Player } from "~/types";

export const buybackProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToBuyBack = game.board.tiles.find((t) => t.id === propertyId);

  if (
    !propertyToBuyBack ||
    !["property", "car", "bonus-property"].includes(propertyToBuyBack.type)
  ) {
    return;
  }

  if (propertyToBuyBack.owner !== currentTurnPlayer.username) {
    return;
  }

  if (!propertyToBuyBack.mortgaged || propertyToBuyBack.buybackPrice == null) {
    return;
  }

  if (currentTurnPlayer.balance < propertyToBuyBack.buybackPrice) {
    return;
  }

  propertyToBuyBack.mortgaged = false;
  currentTurnPlayer.balance -= propertyToBuyBack.buybackPrice;
  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `redeemed ${propertyToBuyBack.name} for $${propertyToBuyBack.buybackPrice}`,
  });
  return;
};
