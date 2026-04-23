import { GameState, Player } from "~/types";

type ResolveBankruptcyParams = {
  game: GameState;
  bankruptPlayer: Player;
  currentTurnPlayerIdx: number;
  creditorUsername?: string;
};

const setCurrentTurnAfterElimination = (
  game: GameState,
  eliminatedPlayerUsername: string,
  currentTurnPlayerIdx: number
) => {
  if (game.players.length === 0) {
    game.currentTurn = "";
    return;
  }

  if (game.currentTurn !== eliminatedPlayerUsername) {
    const currentTurnStillActive = game.players.some(
      player => player.username === game.currentTurn
    );
    if (!currentTurnStillActive) {
      game.currentTurn = game.players[0].username;
    }
    return;
  }

  const nextPlayerIdx = Math.min(currentTurnPlayerIdx, game.players.length - 1);
  game.currentTurn = game.players[nextPlayerIdx].username;
};

const recalculateSpecialPropertyRentLevels = (game: GameState) => {
  const ownedCarsCount: Record<string, number> = {};
  const ownedBonusPropertiesCount: Record<string, number> = {};

  game.board.tiles.forEach(tile => {
    if (!tile.owner) {
      return;
    }

    if (tile.type === "car") {
      ownedCarsCount[tile.owner] = (ownedCarsCount[tile.owner] || 0) + 1;
    }

    if (tile.type === "bonus-property") {
      ownedBonusPropertiesCount[tile.owner] =
        (ownedBonusPropertiesCount[tile.owner] || 0) + 1;
    }
  });

  game.board.tiles.forEach(tile => {
    if (tile.type === "car") {
      tile.rentLevel = tile.owner ? ownedCarsCount[tile.owner] - 1 : 0;
    }

    if (tile.type === "bonus-property") {
      tile.rentLevel = tile.owner ? ownedBonusPropertiesCount[tile.owner] - 1 : 0;
    }
  });
};

const syncPropertySets = (game: GameState) => {
  game.board.groups.forEach(group => {
    const groupedTiles = game.board.tiles.filter(tile =>
      group.properties.includes(tile.id)
    );
    const tileOwners = groupedTiles
      .map(tile => tile.owner)
      .filter((owner): owner is string => Boolean(owner));

    const hasSingleOwner =
      tileOwners.length === groupedTiles.length &&
      new Set(tileOwners).size === 1;

    if (group.isFullSet && !hasSingleOwner) {
      groupedTiles.forEach(tile => {
        if (tile.rentLevels?.length) {
          tile.rentLevels[0] = tile.rentLevels[0] / 2;
        }
      });
    }

    if (!group.isFullSet && hasSingleOwner) {
      groupedTiles.forEach(tile => {
        if (tile.rentLevels?.length) {
          tile.rentLevels[0] = tile.rentLevels[0] * 2;
        }
      });
    }

    group.isFullSet = hasSingleOwner;
  });
};

export const resolveBankruptcy = ({
  game,
  bankruptPlayer,
  currentTurnPlayerIdx,
  creditorUsername,
}: ResolveBankruptcyParams) => {
  const creditor = creditorUsername
    ? game.players.find(player => player.username === creditorUsername)
    : null;

  const bankruptProperties = [...bankruptPlayer.properties];

  bankruptProperties.forEach(propertyId => {
    const tile = game.board.tiles.find(boardTile => boardTile.id === propertyId);
    if (!tile) {
      return;
    }

    if (creditor) {
      tile.owner = creditor.username;
      if (!creditor.properties.includes(propertyId)) {
        creditor.properties.push(propertyId);
      }
      return;
    }

    // Debt to the bank: clear ownership and reset property state.
    tile.owner = "";
    if (typeof tile.rentLevel === "number") {
      tile.rentLevel = 0;
    }
    if (typeof tile.mortgaged === "boolean") {
      tile.mortgaged = false;
    }
  });

  if (creditor && bankruptPlayer.balance > 0) {
    creditor.balance += bankruptPlayer.balance;
  }

  bankruptPlayer.balance = 0;
  bankruptPlayer.properties = [];
  bankruptPlayer.ownedPropertyGroupIds = [];

  if (!game.eliminatedPlayers.includes(bankruptPlayer.username)) {
    game.eliminatedPlayers.push(bankruptPlayer.username);
  }

  game.players = game.players.filter(
    player => player.username !== bankruptPlayer.username
  );

  recalculateSpecialPropertyRentLevels(game);
  syncPropertySets(game);

  if (game.players.length === 1) {
    game.status = "ENDED";
    game.winnerUsername = game.players[0].username;
    game.currentTurn = game.players[0].username;
    game.currentAction = "roll";
    return;
  }

  game.status = "STARTED";
  game.winnerUsername = null;

  setCurrentTurnAfterElimination(
    game,
    bankruptPlayer.username,
    currentTurnPlayerIdx
  );
  game.currentAction = "roll";
};
