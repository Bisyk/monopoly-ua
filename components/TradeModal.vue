<script lang="ts" setup>
import { computed, type PropType } from "vue";
import type { BoardState, Player, Trade } from "~/types";
import { getTileSpriteUrl } from "~/utils/cartridgeTheme";

const props = defineProps({
  tradePlayerUsername: {
    type: String,
    required: false,
    default: "",
  },
  tradeTiles: {
    type: Object,
    required: false,
    default: () => ({
      given: new Set<number>(),
      received: new Set<number>(),
      givenMoney: 0,
      receivedMoney: 0,
    }),
  },
  player: {
    type: Object as PropType<Player>,
    required: false,
  },
  players: {
    type: Array as PropType<Player[]>,
    required: false,
    default: () => [],
  },
  board: {
    type: Object as PropType<BoardState>,
    required: true,
  },
  send: {
    type: Boolean,
    required: false,
  },
  receive: {
    type: Boolean,
    required: false,
  },
  activeTrade: {
    type: Object as PropType<Trade | null>,
    required: false,
    default: null,
  },
  yourTradableProperties: {
    type: Array as PropType<number[]>,
    required: false,
    default: () => [],
  },
  playerTradableProperties: {
    type: Array as PropType<number[]>,
    required: false,
    default: () => [],
  },
});

defineEmits([
  "setTradePlayerUsername",
  "sendTrade",
  "acceptTrade",
  "declineTrade",
]);

const findTile = (propertyId: number) =>
  props.board.tiles.find((t) => t.id === propertyId);

const toggleGivenProperty = (property: number) => {
  if (props.tradeTiles.given.has(property)) {
    props.tradeTiles.given.delete(property);
  } else {
    props.tradeTiles.given.add(property);
  }
};

const toggleReceivedProperty = (property: number) => {
  if (props.tradeTiles.received.has(property)) {
    props.tradeTiles.received.delete(property);
  } else {
    props.tradeTiles.received.add(property);
  }
};

const sortedYourProperties = computed(() =>
  [...props.yourTradableProperties].sort((a, b) => a - b)
);

const sortedOpponentProperties = computed(() =>
  [...props.playerTradableProperties].sort((a, b) => a - b)
);

const sortedActiveGiven = computed(() =>
  [...(props.activeTrade?.given ?? [])].sort((a, b) => a - b)
);

const sortedActiveReceived = computed(() =>
  [...(props.activeTrade?.received ?? [])].sort((a, b) => a - b)
);

const givenPropertiesPrice = computed(() => {
  if (props.send) {
    const propsSum = Array.from(props.tradeTiles.given as Set<number>).reduce(
      (acc, id) => acc + (findTile(id)?.price ?? 0),
      0
    );
    return propsSum + Number(props.tradeTiles.givenMoney || 0);
  }
  const propsSum = (props.activeTrade?.given ?? []).reduce(
    (acc, id) => acc + (findTile(id)?.price ?? 0),
    0
  );
  return propsSum + Number(props.activeTrade?.givenMoney || 0);
});

const receivedPropertiesPrice = computed(() => {
  if (props.send) {
    const propsSum = Array.from(
      props.tradeTiles.received as Set<number>
    ).reduce((acc, id) => acc + (findTile(id)?.price ?? 0), 0);
    return propsSum + Number(props.tradeTiles.receivedMoney || 0);
  }
  const propsSum = (props.activeTrade?.received ?? []).reduce(
    (acc, id) => acc + (findTile(id)?.price ?? 0),
    0
  );
  return propsSum + Number(props.activeTrade?.receivedMoney || 0);
});

const isTradeValid = computed(() => {
  if (givenPropertiesPrice.value <= 0 && receivedPropertiesPrice.value <= 0) {
    return false;
  }
  return (
    givenPropertiesPrice.value >= receivedPropertiesPrice.value / 2 &&
    givenPropertiesPrice.value <= receivedPropertiesPrice.value * 2
  );
});

const valueRatio = computed(() => {
  if (!receivedPropertiesPrice.value) return 0;
  return Math.round(
    (givenPropertiesPrice.value / receivedPropertiesPrice.value) * 100
  );
});

const modalTitle = computed(() => {
  if (props.send && props.tradePlayerUsername) {
    return `Trade — ${props.tradePlayerUsername}`;
  }
  if (props.receive && props.activeTrade?.from) {
    return `Offer from ${props.activeTrade.from}`;
  }
  return "Trade";
});
</script>

