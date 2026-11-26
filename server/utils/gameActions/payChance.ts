import { GameState, Player } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { resolveBankruptcy } from ".";

export const payChance = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const amount = parsedMessage.payload.amount;

  if (currentTurnPlayer.balance < amount) {
    resolveBankruptcy({
      game,
      bankruptPlayer: currentTurnPlayer,
      currentTurnPlayerIdx,
    });
    return;
  }

  currentTurnPlayer.balance -= amount;
  game.currentAction = "roll";
  game.activeChance = { type: "" };
  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  return;
};
