import { GameState, Player } from "~/types";

export const upgradeProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;
  const propertyGroup = game.board.groups.find(g => {
    return g.properties.includes(propertyId);
  });

  const propertyToUpgrade = game.board.tiles.find(
    t => t.id === propertyId
  );

  if (currentTurnPlayer.balance < propertyGroup!.upgradePrice!) {
    return;
  }

  if (propertyToUpgrade!.rentLevel === 5) {
    return;
  }

  propertyToUpgrade!.rentLevel! += 1;
  currentTurnPlayer.balance -= propertyGroup!.upgradePrice!;
  propertyGroup!.isUpgradeAvailable = false;
  return;
};
