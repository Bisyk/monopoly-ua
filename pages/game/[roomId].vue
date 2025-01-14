<script setup lang="ts">
const route = useRoute()

onMounted(async () => {
  const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${route.params.roomId}`)


  const { body } = await $fetch(`/games/${route.params.roomId}`)
  console.log(body);
})
</script>

<template>
  <div>
    <h1>Game #{{ route.params.roomId }}</h1>
  </div>
  <div>
    <BaseButton>ROLL DICE</BaseButton>
  </div>
</template>

<style scoped lang="scss"></style>