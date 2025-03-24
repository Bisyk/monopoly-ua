import { GameState, Player } from "~/types";

// same as downgrade property
export const sellProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToSell = game.boardState.tiles.find(t => t.id === propertyId);

  const propertyGroup = game.boardState.groups.find(g => {
    return g.properties.includes(propertyId);
  });

  if (propertyToSell!.rentLevel! < 1) {
    return;
  }

  currentTurnPlayer.balance +=
    propertyToSell!.rentLevels![propertyToSell!.rentLevel!] / 2;
  propertyToSell!.rentLevel! -= 1;
  return;
};
