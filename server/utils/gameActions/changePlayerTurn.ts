import type { GameState, Player } from "../../../types/index";

export const changePlayerTurn = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number
) => {
  game.boardState.groups.forEach(g => {
    g.isUpgradeAvailable = true;
  });

  if (currentTurnPlayer.bonusRoll) {
    return;
  }

  if (currentTurnPlayerIdx < game.players.length - 1) {
    game.currentTurn = game.players[currentTurnPlayerIdx + 1].username;
  } else {
    game.currentTurn = game.players[0].username;
  }
};
