<script setup lang="ts">
import { onMounted, ref, watch, computed, useTemplateRef, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getTilePosition } from '../../utils/board'
import { onClickOutside } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const players = ref<string[]>([])
const gameState = ref<GameState>({} as GameState)
const username = sessionStorage.getItem('username')
const boardState = ref<BoardState[]>([] as BoardState)
const selectedTile = ref(null)
const tileInfo = ref(null)

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

const handleBuyProperty = () => {
  send(JSON.stringify({ action: 'BUY_PROPERTY', payload: { username, property: { ...currentTilePlayerOn.value } } }))
}

const handlePassProperty = () => {
  send(JSON.stringify({ action: 'PASS_PROPERTY', payload: { username } }))
}

const showTileInfo = async (event, tile) => {
  const tileRect = event.target.getBoundingClientRect();
  const containerRect = document.querySelector('.gameContainer')!.getBoundingClientRect();
  selectedTile.value = tile;
  const position = getTilePosition(tile.id)
  await nextTick();

  let top = tileRect.top - containerRect.top;
  let left = tileRect.left - containerRect.left;

  if (position === 'top') {
    top += tileRect.height
  }

  if (position === 'right') {
    left -= tileRect.width
  }

  if (position === 'bottom') {
    top -= tileRect.height / 2
  }

  if (position === 'left') {
    left += tileRect.width
  }

  if (tileInfo.value) {
    tileInfo.value.style.top = `${top}px`;
    tileInfo.value.style.left = `${left}px`;
  }
}

onClickOutside(tileInfo, event => {
  selectedTile.value = null
})

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

  <div class="gameContainer">

    <!-- Tile Info -->
    <div v-if="selectedTile" class="tileInfo" ref="tileInfo">
      <h3>{{ selectedTile.name }}</h3>
      <!-- {{ gameState.currentTurn === username }}
      {{ player.properties.includes(selectedTile.id) }}
      {{ player }}
      {{ selectedTile.id }} -->
      <BaseButton v-if="gameState.currentTurn === username && player.properties.includes(selectedTile.id)"
        bgColor="red">SELL
      </BaseButton>
      <p>Price: {{ selectedTile.price }}</p>
      <p>Rent: {{ selectedTile.rent }}</p>
    </div>

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
        <BaseButton :disabled="player.balance < currentTilePlayerOn.price" @click="handleBuyProperty" bgColor="green">
          BUY
        </BaseButton>
        <BaseButton @click="handlePassProperty" bgColor="red">PASS
        </BaseButton>
      </div>
    </GameModal>

    <!-- GAME BOARD -->
    <GameBoard :tilesState="tilesState" :gameState="gameState" :showTileInfo="showTileInfo" />
  </div>




</template>

<style scoped lang="scss">
.gameContainer {
  position: relative;
  max-width: fit-content + 1rem;
  max-height: fit-content;
  margin: 0 auto;

  .tileInfo {
    position: absolute;
    z-index: 11;
    background-color: white;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    min-width: 10vw;
  }
}
</style>