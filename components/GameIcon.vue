<script setup lang="ts">
export type GameIconName =
  | "dice"
  | "coin"
  | "gavel"
  | "lock"
  | "swap"
  | "up"
  | "down"
  | "warn"
  | "jail"
  | "clock"
  | "house"
  | "hq"
  | "star"
  | "bolt"
  | "close"
  | "plus"
  | "user"
  | "trophy";

withDefaults(
  defineProps<{
    name: GameIconName;
    size?: number | string;
  }>(),
  {
    size: 19,
  }
);
</script>

<template>
  <svg
    class="game-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'dice'">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fill-opacity="0.16" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="name === 'coin'">
      <circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.18" />
      <path d="M12 7v10M14.5 9.5c0-1.1-1.1-2-2.5-2s-2.5.9-2.5 2 1.1 2 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2-2.5-.9-2.5-2" />
    </template>

    <template v-else-if="name === 'gavel'">
      <path d="M14 4l6 6-3 3-6-6 3-3z" fill="currentColor" fill-opacity="0.22" />
      <path d="M11 7L4 14l3 3 7-7" />
      <path d="M3 20h10" />
    </template>

    <template v-else-if="name === 'lock'">
      <rect x="4" y="11" width="16" height="10" rx="2" fill="currentColor" fill-opacity="0.2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="name === 'swap'">
      <path d="M4 8h15l-4-4" />
      <path d="M20 16H5l4 4" />
    </template>

    <template v-else-if="name === 'up'">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </template>

    <template v-else-if="name === 'down'">
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </template>

    <template v-else-if="name === 'warn'">
      <path d="M12 3L21 19H3L12 3z" fill="currentColor" fill-opacity="0.18" />
      <path d="M12 9v4.5" />
      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="name === 'jail'">
      <rect x="3" y="4" width="18" height="16" rx="1.5" fill="currentColor" fill-opacity="0.14" />
      <path d="M8 4v16M12 4v16M16 4v16" />
    </template>

    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.15" />
      <path d="M12 7v5l3.5 2" />
    </template>

    <template v-else-if="name === 'house'">
      <path d="M3.5 11.5L12 4L20.5 11.5V20H3.5V11.5Z" fill="currentColor" fill-opacity="0.28" />
    </template>

    <template v-else-if="name === 'hq'">
      <path d="M4 20V6L12 2.5L20 6V20H4Z" fill="currentColor" fill-opacity="0.32" />
      <path d="M9.5 10h5M9.5 14.5h5" />
    </template>

    <template v-else-if="name === 'star'">
      <polygon
        points="12 3 15 9 21 9.8 16.5 14.2 17.6 20.5 12 17.4 6.4 20.5 7.5 14.2 3 9.8 9 9"
        fill="currentColor"
        fill-opacity="0.25"
      />
    </template>

    <template v-else-if="name === 'bolt'">
      <polygon
        points="13 2 4 14 11 14 10 22 20 10 13 10"
        fill="currentColor"
        fill-opacity="0.25"
      />
    </template>

    <template v-else-if="name === 'close'">
      <path d="M6 6l12 12M18 6L6 18" />
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>

    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8.5" r="4" fill="currentColor" fill-opacity="0.2" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="currentColor" fill-opacity="0.16" />
    </template>

    <template v-else-if="name === 'trophy'">
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" fill="currentColor" fill-opacity="0.22" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
      <path d="M12 15v4M8.5 20h7" />
    </template>
  </svg>
</template>

<style scoped>
.game-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
