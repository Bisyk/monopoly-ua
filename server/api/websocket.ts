import { parse } from "url";
import prisma from "~/lib/prisma";
import {
  chances,
  colors,
  initialGroupsState,
  initialPlayersState,
  initialTilesState,
} from "../constants";

export default defineWebSocketHandler({
  async open(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!);
    peer.subscribe(roomId);

    const game = await prisma.game.findUnique({
      where: {
        associatedRoomId: roomId,
      },
    });

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
      game.boardState.groups.forEach(g => {
        g.isUpgradeAvailable = true;
      });

      if (currentTurnPlayer.bonusRoll) {
        return;
      }

      if (currentTurnPlayerIdx < game.players.length - 1) {
        game.currentTurn = game.players[currentTurnPlayerIdx + 1].username;
      } else {
        game.currentTurn = game.players[0].username;
      }
    };

    if (parsedMessage.action === "ROLL_DICE") {
      console.log("ROLL_DICE");

      const boardSize = 40;
      const { left, right } = parsedMessage.payload.turnResult;

      if (left === right) {
        currentTurnPlayer.doublesInRow += 1;
        currentTurnPlayer.bonusRoll = true;
        game.gameLog.push({
          username: game.currentTurn,
          msg: `rolled ${left} and ${right} and got bonus roll`,
        });
      } else {
        game.gameLog.push({
          username: game.currentTurn,
          msg: `rolled ${left} and ${right}`,
        });
        currentTurnPlayer.doublesInRow = 0;
        currentTurnPlayer.bonusRoll = false;
      }

      if (currentTurnPlayer.doublesInRow === 3) {
        currentTurnPlayer.jailed = true;
        currentTurnPlayer.turnsInJail = 3;
        currentTurnPlayer.position = 10;
        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (currentTurnPlayer.jailed) {
        currentTurnPlayer.turnsInJail -= 1;

        if (!(left === right) && currentTurnPlayer.turnsInJail > 0) {
          if (currentTurnPlayer.turnsInJail === 0) {
            currentTurnPlayer.jailed = false;
          }

          game.gameLog.push({
            username: game.currentTurn,
            msg: `You failed to roll doubles and stay in jail. Turns left: ${currentTurnPlayer.turnsInJail}`,
          });
          changePlayerTurn();
          syncGameState(roomId, peer, game);
          return;
        }

        if (left === right) {
          currentTurnPlayer.jailed = false;
          currentTurnPlayer.turnsInJail = 0;
          game.gameLog.push({
            username: game.currentTurn,
            msg: "You rolled doubles and got out of jail",
          });
        }

        if (currentTurnPlayer.turnsInJail === 0) {
          currentTurnPlayer.jailed = false;
          game.gameLog.push({
            username: game.currentTurn,
            msg: "You got out of jail",
          });
        }
      }

      const newPlayerPosition =
        ((currentTurnPlayer.position + left + right - 1) % boardSize) + 1;

      currentTurnPlayer.position = newPlayerPosition;
      const tilePlayerOn = game.boardState.tiles.find(
        t => t.id === newPlayerPosition
      );

      if (
        ["property", "car", "bonus-property"].includes(tilePlayerOn!.type) &&
        !tilePlayerOn!.owner
      ) {
        game.currentAction = "buy";
      }

      if (
        ["property", "car", "bonus-property"].includes(tilePlayerOn!.type) &&
        tilePlayerOn!.owner &&
        tilePlayerOn!.owner !== currentTurnPlayer.username &&
        !tilePlayerOn!.mortgaged
      ) {
        game.currentAction = "payRent";
        game.gameLog.push({
          username: game.currentTurn,
          msg: `You have to pay rent to ${tilePlayerOn!.owner}`,
        });
      }

      if (tilePlayerOn!.owner === currentTurnPlayer.username) {
        game.gameLog.push({
          username: game.currentTurn,
          msg: "You landed on your property",
        });
        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (tilePlayerOn!.type === "chance") {
        game.currentAction = "chance";

        const yourChance = chances[Math.floor(Math.random() * chances.length)];

        game.gameLog.push({
          username: game.currentTurn,
          msg: yourChance.text,
        });

        if (yourChance.type === "goToJail") {
          currentTurnPlayer.position = yourChance.tileId!;
          currentTurnPlayer.jailed = true;
          currentTurnPlayer.turnsInJail = 3;
          game.currentAction = "roll";
          changePlayerTurn();
        }

        if (yourChance.type === "minusBalance") {
          game.activeChance = yourChance;
        }

        if (yourChance.type === "plusBalance") {
          currentTurnPlayer.balance += yourChance.amount!;
          game.currentAction = "roll";
          changePlayerTurn();
        }
      }

      if (tilePlayerOn!.type === "tax") {
        game.gameLog.push({
          username: game.currentTurn,
          msg: "You need to pay 100$ tax",
        });
        game.currentAction = "payTax";
      }

      if (tilePlayerOn!.type === "luxury-tax") {
        game.gameLog.push({
          username: game.currentTurn,
          msg: "You need to pay 75$ luxury tax",
        });
        game.currentAction = "payTax";
      }

      if (tilePlayerOn.type === "go") {
        currentTurnPlayer.balance += 200;
        game.gameLog.push({
          username: game.currentTurn,
          msg: "You got 200$ for landing on go",
        });
        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (tilePlayerOn!.type === "jail") {
        game.gameLog.push({
          username: game.currentTurn,
          msg: "You are in jail with excursion",
        });
        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (tilePlayerOn.type === "parking") {
        game.gameLog.push({
          username: game.currentTurn,
          msg: "You landed on parking",
        });
        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (tilePlayerOn!.type === "goToJail") {
        currentTurnPlayer.jailed = true;
        currentTurnPlayer.turnsInJail = 3;
        currentTurnPlayer.position = 11;
        game.currentAction = "roll";
        game.gameLog.push({
          username: game.currentTurn,
          msg: "You are going in jail",
        });
        changePlayerTurn();
      }
    }

    if (parsedMessage.action === "BUY_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;

      const boughtProperty = game.boardState.tiles.find(
        t => t.id === propertyId
      );

      if (currentTurnPlayer.balance < boughtProperty!.price!) {
        return;
      }

      if (boughtProperty!.type === "property") {
        boughtProperty!.owner = game.currentTurn;

        currentTurnPlayer.properties.push(boughtProperty!.id);

        currentTurnPlayer.balance =
          currentTurnPlayer.balance - boughtProperty!.price!;

        checkIsFullSet(currentTurnPlayer, game.boardState);
      }

      if (boughtProperty!.type === "car") {
        currentTurnPlayer.balance -= boughtProperty!.price!;
        currentTurnPlayer.properties.push(boughtProperty!.id);
        boughtProperty!.owner = currentTurnPlayer.username;

        const boughtCars = game.boardState.tiles.filter(
          t => t.type === "car" && t.owner === currentTurnPlayer.username
        );

        boughtCars.forEach(c => {
          c.rentLevel = boughtCars.length - 1;
        });
      }

      if (boughtProperty!.type === "bonus-property") {
        currentTurnPlayer.balance -= boughtProperty!.price!;
        currentTurnPlayer.properties.push(boughtProperty!.id);
        boughtProperty!.owner = currentTurnPlayer.username;

        const propertiesOwned = game.boardState.tiles.filter(
          t =>
            t.type === "bonus-property" &&
            t.owner === currentTurnPlayer.username
        );

        propertiesOwned.forEach(p => {
          p.rentLevel = propertiesOwned.length - 1;
        });
      }

      changePlayerTurn();

      game.currentAction = "roll";
      syncGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "PASS_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;
      const playerToPassUsername = parsedMessage.payload.username;

      const passedProperty = game.boardState.tiles.find(
        t => t.id === propertyId
      );

      const players = game.players;

      const auctionParticipants = players
        .filter(p => p.username !== playerToPassUsername)
        .filter(p => p.balance >= passedProperty!.price!);

      if (!auctionParticipants.length) {
        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (auctionParticipants.length) {
        game.currentAction = "auction";
        game.auctionParticipants = auctionParticipants.map(p => p.username);
        game.currentAuctionParticipant = game.auctionParticipants[0];
        game.currentAuctionBid = passedProperty!.price!;
        game.tileOnAuction = propertyId;
      }
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
        const propertyToBuy = game.boardState.tiles.find(
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

      if (playerToBid!.balance < game.currentAuctionBid! + 10) {
        return;
      }

      game.currentAuctionBid! += 10;

      if (game.auctionParticipants.length === 1) {
        const winner = game.players.find(
          p => p.username === playerToBidUsername
        );
        const propertyToBuy = game.boardState.tiles.find(
          t => t.id === propertyId
        );
        if (propertyToBuy!.type === "property") {
          winner!.balance -= game.currentAuctionBid!;
          winner!.properties.push(propertyId);
          propertyToBuy!.owner = winner!.username;
        }

        if (propertyToBuy!.type === "car") {
          winner!.balance -= game.currentAuctionBid!;
          winner!.properties.push(propertyId);
          propertyToBuy!.owner = winner!.username;

          const boughtCars = game.boardState.tiles.filter(
            t => t.type === "car" && t.owner === winner!.username
          );

          boughtCars.forEach(c => {
            c.rentLevel = boughtCars.length - 1;
          });
        }

        if (propertyToBuy!.type === "bonus-property") {
          winner!.balance -= game.currentAuctionBid!;
          winner!.properties.push(propertyId);
          propertyToBuy!.owner = winner!.username;

          const propertiesOwned = game.boardState.tiles.filter(
            t => t.type === "bonus-property" && t.owner === winner!.username
          );

          propertiesOwned.forEach(p => {
            p.rentLevel = propertiesOwned.length - 1;
          });
        }

        game.currentAction = "roll";
        changePlayerTurn();
      }

      if (playerToBidIdxInAuction === game.auctionParticipants.length - 1) {
        game.currentAuctionParticipant = game.auctionParticipants[0];
      } else {
        game.currentAuctionParticipant =
          game.auctionParticipants[playerToBidIdxInAuction + 1];
      }
    }

    if (parsedMessage.action === "PAY_RENT") {
      const propertyId = parsedMessage.payload.propertyId;

      const propertyToPayRent = game.boardState.tiles.find(
        t => t.id === propertyId
      );

      const owner = game.players.find(
        p => p.username === propertyToPayRent!.owner
      );

      let rentToPay = 0;

      if (
        propertyToPayRent!.type === "bonus-property" &&
        parsedMessage.payload.turnResult
      ) {
        rentToPay =
          propertyToPayRent!.rentLevels[propertyToPayRent!.rentLevel] *
          (parsedMessage.payload.turnResult.left +
            parsedMessage.payload.turnResult.right);
      } else {
        rentToPay = propertyToPayRent!.rentLevels[propertyToPayRent!.rentLevel];
      }

      if (currentTurnPlayer.balance < rentToPay) {
        return;
      }

      currentTurnPlayer.balance -= rentToPay;
      owner!.balance += rentToPay;

      changePlayerTurn();
      game.currentAction = "roll";
    }

    if (parsedMessage.action === "MORTGAGE_PROPERTY") {
      const propertyId = parsedMessage.payload.propertyId;

      const propertyToMortgage = game.boardState.tiles.find(
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

      const propertyToBuyBack = game.boardState.tiles.find(
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
      const propertyGroup = game.boardState.groups.find(g => {
        return g.properties.includes(propertyId);
      });

      const propertyToUpgrade = game.boardState.tiles.find(
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

      const propertyToSell = game.boardState.tiles.find(
        t => t.id === propertyId
      );

      const propertyGroup = game.boardState.groups.find(g => {
        return g.properties.includes(propertyId);
      });

      if (propertyToSell!.rentLeven < 1) {
        return;
      }

      currentTurnPlayer.balance +=
        propertyToSell.rentLevels[propertyToSell.rentLevel] / 2;
      propertyToSell!.rentLevel -= 1;
    }

    if (parsedMessage.action === "PAY_CHANCE") {
      const amount = parsedMessage.payload.amount;

      if (currentTurnPlayer.balance < amount) {
        return;
      }

      currentTurnPlayer.balance -= amount;
      game.currentAction = "roll";
      game.activeChance = { type: "" };
      changePlayerTurn();
    }

    if (parsedMessage.action === "JAIL_PAY") {
      if (currentTurnPlayer.balance < 50) {
        return;
      }

      currentTurnPlayer.balance -= 50;
      currentTurnPlayer.jailed = false;
      currentTurnPlayer.turnsInJail = 0;
      game.currentAction = "roll";
    }

    if (parsedMessage.action === "PAY_TAX") {
      const tax = parsedMessage.payload.tax;

      if (currentTurnPlayer.balance < tax) {
        return;
      }

      currentTurnPlayer.balance -= tax;
      game.currentAction = "roll";
    }

    if (parsedMessage.action === "TRADE") {
      const { username, tradePlayerUsername, tradeTiles } =
        parsedMessage.payload;

      const { given, received, givenMoney, receivedMoney } = tradeTiles;

      console.log(username);
      console.log(tradePlayerUsername);
      console.log(tradeTiles);

      game.currentAction = "trade";
      game.activeTrade = {
        from: username,
        to: tradePlayerUsername,
        given,
        received,
        givenMoney,
        receivedMoney,
      };
    }

    if (parsedMessage.action === "ACCEPT_TRADE") {
      const { from, to, given, received, givenMoney, receivedMoney } =
        game.activeTrade;

      const playerFrom = game.players.find(p => p.username === from);
      const playerTo = game.players.find(p => p.username === to);

      given.forEach(g => {
        playerFrom!.properties = playerFrom!.properties.filter(p => p !== g);
        playerTo!.properties.push(g);
        game.boardState.tiles.find(t => t.id === g)!.owner = to;
      });

      received.forEach(r => {
        playerTo!.properties = playerTo!.properties.filter(p => p !== r);
        playerFrom!.properties.push(r);
        game.boardState.tiles.find(t => t.id === r)!.owner = from;
      });

      checkIsFullSet(playerFrom, game.boardState);
      checkIsFullSet(playerTo, game.boardState);

      playerFrom!.balance -= givenMoney;
      playerTo!.balance += givenMoney;

      playerFrom!.balance += receivedMoney;
      playerTo!.balance -= receivedMoney;

      game.activeTrade = {
        from: "",
        to: "",
        given: [],
        received: [],
        givenMoney: 0,
        receivedMoney: 0,
      };

      game.currentAction = "roll";
      syncGameState(roomId, peer, game);
      return;
    }

    if (parsedMessage.action === "DECLINE_TRADE") {
      game.activeTrade = {
        from: "",
        to: "",
        given: [],
        received: [],
        givenMoney: 0,
        receivedMoney: 0,
      };
      game.currentAction = "roll";
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
      activeChance: newGameState.activeChance,
      activeTrade: newGameState.activeTrade,
    },
  });

  peer.send(JSON.stringify(updatedGame));
  peer.publish(roomId, JSON.stringify(updatedGame));
}

const checkIsFullSet = (player: any, boardState: any) => {
  const playerProperties = player.properties;

  for (const group of boardState.groups) {
    const groupProperties = group.properties;

    if (
      groupProperties.some((p: any) => playerProperties.includes(p)) &&
      group.isFullSet
    ) {
      group.isFullSet = false;

      boardState.tiles.forEach((t: any) => {
        if (groupProperties.includes(t.id)) {
          t.rentLevels[0] = t.rentLevels[0] / 2;
        }
      });
    }

    if (groupProperties.every((p: any) => playerProperties.includes(p))) {
      group.isFullSet = true;

      boardState.tiles.forEach((t: any) => {
        if (groupProperties.includes(t.id)) {
          t.rentLevels[0] = t.rentLevels[0] * 2;
        }
      });
    }
  }
};
