<script setup lang="ts">
defineEmits(['handleUserTurn', 'handleJailPay'])

const props = defineProps({
  isSending: {
    type: Boolean,
    required: true
  },
  playerBalance: {
    type: Number,
    required: true
  }
})
</script>

<template>
  <GameModal>
    <h1>You are in JAIL!</h1>
    <p>You have the following options:</p>
    <ul>
      <li>Pay $50 to get out of jail immediately.</li>
      <li>Roll doubles on your next turn to get out of jail for free.</li>
      <li>
        Wait for three turns, after which you will be released automatically.
      </li>
    </ul>
    <div>
      <BaseButton @click="$emit('handleUserTurn')" :disabled="props.isSending">ROLL DICE</BaseButton>
      <BaseButton @click="$emit('handleJailPay')" :disabled="props.playerBalance < 50 || isSending" bgColor="green">PAY
      </BaseButton>
    </div>
  </GameModal>

</template>

<style lang="scss" scoped></style>