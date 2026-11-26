import prisma from "~/lib/prisma";
import type { GameState, PlayerMoveEvent } from "~/types";

export const broadcastGameState = async (
  roomId: string,
  peer: any,
  newGameState: GameState,
  lastMove?: PlayerMoveEvent | null
) => {
  const updatedGame = await prisma.game.update({
    where: {
      associatedRoomId: roomId,
    },
    data: {
      players: newGameState.players,
      currentTurn: newGameState.currentTurn,
      gameLog: newGameState.gameLog,
      board: newGameState.board,
      currentAction: newGameState.currentAction,
      auctionParticipants: newGameState.auctionParticipants,
      activeAuctionBidder: newGameState.activeAuctionBidder,
      auctionBidAmount: newGameState.auctionBidAmount,
      auctionedTileId: newGameState.auctionedTileId,
      activeChance: newGameState.activeChance,
      activeTrade: newGameState.activeTrade,
    },
  });

  const payload = lastMove ? { ...updatedGame, lastMove } : updatedGame;
  const serialized = JSON.stringify(payload);

  peer.send(serialized);
  peer.publish(roomId, serialized);
};
