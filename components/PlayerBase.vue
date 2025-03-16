<script setup lang="ts">
import { defineProps, computed, type PropType } from 'vue'
import type { Player } from '~/types'

const colorMap: Record<string, string> = {
  "#9999FF": "#6666FF", // light blue
  "#99CC99": "#66CC66", // light green
  "#FF9999": "#FF6666", // light red
  "#FFFF99": "#FFFF66", // light yellow
  "#CC99CC": "#DDA0DD", // light purple
  "#FFCC99": "#FFB266", // light orange
  "#CC9980": "#D2B48C", // light brown
  "#FFE6EB": "#FFB6C1", // light pink
}

const props = defineProps({
  player: {
    type: Object as PropType<Player>,
    required: true
  },
  tileId: {
    type: Number,
    required: true
  }
})

const isPlayerOnTile = computed(() => props.player.position === props.tileId)

const borderColor = computed(() => {
  // Safely return the border color or a fallback (transparent)
  return colorMap[props.player.color] || 'black'
})

</script>

<template>
  <div v-if="isPlayerOnTile" class="player-token" :style="{
    backgroundColor: player.color,
    borderColor: borderColor
  }"></div>
</template>

<style scoped>
.player-token {
  width: 3vmin;
  aspect-ratio: 1/1;
  margin: 0.2vh;
  border-radius: 50%;
  transition: transform 0.5s ease;
  border: 0.5vmin solid;
}
</style>