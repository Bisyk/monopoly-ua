import prisma from "~/lib/prisma";
import { GameState } from "~/types";

export const syncGameState = async (
  roomId: string,
  peer: any,
  newGameState: GameState
) => {
  const updatedGame = await prisma.game.update({
    where: {
      associatedRoomId: roomId,
    },
    data: {
      players: newGameState.players,
      currentTurn: newGameState.currentTurn,
      gameLog: newGameState.gameLog,
      boardState: newGameState.boardState,
      currentAction: newGameState.currentAction,
      auctionParticipants: newGameState.auctionParticipants,
      currentAuctionParticipant: newGameState.currentAuctionParticipant,
      currentAuctionBid: newGameState.currentAuctionBid,
      tileOnAuction: newGameState.tileOnAuction,
      activeChance: newGameState.activeChance ,
      activeTrade: newGameState.activeTrade,
    },
  });

  peer.send(JSON.stringify(updatedGame));
  peer.publish(roomId, JSON.stringify(updatedGame));
};
