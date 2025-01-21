<script setup lang="ts">
const props = defineProps({
  type: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
  id: {
    type: Number,
    required: true
  }
})

const isCorner = (() => {
  if (props.type === 'go' || props.type === 'jail' || props.type === 'parking' || props.type === 'goToJail') {
    return true
  }
  return false
})
</script>

<template>
  <div :class="`space ${isCorner.value ? 'corner' : ''} ${props.type}`">
    <div class=" container">
      <div class="heroSprite">{{ props.name }}</div>
    </div>
    <div class="player-container">
      <PlayerBase v-for="player in props.players" :key="player.id" :player="player" :tile-id="props.id" />
    </div>

  </div>
</template>


<style lang="scss" scoped>
$tile-size: 3.5vw;
$corner-tile-size: calc(6vw + 4px);

.space {
  background: white;
  text-align: center;
  // border: 1px solid black;
  border-radius: 12px;
  filter: drop-shadow(0 0 0.15rem rgba(0, 0, 0, 0.5));

  .container {
    background-color: transparent;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    transform-origin: center;
    height: 100%;
    width: 100%;

    .heroSprite {
      padding: 0;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
    }
  }
}

// Corner spaces
.corner {
  .container {
    justify-content: space-around;
    height: 100%;
    width: 100%;
  }

  .name {
    padding: 22;
  }
}

// Specific spaces
.freeParking {
  grid-column: 11;
  grid-row: 11 / 12;
  position: relative;

  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
}

.goToJail {
  grid-column: 1;
  grid-row: 11 / 12;
  display: grid;


  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
}

.go {
  grid-column: 1;
  grid-row: 1 / 2;

  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
}

.jail {
  grid-column: 11;
  grid-row: 1 / 1;

  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
}

.player-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}
</style>