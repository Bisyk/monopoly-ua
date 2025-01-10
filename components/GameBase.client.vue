<script setup lang="ts">
import { useWebSocket } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'

const roomId = ref('1')
const history = ref<string[]>([])
const turnResult = ref<number>(0)
const isConnectedToRoom = ref(false)
const roomConnections = ref<{ [key: string]: { status: any, send: any, open: any, close: any } }>({})
const username = ref(sessionStorage.getItem('username') || `User-${Math.random().toString(36).substring(2, 10)}`)
const gameStore = useGameStore()

const saveUsernameToSessionStorage = (username: string) => {
  sessionStorage.setItem('username', username)
}

onMounted(() => {
  saveUsernameToSessionStorage(username.value)
})

const handleRoomConnection = () => {

  if (roomConnections.value[roomId.value]) {
    console.log(`Already connected to room ${roomId.value}`);
    return
  }

  const { status, data, send, open, close } = useWebSocket(`ws://${location.host}/api/websocket?roomId=${roomId.value}`)

  roomConnections.value[roomId.value] = { status, send, open, close }

  watch(data, (newValue) => {
    try {
      const { username, turnResult } = JSON.parse(newValue)
      history.value.push(`${username}: ${turnResult}`)
    } catch (error) {
      console.error("Failed to parse message:", error)
    }
  })

  isConnectedToRoom.value = true
}

function sendData() {
  const payload = {
    username: username.value,
    turnResult: turnResult.value,
    action: "ROLL_DICE"
  }
  history.value.push(`${username.value}: ${turnResult.value}`)
  roomConnections.value[roomId.value].send(JSON.stringify(payload))
  turnResult.value = 0
}

const handlePlayerTurn = () => {
  turnResult.value = rollDice()
  sendData()
}
</script>

<template>
  <pre>
    {{ gameStore }}
  </pre>
  <div>
    <label>Room: <input type="text" v-model="roomId" /></label> <button @click="handleRoomConnection">Connect</button>
    <p></p>
    <label>Username: <input type="text" v-model="username" @input="(e) => {
      saveUsernameToSessionStorage((e.target as HTMLInputElement).value)
    }
      " /></label>
    <p></p>
    <div v-if="isConnectedToRoom">
      <button @click="handlePlayerTurn">ROLL DICE</button>
      <div>
        <h2>Game Log:</h2>
        <p v-for="entry in history">
          {{ entry }}
        </p>
      </div>
    </div>
  </div>
</template>