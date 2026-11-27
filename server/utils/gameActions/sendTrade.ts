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
  const returnAction =
    game.currentAction === "payRent" ||
    game.currentAction === "payTax" ||
    game.currentAction === "chance"
      ? game.currentAction
      : "roll";

  game.currentAction = "trade";
  game.activeTrade = {
    from: username,
    to: tradePlayerUsername,
    given,
    received,
    givenMoney: normalizedGivenMoney,
    receivedMoney: normalizedReceivedMoney,
    returnAction,
  };
  game.gameLog.push({
    username,
    msg: `sent a trade offer to ${tradePlayerUsername}`,
  });
  return;
};
