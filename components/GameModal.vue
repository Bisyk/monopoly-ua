<script setup lang="ts">
import { onMounted } from 'vue';


onMounted(() => {
  const audio = new Audio('/sound.wav');
  
  // audio.play();
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
  position: fixed;
  z-index: 10;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  min-height: 40vh;
  max-height: 80vh;
  min-width: 25vw;
  max-width: 80vw;
  background-color: white;
  padding: 2vmin;
  border-radius: 2vmin;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}
</style>