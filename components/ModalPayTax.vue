<script setup lang="ts">
const props = defineProps({
  taxAmount: {
    type: Number,
    required: true
  },
  playerBalance: {
    type: Number,
    required: true
  },
  isSending: {
    type: Boolean,
    required: true
  }
})

defineEmits(['handlePayTax'])
</script>

<template>
  <GameModal>
    <h1>Pay Tax</h1>
    <h3>You need to pay ${{ props.taxAmount }} tax</h3>
    <BaseButton @click="$emit('handlePayTax')" bgColor="red" :disabled="props.playerBalance < props.taxAmount || isSending">PAY
    </BaseButton>
  </GameModal>
</template>

<style lang="scss" scoped></style>