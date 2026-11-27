import type { GameState } from "~/types";

export const sendTrade = (game: GameState, parsedMessage: any) => {
  const { username, tradePlayerUsername, tradeTiles } = parsedMessage.payload;

  const {
    given = [],
    received = [],
    givenMoney,
    receivedMoney,
  } = tradeTiles;

  const normalizedGivenMoney = Number(givenMoney) || 0;
  const normalizedReceivedMoney = Number(receivedMoney) || 0;

  game.currentAction = "trade";
  game.activeTrade = {
    from: username,
    to: tradePlayerUsername,
    given,
    received,
    givenMoney: normalizedGivenMoney,
    receivedMoney: normalizedReceivedMoney,
  };
  game.gameLog.push({
    username,
    msg: `sent a trade offer to ${tradePlayerUsername}`,
  });
  return;
};
