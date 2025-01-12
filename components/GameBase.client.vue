<script setup lang="ts">
import { useGameStore } from '../stores/gameStore'

const history = ref<string[]>([])
const turnResult = ref<number>(0)

const roomConnections = ref<{ [key: string]: { status: any, send: any, open: any, close: any } }>({})
const username = ref(sessionStorage.getItem('username') || `User-${Math.random().toString(36).substring(2, 10)}`)
const gameStore = useGameStore()
const availableGames = ref<CreatedGame[]>([])
const selectedGame = ref(0)

const isUserAlreadyCreateGame = computed(() => {
  return availableGames.value.some(game => game.createdBy === username.value)
})

const isConnectedToRoom = computed(() => {
  return availableGames.value.some(game => game.players.includes(username.value))
})

const saveUsernameToSessionStorage = (username: string) => {
  sessionStorage.setItem('username', username)
}

onMounted(() => {
  saveUsernameToSessionStorage(username.value)

  const { send, handleMessage } = useWebsocketManager(`ws://${location.host}/api/games`)

  setInterval(() => {
    send('GET_GAMES')
  }, 1000)

  handleMessage((message) => {
    availableGames.value = JSON.parse(message)
  })
})

const handleRoomConnection = async (roomId: number) => {
  if (roomConnections.value[roomId]) {
    console.log(`Already connected to room ${roomId}`);
    return
  }

  try {
    await $fetch('/games', {
      method: 'PUT',
      body: { username: username.value, roomId }
    });

    const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${roomId}`)

    roomConnections.value[roomId] = { status, send, open, close }

    handleMessage((message) => {
      const { username, turnResult } = JSON.parse(message)
      history.value.push(`${username}: ${turnResult}`)
    })

    selectedGame.value = roomId
  } catch (error) {
    console.error(error);
  }
}

function sendData(roomId: number) {
  const payload = {
    username: username.value,
    turnResult: turnResult.value,
    action: "ROLL_DICE"
  }
  history.value.push(`${username.value}: ${turnResult.value}`)
  roomConnections.value[roomId].send(JSON.stringify(payload))
  turnResult.value = 0
}

const handlePlayerTurn = (roomId: number) => {
  turnResult.value = rollDice()
  sendData(roomId)
}

const createGame = async () => {
  const id = Math.floor(Math.random() * 1000000000)

  try {
    const { body } = await $fetch('/games', {
      method: 'POST',
      body: {
        id,
        players: [username.value],
        createdBy: username.value,
      }
    })

    const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${id}`)

    roomConnections.value[id] = { status, send, open, close }

    handleMessage((message) => {
      const { username, turnResult } = JSON.parse(message)
      history.value.push(`${username}: ${turnResult}`)
    })

    selectedGame.value = id
  } catch (err) {
    console.error(err);
  }
}
</script>

<template>
  <pre v-if="false">
    {{ gameStore }}
  </pre>
  <div>
    <label>Username: <input type=" text" v-model="username" @input="(e) => {
      saveUsernameToSessionStorage((e.target as HTMLInputElement).value)
    }
      " /></label>
    <p></p>
    <div v-if="isConnectedToRoom">
      <button @click="handlePlayerTurn(selectedGame)">ROLL DICE</button>
      <div>
        <h2>Game Log:</h2>
        <p v-for="entry in history">
          {{ entry }}
        </p>
      </div>
    </div>
  </div>
  <button v-if="!isUserAlreadyCreateGame && !isConnectedToRoom" @click="createGame">CREATE GAME</button>
  <div>
    <div v-for="game in availableGames">
      <p>Game #{{ game.id }} <button v-if="!isConnectedToRoom" @click="handleRoomConnection(game.id)">JOIN</button></p>
      <p>Players: {{ game.players.map(p => p) }}</p>
    </div>
  </div>
</template>