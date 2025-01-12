declare interface GameState {
  roomId: number | null
  players: Array<string>
  currentTurn: string | null
  boardState: Array<object>
}
