import prisma from "~/lib/prisma";
import { broadcastToRoom } from "~/server/utils/roomPeers";
import type { DiceRollEvent, GameState, PlayerMoveEvent } from "~/types";

export const broadcastGameState = async (
  roomId: string,
  peer: any | null,
  newGameState: GameState,
  lastMove?: PlayerMoveEvent | null,
  lastRoll?: DiceRollEvent | null
): Promise<GameState> => {
  const normalizedBoard = {
    tiles: newGameState.board.tiles.map((tile) => ({
      ...tile,
      rentLevels: tile.rentLevels ?? [],
    })),
    groups: newGameState.board.groups,
  };

  const normalizedChance = {
    type: newGameState.activeChance?.type ?? "",
    amount: newGameState.activeChance?.amount ?? null,
    text: newGameState.activeChance?.text ?? null,
  };

  const normalizedTrade = newGameState.activeTrade
    ? {
        from: newGameState.activeTrade.from ?? "",
        to: newGameState.activeTrade.to ?? "",
        given: newGameState.activeTrade.given ?? [],
        received: newGameState.activeTrade.received ?? [],
        givenMoney: newGameState.activeTrade.givenMoney ?? 0,
        receivedMoney: newGameState.activeTrade.receivedMoney ?? 0,
      }
    : {
        from: "",
        to: "",
        given: [],
        received: [],
        givenMoney: 0,
        receivedMoney: 0,
      };

  const updatedGame = await prisma.game.update({
    where: {
      associatedRoomId: roomId,
    },
    data: {
      status: newGameState.status,
      winnerUsername: newGameState.winnerUsername,
      eliminatedPlayers: newGameState.eliminatedPlayers,
      players: newGameState.players,
      currentTurn: newGameState.currentTurn,
      gameLog: newGameState.gameLog,
      board: normalizedBoard,
      currentAction: newGameState.currentAction,
      auctionParticipants: newGameState.auctionParticipants,
      activeAuctionBidder: newGameState.activeAuctionBidder,
      auctionBidAmount: newGameState.auctionBidAmount,
      auctionedTileId: newGameState.auctionedTileId,
      activeChance: normalizedChance,
      activeTrade: normalizedTrade,
      lastDiceRoll: newGameState.lastDiceRoll ?? null,
      declinedTrades: newGameState.declinedTrades ?? [],
    },
  });

  if (newGameState.status === "ENDED") {
    await prisma.room.updateMany({
      where: {
        id: roomId,
      },
      data: {
        status: "ENDED",
      },
    });
  }

  const payload = {
    ...updatedGame,
    ...(lastMove ? { lastMove } : {}),
    ...(lastRoll ? { lastRoll } : {}),
  };
  const serialized = JSON.stringify(payload);

  broadcastToRoom(roomId, serialized, peer);

  return updatedGame as GameState;
};
