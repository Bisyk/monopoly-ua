import { GameState, Player, Tile } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";

export const passProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;
  const playerToPassUsername = parsedMessage.payload.username;

  const passedProperty = game.board.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  const players = game.players;

  const auctionParticipants = players
    .filter((p: Player) => p.username !== playerToPassUsername)
    .filter((p: Player) => p.balance >= passedProperty!.price!);

  if (!auctionParticipants.length) {
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
  }

  if (auctionParticipants.length) {
    game.currentAction = "auction";
    game.auctionParticipants = auctionParticipants.map(
      (p: Player) => p.username
    );
    game.activeAuctionBidder = game.auctionParticipants[0];
    game.auctionBidAmount = passedProperty!.price!;
    game.auctionedTileId = propertyId;
  }
};
