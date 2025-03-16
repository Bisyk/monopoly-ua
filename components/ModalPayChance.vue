<script setup lang="ts">
const props = defineProps({
  chanceText: {
    type: String,
    required: true
  },
  playerBalance: {
    type: Number,
    required: true
  },
  chanceAmount: {
    type: Number,
    required: true
  },
  isSending: {
    type: Boolean,
    required: true
  }
})

defineEmits(['handlePayChance'])
</script>

<template>
  <GameModal>
    <h1>Pay Chance</h1>
    <h3>{{ props.chanceText }}</h3>
    <BaseButton @click="$emit('handlePayChance')" bgColor="red" :disabled="props.playerBalance < props.chanceAmount || props.isSending
      ">PAY</BaseButton>
  </GameModal>
</template>

<style lang="scss" scoped></style>