// export { Tile, Player };

type GameStatuses = "PENDING" | "STARTED" | "ENDED";
export interface Tile {
  id: number;
  groupId: number;
  spriteName: string;
  name: string;
  price: number;
  type: string;
  owner: string;
  houses: number;
  mortgaged: boolean;
  position: number;
  rentLevel: number;
  rentLevels: number[];
  mortgagePrice: number;
  buybackPrice: number;
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
  upgradePrice: number;
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
  id: string;
  associatedRoomId: string;
  players: Player[];
  currentTurn: string;
  boardState: BoardState;
  currentAction: string;
  auctionParticipants: string[];
  currentAuctionParticipant?: string;
  currentAuctionBid?: number;
  tileOnAuction?: number;
  activeChance: Chance[];
  activeTrade: Record<string, any>;
}

export interface BoardState {
  tiles: Tile[];
  groups: Group[];
}

export interface Chance {
  type: string;
  amount?: number;
  text?: string;
  tileId?: number;
}
