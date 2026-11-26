import { parse } from "url";
import prisma from "~/lib/prisma";
import { GameState } from "../../types";
import {
  broadcastGameState,
  handleRollDice,
  buyProperty,
  passProperty,
  passAuctionProperty,
  bidAuctionProperty,
  payRent,
  mortgageProperty,
  buybackProperty,
  upgradeProperty,
  checkIsFullPropertySet,
  sellProperty,
  payChance,
  payJail,
  payTax,
  sendTrade,
  acceptTrade,
  declineTrade,
} from "../utils/gameActions";

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

export default defineWebSocketHandler({
  async open(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    peer.subscribe(roomId);

    const game = (await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    })) as GameState;

    if (game) {
      console.log("game in websocket found", game);
      peer.send(JSON.stringify(game));
      peer.publish(roomId, JSON.stringify(game));

      return;
    }

    console.log("game not found in websocket");
  },
  close(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
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

    if (game.status === "ENDED" && MUTATING_ACTIONS.has(parsedMessage.action)) {
      peer.send(JSON.stringify(game));
      return;
    }

    const currentTurnPlayer = game.players.filter(
      p => p.username === game.currentTurn
    )[0];

    const currentTurnPlayerIdx = game.players.indexOf(currentTurnPlayer);

    if (parsedMessage.action === "ROLL_DICE") {
      handleRollDice(
        game,
        currentTurnPlayer,
        currentTurnPlayerIdx,
        parsedMessage
      );
      broadcastGameState(roomId, peer, game);
    }

    if (parsedMessage.action === "BUY_PROPERTY") {
      buyProperty(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "PASS_PROPERTY") {
      passProperty(
        game,
        currentTurnPlayer,
        currentTurnPlayerIdx,
        parsedMessage
      );
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "PASS_AUCTION_PROPERTY") {
      passAuctionProperty(
        game,
        currentTurnPlayer,
        currentTurnPlayerIdx,
        parsedMessage
      );
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "BID_AUCTION_PROPERTY") {
      bidAuctionProperty(
        game,
        currentTurnPlayer,
        currentTurnPlayerIdx,
        parsedMessage
      );
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "PAY_RENT") {
      payRent(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "MORTGAGE_PROPERTY") {
      mortgageProperty(game, currentTurnPlayer, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "BUY_BACK_PROPERTY") {
      buybackProperty(game, currentTurnPlayer, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "UPGRADE_PROPERTY") {
      upgradeProperty(game, currentTurnPlayer, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "SELL_PROPERTY") {
      sellProperty(game, currentTurnPlayer, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "PAY_CHANCE") {
      payChance(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "JAIL_PAY") {
      payJail(game, currentTurnPlayer);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "PAY_TAX") {
      payTax(game, currentTurnPlayer, currentTurnPlayerIdx, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "TRADE") {
      sendTrade(game, parsedMessage);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "ACCEPT_TRADE") {
      acceptTrade(game);
      broadcastGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "DECLINE_TRADE") {
      declineTrade(game);
      broadcastGameState(roomId, peer, game);
      return;
    }
  },
});

function getRoomIdFromPeer(url: string): string {
  const queryParams = parse(url, true).query;

  return queryParams!.roomId!.toString();
}
