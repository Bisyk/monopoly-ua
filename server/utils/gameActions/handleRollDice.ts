import { chances } from "~/server/constants";
import { changePlayerTurn } from "./changePlayerTurn";
import type {
  GameState,
  MoveMode,
  MoveSegment,
  Player,
  PlayerMoveEvent,
  Tile,
} from "~/types";
import { GAME_RULES } from "~/shared/constants/gameRules";

const JAIL_TILE_ID = 11;

export const handleRollDice = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
): PlayerMoveEvent | null => {
  const boardSize = GAME_RULES.BOARD_SIZE;
  const { left, right } = parsedMessage.payload.turnResult;
  game.lastDiceRoll = { left, right };
  const startPosition = currentTurnPlayer.position;
  const segments: MoveSegment[] = [];

  const addSegment = (from: number, to: number, mode: MoveMode) => {
    if (from !== to) {
      segments.push({ from, to, mode });
    }
  };

  const buildMoveEvent = (): PlayerMoveEvent | null =>
    segments.length
      ? {
          moveId: crypto.randomUUID(),
          username: currentTurnPlayer.username,
          segments,
        }
      : null;

  const sendPlayerToJail = (
    fromTileId: number,
    targetTileId: number = JAIL_TILE_ID
  ) => {
    currentTurnPlayer.jailed = true;
    currentTurnPlayer.turnsInJail = GAME_RULES.JAIL_TURNS;
    currentTurnPlayer.doublesInRow = 0;
    currentTurnPlayer.bonusRoll = false;
    currentTurnPlayer.position = targetTileId;
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
    addSegment(fromTileId, targetTileId, "direct");
  };

  if (left === right) {
    currentTurnPlayer.doublesInRow += 1;
    currentTurnPlayer.bonusRoll = true;
    game.gameLog.push({
      username: game.currentTurn,
      msg: `rolled ${left} and ${right} and got bonus roll`,
    });
  } else {
    game.gameLog.push({
      username: game.currentTurn,
      msg: `rolled ${left} and ${right}`,
    });
    currentTurnPlayer.doublesInRow = 0;
    currentTurnPlayer.bonusRoll = false;
  }

  if (currentTurnPlayer.doublesInRow === GAME_RULES.MAX_DOUBLES_BEFORE_JAIL) {
    game.gameLog.push({
      username: game.currentTurn,
      msg: "Rolled 3 doubles in a row and went to jail",
    });
    sendPlayerToJail(startPosition);
    return buildMoveEvent();
  }

  if (currentTurnPlayer.jailed) {
    currentTurnPlayer.turnsInJail -= 1;

    if (!(left === right) && currentTurnPlayer.turnsInJail > 0) {
      if (currentTurnPlayer.turnsInJail === 0) {
        currentTurnPlayer.jailed = false;
      }

      game.gameLog.push({
        username: game.currentTurn,
        msg: `You failed to roll doubles and stay in jail. Turns left: ${currentTurnPlayer.turnsInJail}`,
      });
      changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
      return null;
    }

    if (left === right) {
      currentTurnPlayer.jailed = false;
      currentTurnPlayer.turnsInJail = 0;
      game.gameLog.push({
        username: game.currentTurn,
        msg: "You rolled doubles and got out of jail",
      });
    }

    if (currentTurnPlayer.turnsInJail === 0) {
      currentTurnPlayer.jailed = false;
      game.gameLog.push({
        username: game.currentTurn,
        msg: "You got out of jail",
      });
    }
  }

  const rawPosition = currentTurnPlayer.position + left + right;
  const newPlayerPosition = ((rawPosition - 1) % boardSize) + 1;

  currentTurnPlayer.position = newPlayerPosition;
  addSegment(startPosition, newPlayerPosition, "step");

  const tilePlayerOn = game.board.tiles.find(
    (t: Tile) => t.id === newPlayerPosition
  );

  if (rawPosition > boardSize && tilePlayerOn?.type !== "go") {
    currentTurnPlayer.balance += GAME_RULES.PASS_GO_BONUS;
    game.gameLog.push({
      username: game.currentTurn,
      msg: `You got $${GAME_RULES.PASS_GO_BONUS} for passing GO`,
    });
  }

  if (
    ["property", "car", "bonus-property"].includes(tilePlayerOn!.type) &&
    !tilePlayerOn!.owner
  ) {
    game.currentAction = "buy";
  }

  if (
    ["property", "car", "bonus-property"].includes(tilePlayerOn!.type) &&
    tilePlayerOn!.owner &&
    tilePlayerOn!.owner !== currentTurnPlayer.username &&
    !tilePlayerOn!.mortgaged
  ) {
    game.currentAction = "payRent";
    game.gameLog.push({
      username: game.currentTurn,
      msg: `You have to pay rent to ${tilePlayerOn!.owner}`,
    });
  }

  if (
    ["property", "car", "bonus-property"].includes(tilePlayerOn!.type) &&
    tilePlayerOn!.owner &&
    tilePlayerOn!.owner !== currentTurnPlayer.username &&
    tilePlayerOn!.mortgaged
  ) {
    game.gameLog.push({
      username: game.currentTurn,
      msg: `${tilePlayerOn!.name} is mortgaged — no rent owed`,
    });
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (tilePlayerOn!.owner === currentTurnPlayer.username) {
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You landed on your property",
    });
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (tilePlayerOn!.type === "chance") {
    game.currentAction = "chance";

    const yourChance = chances[Math.floor(Math.random() * chances.length)];

    game.gameLog.push({
      username: game.currentTurn,
      msg: yourChance.text!,
    });

    if (yourChance.type === "goToJail") {
      sendPlayerToJail(newPlayerPosition, yourChance.tileId ?? JAIL_TILE_ID);
    }

    if (yourChance.type === "minusBalance") {
      game.activeChance = yourChance;
    }

    if (yourChance.type === "plusBalance") {
      currentTurnPlayer.balance += yourChance.amount!;
      game.currentAction = "roll";
      changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
    }
  }

  if (tilePlayerOn!.type === "tax") {
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You need to pay 100$ tax",
    });
    game.currentAction = "payTax";
  }

  if (tilePlayerOn!.type === "luxury-tax") {
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You need to pay 75$ luxury tax",
    });
    game.currentAction = "payTax";
  }

  if (tilePlayerOn!.type === "go") {
    currentTurnPlayer.balance += GAME_RULES.LAND_ON_GO_BONUS;
    game.gameLog.push({
      username: game.currentTurn,
      msg: `You got $${GAME_RULES.LAND_ON_GO_BONUS} for landing on GO`,
    });
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (tilePlayerOn!.type === "jail") {
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You are in jail with excursion",
    });
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (tilePlayerOn!.type === "parking") {
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You landed on parking",
    });
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (tilePlayerOn!.type === "goToJail") {
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You are going in jail",
    });
    sendPlayerToJail(newPlayerPosition);
  }

  return buildMoveEvent();
};
