<script setup lang="ts">
import { onMounted, ref, watch, computed, useTemplateRef, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import { getTilePosition } from "../../utils/board";
import { onClickOutside } from "@vueuse/core";
import { useGameActions } from "../../composables/useGameActions";
import type { Player, Tile } from "~/types";
import { useWebsocketManager } from "~/composables/useWebsocketManager";
import { getPlayerTradableProperties } from "~/utils/getPlayerTradableProperties";

const route = useRoute();
const router = useRouter();
const players = ref<Player[]>([]);
const username = sessionStorage.getItem("username") || "";
const tileInfo = ref(null);
const tileInfoStyle = ref({ top: 0, left: 0 });
const isMoveAnimating = ref(false);

const handleAnimationStateChange = (animating: boolean) => {
  isMoveAnimating.value = animating;
};

// @ts-ignore
const protocol = location.protocol === "https:" ? "wss" : "ws";
const { status, send, open, close, handleMessage } = useWebsocketManager(
  `${protocol}://${location.host}/api/websocket?roomId=${route.params.roomId}`
);
const {
  isSending,
  gameState,
  tiles,
  propertyGroups,
  board,
  player,
  tradeTiles,
  tradePlayerUsername,
  fullSetsGroups,
  selectedTile,
  turnResult,
  currentTilePlayerOn,
  handleMortgageProperty,
  handleBuyBackProperty,
  handleSellProperty,
  handleUpgradeProperty,
  handleUserTurn,
  handleJailPay,
  handleBuyProperty,
  handlePassProperty,
  handleBidAuctionProperty,
  handlePassAuctionProperty,
  handlePayRent,
  handlePayChance,
  handlePayTax,
  handleSendTrade,
  handleAcceptTrade,
  handleDeclineTrade,
} = useGameActions(send, username!);

handleMessage((message: string) => {
  isSending.value = false;
  gameState.value = JSON.parse(message);
});

const showTileInfo = async (event: Event, tile: Tile) => {
  const targetEl =
    (event.currentTarget as HTMLElement | null) ||
    ((event.target as HTMLElement | null)?.closest(
      "[data-tile-id]"
    ) as HTMLElement | null) ||
    (event.target as HTMLElement | null);

  if (!targetEl) return;

  const tileRect = targetEl.getBoundingClientRect();
  selectedTile.value = tile;
  const position = getTilePosition(tile.id);

  await nextTick();

  const cardEl = (tileInfo.value as { $el?: HTMLElement } | null)?.$el;
  const cardRect = cardEl?.getBoundingClientRect();
  const cardWidth = cardRect?.width || 296;
  const cardHeight = cardRect?.height || 420;
  const gap = 12;
  const pad = 12;

  let top = tileRect.top + tileRect.height / 2 - cardHeight / 2;
  let left = tileRect.left + tileRect.width / 2 - cardWidth / 2;

  if (position === "top") {
    top = tileRect.bottom + gap;
  } else if (position === "bottom") {
    top = tileRect.top - cardHeight - gap;
  } else if (position === "left") {
    left = tileRect.right + gap;
  } else if (position === "right") {
    left = tileRect.left - cardWidth - gap;
  }

  left = Math.max(pad, Math.min(left, window.innerWidth - cardWidth - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - cardHeight - pad));

  tileInfoStyle.value = { top, left };
};

const activateTrade = (username: string) => {
  if (gameState.value.currentTurn !== player.value.username) return;
  tradePlayerUsername.value = username;
};

const setTradePlayerUsername = (username: string) => {
  tradePlayerUsername.value = username;
};

const isActiveTurnReady = computed(
  () => !isMoveAnimating.value && gameState.value?.currentTurn === username
);
const isGameEnded = computed(() => gameState.value?.status === "ENDED");
const gameWinnerText = computed(() => {
  if (!isGameEnded.value) {
    return "";
  }

  return gameState.value?.winnerUsername
    ? `Winner: ${gameState.value.winnerUsername}`
    : "Game ended";
});
const auctionedTile = computed(() =>
  tiles.value.find((t: Tile) => t.id === gameState.value?.auctionedTileId)
);

onClickOutside(tileInfo, () => {
  selectedTile.value = null;
});

onMounted(async () => {
  const username = sessionStorage.getItem("username");
  // @ts-ignore
  const { body } = await $fetch(`/games/${route.params.roomId}`);
  const { game } = JSON.parse(body);

  gameState.value = game;
  players.value = game.players;

  if (!game.players.some((p: Player) => p.username === username)) {
    router.push({ path: "/" });
  }
});

// @ts-ignore
definePageMeta({
  title: "Monopoly UA | Game",
  layout: "empty",
  head: {
    meta: [
      {
        name: "viewport",
        content:
          "width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,shrink-to-fit=no",
      },
    ],
  },
});
</script>

<template>
  <div class="gameContainer" v-if="gameState">
    <div v-if="isGameEnded" class="gameEndedBanner">
      <GameIcon name="trophy" :size="22" />
      <span>{{ gameWinnerText }}</span>
      <BaseButton size="sm" variant="secondary" @click="router.push('/')">
        LOBBY
      </BaseButton>
    </div>

    <TileInfoCard
      v-if="selectedTile"
      ref="tileInfo"
      @mortgageProperty="handleMortgageProperty"
      @buyBackProperty="handleBuyBackProperty"
      @sellProperty="handleSellProperty"
      @upgradeProperty="handleUpgradeProperty"
      :selectedTile="selectedTile"
      :currentTurn="gameState.currentTurn"
      :username="username"
      :player="player"
      :tiles="tiles"
      :board="board"
      :propertyGroups="propertyGroups"
      :fullSetsGroups="fullSetsGroups"
      :tileInfoStyle="tileInfoStyle"
      :isSending="isSending"
    />

    <ModalRoll
      v-if="
        isActiveTurnReady &&
        gameState.currentAction === 'roll' &&
        !player.jailed
      "
      @handleUserTurn="handleUserTurn"
      :isSending="isSending"
    />

    <ModalJail
      v-if="isActiveTurnReady && player.jailed"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handleUserTurn="handleUserTurn"
      @handleJailPay="handleJailPay"
    />

    <ModalBuy
      v-if="isActiveTurnReady && gameState.currentAction === 'buy'"
      :tileId="currentTilePlayerOn.id"
      :tileName="currentTilePlayerOn.name"
      :tilePrice="currentTilePlayerOn.price"
      :assetId="currentTilePlayerOn.assetId"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handleBuyProperty="handleBuyProperty(currentTilePlayerOn.id)"
      @handlePassProperty="handlePassProperty(currentTilePlayerOn.id)"
    />

    <ModalAuction
      v-if="
        gameState.currentAction === 'auction' &&
        gameState.activeAuctionBidder === username &&
        auctionedTile
      "
      :tileOnAuctionName="auctionedTile.name"
      :tileOnAuctionPrice="gameState.auctionBidAmount + 10"
      :assetId="auctionedTile.assetId"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handleBidAuctionProperty="
        handleBidAuctionProperty(gameState.auctionedTileId)
      "
      @handlePassAuctionProperty="
        handlePassAuctionProperty(gameState.auctionedTileId)
      "
    />

    <ModalPayRent
      v-if="isActiveTurnReady && gameState.currentAction === 'payRent'"
      :tilePlayerOn="currentTilePlayerOn"
      :turnResult="turnResult"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handlePayRent="handlePayRent(currentTilePlayerOn.id)"
    />

    <ModalPayChance
      v-if="
        isActiveTurnReady &&
        gameState.currentAction === 'chance' &&
        gameState.activeChance.type === 'minusBalance'
      "
      :chanceText="gameState.activeChance.text"
      :playerBalance="player.balance"
      :chanceAmount="gameState.activeChance.amount"
      :isSending="isSending"
      @handlePayChance="handlePayChance"
    />

    <ModalPayTax
      v-if="isActiveTurnReady && gameState.currentAction === 'payTax'"
      :taxAmount="currentTilePlayerOn.taxAmount"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handlePayTax="handlePayTax"
    />

    <!-- SEND TRADE MODAL -->
    <TradeModal
      v-if="tradePlayerUsername"
      :tradePlayerUsername="tradePlayerUsername"
      :tradeTiles="tradeTiles"
      :player="player"
      :players="gameState.players"
      :board="board"
      :yourTradableProperties="
        getPlayerTradableProperties(tiles, fullSetsGroups, username)
      "
      :playerTradableProperties="
        getPlayerTradableProperties(
          tiles,
          fullSetsGroups,
          tradePlayerUsername
        )
      "
      @setTradePlayerUsername="(username: string) => setTradePlayerUsername(username)"
      @sendTrade="handleSendTrade"
      send
    />

    <!-- RECEIVE TRADE MODAL -->
    <TradeModal
      v-if="
        gameState.currentAction === 'trade' &&
        gameState.activeTrade.to === username
      "
      :tradePlayerUsername="tradePlayerUsername"
      :activeTrade="gameState.activeTrade"
      :board="board"
      @acceptTrade="handleAcceptTrade"
      @declineTrade="handleDeclineTrade"
      receive
    />

    <!-- GAME BOARD -->
    <GameBoard
      :tiles="tiles"
      :gameState="gameState"
      :showTileInfo="showTileInfo"
      :players="players"
      :player="player"
      :selectedTileId="selectedTile?.id ?? null"
      @activateTrade="(username: string) => activateTrade(username)"
      @animationStateChange="handleAnimationStateChange"
    />
  </div>

  <div v-else class="loading-screen">
    <div class="loading-card">
      <div class="loading-card__bar">
        <GameIcon name="dice" :size="20" />
        <span>MONOPOLY UA</span>
      </div>
      <div class="loading-card__body">
        <div class="loading-card__title">LOADING MATCH...</div>
        <p class="loading-card__sub">Syncing board state and room players.</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gameContainer {
  position: relative;
  width: 100%;
  min-height: 100vh;
}

.gameEndedBanner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: var(--gold-light);
  color: var(--ink);
  padding: 10px 16px;
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-md);
  box-shadow: 0 5px 0 var(--outline);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.loading-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.loading-card {
  width: 100%;
  max-width: 340px;
  background: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: var(--modal-shadow);
  overflow: hidden;
}

.loading-card__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  background: var(--accent);
  color: #ffffff;
  border-bottom: 2.5px solid var(--outline);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.loading-card__body {
  padding: 20px 18px;
  text-align: center;
}

.loading-card__title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 6px;
}

.loading-card__sub {
  font-size: 13px;
  color: var(--ink-muted);
}
</style>
