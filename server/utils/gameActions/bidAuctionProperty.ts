import { GameState, Player } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";

export const bidAuctionProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const playerToBidUsername = parsedMessage.payload.username;

  const playerToBidIdxInAuction = game.auctionParticipants.findIndex(
    (p: string) => p === playerToBidUsername
  );

  const playerToBid = game.players.find(
    (p: Player) => p.username === playerToBidUsername
  );

  if (playerToBid!.balance < game.currentAuctionBid! + 10) {
    return;
  }

  game.currentAuctionBid! += 10;

  if (game.auctionParticipants.length === 1) {
    const winner = game.players.find(p => p.username === playerToBidUsername);
    const propertyToBuy = game.boardState.tiles.find(t => t.id === propertyId);
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
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (playerToBidIdxInAuction === game.auctionParticipants.length - 1) {
    game.currentAuctionParticipant = game.auctionParticipants[0];
  } else {
    game.currentAuctionParticipant =
      game.auctionParticipants[playerToBidIdxInAuction + 1];
  }
  return;
};
