<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const players = ref<string[]>([])
const gameState = ref<GameState>({} as GameState)
const username = sessionStorage.getItem('username')
const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${route.params.roomId}`)

handleMessage((message) => {
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
  <!-- <pre v-if="false">
    {{ gameState }}
  </pre>
  <div v-if="false">
    <h1>Game #{{ route.params.roomId }}</h1>
  </div> -->

  <div class="table">
    <div class="board">
      <div class="center">
        <h1 class="">MONOPOLY</h1>
      </div>

      <div class="row horizontal-row top-row ">


        <div class="space ">
          <div class="container">
            2
          </div>
        </div>
        <div class="space ">
          <div class="container">
            3
          </div>
        </div>
        <div class="space ">
          <div class="container">
            4
          </div>
        </div>
        <div class="space ">
          <div class="container">
            5
          </div>
        </div>
        <div class="space ">
          <div class="container">
            6
          </div>
        </div>
        <div class="space ">
          <div class="container">
            7
          </div>
        </div>
        <div class="space ">
          <div class="container">
            8
          </div>
        </div>
        <div class="space  ">
          <div class="container">
            9
          </div>
        </div>
        <div class="space ">
          <div class="container">
            10
          </div>
        </div>
      </div>

      <div class="space corner jail">
        <div class="container">
          JAIL
        </div>
      </div>

      <div class="row vertical-row right-row">
        <div class="space ">
          <div class="container">
            12
          </div>
        </div>
        <div class="space ">
          <div class="container">
            13
          </div>
        </div>
        <div class="space ">
          <div class="container">
            14
          </div>
        </div>
        <div class="space ">
          <div class="container">
            15
          </div>
        </div>
        <div class="space ">
          <div class="container">
            16
          </div>
        </div>
        <div class="space">
          <div class="container">
            17
          </div>
        </div>
        <div class="space ">
          <div class="container">
            18
          </div>
        </div>
        <div class="space">
          <div class="container">
            19
          </div>
        </div>
        <div class="space">
          <div class="container">
            20
          </div>
        </div>
      </div>


      <div class="space corner free-parking">
        <div class="container">
          FREE PARKING
        </div>
      </div>

      <div class="row horizontal-row bottom-row">
        <div class="space">
          <div class="container">
            30
          </div>
        </div>
        <div class="space">
          <div class="container">
            29
          </div>
        </div>
        <div class="space">
          <div class="container">
            28
          </div>
        </div>
        <div class="space ">
          <div class="container">
            27
          </div>
        </div>
        <div class="space">
          <div class="container">
            26
          </div>
        </div>
        <div class="space">
          <div class="container">
            25
          </div>
        </div>
        <div class="space">
          <div class="container">
            24
          </div>
        </div>
        <div class="space">
          <div class="container">
            23
          </div>
        </div>
        <div class="space">
          <div class="container">
            22
          </div>
        </div>
      </div>



      <div class="row vertical-row left-row">
        <div class="space">
          <div class="container">
            40
          </div>
        </div>
        <div class="space">
          <div class="container">
            39
          </div>
        </div>
        <div class="space">
          <div class="container">
            38
          </div>
        </div>
        <div class="space">
          <div class="container">
            37
          </div>
        </div>
        <div class="space">
          <div class="container">
            36
          </div>
        </div>
        <div class="space">
          <div class="container">
            35
          </div>
        </div>
        <div class="space">
          <div class="container">
            34
          </div>
        </div>
        <div class="space">
          <div class="container">
            33
          </div>
        </div>
        <div class="space">
          <div class="container">
            32
          </div>
        </div>
      </div>

      <div class="space corner go">
        <div class="container">
          GO
        </div>
      </div>

      <div class="space corner go-to-jail">
        <div class="container">
          GO TO JAIL
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
    justify-content: flex-start;
    transform: rotate(315deg);
  }
}

.go-to-jail {
  grid-column: 1;
  grid-row: 11 / 12;
  display: grid;


  .container {
    align-items: center;
    transform: rotate(45deg);
  }
}

.go {
  grid-column: 1;
  grid-row: 1 / 2;

  .container {
    justify-content: center;
    transform: rotate(45deg);
  }
}

.jail {
  grid-column: 11;
  grid-row: 1 / 1;

  .container {
    justify-content: center;
    transform: rotate(-45deg);
  }
}
</style>