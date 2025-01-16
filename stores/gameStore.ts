import { defineStore } from 'pinia'

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
