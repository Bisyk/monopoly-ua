import type { GameState, Player } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { assignPropertyToPlayer } from "./shared";
import { GAME_RULES } from "~/shared/constants/gameRules";

export const bidAuctionProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId ?? game.auctionedTileId;
  const playerToBidUsername = parsedMessage.payload.username;

  const playerToBidIdxInAuction = game.auctionParticipants.findIndex(
    (p: string) => p === playerToBidUsername
  );

  if (playerToBidIdxInAuction === -1) {
    return;
  }

  const playerToBid = game.players.find(
    (p: Player) => p.username === playerToBidUsername
  );

  const propertyToBuy = game.board.tiles.find((t) => t.id === propertyId);

  if (!playerToBid || !propertyToBuy) {
    return;
  }

  const nextBidAmount =
    (game.auctionBidAmount ?? propertyToBuy.price ?? 0) +
    GAME_RULES.AUCTION_BID_INCREMENT;

  if (playerToBid.balance < nextBidAmount) {
    return;
  }

  game.auctionBidAmount = nextBidAmount;
  game.gameLog.push({
    username: playerToBidUsername,
    msg: `bid $${nextBidAmount} for ${propertyToBuy.name}`,
  });

  if (game.auctionParticipants.length === 1) {
    assignPropertyToPlayer(
      game,
      propertyToBuy,
      playerToBid,
      game.auctionBidAmount
    );

    game.gameLog.push({
      username: playerToBidUsername,
      msg: `won auction for ${propertyToBuy.name} at $${game.auctionBidAmount}`,
    });

    game.auctionParticipants = [];
    game.activeAuctionBidder = "";
    game.auctionBidAmount = 0;
    game.auctionedTileId = null;
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
    return;
  }

  if (playerToBidIdxInAuction === game.auctionParticipants.length - 1) {
    game.activeAuctionBidder = game.auctionParticipants[0];
  } else {
    game.activeAuctionBidder =
      game.auctionParticipants[playerToBidIdxInAuction + 1];
  }
  return;
};
