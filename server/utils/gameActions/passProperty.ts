import type { GameState, Player, Tile } from "~/types";
import { changePlayerTurn } from "./changePlayerTurn";

export const passProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  currentTurnPlayerIdx: number,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;
  const playerToPassUsername =
    parsedMessage.payload.username || currentTurnPlayer.username;

  const passedProperty = game.board.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  if (!passedProperty || passedProperty.price == null) {
    return;
  }

  const players = game.players;

  const auctionParticipants = players
    .filter((p: Player) => p.username !== playerToPassUsername)
    .filter((p: Player) => p.balance >= passedProperty.price!);

  game.gameLog.push({
    username: playerToPassUsername,
    msg: `passed on ${passedProperty.name}`,
  });

  if (!auctionParticipants.length) {
    game.currentAction = "roll";
    changePlayerTurn(game, currentTurnPlayer, currentTurnPlayerIdx);
    return;
  }

  game.currentAction = "auction";
  game.auctionParticipants = auctionParticipants.map((p: Player) => p.username);
  game.activeAuctionBidder = game.auctionParticipants[0];
  game.auctionBidAmount = passedProperty.price;
  game.auctionedTileId = propertyId;
  game.gameLog.push({
    username: playerToPassUsername,
    msg: `started auction for ${passedProperty.name} at $${passedProperty.price}`,
  });
};
