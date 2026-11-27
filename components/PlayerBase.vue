<script setup lang="ts">
import { computed, type CSSProperties, type PropType } from "vue";
import { getBotAvatarUrl } from "~/shared/constants/botNames";
import type { Player } from "~/types";
import {
  getCartridgePlayerColor,
  getPlayerInitials,
} from "~/utils/cartridgeTheme";

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
  isActiveTurn: {
    type: Boolean,
    default: false,
  },
});

const tokenBg = computed(() => getCartridgePlayerColor(props.player.color));
const initials = computed(() => getPlayerInitials(props.player.username));
const avatarUrl = computed(() =>
  props.player.isBot ? getBotAvatarUrl(props.player.username) : null
);

const anchorStyle = computed<CSSProperties>(() => ({
  transform: `translate3d(${props.x}px, ${props.y}px, 0) translate(-50%, -50%)`,
  transition:
    props.transitionDurationMs > 0
      ? `transform ${props.transitionDurationMs}ms ${props.transitionEasing}`
      : "none",
  zIndex: props.isMoving ? 20 : props.isActiveTurn ? 12 : 6,
}));

const tokenStyle = computed<CSSProperties>(() => {
  const clampedLift = Math.max(0, Math.min(1.5, props.lift));
  const scale = 1 + clampedLift * 0.2;
  const shadowOffset = 2.5 + clampedLift * 4.5;

  return {
    backgroundColor: tokenBg.value,
    transform: clampedLift > 0.001 ? `scale(${scale.toFixed(3)})` : "scale(1)",
    boxShadow: props.isActiveTurn
      ? `0 0 0 2px #2667e8, ${shadowOffset.toFixed(1)}px ${shadowOffset.toFixed(1)}px 0 #1e1b3a, inset 0 2px 0 rgba(255, 255, 255, 0.38)`
      : `${shadowOffset.toFixed(1)}px ${shadowOffset.toFixed(1)}px 0 #1e1b3a, inset 0 2px 0 rgba(255, 255, 255, 0.38)`,
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
        'player-token--active': isActiveTurn,
        'player-token--avatar': Boolean(avatarUrl),
      }"
      :style="tokenStyle"
      :title="player.username"
    >
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        :alt="player.username"
        class="player-token__img"
      />
      <span v-else class="player-token__initials">{{ initials }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.player-token-anchor {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  will-change: transform;
}

.player-token {
  width: clamp(24px, 3.2vmin, 32px);
  height: clamp(24px, 3.2vmin, 32px);
  border-radius: 5px;
  border: 2px solid #ffffff;
  outline: 1.5px solid var(--outline);
  display: grid;
  place-items: center;
  overflow: hidden;
  will-change: transform;
}

.player-token__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.player-token__initials {
  font-family: var(--font-mono);
  font-size: clamp(8.5px, 1.05vmin, 11px);
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
  line-height: 1;
  letter-spacing: -0.02em;
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