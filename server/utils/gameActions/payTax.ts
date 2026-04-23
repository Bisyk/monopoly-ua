import { GameState, Player } from "../../../types";
import { resolveBankruptcy } from ".";

export const payTax = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const tax = parsedMessage.payload.tax;

  if (currentTurnPlayer.balance < tax) {
    resolveBankruptcy({
      game,
      bankruptPlayer: currentTurnPlayer,
      currentTurnPlayerIdx,
    });
    return;
  }

  currentTurnPlayer.balance -= tax;
  game.currentAction = "roll";
  return;
};
