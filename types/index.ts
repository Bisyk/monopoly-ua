// export { Tile, Player };

type GameStatuses = "PENDING" | "STARTED" | "ENDED";
export interface Tile {
  id: number;
  groupId?: number | null;
  spriteName: string;
  name: string;
  price: number | null;
  type: string;
  owner: string | null;
  houses: number | null;
  mortgaged: boolean | null;
  position: number;
  rentLevel: number | null;
  rentLevels: number[] | null;
  mortgagePrice: number | null;
  buybackPrice: number | null;
  taxAmount: number | null;
}

export interface Player {
  username: string;
  color: string;
  position: number;
  balance: number;
  properties: number[];
  ownedPropertiesGroup: number[];
  jailed: boolean;
  turnsInJail: number;
  doublesInRow: number;
  bonusRoll: boolean;
}

export interface Group {
  groupId: number;
  color: string;
  properties: number[];
  upgradePrice: number | null;
  isFullSet: boolean;
  isUpgradeAvailable: boolean;
}

export interface CreatedGame {
  id: string;
  players: string[];
  createdBy: string;
  maxPlayers: number;
  status: GameStatuses;
  createdAt: string;
}

export interface GameState {
  players: Player[];
  gameLog: { username: string; msg: string }[];
  board: BoardState;
  activeChance: Chance;
  id: string;
  associatedRoomId: string;
  currentTurn: string;
  currentAction: string;
  auctionParticipants: string[];
  currentAuctionParticipant?: string | null;
  currentAuctionBid?: number | null;
  auctionedTileId?: number | null;
  activeTrade: Trade | null;
}

export interface BoardState {
  tiles: Tile[];
  groups: Group[];
}

export interface Chance {
  type: string | null;
  amount?: number | null;
  text?: string | null;
  tileId?: number | null;
}

export interface Trade {
  from: string | null;
  to: string | null;
  given: number[];
  received: number[];
  givenMoney: number | null;
  receivedMoney: number | null;
}
