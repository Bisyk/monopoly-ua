import { GameState } from "~/types";

export const sendTrade = (game: GameState, parsedMessage: any) => {
  const { username, tradePlayerUsername, tradeTiles } = parsedMessage.payload;

  const { given, received, givenMoney, receivedMoney } = tradeTiles;

  game.currentAction = "trade";
  game.activeTrade = {
    from: username,
    to: tradePlayerUsername,
    given,
    received,
    givenMoney,
    receivedMoney,
  };
  return;
};
