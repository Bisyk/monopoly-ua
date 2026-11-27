import type { GameState, Player } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { resolveBankruptcy } from "./resolveBankruptcy";

export const payRent = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToPayRent = game.board.tiles.find((t) => t.id === propertyId);
  if (!propertyToPayRent || !propertyToPayRent.owner) {
    return;
  }

  const owner = game.players.find(
    (p) => p.username === propertyToPayRent.owner
  );
  if (!owner) {
    return;
  }

  const rentLevel = propertyToPayRent.rentLevel ?? 0;
  const baseRent = propertyToPayRent.rentLevels?.[rentLevel] ?? 0;
  let rentToPay = 0;

  if (propertyToPayRent.type === "bonus-property") {
    const diceRoll = parsedMessage.payload.turnResult ?? game.lastDiceRoll;
    const diceSum =
      diceRoll &&
      typeof diceRoll.left === "number" &&
      typeof diceRoll.right === "number"
        ? diceRoll.left + diceRoll.right
        : 7;
    rentToPay = baseRent * diceSum;
  } else {
    rentToPay = baseRent;
  }

  if (currentTurnPlayer.balance < rentToPay) {
    resolveBankruptcy({
      game,
      bankruptPlayer: currentTurnPlayer,
      currentTurnPlayerIdx,
      creditorUsername: owner.username,
    });
    return;
  }

  currentTurnPlayer.balance -= rentToPay;
  owner.balance += rentToPay;

  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `paid $${rentToPay} rent to ${owner.username} for ${propertyToPayRent.name}`,
  });

  changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  game.currentAction = "roll";
};
