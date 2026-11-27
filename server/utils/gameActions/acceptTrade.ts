import type { GameState, Player, Tile } from "~/types";
import { computeMortgageTransferFee } from "~/shared/utils/mortgageTransferFee";
import {
  recalculateSpecialPropertyRentLevels,
  syncPropertySets,
} from "./shared";

export const acceptTrade = (game: GameState) => {
  if (!game.activeTrade || !game.activeTrade.from || !game.activeTrade.to) {
    return;
  }

  const { from, to, given, received, givenMoney, receivedMoney } =
    game.activeTrade;

  const playerFrom = game.players.find((p: Player) => p.username === from);
  const playerTo = game.players.find((p: Player) => p.username === to);

  if (!playerFrom || !playerTo) {
    return;
  }

  const normalizedGivenMoney = Number(givenMoney) || 0;
  const normalizedReceivedMoney = Number(receivedMoney) || 0;

  // Strict Hasbro rule: recipients of mortgaged properties immediately pay 10% of mortgage value to the bank
  const toMortgageFee = computeMortgageTransferFee(game.board.tiles, given);
  const fromMortgageFee = computeMortgageTransferFee(
    game.board.tiles,
    received
  );

  const postFromBalance =
    playerFrom.balance -
    normalizedGivenMoney +
    normalizedReceivedMoney -
    fromMortgageFee;
  const postToBalance =
    playerTo.balance +
    normalizedGivenMoney -
    normalizedReceivedMoney -
    toMortgageFee;

  if (postFromBalance < 0 || postToBalance < 0) {
    return;
  }

  given.forEach((g: number) => {
    playerFrom.properties = playerFrom.properties.filter((p) => p !== g);
    if (!playerTo.properties.includes(g)) {
      playerTo.properties.push(g);
    }
    const tile = game.board.tiles.find((t: Tile) => t.id === g);
    if (tile) {
      tile.owner = to;
    }
  });

  received.forEach((r: number) => {
    playerTo.properties = playerTo.properties.filter((p) => p !== r);
    if (!playerFrom.properties.includes(r)) {
      playerFrom.properties.push(r);
    }
    const tile = game.board.tiles.find((t: Tile) => t.id === r);
    if (tile) {
      tile.owner = from;
    }
  });

  playerFrom.balance = postFromBalance;
  playerTo.balance = postToBalance;

  syncPropertySets(game);
  recalculateSpecialPropertyRentLevels(game);

  game.gameLog.push({
    username: to,
    msg: `accepted trade from ${from}`,
  });

  if (toMortgageFee > 0) {
    game.gameLog.push({
      username: to,
      msg: `paid $${toMortgageFee} mortgage transfer fee (10%)`,
    });
  }

  if (fromMortgageFee > 0) {
    game.gameLog.push({
      username: from,
      msg: `paid $${fromMortgageFee} mortgage transfer fee (10%)`,
    });
  }

  const returnAction = game.activeTrade.returnAction || "roll";

  game.activeTrade = {
    from: "",
    to: "",
    given: [],
    received: [],
    givenMoney: 0,
    receivedMoney: 0,
    returnAction: null,
  };

  game.currentAction = returnAction;
  return;
};
