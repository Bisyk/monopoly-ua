<script lang="ts" setup>
import { computed, type PropType } from "vue";
import type { BoardState, Player, Trade } from "~/types";
import {
  getBotAvatarUrl,
  getBotPersonaByUsername,
} from "~/shared/constants/botNames";
import {
  getCartridgePlayerColor,
  getCartridgePlayerTileTint,
  getPlayerInitials,
  getTileSpriteUrl,
} from "~/utils/cartridgeTheme";

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

interface TradePlayerIdentity {
  username: string;
  color: string;
  tint: string;
  avatarUrl: string | null;
  initials: string;
  isSelf: boolean;
}

const findPlayerByUsername = (username?: string | null): Player | null => {
  if (!username) return null;
  const fromList = props.players.find((p) => p.username === username);
  if (fromList) return fromList;
  if (props.player?.username === username) return props.player;
  return null;
};

const buildPlayerIdentity = (
  playerObj: Player | null,
  fallbackUsername: string,
  isSelf: boolean
): TradePlayerIdentity => {
  const username =
    playerObj?.username || fallbackUsername || (isSelf ? "You" : "Player");
  const persona = getBotPersonaByUsername(username);
  const rawColor = playerObj?.color || persona?.bgColor;

  return {
    username,
    color: getCartridgePlayerColor(rawColor),
    tint: getCartridgePlayerTileTint(rawColor),
    avatarUrl: getBotAvatarUrl(username),
    initials: getPlayerInitials(username),
    isSelf,
  };
};

const selfIdentity = computed<TradePlayerIdentity>(() => {
  const fallbackName = props.player?.username || props.activeTrade?.to || "You";
  const playerObj = props.player ?? findPlayerByUsername(props.activeTrade?.to);
  return buildPlayerIdentity(playerObj, fallbackName, true);
});

