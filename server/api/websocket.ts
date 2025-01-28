import { parse } from "url";
import prisma from "~/lib/prisma";
import {
  initialGroupsState,
  initialPlayersState,
  initialTilesState,
} from "../constants";

// todo: replace with actual game state
const MAX_PLAYERS = 2;

export default defineWebSocketHandler({
  async open(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    peer.subscribe(roomId);
    const room = await prisma.room.findUnique({
      where: {
        id: roomId,
      },
    });

    const game = await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    });

    if (game) {
      peer.send(JSON.stringify(game));
      peer.publish(roomId, JSON.stringify(game));

      return;
    }

    if (!game) {
      const game = await prisma.game.create({
        data: {
          associatedRoomId: roomId,
          players: room!.players.map(player => ({
            username: player,
            ...initialPlayersState,
          })),
          currentTurn: room!.players[0],
          gameLog: [],
          boardState: {
            tiles: initialTilesState,
            groups: initialGroupsState,
          },
        },
      });
    }

    const createdGame = await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    });

    peer.send(JSON.stringify(createdGame));
    peer.publish(roomId, JSON.stringify(createdGame));
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

    console.log(parsedMessage);

    if (parsedMessage.action === "ROLL_DICE") {
      const game = await prisma.game.findUnique({
        where: {
          associatedRoomId: roomId,
        },
      });
      console.log("ROLL_DICE");
      console.log(parsedMessage.payload.turnResult);
      console.log(game);

      const { left, right } = parsedMessage.payload.turnResult;

      // const indexOfPlayerCurrentTurn = gameState[roomId].players.indexOf(
      //   gameState[roomId].currentTurn
      // );

      if (!game) {
        return;
      }

      const currentTurnPlayer = game.players.filter(
        p => p.username === game.currentTurn
      )[0];
      const currentTurnPlayerIdx = game.players.indexOf(currentTurnPlayer);

      game.gameLog.push({
        username: game.currentTurn,
        msg: `got ${left} and ${right}`,
      });

      const boardSize = 40;
      currentTurnPlayer.position =
        (currentTurnPlayer.position + left + right) % boardSize;
      if (currentTurnPlayer.position === 0) {
        currentTurnPlayer.position = boardSize;
      }

      if (currentTurnPlayerIdx < MAX_PLAYERS - 1) {
        game.currentTurn = game.players[currentTurnPlayerIdx + 1].username;
      } else {
        game.currentTurn = game.players[0].username;
      }

      console.log("gameState after ROLL_DICE", game);

      await syncGameState(roomId, peer, game);
    }
  },
});

function getRoomIdFromPeer(url: string): string {
  const queryParams = parse(url, true).query;

  return queryParams!.roomId!.toString();
}

async function syncGameState(roomId: string, peer, newGameState) {
  console.log(roomId);
  const updatedGame = await prisma.game.update({
    where: {
      associatedRoomId: roomId,
    },
    data: {
      players: newGameState.players,
      currentTurn: newGameState.currentTurn,
      gameLog: newGameState.gameLog,
      boardState: newGameState.boardState,
    },
  });

  peer.send(JSON.stringify(updatedGame));
  peer.publish(roomId, JSON.stringify(updatedGame));
}
