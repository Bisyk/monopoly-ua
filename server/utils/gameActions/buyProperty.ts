import { GameState, Player, Tile } from "~/types";
import { changePlayerTurn, checkIsFullPropertySet } from ".";

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

  if (boughtProperty!.type === "property") {
    boughtProperty!.owner = game.currentTurn;

    currentTurnPlayer.properties.push(boughtProperty!.id);

    currentTurnPlayer.balance =
      currentTurnPlayer.balance - boughtProperty!.price!;

    checkIsFullPropertySet(currentTurnPlayer, game.boardState);
  }

  if (boughtProperty!.type === "car") {
    currentTurnPlayer.balance -= boughtProperty!.price!;
    currentTurnPlayer.properties.push(boughtProperty!.id);
    boughtProperty!.owner = currentTurnPlayer.username;

    const boughtCars = game.boardState.tiles.filter(
      t => t.type === "car" && t.owner === currentTurnPlayer.username
    );

    boughtCars.forEach(c => {
      c.rentLevel = boughtCars.length - 1;
    });
  }

  if (boughtProperty!.type === "bonus-property") {
    currentTurnPlayer.balance -= boughtProperty!.price!;
    currentTurnPlayer.properties.push(boughtProperty!.id);
    boughtProperty!.owner = currentTurnPlayer.username;

    const propertiesOwned = game.boardState.tiles.filter(
      t => t.type === "bonus-property" && t.owner === currentTurnPlayer.username
    );

    propertiesOwned.forEach(p => {
      p.rentLevel = propertiesOwned.length - 1;
    });
  }

  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);

  game.currentAction = "roll";
  return;
};
