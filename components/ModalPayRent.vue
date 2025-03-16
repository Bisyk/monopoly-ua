<script setup lang="ts">
const props = defineProps({
  tilePlayerOn: {
    type: Object,
    required: true
  },
  turnResult: {
    type: Object,
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

defineEmits(['handlePayRent'])
</script>

<template>
  <GameModal>
    <h1>Pay Rent</h1>
    <h3>Owner: {{ props.tilePlayerOn.owner }}</h3>
    <h3 v-if="props.tilePlayerOn.type === 'bonus-property'">
      {{
        `${props.turnResult.left} + ${props.turnResult.right} x
      ${props.tilePlayerOn.rentLevels[props.tilePlayerOn.rentLevel]}
      = ${props.turnResult.left +
        props.turnResult.right *
        props.tilePlayerOn.rentLevels[props.tilePlayerOn.rentLevel]
        }`
      }}
    </h3>
    <h3 v-else>
      Rent:
      {{ props.tilePlayerOn.rentLevels[props.tilePlayerOn.rentLevel] }}
    </h3>
    <BaseButton @click="$emit('handlePayRent')" bgColor="red" :disabled="props.playerBalance <
      props.tilePlayerOn.rentLevels[props.tilePlayerOn.rentLevel] ||
      props.isSending
      ">PAY
    </BaseButton>
    <p v-if="
      props.playerBalance <
      props.tilePlayerOn.rentLevels[props.tilePlayerOn.rentLevel]
    ">
      * you don't have enough money to pay rent, mortgage something
    </p>
  </GameModal>
</template>

<style lang="scss"></style>