<script setup lang="ts">
import { onMounted } from "vue";
import type { GameIconName } from "./GameIcon.vue";

withDefaults(
  defineProps<{
    title?: string;
    code?: string;
    icon?: GameIconName;
    wide?: boolean;
  }>(),
  {
    title: "",
    code: "",
    wide: false,
  }
);

onMounted(() => {
  // Audio cue hook preserved for future SFX toggle
  // const audio = new Audio('/sound.wav');
});
</script>

<template>
  <div class="game-modal-backdrop">
    <div class="game-modal" :class="{ 'game-modal--wide': wide }">
      <div v-if="title" class="game-modal__head">
        <div class="game-modal__head-left">
          <GameIcon v-if="icon" :name="icon" :size="22" />
          <h1 class="game-modal__title">{{ title }}</h1>
        </div>
        <span v-if="code" class="game-modal__code">{{ code }}</span>
      </div>

      <div class="game-modal__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.game-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  pointer-events: none;
}

.game-modal {
  pointer-events: auto;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 36px);
  background: var(--surface);
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  box-shadow:
    0 6px 0 var(--outline),
    0 18px 42px rgba(30, 27, 58, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &--wide {
    width: min(680px, calc(100vw - 32px));
  }
}

.game-modal__head {
  padding: 13px 18px;
  background: var(--accent);
  color: #ffffff;
  border-bottom: 2.5px solid var(--outline);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.game-modal__head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.game-modal__title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1;
  color: #ffffff;
}

.game-modal__code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 7px;
  background: rgba(30, 27, 58, 0.28);
  border: 1.5px solid rgba(255, 255, 255, 0.45);
  border-radius: var(--radius-sm);
  color: #ffffff;
  flex-shrink: 0;
}

.game-modal__body {
  padding: 18px 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.modal-copy {
  font-size: 13.5px;
  line-height: 1.48;
  color: var(--ink-muted);
}

.modal-highlight {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface-alt);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
}

.modal-asset {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.modal-asset__logo {
  width: 54px;
  height: 54px;
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  box-shadow: 2px 2px 0 var(--outline);
  display: grid;
  place-items: center;
  padding: 5px;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.modal-asset__name {
  font-family: var(--font-body);
  font-size: 15.5px;
  font-weight: 800;
  color: var(--ink);
}

.modal-asset__sub {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ink-muted);
  margin-top: 2px;
}

.modal-price {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 800;
  color: var(--ink);
  letter-spacing: -0.02em;
  flex-shrink: 0;

  &--danger {
    color: var(--danger);
  }
}

.modal-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--danger-soft);
  border: 2px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  gap: 10px;
  padding-bottom: 2px;

  > button {
    flex: 1;
  }
}
</style>