<template>
  <GameModal :title="modalTitle" code="50%–200% RULE" icon="swap" wide>
    <!-- SEND TRADE VIEW -->
    <template v-if="send && tradePlayerUsername">
      <div class="trade-cols">
        <div class="trade-pane">
          <div class="trade-pane__head">
            <span>YOU GIVE</span>
            <span>TOTAL ${{ givenPropertiesPrice }}</span>
          </div>
          <input
            v-model.number="tradeTiles.givenMoney"
            type="number"
            min="0"
            step="10"
            placeholder="0"
            class="trade-input"
          />
          <div class="trade-chips">
            <button
              v-for="property in sortedYourProperties"
              :key="property"
              type="button"
              class="trade-chip"
              :class="{ 'is-selected': tradeTiles.given.has(property) }"
              @click="toggleGivenProperty(property)"
            >
              <img
                :src="getTileSpriteUrl(findTile(property)?.assetId)"
                :alt="findTile(property)?.name"
              />
              <span>{{ findTile(property)?.name }}</span>
              <span class="trade-chip__price">
                ${{ findTile(property)?.price }}
              </span>
            </button>
            <p v-if="!sortedYourProperties.length" class="trade-empty">
              No tradable deeds
            </p>
          </div>
        </div>

        <div class="trade-pane">
          <div class="trade-pane__head">
            <span>YOU RECEIVE ({{ tradePlayerUsername }})</span>
            <span>TOTAL ${{ receivedPropertiesPrice }}</span>
          </div>
          <input
            v-model.number="tradeTiles.receivedMoney"
            type="number"
            min="0"
            step="10"
            placeholder="0"
            class="trade-input"
          />
          <div class="trade-chips">
            <button
              v-for="property in sortedOpponentProperties"
              :key="property"
              type="button"
              class="trade-chip"
              :class="{ 'is-selected': tradeTiles.received.has(property) }"
              @click="toggleReceivedProperty(property)"
            >
              <img
                :src="getTileSpriteUrl(findTile(property)?.assetId)"
                :alt="findTile(property)?.name"
              />
              <span>{{ findTile(property)?.name }}</span>
              <span class="trade-chip__price">
                ${{ findTile(property)?.price }}
              </span>
            </button>
            <p v-if="!sortedOpponentProperties.length" class="trade-empty">
              No tradable deeds
            </p>
          </div>
        </div>
      </div>

      <div v-if="!isTradeValid" class="modal-warning">
        <GameIcon name="warn" :size="19" />
        <span>
          Trade offer must stay within 50%–200% of the requested value.
        </span>
      </div>

      <div class="trade-footer">
        <div class="trade-parity">
          <RetroBadge :variant="isTradeValid ? 'positive' : 'danger'">
            {{ isTradeValid ? "FAIR DEAL" : "UNBALANCED" }}
          </RetroBadge>
          <span class="trade-parity__ratio">RATIO: {{ valueRatio }}%</span>
        </div>

        <div class="trade-footer__btns">
          <BaseButton
            variant="secondary"
            @click="$emit('setTradePlayerUsername', '')"
          >
            CANCEL
          </BaseButton>
          <BaseButton
            variant="positive"
            :disabled="!isTradeValid"
            @click="$emit('sendTrade')"
          >
            <GameIcon name="swap" :size="18" />
            <span>SEND OFFER</span>
          </BaseButton>
        </div>
      </div>
    </template>

    <!-- RECEIVE TRADE VIEW -->
    <template v-else-if="receive && activeTrade">
      <div class="trade-cols">
        <div class="trade-pane">
          <div class="trade-pane__head">
            <span>YOU RECEIVE</span>
            <span>TOTAL ${{ givenPropertiesPrice }}</span>
          </div>
          <div class="trade-cash-readout">
            Cash: <strong>${{ activeTrade.givenMoney || 0 }}</strong>
          </div>
          <div class="trade-chips">
            <div
              v-for="property in sortedActiveGiven"
              :key="property"
              class="trade-chip is-readonly"
            >
              <img
                :src="getTileSpriteUrl(findTile(property)?.assetId)"
                :alt="findTile(property)?.name"
              />
              <span>{{ findTile(property)?.name }}</span>
              <span class="trade-chip__price">
                ${{ findTile(property)?.price }}
              </span>
            </div>
            <p v-if="!sortedActiveGiven.length" class="trade-empty">
              No deeds offered
            </p>
          </div>
        </div>

        <div class="trade-pane">
          <div class="trade-pane__head">
            <span>YOU GIVE</span>
            <span>TOTAL ${{ receivedPropertiesPrice }}</span>
          </div>
          <div class="trade-cash-readout">
            Cash: <strong>${{ activeTrade.receivedMoney || 0 }}</strong>
          </div>
          <div class="trade-chips">
            <div
              v-for="property in sortedActiveReceived"
              :key="property"
              class="trade-chip is-readonly"
            >
              <img
                :src="getTileSpriteUrl(findTile(property)?.assetId)"
                :alt="findTile(property)?.name"
              />
              <span>{{ findTile(property)?.name }}</span>
              <span class="trade-chip__price">
                ${{ findTile(property)?.price }}
              </span>
            </div>
            <p v-if="!sortedActiveReceived.length" class="trade-empty">
              No deeds requested
            </p>
          </div>
        </div>
      </div>

      <div class="trade-footer">
        <div class="trade-parity">
          <RetroBadge variant="gold">INCOMING OFFER</RetroBadge>
        </div>
        <div class="trade-footer__btns">
          <BaseButton variant="danger" @click="$emit('declineTrade')">
            DECLINE
          </BaseButton>
          <BaseButton variant="positive" @click="$emit('acceptTrade')">
            <GameIcon name="swap" :size="18" />
            <span>ACCEPT</span>
          </BaseButton>
        </div>
      </div>
    </template>
  </GameModal>
</template>

<style lang="scss" scoped>
.trade-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.trade-pane {
  background: var(--surface-alt);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trade-pane__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 800;
  color: var(--ink);
}

.trade-input {
  width: 100%;
  padding: 9px 11px;
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 800;

  &:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
}

.trade-cash-readout {
  padding: 8px 10px;
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ink);
}

.trade-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.trade-chip {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  box-shadow: 2px 2px 0 var(--outline);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.08s ease;

  img {
    width: 28px;
    height: 28px;
    object-fit: contain;
    background: #ffffff;
    padding: 2px;
    border-radius: 3px;
    border: 1px solid rgba(30, 27, 58, 0.2);
  }

  &:not(.is-readonly):active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }

  &.is-selected {
    background: var(--accent);
    color: #ffffff;
  }

  &.is-readonly {
    cursor: default;
  }
}

.trade-chip__price {
  font-family: var(--font-mono);
  font-size: 10.5px;
  opacity: 0.78;
}

.trade-empty {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-muted);
}

.trade-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 2px solid var(--outline);
}

.trade-parity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.trade-parity__ratio {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-muted);
}

.trade-footer__btns {
  display: flex;
  gap: 10px;
  padding-bottom: 2px;
}
</style>