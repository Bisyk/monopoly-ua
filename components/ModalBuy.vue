<script lang="ts" setup>
const props = defineProps({
  tileId: {
    type: Number,
    required: true
  },
  tileName: {
    type: String,
    required: true
  },
  tilePrice: {
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

defineEmits(['handleBuyProperty', 'handlePassProperty'])
</script>

<template>
  <GameModal>
    <h1>Do you want to buy this property?</h1>

    <h3>Name: {{ props.tileName }}</h3>
    <h3>Price: {{ props.tilePrice }}</h3>
    <div style="display: flex; gap: 1rem">
      <BaseButton :disabled="props.playerBalance < props.tilePrice || props.isSending"
        @click="$emit('handleBuyProperty')" bgColor="green">
        BUY
      </BaseButton>
      <BaseButton @click="$emit('handlePassProperty')" bgColor="red" :disabled="props.isSending">PASS
      </BaseButton>
    </div>
  </GameModal>
</template>

<style lang="scss"></style>