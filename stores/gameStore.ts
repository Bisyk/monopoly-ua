import { defineStore } from 'pinia'

interface GameState {
  roomId: number | null
  players: Array<string>
  currentTurn: string | null
  boardState: Array<object>
}

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    roomId: null,
    players: [],
    currentTurn: null,
    boardState: []
  }),
  actions: {
    setGameState(gameState: GameState) {
      this.players = gameState.players
      this.currentTurn = gameState.currentTurn
      this.boardState = gameState.boardState
    }
  }
})
