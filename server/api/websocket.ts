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
        name: "atb",
        position: 2,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 3,
        type: "chance",
        name: "chance 3",
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
        name: "silpo",
        position: 4,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 5,
        type: "tax",
        name: "tax 1",
        position: 5,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 6,
        type: "car",
        name: "mercedes-benz",
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
        name: "staff",
        position: 7,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 8,
        type: "chance",
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
        name: "urban",
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
        name: "riotdivision",
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
        name: "depositphotos",
        position: 12,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 13,
        type: "bonus-property",
        name: "ukrnafta",
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
        name: "gitlab",
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
        name: "grammarly",
        position: 15,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 16,
        type: "car",
        name: "porsche",
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
        name: "globallogic",
        position: 17,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 18,
        type: "chance",
        name: "chance 3",
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
        name: "softserve",
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
        name: "epam",
        position: 20,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 21,
        type: "parking",
        name: "freeparking",
        position: 21,
      },
      {
        id: 22,
        type: "property",
        name: "monobank",
        position: 22,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 23,
        type: "chance",
        name: "chance 4",
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
        name: "oschadbank",
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
        name: "privatbank",
        position: 25,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 26,
        type: "car",
        name: "bmw",
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
        name: "okko",
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
        name: "wog",
        position: 28,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 29,
        type: "bonus-property",
        name: "naftogaz",
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
        name: "socar",
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
        name: "goToJail",
        position: 31,
      },
      {
        id: 32,
        type: "property",
        name: "ukrposhta",
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
        name: "meest",
        position: 33,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 34,
        type: "chance",
        name: "chance 5",
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
        name: "novaposhta",
        position: 35,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 36,
        type: "car",
        name: "toyota",
        position: 36,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 37,
        type: "luxury-tax",
        name: "luxurytax",
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
        name: "metinvest",
        position: 38,
        owner: null,
        houses: 0,
        price: 0,
        rent: 0,
        mortgaged: false,
      },
      {
        id: 39,
        type: "chance",
        name: "chance 6",
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
        name: "dtek",
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
