import { GameState, Player } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";
import { assignPropertyToPlayer } from "./shared";
import { GAME_RULES } from "~/shared/constants/gameRules";

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

  if (
    playerToBid!.balance <
    game.currentAuctionBid! + GAME_RULES.AUCTION_BID_INCREMENT
  ) {
    return;
  }

  game.currentAuctionBid! += GAME_RULES.AUCTION_BID_INCREMENT;

  if (game.auctionParticipants.length === 1) {
    const winner = game.players.find((p) => p.username === playerToBidUsername);
    const propertyToBuy = game.boardState.tiles.find(
      (t) => t.id === propertyId
    );

    assignPropertyToPlayer(
      game,
      propertyToBuy!,
      winner!,
      game.currentAuctionBid!
    );

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
