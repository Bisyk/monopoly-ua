<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const route = useRoute()
const router = useRouter()
const players = ref<string[]>([])
const gameState = ref<GameState>({} as GameState)
const username = sessionStorage.getItem('username')
const boardState = ref<BoardState[]>([] as BoardState)

const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${route.params.roomId}`)

watch(gameState, (newState) => {
  console.log(newState)
  if (Object.keys(newState).length > 0) {
    boardState.value = newState.boardState
  }
})

const tilesState = computed(() => {
  if (boardState.value[0]) {
    return boardState.value[0].tiles
  }
  return []
})

const player = computed(() => {
  return gameState.value.players.find(p => p.username === username)
})

const currentTilePlayerOn = computed(() => {
  return tilesState.value[player.value.position - 1]
})

handleMessage((message) => {
  console.log('received message')
  console.log(JSON.parse(message));
  gameState.value = JSON.parse(message)
})

const handleUserTurn = () => {
  const turnResult = rollDice()
  send(JSON.stringify({ action: 'ROLL_DICE', payload: { username, turnResult } }))
}

onMounted(async () => {
  const username = sessionStorage.getItem('username')
  console.log('username: ', username);
  const { body } = await $fetch(`/games/${route.params.roomId}`)
  const { game } = JSON.parse(body)

  players.value = game.players

  if (!game.players.some(u => u.username === username)) {
    router.push('/')
  }

  send(JSON.stringify({ action: 'JOIN_GAME', payload: { username } }))
})


definePageMeta({
  title: 'Monopoly UA | Game',
  layout: 'empty',
  head: {
    meta: [
      {
        name: 'viewport',
        content: 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,shrink-to-fit=no',
      }
    ]
  }
})
</script>

<template>
  <div style="position: fixed; top: 0; left: 0; z-index: 9999; height: 100vh; width: fit-content; overflow-y: scroll;">
    <pre>
      {{ gameState }}
    </pre>
  </div>

  <div class="gameContainer" style="position: relative;">

    <!-- ROLL MODAL -->
    <GameModal v-if="gameState.currentTurn === username && gameState.currentAction === 'roll'">
      <div>
        <h1>It's your turn!</h1>
        <h3 style="margin-bottom: 1rem;">Roll the dice to move your piece.</h3>
      </div>
      <BaseButton @click="handleUserTurn" style="position: absolute; z-index: 11111;">ROLL DICE</BaseButton>
    </GameModal>

    <!-- BUY MODAL -->
    <GameModal v-if="gameState.currentTurn === username && gameState.currentAction === 'buy'">
      <h1>Do you want to buy this property?</h1>
      <h3>Name: {{ currentTilePlayerOn.name }}</h3>
      <h3>Price: {{ currentTilePlayerOn.price }}</h3>
      <div style="display: flex; gap: 1rem;">
        <BaseButton :disabled="player.balance < currentTilePlayerOn.price"
          @click="send(JSON.stringify({ action: 'BUY_PROPERTY', payload: { username, property: { ...currentTilePlayerOn } } }))"
          bgColor="green">BUY
        </BaseButton>
        <BaseButton @click="send(JSON.stringify({ action: 'PASS_PROPERTY', payload: { username } }))" bgColor="red">PASS
        </BaseButton>
      </div>
    </GameModal>

    <GameBoard :tilesState="tilesState" :gameState="gameState" />
  </div>




</template>

<style scoped lang="scss"></style>