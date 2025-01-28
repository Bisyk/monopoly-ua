<template>
    <div v-if="isPlayerOnTile" class="player-token"></div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue'

const colorMap = {
  "#0000FF": "#6666FF", // blue
  "#008000": "#66B266", // green
  "#FF0000": "#FF6666", // red
  "#FFFF00": "#FFFF66", // yellow
  "#800080": "#B266B2", // purple
  "#FFA500": "#FFB266", // orange
  "#8B4513": "#B2735B", // brown
  "#FFC0CB": "#FFD9E1", // pink
}

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

const borderColor = colorMap[props.player.color]

</script>

<style scoped>
.player-token {
  width: 3.5vh;
  height: 3.5vh;
  background-color: v-bind(player.color);
  border: 0.5vh solid v-bind(borderColor);
  margin: 0.2vh;
  border-radius: 50%;
  transition: transform 0.5s ease;
}
</style>