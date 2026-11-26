<script setup lang="ts">
import { computed, type CSSProperties, type PropType } from "vue";
import type { Player } from "~/types";

const colorMap: Record<string, string> = {
  "#9999FF": "#6666FF", // light blue
  "#99CC99": "#66CC66", // light green
  "#FF9999": "#FF6666", // light red
  "#FFFF99": "#FFFF66", // light yellow
  "#CC99CC": "#DDA0DD", // light purple
  "#FFCC99": "#FFB266", // light orange
  "#CC9980": "#D2B48C", // light brown
  "#FFE6EB": "#FFB6C1", // light pink
};

const props = defineProps({
  player: {
    type: Object as PropType<Player>,
    required: true,
  },
  x: {
    type: Number,
    required: true,
  },
  y: {
    type: Number,
    required: true,
  },
  transitionDurationMs: {
    type: Number,
    default: 0,
  },
  transitionEasing: {
    type: String,
    default: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  isMoving: {
    type: Boolean,
    default: false,
  },
  lift: {
    type: Number,
    default: 0,
  },
});

const borderColor = computed(() => colorMap[props.player.color] || "black");

const anchorStyle = computed<CSSProperties>(() => ({
  transform: `translate3d(${props.x}px, ${props.y}px, 0) translate(-50%, -50%)`,
  transition:
    props.transitionDurationMs > 0
      ? `transform ${props.transitionDurationMs}ms ${props.transitionEasing}`
      : "none",
  zIndex: props.isMoving ? 20 : 6,
}));

const tokenStyle = computed<CSSProperties>(() => {
  const clampedLift = Math.max(0, Math.min(1.5, props.lift));
  const scale = 1 + clampedLift * 0.18;
  const shadowY = 2 + clampedLift * 7;
  const shadowBlur = 5 + clampedLift * 12;
  const shadowAlpha = 0.35 + Math.min(0.2, clampedLift * 0.14);

  return {
    backgroundColor: props.player.color,
    borderColor: borderColor.value,
    transform: clampedLift > 0.001 ? `scale(${scale.toFixed(3)})` : "scale(1)",
    boxShadow: `0 ${shadowY.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0, 0, 0, ${shadowAlpha.toFixed(2)})`,
  };
});
</script>

<template>
  <div
    class="player-token-anchor"
    :style="anchorStyle"
    :data-player-token="player.username"
  >
    <div
      class="player-token"
      :class="{
        'player-token--moving': isMoving,
      }"
      :style="tokenStyle"
    />
  </div>
</template>

<style scoped>
.player-token-anchor {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  will-change: transform;
}

.player-token {
  width: 3vmin;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: 0.5vmin solid;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .player-token-anchor,
  .player-token {
    transition: none !important;
  }

  .player-token {
    transform: none !important;
  }
}
</style>