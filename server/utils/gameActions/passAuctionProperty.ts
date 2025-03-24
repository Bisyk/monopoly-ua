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

  const remainingParticipants = game.auctionParticipants.filter(
    (p: string) => p !== playerToPassUsername
  );

  if (!remainingParticipants.length) {
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (remainingParticipants.length === 1) {
    const winner = game.players.find(
      (p: Player) => p.username === remainingParticipants[0]
    );
    const propertyToBuy = game.boardState.tiles.find(
      (t: Tile) => t.id === propertyId
    );
    winner!.balance -= game.currentAuctionBid!;
    winner!.properties.push(propertyId);
    propertyToBuy!.owner = winner!.username;
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  game.auctionParticipants = remainingParticipants;
  game.currentAuctionParticipant = game.auctionParticipants[0];
  return;
};
