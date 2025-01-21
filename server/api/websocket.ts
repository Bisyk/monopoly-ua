import { parse } from "url";

const initialState = {
  players: [],
  currentTurn: null,
  gameLog: [],
  boardState: {
    tiles: [
      {
        id: 1,
        type: "go",
        name: "Go",
        position: 1,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 2,
        type: "property",
        name: "Property 2",
        position: 2,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 3,
        type: "property",
        name: "Property 3",
        position: 3,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 4,
        type: "property",
        name: "Property 4",
        position: 4,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 5,
        type: "property",
        name: "Property 5",
        position: 5,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 6,
        type: "property",
        name: "Property 6",
        position: 6,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 7,
        type: "property",
        name: "Property 7",
        position: 7,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 8,
        type: "property",
        name: "Property 8",
        position: 8,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 9,
        type: "property",
        name: "Property 9",
        position: 9,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 10,
        type: "property",
        name: "Property 10",
        position: 9,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 11,
        type: "jail",
        name: "JAIL",
        position: 11,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 12,
        type: "property",
        name: "Property 12",
        position: 12,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 13,
        type: "property",
        name: "Property 13",
        position: 13,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 14,
        type: "property",
        name: "Property 14",
        position: 14,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 15,
        type: "property",
        name: "Property 15",
        position: 15,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 16,
        type: "property",
        name: "Property 16",
        position: 16,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 17,
        type: "property",
        name: "Property 17",
        position: 17,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 18,
        type: "property",
        name: "Property 18",
        position: 18,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 19,
        type: "property",
        name: "Property 19",
        position: 19,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 20,
        type: "property",
        name: "Property 20",
        position: 20,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 21,
        type: "freeParking",
        name: "Free Parking",
        position: 21,
      },
      {
        id: 22,
        type: "property",
        name: "Property 22",
        position: 22,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 23,
        type: "property",
        name: "Property 23",
        position: 23,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 24,
        type: "property",
        name: "Property 24",
        position: 24,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 25,
        type: "property",
        name: "Property 25",
        position: 25,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 26,
        type: "property",
        name: "Property 26",
        position: 26,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 27,
        type: "property",
        name: "Property 27",
        position: 27,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 28,
        type: "property",
        name: "Property 28",
        position: 28,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 29,
        type: "property",
        name: "Property 29",
        position: 29,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 30,
        type: "property",
        name: "Property 30",
        position: 30,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 31,
        type: "goToJail",
        name: "Go To Jail",
        position: 31,
      },
      {
        id: 32,
        type: "property",
        name: "Property 32",
        position: 32,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 33,
        type: "property",
        name: "Property 33",
        position: 33,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 34,
        type: "property",
        name: "Property 34",
        position: 34,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 35,
        type: "property",
        name: "Property 35",
        position: 35,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 36,
        type: "property",
        name: "Property 36",
        position: 36,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 37,
        type: "property",
        name: "Property 37",
        position: 37,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 38,
        type: "property",
        name: "Property 38",
        position: 38,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 39,
        type: "property",
        name: "Property 39",
        position: 39,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 40,
        type: "property",
        name: "Property 40",
        position: 40,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
    ],
  },
};

// todo: replace with actual game state
const MAX_PLAYERS = 2;

const gameState: { [roomId: string]: GameState } = {};

const connectedPeers: { [roomId: string]: any[] } = {};

export default defineWebSocketHandler({
  open(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    peer.subscribe(roomId);
    console.log(`Opened WS for room: ${roomId}`);

    if (!gameState[roomId]) {
      gameState[roomId] = initialState;
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
      const isUserAlreadyInGame = gameState[roomId].players.some(
        player => player.username === parsedMessage.payload.username
      );
      if (isUserAlreadyInGame) {
        return;
      }
      gameState[roomId].players.push({
        username: parsedMessage.payload.username,
        position: 1,
        balance: 15000,
        properties: [],
        jailed: false,
        turnsInJail: 0,
      });
      console.log("gameState", gameState[roomId]);

      gameState[roomId].currentTurn = gameState[roomId].players[0].username;

      syncGameState(roomId, peer);
    }

    if (parsedMessage.action === "ROLL_DICE") {
      console.log("ROLL_DICE");
      console.log(parsedMessage.payload.turnResult);

      const { left, right } = parsedMessage.payload.turnResult;

      // const indexOfPlayerCurrentTurn = gameState[roomId].players.indexOf(
      //   gameState[roomId].currentTurn
      // );

      const currentTurnPlayer = gameState[roomId].players.filter(
        p => p.username === gameState[roomId].currentTurn
      )[0];
      const currentTurnPlayerIdx =
        gameState[roomId].players.indexOf(currentTurnPlayer);

      gameState[roomId].gameLog.push({
        username: gameState[roomId].currentTurn,
        msg: `got ${left} and ${right}`,
      });

      const boardSize = 40;
      currentTurnPlayer.position =
        (currentTurnPlayer.position + left + right) % boardSize;
      if (currentTurnPlayer.position === 0) {
        currentTurnPlayer.position = boardSize;
      }

      if (currentTurnPlayerIdx < MAX_PLAYERS - 1) {
        gameState[roomId].currentTurn =
          gameState[roomId].players[currentTurnPlayerIdx + 1].username;
      } else {
        gameState[roomId].currentTurn = gameState[roomId].players[0].username;
      }

      console.log("gameState after ROLL_DICE", gameState[roomId]);

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
    ...gameState[roomId],
  };

  connectedPeers[roomId].forEach(connectedPeer => {
    connectedPeer.publish(roomId, JSON.stringify(updatedGameState));
  });
}
