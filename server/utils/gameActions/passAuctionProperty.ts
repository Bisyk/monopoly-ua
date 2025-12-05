import { GameState, Player, Tile } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";

export const passAuctionProperty = async (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;
  const playerToPassUsername = parsedMessage.payload.username;

  const playerToPassIdxInAuction = game.auctionParticipants.findIndex(
    (p: string) => p === playerToPassUsername
  );

  const remainingParticipants = game.auctionParticipants.filter(
    (p: string) => p !== playerToPassUsername
  );

  const auctionedTileId = game.board.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  if (!remainingParticipants.length) {
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (
    remainingParticipants.length === 1 &&
    game.auctionBidAmount! > auctionedTileId!.price!
  ) {
    const winner = game.players.find(
      (p: Player) => p.username === remainingParticipants[0]
    );
    const propertyToBuy = game.board.tiles.find(
      (t: Tile) => t.id === propertyId
    );
    winner!.balance -= game.auctionBidAmount!;
    winner!.properties.push(propertyId);
    propertyToBuy!.owner = winner!.username;
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  game.auctionParticipants = remainingParticipants;
  game.activeAuctionBidder =
    game.auctionParticipants[
      playerToPassIdxInAuction % remainingParticipants.length
    ];
  return;
};
