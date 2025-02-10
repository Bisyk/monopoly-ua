import { parse } from "url";
import prisma from "~/lib/prisma";
import {
  colors,
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
          players: room!.players.map((player, idx) => ({
            username: player,
            color: colors[idx],
            ...initialPlayersState,
          })),
          currentTurn: room!.players[0],
          currentAction: "roll",
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

    const game = await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    });

    if (!game) {
      return;
    }

    const currentTurnPlayer = game.players.filter(
      p => p.username === game.currentTurn
    )[0];

    const currentTurnPlayerIdx = game.players.indexOf(currentTurnPlayer);

    const changePlayerTurn = () => {
      if (currentTurnPlayerIdx < MAX_PLAYERS - 1) {
        game.currentTurn = game.players[currentTurnPlayerIdx + 1].username;
      } else {
        game.currentTurn = game.players[0].username;
      }
    };

    if (parsedMessage.action === "ROLL_DICE") {
      console.log("ROLL_DICE");

      const { left, right } = parsedMessage.payload.turnResult;

      game.gameLog.push({
        username: game.currentTurn,
        msg: `got ${left} and ${right}`,
      });

      const boardSize = 40;

      const newPlayerPosition =
        (currentTurnPlayer.position + left + right) % boardSize;
      if (currentTurnPlayer.position === 0) {
        currentTurnPlayer.position = boardSize;
      }

      currentTurnPlayer.position = newPlayerPosition + 1;
      const tilePlayerOn = game.boardState[0].tiles[newPlayerPosition];

      if (
        ["property", "car", "bonus-property"].includes(tilePlayerOn.type) &&
        !tilePlayerOn.owner
      ) {
        game.currentAction = "buy";
      }

      if (
        ["property"].includes(tilePlayerOn.type) &&
        tilePlayerOn.owner &&
        tilePlayerOn.owner !== currentTurnPlayer.username &&
        !tilePlayerOn.mortgaged
      ) {
        game.currentAction = "payRent";
      }
    }

    if (parsedMessage.action === "BUY_PROPERTY") {
      const boughtProperty = game.boardState[0].tiles.find(
        t => t.id === parsedMessage.payload.property.id
      );

      if (currentTurnPlayer.balance >= boughtProperty!.price!) {
        boughtProperty!.owner = game.currentTurn;

        currentTurnPlayer.properties.push(boughtProperty!.id);

        currentTurnPlayer.balance =
          currentTurnPlayer.balance - boughtProperty!.price!;

        changePlayerTurn();

        game.currentAction = "roll";
      }
    }

    if (parsedMessage.action === "PASS_PROPERTY") {
      changePlayerTurn();

      game.currentAction = "roll";
    }

    if (parsedMessage.action === "PAY_RENT") {
      const propertyId = parsedMessage.payload.propertyId;

      const propertyToPayRent = game.boardState[0].tiles.find(
        t => t.id === propertyId
      );

      const owner = game.players.find(
        p => p.username === propertyToPayRent!.owner
      );

      const rentToPay =
        propertyToPayRent!.rentLevels[propertyToPayRent!.rentLevel];

      if (currentTurnPlayer.balance <= rentToPay) {
        return;
      }

      currentTurnPlayer.balance -= rentToPay;
      owner!.balance += rentToPay;

      changePlayerTurn();
      game.currentAction = "roll";
    }

    if (parsedMessage.action === "MORTGAGE_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;

      const propertyToMortgage = game.boardState[0].tiles.find(
        t => t.id === propertyId
      );

      if (propertyToMortgage!.mortgaged) {
        return;
      }

      propertyToMortgage!.mortgaged = true;
      currentTurnPlayer.balance += propertyToMortgage!.mortgagePrice;
    }

    if (parsedMessage.action === "BUY_BACK_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;

      const propertyToBuyBack = game.boardState[0].tiles.find(
        t => t.id === propertyId
      );

      if (currentTurnPlayer.balance < propertyToBuyBack!.buybackPrice) {
        return;
      }

      if (!propertyToBuyBack!.mortgaged) {
        return;
      }

      propertyToBuyBack!.mortgaged = false;
      currentTurnPlayer.balance -= propertyToBuyBack!.buybackPrice;
    }

    await syncGameState(roomId, peer, game);
  },
});

function getRoomIdFromPeer(url: string): string {
  const queryParams = parse(url, true).query;

  return queryParams!.roomId!.toString();
}

async function syncGameState(roomId: string, peer, newGameState) {
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
    },
  });

  peer.send(JSON.stringify(updatedGame));
  peer.publish(roomId, JSON.stringify(updatedGame));
}
