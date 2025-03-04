<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps({
  tradePlayerUsername: {
    type: String,
    required: true
  },
  tradeTiles: {
    type: Object,
    required: true
  },
  player: {
    type: Object,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
  boardState: {
    type: Array,
    required: true
  },
  send: {
    type: Boolean,
    required: false
  },
  receive: {
    type: Boolean,
    required: false
  },
  activeTrade: {
    type: Object,
    required: false
  }
})

defineEmits(['setTradePlayerUsername', 'sendTrade', 'acceptTrade', 'declineTrade'])

const toggleGivenProperty = (property: number) => {
  props.tradeTiles.given.has(property) ? props.tradeTiles.given.delete(property) : props.tradeTiles.given.add(property)
}

const toggleReceivedProperty = (property: number) => {
  props.tradeTiles.received.has(property) ? props.tradeTiles.received.delete(property) : props.tradeTiles.received.add(property)
}

const givenPropertiesPrice = computed(() => {
  if (props.send) {
    return Array.from(props.tradeTiles.given).reduce((acc, property) => acc + props.boardState.tiles.find(t => t.id === property).price, 0) + props.tradeTiles.givenMoney
  } else {
    return Array.from(props.activeTrade.given).reduce((acc, property) => acc + props.boardState.tiles.find(t => t.id === property).price, 0) + props.activeTrade.givenMoney
  }
})

const receivedPropertiesPrice = computed(() => {
  if (props.send) {
    return Array.from(props.tradeTiles.received).reduce((acc, property) => acc + props.boardState.tiles.find(t => t.id === property).price, 0) + props.tradeTiles.receivedMoney
  } else {
    return Array.from(props.activeTrade.received).reduce((acc, property) => acc + props.boardState.tiles.find(t => t.id === property).price, 0) + props.activeTrade.receivedMoney
  }
})

const isTradeValid = computed(() => {
  return givenPropertiesPrice.value >= receivedPropertiesPrice.value / 2 && givenPropertiesPrice.value <= receivedPropertiesPrice.value * 2
})

</script>

<template>
  <GameModal>
    <h1>Trade</h1>
    <div v-if="send && tradePlayerUsername">
      <h3>You want to trade with {{ tradePlayerUsername }}?</h3>
      <div class="tradeContainers">
        <div class="tradeContainer">
          <p>Money:</p>
          <p>
            <input type="number" v-model="tradeTiles.givenMoney" placeholder="0" />
          </p>
          <p>Your Properties:</p>
          <div v-for="property in player.properties.sort((a, b) => a - b)">
            <div @click="() => toggleGivenProperty(property)" class="tradeProperty"
              :style="{ backgroundColor: tradeTiles.given.has(property) ? players.find(p => p.username === tradePlayerUsername).color : 'white' }">
              <img :src="`/assets/sprites/ua/${boardState.tiles.find(t => t.id === property).spriteName}.webp`" alt="">
            </div>
          </div>
        </div>
        <div class="tradeContainer">
          <p>Money:</p>
          <p>
            <input type="number" v-model="tradeTiles.receivedMoney" placeholder="0" />
          </p>
          <p>{{ tradePlayerUsername }} properties:</p>
          <div
            v-for="property in players.find(p => p.username === tradePlayerUsername).properties.sort((a, b) => a - b)">
            <div @click="() => toggleReceivedProperty(property)" class="tradeProperty"
              :style="{ backgroundColor: tradeTiles.received.has(property) ? player.color : 'white' }">
              <img :src="`/assets/sprites/ua/${boardState.tiles.find(t => t.id === property).spriteName}.webp`" alt="">
            </div>
          </div>
        </div>
      </div>
      <div class="tradeFooter">
        <p v-if="!isTradeValid">Your trade offer must be within 50% of the value of the received properties.</p>
        <div style="display: flex;">
          <p style="width: 50%;">Total: {{ givenPropertiesPrice }}</p>
          <p style="width: 50%;">Total: {{ receivedPropertiesPrice }}</p>
        </div>
        <div>
          <BaseButton @click="$emit('setTradePlayerUsername', '')" bgColor="red">CANCEL</BaseButton>
          <BaseButton @click="$emit('sendTrade')" bgColor="green" :disabled="!isTradeValid">SEND
          </BaseButton>
        </div>
      </div>
    </div>

    <div v-if="receive && activeTrade">
      <h3>{{ activeTrade.from }} wants to trade!</h3>
      <div class="tradeContainers">
        <div class="tradeContainer">
          <p>You receive:</p>
          <p>Money: {{ activeTrade.givenMoney }}</p>
          <div v-for="property in activeTrade.given.sort((a, b) => a - b)">
            <div class="tradeProperty">
              <img :src="`/assets/sprites/ua/${boardState.tiles.find(t => t.id === property).spriteName}.webp`" alt="">
            </div>
          </div>
        </div>
        <div class="tradeContainer">
          <p>You give:</p>
          <p>Money: {{ activeTrade.receivedMoney }}</p>
          <div v-for="property in activeTrade.received.sort((a, b) => a - b)">
            <div class="tradeProperty">
              <img :src="`/assets/sprites/ua/${boardState.tiles.find(t => t.id === property).spriteName}.webp`" alt="">
            </div>
          </div>
        </div>
      </div>
      <div class="tradeFooter">
        <p v-if="!isTradeValid">Your trade offer must be within 50% of the value of the received properties.</p>
        <div style="display: flex;">
          <p style="width: 50%;">Total: {{ givenPropertiesPrice }}</p>
          <p style="width: 50%;">Total: {{ receivedPropertiesPrice }}</p>
        </div>
        <div>
          <BaseButton @click="$emit('acceptTrade')" bgColor="green">ACCEPT</BaseButton>
          <BaseButton @click="$emit('declineTrade')" bgColor="red">DECLINE
          </BaseButton>
        </div>
      </div>
    </div>
  </GameModal>
</template>

<style lang="scss">
.tradeContainers {
  display: flex;
  position: relative;
  margin-bottom: 12vmin;

  .tradeContainer {
    width: 50%;
    display: flex;
    flex-direction: column;
    gap: 1vmin;


    .tradeProperty {
      width: 70%;
      height: 6vmin;
      box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.5);
      border-radius: 1rem;
      display: flex;
      justify-content: center;
      align-items: center;

      img {
        max-width: 100%;
        max-height: 100%;
        display: block;
        width: auto;
        height: auto;
      }
    }
  }
}

.tradeFooter {
  display: flex;
  flex-direction: column;
  position: fixed;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  width: 100%;
  background-color: rgb(228, 228, 228);
  padding: 1vmin 2vmin;
  border-radius: 1rem 1rem 0 0;
}
</style>