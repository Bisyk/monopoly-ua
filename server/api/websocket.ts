import { parse } from "url";

// todo: replace with actual game state
const MAX_PLAYERS = 2;

const gameStates: { [roomId: string]: GameState } = {};

const connectedPeers: { [roomId: string]: any[] } = {};

export default defineWebSocketHandler({
  open(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    peer.subscribe(roomId);
    console.log(`Opened WS for room: ${roomId}`);

    if (!gameStates[roomId]) {
      gameStates[roomId] = {
        players: [],
        currentTurn: null,
        gameLog: [],
      };
    }

    if (!connectedPeers[roomId]) {
      connectedPeers[roomId] = [];
    }

    connectedPeers[roomId].push(peer);
    syncGameState(roomId, peer);
  },
  close(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    console.log(`Closed WS for room: ${roomId}`);
  },
  error(peer, error) {
    console.log("error on ws", peer, error);
  },
  message(peer, message) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    console.log(`Message received in room ${roomId}:`, message.text());

    const parsedMessage = JSON.parse(message.text());

    console.log(parsedMessage);

    if (parsedMessage.action === "JOIN_GAME") {
      if (gameStates[roomId].players.includes(parsedMessage.payload.username)) {
        return;
      }
      gameStates[roomId].players.push(parsedMessage.payload.username);
      console.log("gameState", gameStates[roomId]);

      gameStates[roomId].currentTurn = gameStates[roomId].players[0];

      syncGameState(roomId, peer);
    }

    if (parsedMessage.action === "ROLL_DICE") {
      console.log("ROLL_DICE");
      console.log(parsedMessage.payload.turnResult);

      const indexOfCurrentTurn = gameStates[roomId].players.indexOf(
        gameStates[roomId].currentTurn
      );

      gameStates[roomId].gameLog.push({
        username: gameStates[roomId].currentTurn,
        msg: `got ${parsedMessage.payload.turnResult}`,
      });

      if (indexOfCurrentTurn < MAX_PLAYERS - 1) {
        gameStates[roomId].currentTurn =
          gameStates[roomId].players[indexOfCurrentTurn + 1];
      } else {
        gameStates[roomId].currentTurn = gameStates[roomId].players[0];
      }

      console.log("gameState after ROLL_DICE", gameStates[roomId]);

      syncGameState(roomId, peer);
    }
  },
});

function getRoomIdFromPeer(url: string): string {
  const queryParams = parse(url, true).query;

  return queryParams!.roomId!.toString();
}

function syncGameState(roomId: string, peer) {
  const updatedGameState = {
    ...gameStates[roomId],
  };

  connectedPeers[roomId].forEach(connectedPeer => {
    connectedPeer.publish(roomId, JSON.stringify(updatedGameState));
  });
}
