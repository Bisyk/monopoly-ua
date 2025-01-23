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
  position: absolute; // Changed from absolute to fixed
  top: 0;
  left: 0;
  z-index: 9999;
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: 30vw;
  height: 40vh;
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
</style>