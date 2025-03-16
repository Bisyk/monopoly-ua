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
  transform: translate(-30%, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  height: 40vmin;
  width: 50vmin;
  background-color: white;
  padding: 2vmin;
  border-radius: 2vmin;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow-y: auto;

  h1 {
    font-size: min(4.5vmin, 2rem);
  }

  h3 {
    font-size: min(3vmin, 1.5rem);
  }

  p {
    font-size: min(2.5vmin, 1rem);
  }
}
</style>