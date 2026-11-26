<script setup lang="ts">
const props = defineProps({
  isSending: {
    type: Boolean,
    required: true,
  },
});

defineEmits(["handleUserTurn"]);
</script>

<template>
  <GameModal title="Your Turn!" code="ROLL" icon="dice">
    <p class="modal-copy">
      Roll two dice to advance your piece around the board. Rolling doubles
      unlocks a bonus turn.
    </p>

    <div class="modal-highlight roll-tray">
      <div class="roll-dice-pair">
        <RetroDie :value="5" :rolling="props.isSending" />
        <RetroDie :value="3" :rolling="props.isSending" />
      </div>
      <div class="roll-tray__meta">
        <span class="roll-tray__kicker">STATUS</span>
        <strong class="roll-tray__label">
          {{ props.isSending ? "Rolling..." : "Ready to roll" }}
        </strong>
      </div>
    </div>

    <div class="modal-actions">
      <BaseButton
        variant="primary"
        size="lg"
        block
        :disabled="props.isSending"
        @click="$emit('handleUserTurn')"
      >
        <GameIcon name="dice" :size="22" />
        <span>{{ props.isSending ? "ROLLING..." : "ROLL DICE" }}</span>
      </BaseButton>
    </div>
  </GameModal>
</template>

<style lang="scss" scoped>
.roll-tray {
  justify-content: space-between;
}

.roll-dice-pair {
  display: flex;
  gap: 10px;
}

.roll-tray__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.roll-tray__kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-muted);
}

.roll-tray__label {
  font-size: 14px;
  font-weight: 800;
  color: var(--ink);
  margin-top: 2px;
}
</style>