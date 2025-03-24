import { GameState, Player } from "~/types";

export const payJail = (game: GameState, currentTurnPlayer: Player) => {
  if (currentTurnPlayer.balance < 50) {
    return;
  }

  currentTurnPlayer.balance -= 50;
  currentTurnPlayer.jailed = false;
  currentTurnPlayer.turnsInJail = 0;
  game.currentAction = "roll";
  return;
};
