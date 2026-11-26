<script setup lang="ts">
import { computed } from "vue";

export type ButtonVariant =
  | "primary"
  | "positive"
  | "danger"
  | "secondary"
  | "ghost";

const props = withDefaults(
  defineProps<{
    textColor?: string;
    bgColor?: string;
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg";
    block?: boolean;
  }>(),
  {
    textColor: "",
    bgColor: "",
    size: "md",
    block: false,
  }
);

const resolvedVariant = computed<ButtonVariant>(() => {
  if (props.variant) return props.variant;
  const bg = props.bgColor.trim().toLowerCase();
  if (bg === "green") return "positive";
  if (bg === "red") return "danger";
  if (bg === "transparent") return "ghost";
  if (bg === "yellow" || bg === "gold") return "secondary";
  return "primary";
});
</script>

<template>
  <button
    class="cartridge-btn"
    :class="[
      `cartridge-btn--${resolvedVariant}`,
      `cartridge-btn--${props.size}`,
      { 'cartridge-btn--block': props.block },
    ]"
  >
    <slot />
  </button>
</template>

<style lang="scss" scoped>
.cartridge-btn {
  appearance: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: 13.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 11px 18px;
  border-radius: var(--radius-md);
  border: 2.5px solid var(--outline);
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  transition:
    transform 0.07s cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 0.07s cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 0.12s ease,
    background-color 0.12s ease;

  &--sm {
    font-size: 11.5px;
    padding: 8px 12px;
    gap: 6px;
  }

  &--lg {
    font-size: 15px;
    padding: 14px 22px;
    gap: 9px;
  }

  &--block {
    width: 100%;
  }

  &--primary {
    background: var(--accent);
    color: #ffffff;
    box-shadow:
      0 5px 0 var(--accent-dark),
      0 5px 0 2px var(--outline),
      inset 0 3px 0 rgba(255, 255, 255, 0.4);
  }

  &--positive {
    background: var(--positive);
    color: #ffffff;
    box-shadow:
      0 5px 0 var(--positive-dark),
      0 5px 0 2px var(--outline),
      inset 0 3px 0 rgba(255, 255, 255, 0.38);
  }

  &--danger {
    background: var(--danger);
    color: #ffffff;
    box-shadow:
      0 5px 0 var(--danger-dark),
      0 5px 0 2px var(--outline),
      inset 0 3px 0 rgba(255, 255, 255, 0.35);
  }

  &--secondary {
    background: var(--gold);
    color: var(--ink);
    box-shadow:
      0 5px 0 var(--gold-dark),
      0 5px 0 2px var(--outline),
      inset 0 3px 0 rgba(255, 255, 255, 0.55);
  }

  &--ghost {
    background: transparent;
    color: var(--ink);
    border-color: transparent;
    box-shadow: none;

    &:hover:not(:disabled) {
      background: var(--surface-alt);
      border-color: var(--outline);
      transform: none;
      filter: none;
    }

    &:active:not(:disabled) {
      transform: translateY(1px);
      box-shadow: none;
    }
  }

  &:not(&--ghost):hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }

  &:not(&--ghost):active:not(:disabled) {
    transform: translateY(5px);
    box-shadow:
      0 0 0 var(--outline),
      inset 0 2px 0 rgba(0, 0, 0, 0.16);
  }

  &:disabled {
    background: #d8dfec;
    color: #848da3;
    border-color: #adb6ca;
    box-shadow: 0 2px 0 #adb6ca;
    cursor: not-allowed;
    transform: none;
    filter: none;
  }
}
</style>