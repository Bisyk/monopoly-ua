// export { Tile, Player };

type GameStatuses = "PENDING" | "STARTED" | "ENDED";
export interface Tile {
  id: number;
  groupId?: number | null;
  assetId: string;
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

export type BotDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface BotSlot {
  username: string;
  difficulty: BotDifficulty;
}

export interface DiceRoll {
  left: number;
  right: number;
}

export interface DeclinedTrade {
  from: string;
  to: string;
  signature: string;
  boardHash: string;
}

export interface Player {
  username: string;
  color: string;
  position: number;
  balance: number;
  properties: number[];
  ownedPropertyGroupIds: number[];
  jailed: boolean;
  turnsInJail: number;
  doublesInRow: number;
  bonusRoll: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty | null;
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
  bots?: BotSlot[];
  createdBy: string;
  maxPlayers: number;
  status: GameStatuses;
  createdAt: string;
}

export type MoveMode = "step" | "direct";

export interface MoveSegment {
  from: number;
  to: number;
  mode: MoveMode;
}

export interface PlayerMoveEvent {
  moveId: string;
  username: string;
  segments: MoveSegment[];
}

export interface DiceRollEvent {
  rollId: string;
  username: string;
  left: number;
  right: number;
  isDoubles: boolean;
}

export interface GameState {
  players: Player[];
  status: GameStatuses;
  winnerUsername: string | null;
  eliminatedPlayers: string[];
  gameLog: { username: string; msg: string }[];
  board: BoardState;
  activeChance: Chance;
  id: string;
  associatedRoomId: string;
  currentTurn: string;
  currentAction: string;
  auctionParticipants: string[];
  activeAuctionBidder?: string | null;
  auctionBidAmount?: number | null;
  auctionedTileId?: number | null;
  activeTrade: Trade | null;
  lastMove?: PlayerMoveEvent | null;
  lastRoll?: DiceRollEvent | null;
  lastDiceRoll?: DiceRoll | null;
  declinedTrades?: DeclinedTrade[];
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
