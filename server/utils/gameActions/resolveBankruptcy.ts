import type { GameState, Player } from "~/types";
import {
  recalculateSpecialPropertyRentLevels,
  syncPropertySets,
} from "./shared";

type ResolveBankruptcyParams = {
  game: GameState;
  bankruptPlayer: Player;
  currentTurnPlayerIdx: number;
  creditorUsername?: string;
};

const setCurrentTurnAfterElimination = (
  game: GameState,
  eliminatedPlayerUsername: string,
  currentTurnPlayerIdx: number
) => {
  if (game.players.length === 0) {
    game.currentTurn = "";
    return;
  }

  if (game.currentTurn !== eliminatedPlayerUsername) {
    const currentTurnStillActive = game.players.some(
      (player) => player.username === game.currentTurn
    );
    if (!currentTurnStillActive) {
      game.currentTurn = game.players[0].username;
    }
    return;
  }

  const nextPlayerIdx = Math.min(currentTurnPlayerIdx, game.players.length - 1);
  game.currentTurn = game.players[nextPlayerIdx].username;
};

export const resolveBankruptcy = ({
  game,
  bankruptPlayer,
  currentTurnPlayerIdx,
  creditorUsername,
}: ResolveBankruptcyParams) => {
  const creditor = creditorUsername
    ? game.players.find((player) => player.username === creditorUsername)
    : null;

  const bankruptProperties = [...bankruptPlayer.properties];

  bankruptProperties.forEach((propertyId) => {
    const tile = game.board.tiles.find(
      (boardTile) => boardTile.id === propertyId
    );
    if (!tile) {
      return;
    }

    if (creditor) {
      tile.owner = creditor.username;
      if (!creditor.properties.includes(propertyId)) {
        creditor.properties.push(propertyId);
      }
      return;
    }

    // Debt to the bank: clear ownership and reset property state.
    tile.owner = "";
    if (typeof tile.rentLevel === "number") {
      tile.rentLevel = 0;
    }
    if (typeof tile.mortgaged === "boolean") {
      tile.mortgaged = false;
    }
  });

  if (creditor && bankruptPlayer.balance > 0) {
    creditor.balance += bankruptPlayer.balance;
  }

  bankruptPlayer.balance = 0;
  bankruptPlayer.properties = [];
  bankruptPlayer.ownedPropertyGroupIds = [];

  if (!game.eliminatedPlayers.includes(bankruptPlayer.username)) {
    game.eliminatedPlayers.push(bankruptPlayer.username);
  }

  game.players = game.players.filter(
    (player) => player.username !== bankruptPlayer.username
  );

  recalculateSpecialPropertyRentLevels(game);
  syncPropertySets(game);

  game.gameLog.push({
    username: bankruptPlayer.username,
    msg: creditor
      ? `went bankrupt to ${creditor.username}`
      : "went bankrupt",
  });

  if (game.players.length === 1) {
    game.status = "ENDED";
    game.winnerUsername = game.players[0].username;
    game.currentTurn = game.players[0].username;
    game.currentAction = "roll";
    game.gameLog.push({
      username: game.players[0].username,
      msg: "won the game!",
    });
    return;
  }

  game.status = "STARTED";
  game.winnerUsername = null;

  setCurrentTurnAfterElimination(
    game,
    bankruptPlayer.username,
    currentTurnPlayerIdx
  );
  game.currentAction = "roll";
};
