<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const route = useRoute()
const router = useRouter()
const players = ref<string[]>([])
const gameState = ref<GameState>({} as GameState)
const username = sessionStorage.getItem('username')
const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${route.params.roomId}`)
const boardState = ref<BoardState[]>([] as BoardState)

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
    <GameModal v-if="gameState.currentTurn === username">
      <div>
        <h1>It's your turn!</h1>
        <h3 style="margin-bottom: 1rem;">Roll the dice to move your piece.</h3>
      </div>
      <BaseButton @click="handleUserTurn" style="position: absolute; z-index: 11111;">ROLL DICE</BaseButton>
    </GameModal>
    <div class="table">
      <div v-if="tilesState && tilesState.length" class="board">
        <div class="center">
          <div>
            <div v-if="gameState.gameLog && gameState?.gameLog.length" class="gameLog">
              <p v-for="entry in gameState?.gameLog">{{ entry.username }}: {{ entry.msg }}</p>
            </div>
          </div>
        </div>
        <BoardTile :type="tilesState[0].type" :name="tilesState[0].name" :players="gameState.players" :id="1"
          isHorizontal />
        <div class="row horizontal-row top-row ">
          <BoardTile v-for="tile in tilesState.slice(1, 10)" :type="tile.type" :name="tile.name"
            :players="gameState.players" :id="tile.id" inTopRow isHorizontal />
        </div>
        <BoardTile :type="tilesState[10].type" :name="tilesState[10].name" :players="gameState.players" :id="11"
          isHorizontal />
        <div class="row vertical-row right-row">
          <BoardTile v-for="tile in tilesState.slice(11, 20)" :type="tile.type" :name="tile.name"
            :players="gameState.players" :id="tile.id" inRightRow isVertical />
        </div>
        <BoardTile :type="tilesState[20].type" :name="tilesState[20].name" :players="gameState.players" :id="21"
          isHorizontal />
        <div class="row horizontal-row bottom-row">
          <BoardTile v-for="tile in tilesState.slice(21, 30).reverse()" :type="tile.type" :name="tile.name"
            :players="gameState.players" :id="tile.id" inBottomRow isHorizontal />
        </div>
        <BoardTile :type="tilesState[30].type" :name="tilesState[30].name" :players="gameState.players" :id="31"
          isHorizontal />
        <div class="row vertical-row left-row">
          <BoardTile v-for="tile in tilesState.slice(31, 40).reverse()" :type="tile.type" :name="tile.name"
            :players="gameState.players" :id="tile.id" isLeftRow isVertical />
        </div>
      </div>
    </div>
  </div>




</template>

<style scoped lang="scss">
$tile-size: 3.5vw;
$corner-tile-size: calc(6vw + 4px);

.table {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  overflow: hidden;
}

.board {
  display: grid;
  grid-template-columns: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for columns
  grid-template-rows: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for rows
  grid-gap: 2px;
  margin: 0 auto;
  max-width: 90vw; // Ensure it doesn't exceed a maximum size
  max-height: 90vw; // Ensure it doesn't exceed a maximum size  
}

.center {
  position: relative;
  grid-column: 2 / 11;
  grid-row: 2 / 11;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(7, 1fr);
  justify-items: center;
  align-items: center;
}


// =================
// Rows and Spaces
// =================

.row {
  display: grid;
  grid-gap: 2px;
}

.horizontal-row {
  grid-template-columns: repeat(9, $tile-size); // Adjust column size based on viewport width
  grid-template-rows: $corner-tile-size;
}

.vertical-row {
  grid-template-columns: $corner-tile-size;
  grid-template-rows: repeat(9, $tile-size); // Adjust row size based on viewport width

  .container {
    top: 50%;
    left: 50%;
  }
}

// Specific space styles for different rows
.bottom-row {
  grid-column: 2 / 11;
  grid-row: 11;
}

.left-row {
  grid-column: 1;
  grid-row: 2 / 11;

  .container {
    transform: translate(-50%, -50%) rotate(90deg);
  }
}

.top-row {
  grid-column: 2 / 11;
  grid-row: 1;

  .container {
    transform: rotate(0deg);
  }
}

.right-row {
  grid-column: 11;
  grid-row: 2 / 11;

  .container {
    transform: translate(-50%, -50%) rotate(-90deg);
  }
}

.gameLog {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(126, 126, 126, 0.1);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: scroll;
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
  border-radius: 2rem;
}
</style>