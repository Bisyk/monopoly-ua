import { GameState, Player, Tile } from "~/types";

export const mortgageProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToMortgage = game.board.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  if (propertyToMortgage!.mortgaged) {
    return;
  }

  propertyToMortgage!.mortgaged = true;
  currentTurnPlayer.balance += propertyToMortgage!.mortgagePrice!;
  return;
};
