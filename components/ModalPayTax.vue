<script setup lang="ts">
const props = defineProps({
  taxAmount: {
    type: Number,
    required: true,
  },
  playerBalance: {
    type: Number,
    required: true,
  },
  isSending: {
    type: Boolean,
    required: false,
    default: false,
  },
});

defineEmits(["handlePayTax"]);
</script>

<template>
  <GameModal title="Pay Tax" code="TREASURY" icon="coin">
    <p class="modal-copy">
      Treasury assessment due on landing. Pay the tax to finish your turn.
    </p>

    <div class="modal-highlight">
      <div>
        <div class="modal-asset__name">Tax Assessment</div>
        <div class="modal-asset__sub">
          Your cash: ${{ props.playerBalance.toLocaleString() }}
        </div>
      </div>
      <div class="modal-price modal-price--danger">${{ props.taxAmount }}</div>
    </div>

    <div v-if="props.playerBalance < props.taxAmount" class="modal-warning">
      <GameIcon name="warn" :size="20" />
      <span>
        Short ${{ props.taxAmount - props.playerBalance }} — mortgage assets to
        pay tax.
      </span>
    </div>

    <div class="modal-actions">
      <BaseButton
        variant="danger"
        size="lg"
        block
        :disabled="props.playerBalance < props.taxAmount || props.isSending"
        @click="$emit('handlePayTax')"
      >
        <GameIcon name="coin" :size="20" />
        <span>PAY ${{ props.taxAmount }}</span>
      </BaseButton>
    </div>
  </GameModal>
</template>