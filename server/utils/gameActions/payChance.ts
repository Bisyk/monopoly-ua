import type { GameState, Player } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { resolveBankruptcy } from "./resolveBankruptcy";

export const payChance = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const amount = Number(
    parsedMessage.payload.amount ?? game.activeChance?.amount ?? 0
  );

  if (currentTurnPlayer.balance < amount) {
    resolveBankruptcy({
      game,
      bankruptPlayer: currentTurnPlayer,
      currentTurnPlayerIdx,
    });
    return;
  }

  currentTurnPlayer.balance -= amount;
  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `paid $${amount} for chance`,
  });
  game.currentAction = "roll";
  game.activeChance = { type: "" };
  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  return;
};
