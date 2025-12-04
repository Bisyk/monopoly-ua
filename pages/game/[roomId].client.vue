<script setup lang="ts">
import { onMounted, ref, watch, computed, useTemplateRef, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import { getTilePosition } from "../../utils/board";
import { onClickOutside } from "@vueuse/core";
import { useGameActions } from "../../composables/useGameActions";
import type { Player, Tile } from "~/types";

const route = useRoute();
const router = useRouter();
const players = ref<Player[]>([]);
const username = sessionStorage.getItem("username");
const tileInfo = ref(null);
const tileInfoStyle = ref({ top: 0, left: 0 });

// @ts-ignore
const protocol = location.protocol === "https:" ? "wss" : "ws";
const { status, send, open, close, handleMessage } = useWebsocketManager(
  `${protocol}://${location.host}/api/websocket?roomId=${route.params.roomId}`
);
const {
  isSending,
  gameState,
  tilesState,
  groupsState,
  boardState,
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
  handleDeclineTrade
} = useGameActions(send, username!);

const getYourTradableProperties = () => {
  const ownedAndNotMortgaged = tilesState.value.filter(
    (t: Tile) =>
      t.owner === username &&
      ["car", "property", "bonus-property"].includes(t.type) &&
      !t.mortgaged
  );
  const tradeable = ownedAndNotMortgaged.filter((t: Tile) => {
    const isFullSet = fullSetsGroups.value.includes(t.groupId);
    const isAnyTileInFullSetUpgraded = tilesState.value.some(
      (tile: Tile) => tile.groupId === t.groupId && tile.rentLevel! > 0
    );

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false;
    }

    return true;
  });

  return tradeable.map((t: Tile) => t.id);
};

const getPlayerTradableProperties = () => {
  const ownedAndNotMortgaged = tilesState.value.filter(
    (t: Tile) =>
      t.owner === tradePlayerUsername.value &&
      ["car", "property", "bonus-property"].includes(t.type) &&
      !t.mortgaged
  );
  console.log(ownedAndNotMortgaged);
  const tradeable = ownedAndNotMortgaged.filter((t: Tile) => {
    const isFullSet = fullSetsGroups.value.includes(t.groupId);
    const isAnyTileInFullSetUpgraded = tilesState.value.some(
      (tile: Tile) => tile.groupId === t.groupId && tile.rentLevel! > 0
    );

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false;
    }

    return true;
  });

  return tradeable.map((t: Tile) => t.id);
};

handleMessage((message: string) => {
  isSending.value = false;
  gameState.value = JSON.parse(message);
});

const showTileInfo = async (event: any, tile: Tile) => {
  const tileRect = event.target.getBoundingClientRect();
  const containerRect = document
    .querySelector(".gameContainer")!
    .getBoundingClientRect();
  selectedTile.value = tile;
  const position = getTilePosition(tile.id);
  await nextTick();

  let top = tileRect.top - containerRect.top;
  let left = tileRect.left - containerRect.left;

  if (position === "top") {
    top += tileRect.height;
  }

  if (position === "right") {
    left -= tileRect.width;
    top -= tileRect.height * 1.8;
  }

  if (position === "bottom") {
    top -= tileRect.height * 2.3;
  }

  if (position === "left") {
    left += tileRect.width;
    top -= tileRect.height * 1.8;
  }

  tileInfoStyle.value.top = top;
  tileInfoStyle.value.left = left;
};

const activateTrade = (username: string) => {
  if (gameState.value.currentTurn !== player.value.username) return;
  tradePlayerUsername.value = username;
};

const setTradePlayerUsername = (username: string) => {
  tradePlayerUsername.value = username;
};

onClickOutside(tileInfo, (event) => {
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
  <div
    style="
      position: fixed;
      top: 0;
      right: 0;
      z-index: 9999;
      height: 100vh;
      width: fit-content;
      overflow-y: scroll;
      max-width: 40vmin;
    "
  >
    <pre>
      {{ tradePlayerUsername }}
      {{ tradeTiles }}
      {{ fullSetsGroups }}
      {{ gameState }}
    </pre>
  </div>

  <div class="gameContainer" v-if="gameState">
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
      :tilesState="tilesState"
      :boardState="boardState"
      :groupsState="groupsState"
      :fullSetsGroups="fullSetsGroups"
      :tileInfoStyle="tileInfoStyle"
      :isSending="isSending"
    />

    <ModalRoll
      v-if="
        gameState.currentTurn === username &&
        gameState.currentAction === 'roll' &&
        !player.jailed
      "
      @handleUserTurn="handleUserTurn"
      :isSending="isSending"
    />

    <ModalJail
      v-if="gameState.currentTurn === username && player.jailed"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handleUserTurn="handleUserTurn"
      @handleJailPay="handleJailPay"
    />

    <ModalBuy
      v-if="
        gameState.currentTurn === username && gameState.currentAction === 'buy'
      "
      :tileName="currentTilePlayerOn.name"
      :tilePrice="currentTilePlayerOn.price"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handleBuyProperty="handleBuyProperty(currentTilePlayerOn.id)"
      @handlePassProperty="handlePassProperty(currentTilePlayerOn.id)"
    />

    <ModalAuction
      v-if="
        gameState.currentAction === 'auction' &&
        gameState.currentAuctionParticipant === username
      "
      :tileOnAuctionName="tilesState.filter((t: Tile) => t.id === gameState.tileOnAuction)[0].name"
      :tileOnAuctionPrice="gameState.currentAuctionBid + 10"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handleBidAuctionProperty="
        handleBidAuctionProperty(gameState.tileOnAuction)
      "
      @handlePassAuctionProperty="
        handlePassAuctionProperty(gameState.tileOnAuction)
      "
    />

    <ModalPayRent
      v-if="
        gameState.currentTurn === username &&
        gameState.currentAction === 'payRent'
      "
      :tilePlayerOn="currentTilePlayerOn"
      :turnResult="turnResult"
      :playerBalance="player.balance"
      :isSending="isSending"
      @handlePayRent="handlePayRent(currentTilePlayerOn.id)"
    />

    <ModalPayChance
      v-if="
        gameState.currentTurn === username &&
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
      v-if="
        gameState.currentTurn === username &&
        gameState.currentAction === 'payTax'
      "
      :taxAmount="currentTilePlayerOn.taxAmount"
      :playerBalance="player.balance"
      @handlePayTax="handlePayTax"
    />

    <!--SEND TRADE MODAL -->
    <TradeModal
      v-if="tradePlayerUsername"
      :tradePlayerUsername="tradePlayerUsername"
      :tradeTiles="tradeTiles"
      :player="player"
      :players="gameState.players"
      :boardState="boardState"
      :yourTradableProperties="getYourTradableProperties()"
      :playerTradableProperties="getPlayerTradableProperties()"
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
      :boardState="boardState"
      @acceptTrade="handleAcceptTrade"
      @declineTrade="handleDeclineTrade"
      receive
    />

    <!-- GAME BOARD -->
    <GameBoard
      :tilesState="tilesState"
      :gameState="gameState"
      :showTileInfo="showTileInfo"
      :players="players"
      :player="player"
      @activateTrade="(username: string) => activateTrade(username)"
    />
  </div>

  <div v-else>Loading...</div>
</template>

<style scoped lang="scss">
.gameContainer {
  position: relative;
  max-width: 100%;
  max-height: fit-content;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 4fr;

  .playersContainer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .player {
    border: 1px solid black;
  }
}
</style>
