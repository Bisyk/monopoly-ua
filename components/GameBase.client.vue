<script setup lang="ts">
import { useGameStore } from '../stores/gameStore'

const history = ref<string[]>([])
const turnResult = ref<number>(0)
const username = ref(sessionStorage.getItem('username') || `User-${Math.random().toString(36).substring(2, 10)}`)
const gameStore = useGameStore()

const saveUsernameToSessionStorage = (username: string) => {
  sessionStorage.setItem('username', username)
}

onMounted(() => {
  saveUsernameToSessionStorage(username.value)
})



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

  <AvailableRooms :username="username" />
  <div>

  </div>
</template>