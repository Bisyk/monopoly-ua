import type { GameState, Player } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { resolveBankruptcy } from "./resolveBankruptcy";

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
  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `paid $${tax} tax`,
  });
  game.currentAction = "roll";
  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  return;
};
