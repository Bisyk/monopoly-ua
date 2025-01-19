<script setup lang="ts">
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

handleMessage((message) => {
  console.log(JSON.parse(message));
  gameState.value = JSON.parse(message)
})

const handleUserTurn = () => {
  const turnResult = rollDice()
  send(JSON.stringify({ action: 'ROLL_DICE', payload: { turnResult } }))
}

onMounted(async () => {

  const username = sessionStorage.getItem('username')
  const { body } = await $fetch(`/games/${route.params.roomId}`)
  const { game } = JSON.parse(body)
  players.value = game.players


  if (!game.players.includes(username)) {
    router.push('/')
  }

  send(JSON.stringify({ action: 'JOIN_GAME', payload: { username } }))
})


definePageMeta({
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

  <div class="table">
    <div v-if="boardState.tiles.length" class="board">
      <div class="center">
        <h1 class="">MONOPOLY</h1>
      </div>

      <div class="space corner go">
        <div class="container">
          {{ boardState.tiles[0].name }}
        </div>
      </div>

      <div class="row horizontal-row top-row ">

        <div v-for="tile in boardState.tiles.slice(1, 10)" class="space ">
          <div class="container">
            {{ tile.id }}
          </div>
        </div>

      </div>

      <div class="space corner jail">
        <div class="container">
          {{ boardState.tiles[10].name }}
        </div>
      </div>

      <div class="row vertical-row right-row">

        <div v-for="tile in boardState.tiles.slice(11, 20)" class="space ">
          <div class="container">
            {{ tile.id }}
          </div>
        </div>

      </div>


      <div class="space corner free-parking">
        <div class="container">
          {{ boardState.tiles[20].name }}
        </div>
      </div>

      <div class="row horizontal-row bottom-row">
        <div v-for="tile in boardState.tiles.slice(21, 30).reverse()" class="space">
          <div class="container">
            {{ tile.id }}
          </div>
        </div>
      </div>

      <div class="space corner go-to-jail">
        <div class="container">
          GO TO JAIL
        </div>
      </div>

      <div class="row vertical-row left-row">

        <div v-for="tile in boardState.tiles.slice(31, 40).reverse()" class="space">
          <div class="container">
            {{ tile.id }}
          </div>
        </div>

      </div>
    </div>
  </div>



  <!-- <div>
    <BaseButton v-if="gameState?.currentTurn === username" @click="handleUserTurn">ROLL DICE</BaseButton>
    <div v-if="gameState.gameLog && gameState?.gameLog.length">
      <p v-for="entry in gameState?.gameLog">{{ entry.username }}: {{ entry.msg }}</p>
    </div>
  </div> -->
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
    transform: translate(50%, -50%) rotate(-90deg);
  }
}

// =================
// SPACES
// =================

.space {
  background: white;
  text-align: center;
  // border: 1px solid black;
  border-radius: 12px;
  filter: drop-shadow(0 0 0.15rem rgba(0, 0, 0, 0.5));

  .container {
    background-color: transparent;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    transform-origin: center;
    height: $corner-tile-size; // Adjust height based on viewport width
    width: $tile-size; // Adjust width based on viewport width
  }
}

// Corner spaces
.corner {
  .container {
    justify-content: space-around;
    height: 100%;
    width: 100%;
  }

  .name {
    padding: 0;
  }
}

// Specific spaces
.free-parking {
  grid-column: 11;
  grid-row: 11 / 12;
  position: relative;

  .container {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.go-to-jail {
  grid-column: 1;
  grid-row: 11 / 12;
  display: grid;


  .container {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.go {
  grid-column: 1;
  grid-row: 1 / 2;

  .container {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.jail {
  grid-column: 11;
  grid-row: 1 / 1;

  .container {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>