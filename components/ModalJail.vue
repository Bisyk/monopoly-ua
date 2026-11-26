<script setup lang="ts">
defineEmits(["handleUserTurn", "handleJailPay"]);

const props = defineProps({
  isSending: {
    type: Boolean,
    required: true,
  },
  playerBalance: {
    type: Number,
    required: true,
  },
});
</script>

<template>
  <GameModal title="In Jail!" code="DETAINED" icon="jail">
    <ul class="jail-options">
      <li>
        <GameIcon name="coin" :size="19" class="jail-options__icon" />
        <span>Pay <strong>$50</strong> bail to get out immediately.</span>
      </li>
      <li>
        <GameIcon name="dice" :size="19" class="jail-options__icon" />
        <span>Roll <strong>doubles</strong> on your turn to exit free.</span>
      </li>
      <li>
        <GameIcon name="clock" :size="19" class="jail-options__icon" />
        <span>Automatic release after 3 turns in jail.</span>
      </li>
    </ul>

    <div class="modal-actions">
      <BaseButton
        variant="primary"
        :disabled="props.isSending"
        @click="$emit('handleUserTurn')"
      >
        <GameIcon name="dice" :size="19" />
        <span>ROLL DICE</span>
      </BaseButton>
      <BaseButton
        variant="positive"
        :disabled="props.playerBalance < 50 || props.isSending"
        @click="$emit('handleJailPay')"
      >
        <GameIcon name="coin" :size="19" />
        <span>PAY $50</span>
      </BaseButton>
    </div>
  </GameModal>
</template>

<style lang="scss" scoped>
.jail-options {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 11px;
    background: var(--surface-alt);
    border: 1.5px solid var(--outline);
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
}

.jail-options__icon {
  color: var(--accent);
}
</style>