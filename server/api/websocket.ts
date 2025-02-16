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
          auctionParticipants: [],
          currentAuctionParticipant: "",
          currentAuctionBid: 0,
          tileOnAuction: null,
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
      game.boardState[0].groups.forEach(g => {
        g.isUpgradeAvailable = true;
      });
      if (currentTurnPlayerIdx < MAX_PLAYERS) {
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
      const propertyId = parsedMessage.payload.propertyId;

      const boughtProperty = game.boardState[0].tiles.find(
        t => t.id === propertyId
      );

      if (currentTurnPlayer.balance <= boughtProperty!.price!) {
        return;
      }

      boughtProperty!.owner = game.currentTurn;

      currentTurnPlayer.properties.push(boughtProperty!.id);

      currentTurnPlayer.balance =
        currentTurnPlayer.balance - boughtProperty!.price!;

      checkIsFullSet(currentTurnPlayer, game.boardState);
      changePlayerTurn();

      game.currentAction = "roll";
    }

    if (parsedMessage.action === "PASS_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;
      const playerToPassUsername = parsedMessage.payload.username;

      const passedProperty = game.boardState[0].tiles.find(
        t => t.id === propertyId
      );

      const players = game.players;

      const auctionParticipants = players
        .filter(p => p.username !== playerToPassUsername)
        .filter(p => p.balance >= passedProperty!.price!);

      if (!auctionParticipants.length) {
        game.currentAction = "roll";
        changePlayerTurn();
        return;
      }

      game.currentAction = "auction";
      game.auctionParticipants = auctionParticipants.map(p => p.username);
      game.currentAuctionParticipant = game.auctionParticipants[0];
      game.currentAuctionBid = passedProperty!.price!;
      game.tileOnAuction = propertyId;
    }

    if (parsedMessage.action === "PASS_AUCTION_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;
      const playerToPassUsername = parsedMessage.payload.username;

      const remainingParticipants = game.auctionParticipants.filter(
        p => p !== playerToPassUsername
      );

      if (!remainingParticipants.length) {
        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (remainingParticipants.length === 1) {
        const winner = game.players.find(
          p => p.username === remainingParticipants[0]
        );
        const propertyToBuy = game.boardState[0].tiles.find(
          t => t.id === propertyId
        );
        winner!.balance -= game.currentAuctionBid!;
        winner!.properties.push(propertyId);
        propertyToBuy!.owner = winner!.username;
        game.currentAction = "roll";
        changePlayerTurn();
      }

      game.auctionParticipants = remainingParticipants;
      game.currentAuctionParticipant = game.auctionParticipants[0];
    }

    if (parsedMessage.action === "BID_AUCTION_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;

      const playerToBidUsername = parsedMessage.payload.username;

      const playerToBidIdxInAuction = game.auctionParticipants.findIndex(
        p => p === playerToBidUsername
      );

      const playerToBid = game.players.find(
        p => p.username === playerToBidUsername
      );

      if (playerToBid!.balance <= game.currentAuctionBid! + 10) {
        return;
      }

      game.currentAuctionBid! += 10;

      if (playerToBidIdxInAuction === game.auctionParticipants.length - 1) {
        game.currentAuctionParticipant = game.auctionParticipants[0];
      } else {
        game.currentAuctionParticipant =
          game.auctionParticipants[playerToBidIdxInAuction + 1];
      }
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

    if (parsedMessage.action === "UPGRADE_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;
      const propertyGroup = game.boardState[0].groups.find(g => {
        return g.properties.includes(propertyId);
      });

      const propertyToUpgrade = game.boardState[0].tiles.find(
        t => t.id === propertyId
      );

      if (currentTurnPlayer.balance < propertyGroup!.upgradePrice) {
        return;
      }

      if (propertyToUpgrade!.rentLevel === 5) {
        return;
      }

      propertyToUpgrade!.rentLevel += 1;
      currentTurnPlayer.balance -= propertyGroup!.upgradePrice;
      propertyGroup!.isUpgradeAvailable = false;
    }

    if (parsedMessage.action === "SELL_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;

      const propertyToSell = game.boardState[0].tiles.find(
        t => t.id === propertyId
      );

      const propertyGroup = game.boardState[0].groups.find(g => {
        return g.properties.includes(propertyId);
      });

      if (propertyToSell!.rentLeven < 1) {
        return;
      }

      currentTurnPlayer.balance +=
        propertyToSell.rentLevels[propertyToSell.rentLevel] / 2;
      propertyToSell!.rentLevel -= 1;
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
      auctionParticipants: newGameState.auctionParticipants,
      currentAuctionParticipant: newGameState.currentAuctionParticipant,
      currentAuctionBid: newGameState.currentAuctionBid,
      tileOnAuction: newGameState.tileOnAuction,
    },
  });

  peer.send(JSON.stringify(updatedGame));
  peer.publish(roomId, JSON.stringify(updatedGame));
}

const checkIsFullSet = (player: any, boardState: any) => {
  const playerProperties = player.properties;

  for (const group of boardState[0].groups) {
    const groupProperties = group.properties;

    if (groupProperties.every((p: any) => playerProperties.includes(p))) {
      group.isFullSet = true;

      boardState[0].tiles.forEach((t: any) => {
        if (groupProperties.includes(t.id)) {
          t.rentLevels[0] = t.rentLevels[0] * 2;
        }
      });
    }
  }
};
