declare interface gameLogEntry {
  username: string;
  msg: string;
}

declare interface GameState {
  roomId: number | null;
  players: Array<string>;
  currentTurn: string | null;
  boardState: Array<object>;
  gameLog: Array<gameLogEntry>;
}
