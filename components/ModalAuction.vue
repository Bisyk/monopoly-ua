<script setup lang="ts">
const props = defineProps({
  tileOnAuctionName: {
    type: String,
    required: true
  },
  tileOnAuctionPrice: {
    type: Number,
    required: true
  },
  playerBalance: {
    type: Number,
    required: true,
  },
  isSending: {
    type: Boolean,
    required: true
  }
})

defineEmits(['handleBidAuctionProperty', 'handlePassAuctionProperty'])
</script>

<template>
  <GameModal>
    <h1>Auction</h1>
    <h3>
      Do you want buy
      <span style="text-decoration: underline">{{
        props.tileOnAuctionName
      }}</span>
      for
      <span style="text-decoration: underline">{{
        props.tileOnAuctionPrice
      }}</span>?
    </h3>
    <BaseButton @click="$emit('handleBidAuctionProperty')" bgColor="green" :disabled="props.playerBalance < props.tileOnAuctionPrice || isSending
      ">BID</BaseButton>
    <BaseButton @click="$emit('handlePassAuctionProperty')" bgColor="red" :disabled="props.isSending">PASS
    </BaseButton>
  </GameModal>
</template>

<style lang="scss" scoped></style>