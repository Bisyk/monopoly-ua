<script setup lang="ts">
import { computed } from "vue";

const DIE_MAP: Record<number, number[]> = {
  1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
  3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
  5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  6: [1, 0, 1, 1, 0, 1, 1, 0, 1],
};

const props = withDefaults(
  defineProps<{
    value?: number;
    size?: number;
    rolling?: boolean;
  }>(),
  {
    value: 5,
    size: 46,
    rolling: false,
  }
);

const pattern = computed(() => DIE_MAP[props.value] ?? DIE_MAP[5]);
</script>

<template>
  <div
    class="retro-die"
    :class="{ 'retro-die--rolling': rolling }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <span
      v-for="(on, idx) in pattern"
      :key="idx"
      class="retro-die__pip"
      :class="{ 'is-on': on === 1 }"
    />
  </div>
</template>

<style scoped lang="scss">
.retro-die {
  background: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: 6px;
  box-shadow:
    0 4px 0 var(--outline),
    inset 0 2px 0 rgba(255, 255, 255, 0.55);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  padding: 7px;
  gap: 3px;
  flex-shrink: 0;
}

.retro-die--rolling {
  animation: dieBounce 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.retro-die__pip {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: transparent;

  &.is-on {
    background: var(--accent);
  }
}

@keyframes dieBounce {
  0% {
    transform: translateY(0) rotate(0deg);
  }
  35% {
    transform: translateY(-7px) rotate(-12deg);
  }
  70% {
    transform: translateY(2px) rotate(8deg);
  }
  100% {
    transform: translateY(0) rotate(0deg);
  }
}
</style>
