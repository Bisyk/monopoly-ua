import { GAME_RULES } from "~/shared/constants/gameRules";
import type { GameState, Player } from "~/types";

export const payJail = (game: GameState, currentTurnPlayer: Player) => {
  if (!currentTurnPlayer.jailed) {
    return;
  }

  if (currentTurnPlayer.balance < GAME_RULES.JAIL_FINE) {
    return;
  }

  currentTurnPlayer.balance -= GAME_RULES.JAIL_FINE;
  currentTurnPlayer.jailed = false;
  currentTurnPlayer.turnsInJail = 0;
  game.currentAction = "roll";
  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `paid $${GAME_RULES.JAIL_FINE} to leave jail`,
  });
  return;
};
