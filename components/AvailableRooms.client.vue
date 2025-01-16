<script setup lang="ts">
import { useRouter } from 'vue-router'
import AvailableRoomCard from './AvailableRoomCard.vue'
import CreateRoomModal from './CreateRoomModal.vue'

const props = defineProps({
  username: { type: String, required: true },
})

const allGames = ref<CreatedGame[]>([])
const roomConnections = ref<{ [key: string]: { status: any, send: any, open: any, close: any } }>({})
const isCreateGameModalActive = ref(false)
const router = useRouter()
const { send, handleMessage } = useWebsocketManager(`ws://${location.host}/api/games`)

setInterval(() => {
  send('GET_GAMES')
}, 1000)

handleMessage((message) => {
  allGames.value = JSON.parse(message)
})

const availableGames = computed(() => {
  return allGames.value.filter(game => game.status === 'PENDING')
})

const isConnectedToRoom = computed(() => {
  return allGames.value.some(game => game.players.includes(props.username))
})

watch(allGames, () => {
  if (allGames.value.some(game => game.players.includes(props.username) && game.status === 'PENDING')) {
    console.log('user to connect: ', props.username);
    const game = allGames.value.find(game => game.players.includes(props.username) && game.status === 'PENDING')
    console.log('finded game for connect: ', game);
    if (game?.players.length === game?.maxPlayers) {
      startGame(game)
    }
  }
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
        status: 'PENDING'
      }
    })

    isCreateGameModalActive.value = false
  } catch (err) {
    console.error(err);
  }
}

const connectRoom = async (roomId: number) => {
  if (roomConnections.value[roomId]) {
    console.log(`Already connected to room ${roomId}`);
    return
  }

  try {
    await $fetch('/games', {
      method: 'PUT',
      body: { action: { type: 'JOIN_ROOM' }, payload: { username: props.username, roomId } }
    });
  } catch (error) {
    console.error(error);
  }
}

const startGame = async (game: CreatedGame) => {
  console.log('startGame', game);
  try {
    console.log(`Started game in room ${game.id}`);
    for (const player of game.players) {
      if (player === props.username) {
        router.push(`/game/${game.id}`)
      }
    }
  } catch (error) {
    console.error(error);
  }
}

const closeModal = () => {
  isCreateGameModalActive.value = false
}



onMounted(() => {
  send('GET_GAMES')
})
</script>

<template>
  <div class="container">
    <CreateRoomModal v-if="isCreateGameModalActive" @create-game="createRoom" @close-modal="closeModal" />
    <div class="header">
      <h2>Available Games</h2>
      <BaseButton v-if="!isConnectedToRoom" @click="isCreateGameModalActive = true">CREATE
        GAME</BaseButton>
    </div>

    <AvailableRoomCard v-for="game in availableGames" :game-id="game.id" :max-players="game.maxPlayers"
      :players="game.players" @joinGame="connectRoom" />

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