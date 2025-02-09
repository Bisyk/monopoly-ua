<script setup lang="ts">
import { onMounted } from 'vue';


onMounted(() => {
  const audio = new Audio('/sound.wav');
  audio.play();
})
</script>

<template>
  <div class="game-modal">
    <div class="modal-content">
      <slot></slot>
    </div>
  </div>
</template>

<style lang="scss">
.game-modal {
  position: absolute;
  z-index: 10;
  top: 50%;
  right: 50%;
  transform: translate(50%, -50%)
}

.modal-content {
  min-height: 40vh;
  max-height: 50vh;
  min-width: 25vw;
  max-width: 40vw;
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
</style>