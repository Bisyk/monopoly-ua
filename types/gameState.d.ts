declare interface gameLogEntry {
  username: string;
  msg: string;
}

declare interface GameState {
  roomId: number | null;
  players: Array<string>;
  currentTurn: string | null;
  currentAction: string | null;
  boardState: Array<object>;
  gameLog: Array<gameLogEntry>;
}

declare interface Tile {
  id: number;
  groupId: number;
  spriteName: string;
  name: string;
  price: number;
  rent: number;
  type: string;
  owner: string;
  houses: number;
  mortgaged: boolean;
  position: number;
  firstLevelRent: number;
  secondLevelRent: number;
  thirdLevelRent: number;
  fourthLevelRent: number;
  fifthLevelRent: number;
  mortgagePrice: number;
  buybackPrice: number;
}
