<script setup lang="ts">
import { onMounted, ref } from 'vue';

const selectedOption = ref(2)
const modalContainer = ref<HTMLElement>({} as HTMLElement);

defineEmits(['createGame', 'closeModal'])

onMounted(() => {
  modalContainer.value?.focus();
});
</script>

<template>
  <div ref="modalContainer" class="modalContainer" @keydown.escape="$emit('closeModal')" tabindex="0">
    <div class=" modal">
      <div class="header">
        <h2>Create Game</h2>
        <BaseButton bg-color="transparent" text-color="black" @click="$emit('closeModal')">X</BaseButton>
      </div>
      <div class=" body">
        <h3>Choose number of players:</h3>
        <div>
          <button :class="selectedOption === playerQuantity ? 'active modalButton' : 'modalButton'"
            v-for="playerQuantity in [2, 3, 4, 5, 6]" @click="selectedOption = playerQuantity">
            {{ playerQuantity }}
          </button>
        </div>
      </div>
      <p class="footer">
        <BaseButton @click="$emit('createGame', selectedOption)">CREATE GAME</BaseButton>
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modalContainer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal {
  position: absolute;
  z-index: 1000;
  max-width: 800px;
  width: 100%;
  background-color: #ffffff;
  border: 1px solid #ccc;
  padding: 1rem;
  border-radius: 12px;
  ;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .modalButton {
    background-color: #ffffff;
    border: 1px solid #ccc;
    color: rgb(0, 0, 0);
    padding: 0.5rem 1rem;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    margin: 4px 2px;
    cursor: pointer;
    border-radius: 5px;

    &:hover {
      background-color: #ccc;
    }
  }

  .active {
    background-color: $main-color;
    color: $white-color;
  }
}



.footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}
</style>