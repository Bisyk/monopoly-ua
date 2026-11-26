<script setup lang="ts">
import { onMounted, ref } from "vue";

const selectedOption = ref(2);
const modalContainer = ref<HTMLElement | null>(null);

defineEmits(["createGame", "closeModal"]);

onMounted(() => {
  modalContainer.value?.focus();
});
</script>

<template>
  <div
    ref="modalContainer"
    class="modal-backdrop"
    tabindex="0"
    @keydown.escape="$emit('closeModal')"
    @click.self="$emit('closeModal')"
  >
    <div class="modal-dialog" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-header__title">
          <GameIcon name="plus" :size="20" />
          <h2>CREATE GAME</h2>
        </div>
        <button
          type="button"
          class="modal-close"
          aria-label="Close modal"
          @click="$emit('closeModal')"
        >
          <GameIcon name="close" :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-label">CHOOSE NUMBER OF PLAYERS</p>
        <div class="qty-grid">
          <button
            v-for="playerQuantity in [2, 3, 4, 5, 6]"
            :key="playerQuantity"
            type="button"
            class="qty-btn"
            :class="{ 'is-active': selectedOption === playerQuantity }"
            @click="selectedOption = playerQuantity"
          >
            <span class="qty-num">{{ playerQuantity }}</span>
            <span class="qty-sub">PLAYERS</span>
          </button>
        </div>
      </div>

      <div class="modal-footer">
        <BaseButton variant="ghost" @click="$emit('closeModal')">
          CANCEL
        </BaseButton>
        <BaseButton
          variant="positive"
          @click="$emit('createGame', selectedOption)"
        >
          <GameIcon name="dice" :size="18" />
          <span>CREATE {{ selectedOption }}P TABLE</span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(30, 27, 58, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  outline: none;
}

.modal-dialog {
  width: 100%;
  max-width: 460px;
  background-color: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: var(--modal-shadow);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--accent);
  color: #ffffff;
  border-bottom: 2.5px solid var(--outline);
}

.modal-header__title {
  display: flex;
  align-items: center;
  gap: 8px;

  h2 {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  color: var(--ink);
  border: 2px solid var(--outline);
  border-radius: 6px;
  box-shadow: 0 2px 0 var(--outline);
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease;

  &:active {
    transform: translateY(2px);
    box-shadow: 0 0 0 var(--outline);
  }
}

.modal-body {
  padding: 18px 18px 14px;
}

.modal-label {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ink-muted);
  margin-bottom: 12px;
}

.qty-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.qty-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 12px 6px;
  background: var(--surface-alt);
  color: var(--ink);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 0 var(--outline);
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease, background-color 0.08s ease;

  &:hover {
    background: var(--gold-light);
  }

  &:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--outline);
  }

  &.is-active {
    background: var(--accent);
    color: #ffffff;
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.25),
      0 4px 0 var(--accent-dark),
      0 6px 0 var(--outline);
  }
}

.qty-num {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.qty-sub {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  opacity: 0.8;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 18px;
}
</style>