const counterpartyIdentity = computed<TradePlayerIdentity>(() => {
  const targetUsername = props.send
    ? props.tradePlayerUsername
    : props.activeTrade?.from || props.tradePlayerUsername;
  const playerObj = findPlayerByUsername(targetUsername);
  return buildPlayerIdentity(playerObj, targetUsername, false);
});

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
        <div
          class="trade-pane"
          :style="{ backgroundColor: selfIdentity.tint }"
        >
          <div
            class="trade-pane__stripe"
            :style="{ backgroundColor: selfIdentity.color }"
          />
          <div class="trade-pane__body">
            <div class="trade-pane__head">
              <div class="trade-pane__player">
                <div
                  class="trade-pane__avatar"
                  :class="{ 'is-avatar': Boolean(selfIdentity.avatarUrl) }"
                  :style="{ backgroundColor: selfIdentity.color }"
                >
                  <img
                    v-if="selfIdentity.avatarUrl"
                    :src="selfIdentity.avatarUrl"
                    :alt="selfIdentity.username"
                  />
                  <template v-else>{{ selfIdentity.initials }}</template>
                </div>
                <div class="trade-pane__identity">
                  <span
                    class="trade-pane__role"
                    :style="{ backgroundColor: selfIdentity.color }"
                  >
                    YOU GIVE
                  </span>
                  <span class="trade-pane__name" :title="selfIdentity.username">
                    {{ selfIdentity.username }}
                  </span>
                </div>
              </div>
              <span class="trade-pane__total">${{ givenPropertiesPrice }}</span>
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
        </div>

        <div
          class="trade-pane"
          :style="{ backgroundColor: counterpartyIdentity.tint }"
        >
          <div
            class="trade-pane__stripe"
            :style="{ backgroundColor: counterpartyIdentity.color }"
          />
          <div class="trade-pane__body">
            <div class="trade-pane__head">
              <div class="trade-pane__player">
                <div
                  class="trade-pane__avatar"
                  :class="{
                    'is-avatar': Boolean(counterpartyIdentity.avatarUrl),
                  }"
                  :style="{ backgroundColor: counterpartyIdentity.color }"
                >
                  <img
                    v-if="counterpartyIdentity.avatarUrl"
                    :src="counterpartyIdentity.avatarUrl"
                    :alt="counterpartyIdentity.username"
                  />
                  <template v-else>{{ counterpartyIdentity.initials }}</template>
                </div>
                <div class="trade-pane__identity">
                  <span
                    class="trade-pane__role"
                    :style="{ backgroundColor: counterpartyIdentity.color }"
                  >
                    YOU RECEIVE
                  </span>
                  <span
                    class="trade-pane__name"
                    :title="counterpartyIdentity.username"
                  >
                    {{ counterpartyIdentity.username }}
                  </span>
                </div>
              </div>
              <span class="trade-pane__total">
                ${{ receivedPropertiesPrice }}
              </span>
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
        <div
          class="trade-pane"
          :style="{ backgroundColor: counterpartyIdentity.tint }"
        >
          <div
            class="trade-pane__stripe"
            :style="{ backgroundColor: counterpartyIdentity.color }"
          />
          <div class="trade-pane__body">
            <div class="trade-pane__head">
              <div class="trade-pane__player">
                <div
                  class="trade-pane__avatar"
                  :class="{
                    'is-avatar': Boolean(counterpartyIdentity.avatarUrl),
                  }"
                  :style="{ backgroundColor: counterpartyIdentity.color }"
                >
                  <img
                    v-if="counterpartyIdentity.avatarUrl"
                    :src="counterpartyIdentity.avatarUrl"
                    :alt="counterpartyIdentity.username"
                  />
                  <template v-else>{{ counterpartyIdentity.initials }}</template>
                </div>
                <div class="trade-pane__identity">
                  <span
                    class="trade-pane__role"
                    :style="{ backgroundColor: counterpartyIdentity.color }"
                  >
                    YOU RECEIVE
                  </span>
                  <span
                    class="trade-pane__name"
                    :title="counterpartyIdentity.username"
                  >
                    {{ counterpartyIdentity.username }}
                  </span>
                </div>
              </div>
              <span class="trade-pane__total">${{ givenPropertiesPrice }}</span>
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
        </div>

        <div
          class="trade-pane"
          :style="{ backgroundColor: selfIdentity.tint }"
        >
          <div
            class="trade-pane__stripe"
            :style="{ backgroundColor: selfIdentity.color }"
          />
          <div class="trade-pane__body">
            <div class="trade-pane__head">
              <div class="trade-pane__player">
                <div
                  class="trade-pane__avatar"
                  :class="{ 'is-avatar': Boolean(selfIdentity.avatarUrl) }"
                  :style="{ backgroundColor: selfIdentity.color }"
                >
                  <img
                    v-if="selfIdentity.avatarUrl"
                    :src="selfIdentity.avatarUrl"
                    :alt="selfIdentity.username"
                  />
                  <template v-else>{{ selfIdentity.initials }}</template>
                </div>
                <div class="trade-pane__identity">
                  <span
                    class="trade-pane__role"
                    :style="{ backgroundColor: selfIdentity.color }"
                  >
                    YOU GIVE
                  </span>
                  <span class="trade-pane__name" :title="selfIdentity.username">
                    {{ selfIdentity.username }}
                  </span>
                </div>
              </div>
              <span class="trade-pane__total">
                ${{ receivedPropertiesPrice }}
              </span>
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
  box-shadow: 0 3px 0 var(--outline);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.trade-pane__stripe {
  height: 6px;
  border-bottom: 1.5px solid var(--outline);
  flex-shrink: 0;
}

.trade-pane__body {
  padding: 11px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trade-pane__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.trade-pane__player {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.trade-pane__avatar {
  width: 36px;
  height: 36px;
  border-radius: 5px;
  border: 2px solid var(--outline);
  box-shadow:
    2px 2px 0 var(--outline),
    inset 0 2px 0 rgba(255, 255, 255, 0.35);
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
  overflow: hidden;

  &.is-avatar {
    box-shadow: 2px 2px 0 var(--outline);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.trade-pane__identity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}

.trade-pane__role {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #ffffff;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
  padding: 2px 5px;
  border: 1.5px solid var(--outline);
  border-radius: 3px;
  line-height: 1;
}

.trade-pane__name {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 800;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.15;
}

.trade-pane__total {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
  color: var(--ink);
  background: var(--surface);
  border: 1.5px solid var(--outline);
  border-radius: var(--radius-sm);
  padding: 3px 7px;
  box-shadow: 1.5px 1.5px 0 var(--outline);
  white-space: nowrap;
  flex-shrink: 0;
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