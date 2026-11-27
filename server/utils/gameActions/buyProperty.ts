import type { GameState, Player, Tile } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { assignPropertyToPlayer } from "./shared";

export const buyProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const boughtProperty = game.board.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  if (!boughtProperty || boughtProperty.price == null || boughtProperty.owner) {
    return;
  }

  if (currentTurnPlayer.balance < boughtProperty.price) {
    return;
  }

  assignPropertyToPlayer(
    game,
    boughtProperty,
    currentTurnPlayer,
    boughtProperty.price
  );

  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `bought ${boughtProperty.name} for $${boughtProperty.price}`,
  });

  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);

  game.currentAction = "roll";
  return;
};
