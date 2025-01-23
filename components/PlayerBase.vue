<template>
    <div v-if="isPlayerOnTile" class="player-token"></div>
</template>

<script setup lang="ts">
const props = defineProps({
  player: {
    type: Object,
    required: true
  },
  tileId: {
    type: Number,
    required: true
  }
})

const isPlayerOnTile = computed(() => props.player.position === props.tileId)


</script>

<style scoped>
.player-token {
  width: 2vh;
  height: 2vh;
  background-color: red;
  margin: 0.2vh;
  border-radius: 50%;
  transition: transform 0.5s ease;
}
</style>