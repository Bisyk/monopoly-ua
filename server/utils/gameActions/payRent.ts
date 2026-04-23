import { GameState, Player } from "~/types";
import { changePlayerTurn, resolveBankruptcy } from ".";

export const payRent = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToPayRent = game.board.tiles.find(
    t => t.id === propertyId
  );

  const owner = game.players.find(p => p.username === propertyToPayRent!.owner);

  let rentToPay = 0;

  if (
    propertyToPayRent!.type === "bonus-property" &&
    parsedMessage.payload.turnResult
  ) {
    rentToPay =
      propertyToPayRent!.rentLevels![propertyToPayRent!.rentLevel!] *
      (parsedMessage.payload.turnResult.left +
        parsedMessage.payload.turnResult.right);
  } else {
    rentToPay = propertyToPayRent!.rentLevels![propertyToPayRent!.rentLevel!];
  }

  if (currentTurnPlayer.balance < rentToPay) {
    resolveBankruptcy({
      game,
      bankruptPlayer: currentTurnPlayer,
      currentTurnPlayerIdx,
      creditorUsername: owner?.username,
    });
    return;
  }

  currentTurnPlayer.balance -= rentToPay;
  owner!.balance += rentToPay;

  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  game.currentAction = "roll";
};
