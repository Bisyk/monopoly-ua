<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  tile: {
    type: Object,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
})

defineEmits(['showTileInfo'])

const isCorner = computed(() => {
  return ['go', 'jail', 'parking', 'goToJail'].includes(props.tile.type)
})

const isHorizontalProperty = computed(() => {
  const horizontalPropertyTypes = ['property', 'bonus-property'];
  const horizontalPropertyIds = [2, 3, 4, 5, 6, 7, 8, 9, 10, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  return horizontalPropertyTypes.includes(props.tile.type) && horizontalPropertyIds.includes(props.tile.id);
});

const isTopRow = computed(() => {
  return props.tile.id >= 1 && props.tile.id <= 10;
});

const isRightRow = computed(() => {
  return props.tile.id >= 11 && props.tile.id <= 20;
});

const isBottomRow = computed(() => {
  return props.tile.id >= 21 && props.tile.id <= 30;
});

const isLeftRow = computed(() => {
  return props.tile.id >= 31 && props.tile.id <= 40;
})

const priceStyle = computed(() => {
  return {
    width: '100%',
    position: 'absolute',
    textAlign: 'center',
    top: isTopRow.value ? '-20%' : '',
    bottom: isBottomRow.value ? '-20%' : '',
    left: isLeftRow.value ? '-80%' : '',
    right: isRightRow.value ? '-80%' : '',
    transform: isLeftRow.value ? 'rotate(270deg) translate(-15%, 80%)' : isRightRow.value ? 'rotate(90deg) translate(15%, 80%)' : '',
  }
})

const tileBgColor = computed(() => {
  return props.tile.owner ? props.players.find(player => player.username === props.tile.owner)?.color : 'white';
})

</script>

<template>
  <div :class="`space ${isCorner ? 'corner' : ''} ${props.tile.type}`" :style="`background-color: ${tileBgColor}`"
    @click="(e) => (['property', 'bonus-property', 'car'].includes(props.tile.type) ? $emit('showTileInfo', e, tile) : null)">
    <div v-if="props.tile.mortgaged" class="mortgaged-container">
      🔒
    </div>
    <div v-if="props.tile.price && !props.tile.owner" :style="priceStyle">
      {{ props.tile.price }}
    </div>
    <div v-if="props.tile.rentLevels.length && props.tile.owner" :style="priceStyle">
      {{ props.tile.rentLevels[props.tile.rentLevel] }}
    </div>
    <div class="container">
      <div class="heroContainer">
        <img :src="`/assets/sprites/ua/${props.tile.spriteName}.webp`" class="heroImage"
          :style="isHorizontalProperty ? { transform: 'rotate(270deg)' } : {}" />
        <div class="player-container">
          <PlayerBase v-for="player in props.players" :key="player.id" :player="player" :tile-id="props.tile.id" />
        </div>
      </div>
    </div>
  </div>
</template>


<style lang="scss" scoped>
$tile-size: 3vw;
$corner-tile-size: 6vw;

.space {
  background: white;
  text-align: center;
  border-radius: 12px;
  filter: drop-shadow(0 0 0.15rem rgba(0, 0, 0, 0.5));
  width: 100%;
  height: 100%;

  .container {
    background-color: transparent;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    transform-origin: center;
    height: 100%;
    width: 100%;

    .heroContainer {
      padding: 0;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      overflow: hidden;

      .heroImage {
        max-width: 100%;
        max-height: 100%;
        display: block;
        width: auto;
        height: auto;
      }

      .vertical {
        max-width: 90%;
        height: 90%;
        object-fit: contain;
      }

      .horizontal {
        width: 100%;
        height: 60%;
        object-fit: contain;
      }
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

.mortgaged-container {
  position: absolute;
  inset: 0;
  z-index: 5;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.6);
}
</style>