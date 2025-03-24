import { GameState } from "../../../types";

export const declineTrade = (game: GameState) => {
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
