import type { GameState, Player, Tile } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { assignPropertyToPlayer } from "./shared";

export const passAuctionProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId ?? game.auctionedTileId;
  const playerToPassUsername = parsedMessage.payload.username;

  const playerToPassIdxInAuction = game.auctionParticipants.findIndex(
    (p: string) => p === playerToPassUsername
  );

  if (playerToPassIdxInAuction === -1) {
    return;
  }

  const remainingParticipants = game.auctionParticipants.filter(
    (p: string) => p !== playerToPassUsername
  );

  const auctionedTile = game.board.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  if (!auctionedTile) {
    return;
  }

  game.gameLog.push({
    username: playerToPassUsername,
    msg: `passed auction on ${auctionedTile.name}`,
  });

  if (!remainingParticipants.length) {
    game.gameLog.push({
      username: playerToPassUsername,
      msg: `auction for ${auctionedTile.name} closed with no buyer`,
    });
    game.auctionParticipants = [];
    game.activeAuctionBidder = "";
    game.auctionBidAmount = 0;
    game.auctionedTileId = null;
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
    return;
  }

  if (
    remainingParticipants.length === 1 &&
    (game.auctionBidAmount ?? 0) > (auctionedTile.price ?? 0)
  ) {
    const winner = game.players.find(
      (p: Player) => p.username === remainingParticipants[0]
    );
    const winningBid = game.auctionBidAmount!;

    if (winner) {
      assignPropertyToPlayer(game, auctionedTile, winner, winningBid);
      game.gameLog.push({
        username: winner.username,
        msg: `won auction for ${auctionedTile.name} at $${winningBid}`,
      });
    }

    game.auctionParticipants = [];
    game.activeAuctionBidder = "";
    game.auctionBidAmount = 0;
    game.auctionedTileId = null;
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
    return;
  }

  game.auctionParticipants = remainingParticipants;
  game.activeAuctionBidder =
    game.auctionParticipants[
      playerToPassIdxInAuction % remainingParticipants.length
    ];
  return;
};
