<template>
    <div v-if="isPlayerOnTile" class="player-token"></div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue'

const colorMap = {
  "#6666FF": "#0000FF", // blue
  "#66B266": "#008000", // green
  "#FF6666": "#FF0000", // red
  "#FFFF66": "#FFFF00", // yellow
  "#B266B2": "#800080", // purple
  "#FFB266": "#FFA500", // orange
  "#B2735B": "#8B4513", // brown
  "#FFD9E1": "#FFC0CB", // pink
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