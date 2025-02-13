<template>
  <div v-if="isPlayerOnTile" class="player-token"></div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue'

const colorMap = {
  "#9999FF": "#0000FF", // blue
  "#99CC99": "#008000", // green
  "#FF9999": "#FF0000", // red
  "#FFFF99": "#FFFF00", // yellow
  "#CC99CC": "#800080", // purple
  "#FFCC99": "#FFA500", // orange
  "#CC9980": "#8B4513", // brown
  "#FFE6EB": "#FFC0CB", // pink
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
  width: 3vmin;
  aspect-ratio: 1/1;
  background-color: v-bind(player.color);
  border: 0.5vh solid v-bind(borderColor);
  margin: 0.2vh;
  border-radius: 50%;
  transition: transform 0.5s ease;
}
</style>