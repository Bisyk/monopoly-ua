<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "positive" | "danger" | "gold" | "neutral";
  }>(),
  {
    variant: "neutral",
  }
);
</script>

<template>
  <span class="retro-badge" :class="`retro-badge--${variant}`">
    <slot />
  </span>
</template>

<style scoped lang="scss">
.retro-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
  padding: 4px 8px;
  border: 1.5px solid var(--outline);
  border-radius: var(--radius-sm);
  white-space: nowrap;

  &--primary {
    background: var(--accent);
    color: #ffffff;
  }

  &--positive {
    background: var(--positive);
    color: #ffffff;
  }

  &--danger {
    background: var(--danger);
    color: #ffffff;
  }

  &--gold {
    background: var(--gold);
    color: var(--ink);
  }

  &--neutral {
    background: var(--surface-alt);
    color: var(--ink);
  }
}
</style>
