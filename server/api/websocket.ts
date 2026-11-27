import { parse } from "url";
import prisma from "~/lib/prisma";
import type { GameState } from "../../types";
import {
  applyGameActionWithEvents,
  cancelBotLoop,
  computeMoveAnimationDelayMs,
  resumeBotLoopIfNeeded,
  scheduleBotStepIfNeeded,
} from "../utils/bots/botRunner";
import { broadcastGameState } from "../utils/gameActions";
import {
  addRoomPeer,
  getRoomPeerCount,
  removeRoomPeer,
} from "../utils/roomPeers";
import { broadcastRoomsUpdate } from "./rooms";

const MUTATING_ACTIONS = new Set([
  "ROLL_DICE",
  "BUY_PROPERTY",
  "PASS_PROPERTY",
  "PASS_AUCTION_PROPERTY",
  "BID_AUCTION_PROPERTY",
  "PAY_RENT",
  "MORTGAGE_PROPERTY",
  "BUY_BACK_PROPERTY",
  "UPGRADE_PROPERTY",
  "SELL_PROPERTY",
  "PAY_CHANCE",
  "JAIL_PAY",
  "PAY_TAX",
  "TRADE",
  "ACCEPT_TRADE",
  "DECLINE_TRADE",
]);

function isActionAuthorized(
  game: GameState,
  action: string,
  senderUsername: unknown
): boolean {
  const sender =
    typeof senderUsername === "string" && senderUsername.length > 0
      ? senderUsername
      : null;

  if (action === "ACCEPT_TRADE" || action === "DECLINE_TRADE") {
    if (game.currentAction !== "trade") {
      return false;
    }
    const tradeRecipientUsername = game.activeTrade?.to;
    if (!tradeRecipientUsername) {
      return false;
    }
    if (sender && tradeRecipientUsername !== sender) {
      return false;
    }
    const recipientPlayer = game.players.find(
      (p) => p.username === tradeRecipientUsername
    );
    if (recipientPlayer?.isBot) {
      return false;
    }
    return true;
  }

  if (action === "BID_AUCTION_PROPERTY" || action === "PASS_AUCTION_PROPERTY") {
    if (game.currentAction !== "auction") {
      return false;
    }
    if (!sender || game.activeAuctionBidder !== sender) {
      return false;
    }
    const bidderPlayer = game.players.find((p) => p.username === sender);
    if (!bidderPlayer || bidderPlayer.isBot) {
      return false;
    }
    return true;
  }

  const currentTurnPlayer = game.players.find(
    (p) => p.username === game.currentTurn
  );
  if (!currentTurnPlayer || currentTurnPlayer.isBot) {
    return false;
  }

  return sender === game.currentTurn;
}

export default defineWebSocketHandler({
  async open(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    peer.subscribe(roomId);
    addRoomPeer(roomId, peer);

    const game = (await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    })) as GameState | null;

    if (game) {
      console.log("game in websocket found", roomId);
      peer.send(JSON.stringify(game));
      resumeBotLoopIfNeeded(roomId);
      return;
    }

    console.log("game not found in websocket", roomId);
  },
  close(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    removeRoomPeer(roomId, peer);
    if (getRoomPeerCount(roomId) === 0) {
      cancelBotLoop(roomId);
    }
    console.log(`Closed WS for room: ${roomId}`);
  },
  error(peer, error) {
    console.log("error on ws", peer, error);
  },
  async message(peer, message) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    console.log(`Message received in room ${roomId}:`, message.text());

    const parsedMessage = JSON.parse(message.text());

    const game = (await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    })) as GameState | null;

    if (!game) {
      return;
    }

    game.status = game.status || "STARTED";
    game.winnerUsername = game.winnerUsername || null;
    game.eliminatedPlayers = game.eliminatedPlayers || [];
    game.declinedTrades = game.declinedTrades || [];

    if (!MUTATING_ACTIONS.has(parsedMessage.action)) {
      return;
    }

    if (game.status === "ENDED") {
      peer.send(JSON.stringify(game));
      return;
    }

    if (
      !isActionAuthorized(
        game,
        parsedMessage.action,
        parsedMessage.payload?.username
      )
    ) {
      peer.send(JSON.stringify(game));
      return;
    }

    const { lastMove, lastRoll } = applyGameActionWithEvents(game, parsedMessage);
    await broadcastGameState(roomId, peer, game, lastMove, lastRoll);

    const updatedStatus = game.status as GameState["status"];
    if (updatedStatus === "ENDED") {
      cancelBotLoop(roomId);
      await broadcastRoomsUpdate();
      return;
    }

    scheduleBotStepIfNeeded(
      roomId,
      computeMoveAnimationDelayMs(lastMove, lastRoll)
    );
  },
});

function getRoomIdFromPeer(url: string): string {
  const queryParams = parse(url, true).query;

  return queryParams!.roomId!.toString();
}
