import { GameState, Player, Tile } from "~/types";
import { changePlayerTurn, checkIsFullPropertySet } from ".";
import { assignPropertyToPlayer } from "./shared";

export const buyProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const boughtProperty = game.boardState.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  if (currentTurnPlayer.balance < boughtProperty!.price!) {
    return;
  }

  assignPropertyToPlayer(
    game,
    boughtProperty!,
    currentTurnPlayer,
    boughtProperty?.price!
  );

  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);

  game.currentAction = "roll";
  return;
};
