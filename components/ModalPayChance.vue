<script setup lang="ts">
const props = defineProps({
  chanceText: {
    type: String,
    required: true,
  },
  playerBalance: {
    type: Number,
    required: true,
  },
  chanceAmount: {
    type: Number,
    required: true,
  },
  isSending: {
    type: Boolean,
    required: true,
  },
});

defineEmits(["handlePayChance"]);
</script>

<template>
  <GameModal title="Chance Fine" code="CHANCE" icon="star">
    <div class="chance-banner">
      <p class="chance-banner__text">{{ props.chanceText }}</p>
      <div class="chance-banner__amount">-${{ props.chanceAmount }}</div>
    </div>

    <div v-if="props.playerBalance < props.chanceAmount" class="modal-warning">
      <GameIcon name="warn" :size="20" />
      <span>
        Short ${{ props.chanceAmount - props.playerBalance }} — mortgage
        properties to cover this chance fine.
      </span>
    </div>

    <div class="modal-actions">
      <BaseButton
        variant="danger"
        size="lg"
        block
        :disabled="props.playerBalance < props.chanceAmount || props.isSending"
        @click="$emit('handlePayChance')"
      >
        <GameIcon name="coin" :size="20" />
        <span>PAY ${{ props.chanceAmount }}</span>
      </BaseButton>
    </div>
  </GameModal>
</template>

<style lang="scss" scoped>
.chance-banner {
  background: #4f3cc9;
  color: #ffffff;
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 0 var(--outline);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chance-banner__text {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.chance-banner__amount {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--gold-light);
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
  flex-shrink: 0;
}
</style>