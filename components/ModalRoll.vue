<script setup lang="ts">
  defineEmits(['handleUserTurn'])
</script>

<template>
   <GameModal>
      <div>
        <h1>It's your turn!</h1>
        <h3 style="margin-bottom: 1rem">Roll the dice to move your piece.</h3>
      </div>
      <BaseButton @click="$emit('handleUserTurn')" style="position: absolute; z-index: 11111" :disabled="isSending">ROLL DICE
      </BaseButton>
    </GameModal>
</template>


<style lang="scss" scoped></style>