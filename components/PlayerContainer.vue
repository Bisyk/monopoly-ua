<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { onClickOutside } from '@vueuse/core'

const props = defineProps({
  playerFromPlayers: {
    type: Object,
    required: true,
  },
  player: {
    type: Object,
    required: true,
  }
})

console.log(props.playerFromPlayers);

defineEmits(['activateTrade'])

const isPlayerActionsVisible = ref(false);

const target = useTemplateRef<HTMLElement>('target')

const togglePlayerActions = () => {
  isPlayerActionsVisible.value = !isPlayerActionsVisible.value;
}
onClickOutside(target, event => isPlayerActionsVisible.value = false)
</script>

<template>
  <div @click="togglePlayerActions" ref="target" class="player-container"
    :style="`background-color: ${playerFromPlayers.color}`">
    <div class="player-avatar-container">
      <div class="player-avatar"></div>
    </div>
    <h2>{{ props.playerFromPlayers.username }}</h2>
    <h3>{{ props.playerFromPlayers.balance }} $</h3>
    <div v-if="isPlayerActionsVisible && playerFromPlayers.username !== player.username" class="player-actions">
      <button>PROFILE</button>
      <button @click="$emit('activateTrade', playerFromPlayers.username)">TRADE</button>
    </div>
  </div>

</template>

<style lang="scss" scoped>
.player-actions {
  position: absolute;
  top: 0;
  left: 105%;
  z-index: 10;
  background-color: white;
  padding: 1vmin;
  border-radius: 1rem;
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  gap: 1vmin;

  button {
    width: 10vmin;
    height: 3vmin;
    border: none;
    cursor: pointer;

    &:hover {
      background-color: rgba(20, 120, 208, 0.6);
      color: white
    }
  }
}

.player-container {
  text-align: center;
  border: 2px solid rgba(0, 0, 0, 0.2);
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.6);
  border-radius: 1rem;
  flex: 1;
  max-height: 24vmin;
  width: 100%;
  position: relative;

  h2 {
    font-size: 2vmin;
  }

  h3 {
    font-size: 1.5vmin;
  }

  .player-avatar-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 1vmin;

    .player-avatar {
      width: 5vmin;
      aspect-ratio: 1/1;
      border-radius: 50%;
      background-color: black;
    }
  }
}
</style>
