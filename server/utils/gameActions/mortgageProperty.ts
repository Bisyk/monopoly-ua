import type { GameState, Player, Tile } from "~/types";

export const mortgageProperty = (
  game: GameState,
  currentTurnPlayer: Player,
  parsedMessage: any
) => {
  const propertyId = parsedMessage.payload.propertyId;

  const propertyToMortgage = game.board.tiles.find(
    (t: Tile) => t.id === propertyId
  );

  if (
    !propertyToMortgage ||
    !["property", "car", "bonus-property"].includes(propertyToMortgage.type)
  ) {
    return;
  }

  if (propertyToMortgage.owner !== currentTurnPlayer.username) {
    return;
  }

  if (propertyToMortgage.mortgaged || propertyToMortgage.mortgagePrice == null) {
    return;
  }

  if (propertyToMortgage.type === "property") {
    if ((propertyToMortgage.rentLevel ?? 0) > 0) {
      return;
    }

    const propertyGroup = game.board.groups.find((g) =>
      g.properties.includes(propertyId)
    );
    if (propertyGroup) {
      const groupHasUpgrades = game.board.tiles.some(
        (t) =>
          propertyGroup.properties.includes(t.id) && (t.rentLevel ?? 0) > 0
      );
      if (groupHasUpgrades) {
        return;
      }
    }
  }

  propertyToMortgage.mortgaged = true;
  currentTurnPlayer.balance += propertyToMortgage.mortgagePrice;
  game.gameLog.push({
    username: currentTurnPlayer.username,
    msg: `mortgaged ${propertyToMortgage.name} for $${propertyToMortgage.mortgagePrice}`,
  });
  return;
};
