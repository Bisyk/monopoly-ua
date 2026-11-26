import { GameState, Player, Tile } from "~/types";

export const assignPropertyToPlayer = (
  game: GameState,
  property: Tile,
  player: Player,
  purchasePrice: number
) => {
  player!.balance -= purchasePrice;
  player!.properties.push(property.id);
  property!.owner = player!.username;

  if (property!.type === "property") {
    checkIsFullPropertySet(player, game.board);
  }

  if (property!.type === "car") {
    updateCarRentLevels(player, game);
  }

  if (property!.type === "bonus-property") {
    updateBonusPropertyRentLevels(player, game);
  }

  function updateCarRentLevels(player: Player, game: GameState) {
    const boughtCars = game.board.tiles.filter(
      (t) => t.type === "car" && t.owner === player!.username
    );

    boughtCars.forEach((c) => {
      c.rentLevel = boughtCars.length - 1;
    });
  }

  function updateBonusPropertyRentLevels(player: Player, game: GameState) {
    const propertiesOwned = game.board.tiles.filter(
      (t) => t.type === "bonus-property" && t.owner === player!.username
    );

    propertiesOwned.forEach((p) => {
      p.rentLevel = propertiesOwned.length - 1;
    });
  }
};
