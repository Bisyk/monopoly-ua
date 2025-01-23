<script setup lang="ts">
import { computed } from 'vue'

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
  },
  inTopRow: {
    type: Boolean,
    default: false
  },
  inRightRow: {
    type: Boolean,
    default: false
  },
  inBottomRow: {
    type: Boolean,
    default: false
  },
  inLeftRow: {
    type: Boolean,
    default: false
  },
  isHorizontal: {
    type: Boolean,
    default: false
  },
  isVertical: {
    type: Boolean,
    default: false
  }
})

const positionCss = computed(() => {
  if (props.inTopRow) {
    return 'transform: rotate(270deg)'
  } else if (props.inRightRow) {
    return 'right-row'
  } else if (props.inBottomRow) {
    return 'transform: rotate(270deg)'
  } else if (props.inLeftRow) {
    return 'left-row'
  } else {
    return ''
  }
})

const isCorner = (() => {
  if (props.type === 'go' || props.type === 'jail' || props.type === 'parking' || props.type === 'goToJail') {
    return true
  }
  return false
})

const heroImageClass = computed(() => {
  if (props.isHorizontal) {
    return "heroImage horizontal"
  }
  if (props.isVertical) {
    return "heroImage vertical"
  }
})

</script>

<template>
  <div :class="`space ${isCorner.value ? 'corner' : ''} ${props.type}`">
    <div class=" container" :style="`width: 100%; ${props.type === 'property' || props.type === 'car' || props.type === 'bonus-property' ?
      positionCss : ''}`">
      <div class="heroSprite">
        <img :class="heroImageClass"
          v-if="props.type === 'property' || props.type === 'go' || props.type === 'bonus-property'"
          :src="`/assets/${props.name}-sprite.webp`" alt="tile" />
        <img :class="heroImageClass" v-if="props.type === 'chance'" src="/assets/chance-sprite.webp"
          :style="`${inRightRow ? 'transform: rotate(90deg)' : ''}`" alt="chance" />
        <img :class="heroImageClass" v-if="props.type === 'tax'" src="/assets/tax-sprite.webp" alt="tax" />
        <img :class="heroImageClass" v-if="props.type === 'luxury-tax'" src="/assets/luxurytax-sprite.webp" alt="tax" />
        <img :class="heroImageClass" v-if="props.type === 'car'" :src="`/assets/${props.name}-sprite.webp`" alt="car" />
        <div v-if="props.type === 'jail'">
          <img class="heroImage" src=" /assets/jail-sprite.webp" style="width: 50%; aspect-ratio: 1/1;" alt="jail" />
          <img class="heroImage" src="/assets/doughnut-sprite.webp" style="width: 50%; aspect-ratio: 1/1;" alt="jail" />
        </div>
        <div v-if="props.type === 'parking'">
          <img :class="heroImageClass" src="/assets/freeparking-sprite.webp" alt="parking" />
        </div>
        <div v-if="props.type === 'goToJail'">
          <img :class="heroImageClass" src="/assets/goToJail-sprite.webp" alt="goToJail" />
        </div>
        <div class="player-container">
          <PlayerBase v-for="player in props.players" :key="player.id" :player="player" :tile-id="props.id" />
        </div>
      </div>
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

    .heroSprite {
      padding: 0;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;

      .heroImage {
        width: 100%;
        height: 100%;
        object-fit: contain;
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
</style>