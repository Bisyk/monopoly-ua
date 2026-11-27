import type { GameState } from "~/types";
import { recordDeclinedTrade } from "~/shared/utils/tradeSignature";

export const declineTrade = (game: GameState) => {
  if (game.activeTrade && game.activeTrade.from && game.activeTrade.to) {
    recordDeclinedTrade(game, game.activeTrade);
    game.gameLog.push({
      username: game.activeTrade.to,
      msg: `declined trade from ${game.activeTrade.from}`,
    });
  }

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
