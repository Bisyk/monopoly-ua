import type { GameState, Player } from "../../../types/index";

export const changePlayerTurn = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number
) => {
  if (game.status === "ENDED") {
    return;
  }

  if (game.players.length === 0) {
    game.currentTurn = "";
    return;
  }

  game.board.groups.forEach(g => {
    g.isUpgradeAvailable = true;
  });

  if (currentTurnPlayer.bonusRoll) {
    return;
  }

  let nextPlayerIdx =
    currentTurnPlayerIdx < game.players.length - 1 ? currentTurnPlayerIdx + 1 : 0;

  while (
    game.eliminatedPlayers.includes(game.players[nextPlayerIdx]?.username) &&
    nextPlayerIdx !== currentTurnPlayerIdx
  ) {
    nextPlayerIdx = nextPlayerIdx < game.players.length - 1 ? nextPlayerIdx + 1 : 0;
  }

  game.currentTurn = game.players[nextPlayerIdx].username;
};
