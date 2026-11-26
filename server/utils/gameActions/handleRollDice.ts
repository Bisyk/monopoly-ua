import { chances } from "~/server/constants";
import { changePlayerTurn } from "./changePlayerTurn";
import type { GameState, MoveSegment, Player, PlayerMoveEvent, Tile } from "~/types";
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
  const startPosition = currentTurnPlayer.position;
  const segments: MoveSegment[] = [];

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
    currentTurnPlayer.jailed = true;
    currentTurnPlayer.turnsInJail = GAME_RULES.JAIL_TURNS;
    currentTurnPlayer.doublesInRow = 0;
    currentTurnPlayer.bonusRoll = false;
    currentTurnPlayer.position = JAIL_TILE_ID;
    game.currentAction = "roll";
    game.gameLog.push({
      username: game.currentTurn,
      msg: "Rolled 3 doubles in a row and went to jail",
    });
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);

    if (startPosition !== JAIL_TILE_ID) {
      segments.push({
        from: startPosition,
        to: JAIL_TILE_ID,
        mode: "direct",
      });
    }

    return segments.length
      ? {
          moveId: crypto.randomUUID(),
          username: currentTurnPlayer.username,
          segments,
        }
      : null;
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

  const newPlayerPosition =
    ((currentTurnPlayer.position + left + right - 1) % boardSize) + 1;

  currentTurnPlayer.position = newPlayerPosition;
  if (startPosition !== newPlayerPosition) {
    segments.push({
      from: startPosition,
      to: newPlayerPosition,
      mode: "step",
    });
  }

  const tilePlayerOn = game.board.tiles.find(
    (t: Tile) => t.id === newPlayerPosition
  );

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
      const targetTileId = yourChance.tileId ?? JAIL_TILE_ID;
      currentTurnPlayer.position = targetTileId;
      currentTurnPlayer.jailed = true;
      currentTurnPlayer.turnsInJail = GAME_RULES.JAIL_TURNS;
      game.currentAction = "roll";
      changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);

      if (newPlayerPosition !== targetTileId) {
        segments.push({
          from: newPlayerPosition,
          to: targetTileId,
          mode: "direct",
        });
      }
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
    currentTurnPlayer.balance += GAME_RULES.PASS_GO_BONUS;
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You got 200$ for landing on go",
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
    currentTurnPlayer.jailed = true;
    currentTurnPlayer.turnsInJail = GAME_RULES.JAIL_TURNS;
    currentTurnPlayer.position = JAIL_TILE_ID;
    game.currentAction = "roll";
    game.gameLog.push({
      username: game.currentTurn,
      msg: "You are going in jail",
    });
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);

    if (newPlayerPosition !== JAIL_TILE_ID) {
      segments.push({
        from: newPlayerPosition,
        to: JAIL_TILE_ID,
        mode: "direct",
      });
    }
  }

  return segments.length
    ? {
        moveId: crypto.randomUUID(),
        username: currentTurnPlayer.username,
        segments,
      }
    : null;
};
