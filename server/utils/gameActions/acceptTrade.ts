import type { GameState, Player, Tile } from "~/types";
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

  playerFrom.balance -= normalizedGivenMoney;
  playerTo.balance += normalizedGivenMoney;

  playerFrom.balance += normalizedReceivedMoney;
  playerTo.balance -= normalizedReceivedMoney;

  syncPropertySets(game);
  recalculateSpecialPropertyRentLevels(game);

  game.gameLog.push({
    username: to,
    msg: `accepted trade from ${from}`,
  });

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
