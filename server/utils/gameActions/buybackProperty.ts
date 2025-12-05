import { GameState, Player } from "~/types";

export const buybackProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToBuyBack = game.board.tiles.find(
    t => t.id === propertyId
  );

  if (currentTurnPlayer.balance < propertyToBuyBack!.buybackPrice!) {
    return;
  }

  if (!propertyToBuyBack!.mortgaged) {
    return;
  }

  propertyToBuyBack!.mortgaged = false;
  currentTurnPlayer.balance -= propertyToBuyBack!.buybackPrice!;
  return;
};
