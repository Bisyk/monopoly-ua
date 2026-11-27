import prisma from "~/lib/prisma";
import {
  BOT_STEP_DELAY_MS,
  DICE_JAIL_HOLD_EXTRA_MS,
  DICE_LEAD_IN_MS,
} from "~/shared/constants/animationTimings";
import type { DiceRollEvent, GameState, PlayerMoveEvent } from "~/types";
import {
  buildStepPath,
  computeStepSegmentDurationMs,
  DEFAULT_BOARD_SIZE,
  DEFAULT_SEGMENT_PAUSE_MS,
} from "~/utils/playerMovement";
import { broadcastRoomsUpdate } from "../../api/rooms";
import {
  acceptTrade,
  bidAuctionProperty,
  broadcastGameState,
  buybackProperty,
  buyProperty,
  declineTrade,
  handleRollDice,
  mortgageProperty,
  passAuctionProperty,
  passProperty,
  payChance,
  payJail,
  payRent,
  payTax,
  sellProperty,
  sendTrade,
  upgradeProperty,
} from "../gameActions";
import { getRoomPeerCount } from "../roomPeers";
import {
  decideBotAction,
  getActingBot,
  type BotTurnContext,
} from "./decisionEngine";

export { BOT_STEP_DELAY_MS };
export const DIRECT_MOVE_MS = 520;

const BUSY_RETRY_DELAY_MS = 250;
const TRADE_COOLDOWN_TURNS = 3;

const MANAGEMENT_ACTIONS = new Set([
  "MORTGAGE_PROPERTY",
  "BUY_BACK_PROPERTY",
  "UPGRADE_PROPERTY",
  "SELL_PROPERTY",
  "JAIL_PAY",
  "TRADE",
]);

interface RoomRunnerState {
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  turnKey: string;
  lastTurnOwner: string;
  turnCounter: number;
  proposedTradeThisTurn: boolean;
  proposedLiquidationTradeThisTurn: boolean;
  mortgagedTileIdsThisTurn: number[];
  turnStepCount: number;
  tradeCooldownByBotAndTarget: Record<string, Record<string, number>>;
}

const roomRunnerState = new Map<string, RoomRunnerState>();

function getOrCreateRoomState(roomId: string): RoomRunnerState {
  let state = roomRunnerState.get(roomId);
  if (!state) {
    state = {
      timer: null,
      running: false,
      turnKey: "",
      lastTurnOwner: "",
      turnCounter: 0,
      proposedTradeThisTurn: false,
      proposedLiquidationTradeThisTurn: false,
      mortgagedTileIdsThisTurn: [],
      turnStepCount: 0,
      tradeCooldownByBotAndTarget: {},
    };
    roomRunnerState.set(roomId, state);
  }
  return state;
}

function decrementBotCooldowns(state: RoomRunnerState, botUsername: string): void {
  const cooldowns = state.tradeCooldownByBotAndTarget[botUsername];
  if (!cooldowns) {
    return;
  }

  for (const target of Object.keys(cooldowns)) {
    if (cooldowns[target] <= 1) {
      delete cooldowns[target];
    } else {
      cooldowns[target] -= 1;
    }
  }
}

export function computeMoveAnimationDelayMs(
  lastMove?: PlayerMoveEvent | null,
  lastRoll?: DiceRollEvent | null
): number {
  let moveMs = 0;

  if (lastMove && Array.isArray(lastMove.segments) && lastMove.segments.length > 0) {
    let validSegments = 0;

    for (const segment of lastMove.segments) {
      if (segment.mode === "step") {
        const steps = buildStepPath(
          segment.from,
          segment.to,
          DEFAULT_BOARD_SIZE
        ).length;
        if (steps > 0) {
          if (validSegments > 0) {
            moveMs += DEFAULT_SEGMENT_PAUSE_MS;
          }
          moveMs += computeStepSegmentDurationMs(steps);
          validSegments += 1;
        }
      } else if (segment.mode === "direct" && segment.from !== segment.to) {
        if (validSegments > 0) {
          moveMs += DEFAULT_SEGMENT_PAUSE_MS;
        }
        moveMs += DIRECT_MOVE_MS;
        validSegments += 1;
      }
    }
  }

  if (lastRoll) {
    return DICE_LEAD_IN_MS + (moveMs > 0 ? moveMs : DICE_JAIL_HOLD_EXTRA_MS);
  }

  return moveMs;
}

export interface AppliedActionEvents {
  lastMove: PlayerMoveEvent | null;
  lastRoll: DiceRollEvent | null;
}

export function applyGameActionWithEvents(
  game: GameState,
  parsedMessage: { action: string; payload?: Record<string, any> }
): AppliedActionEvents {
  let lastRoll: DiceRollEvent | null = null;
  if (parsedMessage.action === "ROLL_DICE") {
    const roller = game.players.find((p) => p.username === game.currentTurn);
    const left = Number(parsedMessage.payload?.turnResult?.left ?? 1);
    const right = Number(parsedMessage.payload?.turnResult?.right ?? 1);
    if (roller) {
      lastRoll = {
        rollId: crypto.randomUUID(),
        username: roller.username,
        left,
        right,
        isDoubles: left === right,
      };
    }
  }

  const lastMove = applyGameAction(game, parsedMessage);
  return { lastMove, lastRoll };
}

