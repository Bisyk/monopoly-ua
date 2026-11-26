import { GAME_RULES } from "~/shared/constants/gameRules";
import { GameState, Player } from "~/types";

export const payJail = (game: GameState, currentTurnPlayer: Player) => {
  if (currentTurnPlayer.balance < GAME_RULES.JAIL_FINE) {
    return;
  }

  currentTurnPlayer.balance -= GAME_RULES.JAIL_FINE;
  currentTurnPlayer.jailed = false;
  currentTurnPlayer.turnsInJail = 0;
  game.currentAction = "roll";
  return;
};
