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
