<script setup lang="ts">
import AvailableRoomCard from './AvailableRoomCard.vue'
import CreateRoomModal from './CreateRoomModal.vue'

const props = defineProps({
  username: { type: String, required: true },
})

const availableGames = ref<CreatedGame[]>([])
const roomConnections = ref<{ [key: string]: { status: any, send: any, open: any, close: any } }>({})
const selectedGame = ref(0)
const isCreateGameModalActive = ref(false)

const isUserAlreadyCreateGame = computed(() => {
  return availableGames.value.some(game => game.createdBy === props.username)
})

const isConnectedToRoom = computed(() => {
  return availableGames.value.some(game => game.players.includes(props.username))
})

const createRoom = async (maxPlayers: number) => {
  const id = Math.floor(Math.random() * 1000000000)

  try {
    const { body } = await $fetch('/games', {
      method: 'POST',
      body: {
        id,
        players: [props.username],
        createdBy: props.username,
        maxPlayers,
      }
    })

    const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${id}`)

    roomConnections.value[id] = { status, send, open, close }

    handleMessage((message) => {
      const { username, turnResult } = JSON.parse(message)
      // history.value.push(`${username}: ${turnResult}`)
    })

    // selectedGame.value = i
    isCreateGameModalActive.value = false
  } catch (err) {
    console.error(err);
  }
}

const handleRoomConnection = async (roomId: number) => {
  if (roomConnections.value[roomId]) {
    console.log(`Already connected to room ${roomId}`);
    return
  }

  try {
    await $fetch('/games', {
      method: 'PUT',
      body: { username: props.username, roomId }
    });

    const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${roomId}`)

    roomConnections.value[roomId] = { status, send, open, close }

    handleMessage((message) => {
      const { username, turnResult } = JSON.parse(message)
      // history.value.push(`${username}: ${turnResult}`)
    })

    selectedGame.value = roomId
  } catch (error) {
    console.error(error);
  }
}

onMounted(() => {
  const { send, handleMessage } = useWebsocketManager(`ws://${location.host}/api/games`)

  setInterval(() => {
    send('GET_GAMES')
  }, 1000)

  handleMessage((message) => {
    availableGames.value = JSON.parse(message)
  })
})
</script>

<template>
  <div class="container">
    <CreateRoomModal v-if="isCreateGameModalActive" @create-game="createRoom" />
    <div class="header">
      <h2>Available Games</h2>
      <BaseButton v-if="!isUserAlreadyCreateGame && !isConnectedToRoom" @click="isCreateGameModalActive = true">CREATE
        GAME</BaseButton>
    </div>

    <AvailableRoomCard v-for="game in availableGames" :game-id="game.id" :max-players="game.maxPlayers"
      :players="game.players" @joinGame="handleRoomConnection" />

  </div>
</template>

<style lang="scss" scoped>
.container {
  margin: 2rem 2rem 0 2rem;
  background-color: white;
  padding: 0.5rem 2rem;
  border-radius: 2rem;

}

.header {
  padding: 0.5rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #ccc;
  margin-bottom: 1rem;
}
</style>