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
</script>

<template>
  <pre>
    {{ gameState }}
  </pre>
  <div>
    <h1>Game #{{ route.params.roomId }}</h1>
  </div>
  <div>
    <BaseButton v-if="gameState?.currentTurn === username" @click="handleUserTurn">ROLL DICE</BaseButton>
    <div v-if="gameState.gameLog && gameState?.gameLog.length">
      <p v-for="entry in gameState?.gameLog">{{ entry.username }}: {{ entry.msg }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>