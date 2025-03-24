import { GameState, Player } from "../../../types";

export const payTax = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const tax = parsedMessage.payload.tax;

  if (currentTurnPlayer.balance < tax) {
    return;
  }

  currentTurnPlayer.balance -= tax;
  game.currentAction = "roll";
  return;
};