export function applyGameAction(
  game: GameState,
  parsedMessage: { action: string; payload?: Record<string, any> }
): PlayerMoveEvent | null {
  const currentTurnPlayerIdx = game.players.findIndex(
    (p) => p.username === game.currentTurn
  );
  const currentTurnPlayer =
    currentTurnPlayerIdx >= 0 ? game.players[currentTurnPlayerIdx] : undefined;

  switch (parsedMessage.action) {
    case "ROLL_DICE":
      if (!currentTurnPlayer) return null;
      return handleRollDice(
        game,
        currentTurnPlayer,
        currentTurnPlayerIdx,
        parsedMessage
      );

    case "BUY_PROPERTY":
      if (!currentTurnPlayer) return null;
      buyProperty(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      return null;

    case "PASS_PROPERTY":
      if (!currentTurnPlayer) return null;
      passProperty(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      return null;

    case "PASS_AUCTION_PROPERTY":
      if (!currentTurnPlayer) return null;
      passAuctionProperty(
        game,
        currentTurnPlayer,
        currentTurnPlayerIdx,
        parsedMessage
      );
      return null;

    case "BID_AUCTION_PROPERTY":
      if (!currentTurnPlayer) return null;
      bidAuctionProperty(
        game,
        currentTurnPlayer,
        currentTurnPlayerIdx,
        parsedMessage
      );
      return null;

    case "PAY_RENT":
      if (!currentTurnPlayer) return null;
      payRent(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      return null;

    case "MORTGAGE_PROPERTY":
      if (!currentTurnPlayer) return null;
      mortgageProperty(game, currentTurnPlayer, parsedMessage);
      return null;

    case "BUY_BACK_PROPERTY":
      if (!currentTurnPlayer) return null;
      buybackProperty(game, currentTurnPlayer, parsedMessage);
      return null;

    case "UPGRADE_PROPERTY":
      if (!currentTurnPlayer) return null;
      upgradeProperty(game, currentTurnPlayer, parsedMessage);
      return null;

    case "SELL_PROPERTY":
      if (!currentTurnPlayer) return null;
      sellProperty(game, currentTurnPlayer, parsedMessage);
      return null;

    case "PAY_CHANCE":
      if (!currentTurnPlayer) return null;
      payChance(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      return null;

    case "JAIL_PAY":
      if (!currentTurnPlayer) return null;
      payJail(game, currentTurnPlayer);
      return null;

    case "PAY_TAX":
      if (!currentTurnPlayer) return null;
      payTax(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      return null;

    case "TRADE":
      sendTrade(game, parsedMessage);
      return null;

    case "ACCEPT_TRADE":
      acceptTrade(game);
      return null;

    case "DECLINE_TRADE":
      declineTrade(game);
      return null;

    default:
      return null;
  }
}

export function cancelBotLoop(roomId: string): void {
  const state = roomRunnerState.get(roomId);
  if (state?.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

function scheduleWithExactDelay(roomId: string, delayMs: number): void {
  if (getRoomPeerCount(roomId) === 0) {
    cancelBotLoop(roomId);
    return;
  }

  const state = getOrCreateRoomState(roomId);
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  state.timer = setTimeout(() => {
    void runBotStep(roomId);
  }, Math.max(0, delayMs));
}

export function scheduleBotStepIfNeeded(
  roomId: string,
  extraDelayMs = 0
): void {
  if (getRoomPeerCount(roomId) === 0) {
    cancelBotLoop(roomId);
    return;
  }

  scheduleWithExactDelay(roomId, BOT_STEP_DELAY_MS + extraDelayMs);
}

export function resumeBotLoopIfNeeded(roomId: string): void {
  if (getRoomPeerCount(roomId) === 0) {
    cancelBotLoop(roomId);
    return;
  }

  const state = getOrCreateRoomState(roomId);
  if (state.timer || state.running) {
    return;
  }

  scheduleWithExactDelay(roomId, BOT_STEP_DELAY_MS);
}

async function runBotStep(roomId: string): Promise<void> {
  const state = getOrCreateRoomState(roomId);
  state.timer = null;

  if (getRoomPeerCount(roomId) === 0) {
    cancelBotLoop(roomId);
    return;
  }

  if (state.running) {
    scheduleWithExactDelay(roomId, BUSY_RETRY_DELAY_MS);
    return;
  }

  state.running = true;
  let shouldScheduleNext = false;
  let nextExtraDelay = 0;

  try {
    const game = (await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    })) as GameState | null;

    if (!game) {
      cancelBotLoop(roomId);
      return;
    }

    game.status = game.status || "STARTED";
    game.winnerUsername = game.winnerUsername || null;
    game.eliminatedPlayers = game.eliminatedPlayers || [];
    game.declinedTrades = game.declinedTrades || [];

    if (game.status === "ENDED") {
      cancelBotLoop(roomId);
      roomRunnerState.delete(roomId);
      return;
    }

    const actingBot = getActingBot(game);
    if (!actingBot) {
      if (state.lastTurnOwner && state.lastTurnOwner !== game.currentTurn) {
        state.lastTurnOwner = "";
      }
      return;
    }

    const isOwnTurn = actingBot.username === game.currentTurn;
    if (isOwnTurn && state.lastTurnOwner !== game.currentTurn) {
      state.turnCounter += 1;
      state.lastTurnOwner = game.currentTurn;
      state.turnKey = `${game.currentTurn}:${state.turnCounter}`;
      state.proposedTradeThisTurn = false;
      state.proposedLiquidationTradeThisTurn = false;
      state.mortgagedTileIdsThisTurn = [];
      state.turnStepCount = 0;
      decrementBotCooldowns(state, actingBot.username);
    }

    const context: BotTurnContext = {
      proposedTradeThisTurn: isOwnTurn ? state.proposedTradeThisTurn : false,
      proposedLiquidationTradeThisTurn: isOwnTurn
        ? state.proposedLiquidationTradeThisTurn
        : false,
      mortgagedTileIdsThisTurn: isOwnTurn
        ? [...state.mortgagedTileIdsThisTurn]
        : [],
      turnStepCount: isOwnTurn ? state.turnStepCount : 0,
      tradeCooldownByTarget: {
        ...(state.tradeCooldownByBotAndTarget[actingBot.username] ?? {}),
      },
    };

    const decision = decideBotAction(game, actingBot, context);
    if (!decision) {
      return;
    }

    const beforeTurn = game.currentTurn;
    const beforeAction = game.currentAction;
    const beforeSnapshot = JSON.stringify(game);

    const { lastMove, lastRoll } = applyGameActionWithEvents(game, decision);

    if (!lastMove && !lastRoll && JSON.stringify(game) === beforeSnapshot) {
      console.warn(
        `Bot ${actingBot.username} produced no-op action ${decision.action} in room ${roomId}; stopping loop to avoid spin.`
      );
      return;
    }

    if (isOwnTurn && decision.action === "MORTGAGE_PROPERTY") {
      const mortgagedId = Number(decision.payload?.propertyId);
      if (
        Number.isFinite(mortgagedId) &&
        !state.mortgagedTileIdsThisTurn.includes(mortgagedId)
      ) {
        state.mortgagedTileIdsThisTurn.push(mortgagedId);
      }
    }

    if (decision.action === "TRADE") {
      if (isOwnTurn) {
        if (beforeAction === "roll") {
          state.proposedTradeThisTurn = true;
        } else {
          state.proposedLiquidationTradeThisTurn = true;
        }
      }
      const targetUsername = decision.payload?.tradePlayerUsername;
      if (typeof targetUsername === "string" && targetUsername.length > 0) {
        if (!state.tradeCooldownByBotAndTarget[actingBot.username]) {
          state.tradeCooldownByBotAndTarget[actingBot.username] = {};
        }
        state.tradeCooldownByBotAndTarget[actingBot.username][targetUsername] =
          TRADE_COOLDOWN_TURNS;
      }
    }

    if (isOwnTurn && MANAGEMENT_ACTIONS.has(decision.action)) {
      state.turnStepCount += 1;
    }

    if (isOwnTurn && decision.action === "ROLL_DICE") {
      state.turnStepCount = 0;
      state.proposedLiquidationTradeThisTurn = false;
      state.mortgagedTileIdsThisTurn = [];
    }

    if (game.currentTurn !== beforeTurn) {
      state.lastTurnOwner = "";
      state.proposedTradeThisTurn = false;
      state.proposedLiquidationTradeThisTurn = false;
      state.mortgagedTileIdsThisTurn = [];
      state.turnStepCount = 0;
    }

    await broadcastGameState(roomId, null, game, lastMove, lastRoll);

    const updatedStatus = game.status as GameState["status"];
    if (updatedStatus === "ENDED") {
      cancelBotLoop(roomId);
      roomRunnerState.delete(roomId);
      await broadcastRoomsUpdate();
      return;
    }

    nextExtraDelay = computeMoveAnimationDelayMs(lastMove, lastRoll);
    if (getActingBot(game) && getRoomPeerCount(roomId) > 0) {
      shouldScheduleNext = true;
    }
  } catch (err) {
    console.error(`Error executing bot step in room ${roomId}:`, err);
  } finally {
    state.running = false;
  }

  if (shouldScheduleNext && getRoomPeerCount(roomId) > 0) {
    scheduleBotStepIfNeeded(roomId, nextExtraDelay);
  }
}
