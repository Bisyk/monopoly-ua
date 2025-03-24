import { GameState, Player, Tile } from "~/types";
import { checkIsFullPropertySet } from "./checkIsFullPropertySet";

export const acceptTrade = (game: GameState) => {
  if (!game.activeTrade) return;

  const { from, to, given, received, givenMoney, receivedMoney } =
    game.activeTrade;

  const playerFrom = game.players.find((p: Player) => p.username === from);
  const playerTo = game.players.find((p: Player) => p.username === to);

  given.forEach((g: number) => {
    playerFrom!.properties = playerFrom!.properties.filter(p => p !== g);
    playerTo!.properties.push(g);
    game.boardState.tiles.find((t: Tile) => t.id === g)!.owner = to;
  });

  received.forEach((r: number) => {
    playerTo!.properties = playerTo!.properties.filter(p => p !== r);
    playerFrom!.properties.push(r);
    game.boardState.tiles.find((t: Tile) => t.id === r)!.owner = from;
  });

  checkIsFullPropertySet(playerFrom, game.boardState);
  checkIsFullPropertySet(playerTo, game.boardState);

  playerFrom!.balance -= givenMoney!;
  playerTo!.balance += givenMoney!;

  playerFrom!.balance += receivedMoney!;
  playerTo!.balance -= receivedMoney!;

  game.activeTrade = {
    from: "",
    to: "",
    given: [],
    received: [],
    givenMoney: 0,
    receivedMoney: 0,
  };

  game.currentAction = "roll";
  return;
};
