<script setup lang="ts">
import { onMounted, ref, watch, computed, useTemplateRef, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getTilePosition } from '../../utils/board'
import { onClickOutside } from '@vueuse/core'
import { type Group, type Player, type Tile } from '../../types'
import { rollDice } from '../../utils/gameFunctions'

const route = useRoute()
const router = useRouter()
const players = ref<Player[]>([])
const gameState = ref<any>({} as any)
const username = sessionStorage.getItem('username')
const selectedTile = ref<any>(null)
const tileInfo = ref(null)
const tileInfoStyle = ref({ top: 0, left: 0 })
const isSending = ref(false)
const turnResult = ref({ left: 0, right: 0 })
const tradePlayerUsername = ref('')
const tradeTiles = ref({
  given: new Set(),
  received: new Set(),
  givenMoney: 0,
  receivedMoney: 0
})

// @ts-ignore
const { status, send, open, close, handleMessage } = useWebsocketManager(`ws://${location.host}/api/websocket?roomId=${route.params.roomId}`)

watch(gameState, (newState) => {
  if (Object.keys(newState).length > 0) {
    gameState.value = newState
  }
})

const boardState = computed(() => {
  return gameState.value?.boardState ?? []
})

const tilesState = computed(() => {
  return gameState.value.boardState?.tiles ?? []
})

const groupsState = computed(() => {
  return gameState.value.boardState?.groups ?? []
})

const player = computed(() => {
  if (!gameState.value.players) return {}
  return gameState.value.players.find((p: Player) => p.username === username)
})

const currentTilePlayerOn = computed(() => {
  return tilesState.value?.find((t: Tile) => t.id === player.value.position) ?? {}
})

const fullSetsGroups = computed(() => {
  return groupsState.value?.filter((g: Group) => g.isFullSet).map((g: Group) => g.groupId) ?? []
})

const getYourTradableProperties = () => {
  const ownedAndNotMortgaged = tilesState.value.filter((t: Tile) => t.owner === username && ['car', 'property', 'bonus-property'].includes(t.type) && !t.mortgaged)
  const tradeable = ownedAndNotMortgaged.filter((t: Tile) => {
    const isFullSet = fullSetsGroups.value.includes(t.groupId)
    const isAnyTileInFullSetUpgraded = tilesState.value.some((tile: Tile) => tile.groupId === t.groupId && tile.rentLevel > 0)

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false
    }

    return true
  })

  return tradeable.map((t: Tile) => t.id)
}

const getPlayerTradableProperties = () => {
  const ownedAndNotMortgaged = tilesState.value.filter((t: Tile) => t.owner === tradePlayerUsername.value && ['car', 'property', 'bonus-property'].includes(t.type) && !t.mortgaged)
  console.log(ownedAndNotMortgaged);
  const tradeable = ownedAndNotMortgaged.filter((t: Tile) => {
    const isFullSet = fullSetsGroups.value.includes(t.groupId)
    const isAnyTileInFullSetUpgraded = tilesState.value.some((tile: Tile) => tile.groupId === t.groupId && tile.rentLevel > 0)

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false
    }

    return true
  })

  return tradeable.map((t: Tile) => t.id)
}

handleMessage((message: string) => {
  isSending.value = false
  gameState.value = JSON.parse(message)
})

const handleUserTurn = () => {
  isSending.value = true
  turnResult.value = rollDice()
  send(JSON.stringify({ action: 'ROLL_DICE', payload: { username, turnResult: turnResult.value } }))
}



const handleBuyProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'BUY_PROPERTY', payload: { username, propertyId } }))
}

const handlePassProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'PASS_PROPERTY', payload: { username, propertyId } }))
}

const handleMortgageProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'MORTGAGE_PROPERTY', payload: { username, propertyId } }))
  selectedTile.value = null
}

const handleBuyBackProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'BUY_BACK_PROPERTY', payload: { username, propertyId } }))
  selectedTile.value = null
}

const handleUpgradeProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'UPGRADE_PROPERTY', payload: { username, propertyId } }))
  selectedTile.value = null
}

const handleSellProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'SELL_PROPERTY', payload: { username, propertyId } }))
  selectedTile.value = null
}

const handlePayRent = (propertyId: number) => {
  isSending.value = true
  if (currentTilePlayerOn.value.type === "bonus-property") {
    send(JSON.stringify({ action: 'PAY_RENT', payload: { username, propertyId, turnResult: turnResult.value } }))
  } else {
    send(JSON.stringify({ action: 'PAY_RENT', payload: { username, propertyId } }))
  }
}

const handlePassAuctionProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'PASS_AUCTION_PROPERTY', payload: { username, propertyId } }))
}

const handleBidAuctionProperty = (propertyId: number) => {
  isSending.value = true
  send(JSON.stringify({ action: 'BID_AUCTION_PROPERTY', payload: { username, propertyId } }))
}

const handleJailPay = () => {
  isSending.value = true
  send(JSON.stringify({ action: 'JAIL_PAY', payload: { username } }))
}

const sendTrade = () => {
  isSending.value = true
  send(JSON.stringify({
    action: 'TRADE', payload: {
      username, tradePlayerUsername: tradePlayerUsername.value, tradeTiles: {
        given: Array.from(tradeTiles.value.given),
        received: Array.from(tradeTiles.value.received),
        givenMoney: tradeTiles.value.givenMoney,
        receivedMoney: tradeTiles.value.receivedMoney
      }
    }
  }))
  tradePlayerUsername.value = ''
  tradeTiles.value = {
    given: new Set(),
    received: new Set(),
    givenMoney: 0,
    receivedMoney: 0
  }
}

const acceptTrade = () => {
  isSending.value = true
  send(JSON.stringify({ action: 'ACCEPT_TRADE', payload: { username } }))
}

const declineTrade = () => {
  isSending.value = true
  send(JSON.stringify({ action: 'DECLINE_TRADE', payload: { username } }))
}

const showTileInfo = async (event: any, tile: Tile) => {
  const tileRect = event.target.getBoundingClientRect();
  const containerRect = document.querySelector('.gameContainer')!.getBoundingClientRect();
  selectedTile.value = tile;
  const position = getTilePosition(tile.id)
  await nextTick();

  let top = tileRect.top - containerRect.top;
  let left = tileRect.left - containerRect.left;

  if (position === 'top') {
    top += tileRect.height
  }

  if (position === 'right') {
    left -= tileRect.width
    top -= tileRect.height * 1.8
  }

  if (position === 'bottom') {
    top -= tileRect.height * 2.3
  }

  if (position === 'left') {
    left += tileRect.width
    top -= tileRect.height * 1.8
  }

  tileInfoStyle.value.top = top;
  tileInfoStyle.value.left = left;;
}

const activateTrade = (username: string) => {
  if (gameState.value.currentTurn !== player.value.username) return
  tradePlayerUsername.value = username
}

const setTradePlayerUsername = (username: string) => {
  tradePlayerUsername.value = username
}

onClickOutside(tileInfo, event => {
  selectedTile.value = null
})

onMounted(async () => {
  const username = sessionStorage.getItem('username')
  // @ts-ignore
  const { body } = await $fetch(`/games/${route.params.roomId}`)
  const { game } = JSON.parse(body)

  gameState.value = game
  players.value = game.players

  if (!game.players.some((p: Player) => p.username === username)) {
    router.push({ path: '/' })
  }
})

// @ts-ignore
definePageMeta({
  title: 'Monopoly UA | Game',
  layout: 'empty',
  head: {
    meta: [
      {
        name: 'viewport',
        content: 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,shrink-to-fit=no',
      }
    ]
  }
})
</script>

<template>
  <div
    style="position: fixed; top: 0; right: 0; z-index: 9999; height: 100vh; width: fit-content; overflow-y: scroll; max-width: 40vmin;">
    <pre>
      {{ tradePlayerUsername }}
      {{ tradeTiles }}
      {{ fullSetsGroups }}
      {{ gameState }}
    </pre>
  </div>

  <div class="gameContainer" v-if="gameState">
    <TileInfoCard v-if="selectedTile" ref="tileInfo" @mortgageProperty="handleMortgageProperty"
      @buyBackProperty="handleBuyBackProperty" @sellProperty="handleSellProperty"
      @upgradeProperty="handleUpgradeProperty" :selectedTile="selectedTile" :currentTurn="gameState.currentTurn"
      :username="username" :player="player" :tilesState="tilesState" :boardState="boardState" :groupsState="groupsState"
      :fullSetsGroups="fullSetsGroups" :tileInfoStyle="tileInfoStyle" :isSending="isSending" />

    <ModalRoll v-if="
      gameState.currentTurn === username &&
      gameState.currentAction === 'roll' &&
      !player.jailed" @handleUserTurn="handleUserTurn" />

    <!-- Jail Modal -->
    <!-- <GameModal v-if="gameState.currentTurn === username && player.jailed">
      <h1>You are in JAIL!</h1>
      <p>You have the following options:</p>
      <ul>
        <li>Pay $50 to get out of jail immediately.</li>
        <li>Roll doubles on your next turn to get out of jail for free.</li>
        <li>
          Wait for three turns, after which you will be released automatically.
        </li>
      </ul>
      <div>
        <BaseButton @click="handleUserTurn" :disabled="isSending">ROLL DICE</BaseButton>
        <BaseButton @click="handleJailPay" :disabled="player.balance < 50 || isSending" bgColor="green">PAY</BaseButton>
      </div>
    </GameModal> -->
    <ModalJail v-if="gameState.currentTurn === username && player.jailed" :playerBalance="player.balance" :isSending="isSending" @handleUserTurn="handleUserTurn"
      @handleJailPay="handleJailPay" />

    <!-- BUY MODAL -->
    <GameModal v-if="
      gameState.currentTurn === username && gameState.currentAction === 'buy'
    ">
      <h1>Do you want to buy this property?</h1>

      <h3>Name: {{ currentTilePlayerOn.name }}</h3>
      <h3>Price: {{ currentTilePlayerOn.price }}</h3>
      <div style="display: flex; gap: 1rem">
        <BaseButton :disabled="player.balance < currentTilePlayerOn.price || isSending"
          @click="() => handleBuyProperty(currentTilePlayerOn.id)" bgColor="green">
          BUY
        </BaseButton>
        <BaseButton @click="handlePassProperty(currentTilePlayerOn.id)" bgColor="red" :disabled="isSending">PASS
        </BaseButton>
      </div>
    </GameModal>

    <!-- AUCTION MODAL -->
    <GameModal v-if="
      gameState.currentAction === 'auction' &&
      gameState.currentAuctionParticipant === username
    ">
      <h1>Auction</h1>
      <h3>
        Do you want buy
        <span style="text-decoration: underline">{{
          tilesState.filter((t: Tile) => t.id === gameState.tileOnAuction)[0].name
        }}</span>
        for
        <span style="text-decoration: underline">{{
          gameState.currentAuctionBid + 10
        }}</span>?
      </h3>
      <BaseButton @click="handleBidAuctionProperty(gameState.tileOnAuction)" bgColor="green" :disabled="player.balance < gameState.currentAuctionBid + 10 || isSending
        ">BID</BaseButton>
      <BaseButton @click="handlePassAuctionProperty(gameState.tileOnAuction)" bgColor="red" :disabled="isSending">PASS
      </BaseButton>
    </GameModal>

    <!-- PAY RENT MODAL -->
    <GameModal v-if="
      gameState.currentTurn === username &&
      gameState.currentAction === 'payRent'
    ">
      <h1>Pay Rent</h1>
      <h3>Owner: {{ currentTilePlayerOn.owner }}</h3>
      <h3 v-if="currentTilePlayerOn.type === 'bonus-property'">
        {{
          `${turnResult.left} + ${turnResult.right} x ${currentTilePlayerOn.rentLevels[currentTilePlayerOn.rentLevel]}
        = ${turnResult.left +
          turnResult.right *
          currentTilePlayerOn.rentLevels[currentTilePlayerOn.rentLevel]
          }`
        }}
      </h3>
      <h3 v-else>
        Rent:
        {{ currentTilePlayerOn.rentLevels[currentTilePlayerOn.rentLevel] }}
      </h3>
      <BaseButton @click="() => handlePayRent(currentTilePlayerOn.id)" bgColor="red" :disabled="player.balance <
        currentTilePlayerOn.rentLevels[currentTilePlayerOn.rentLevel] ||
        isSending
        ">PAY
      </BaseButton>
      <p v-if="
        player.balance <
        currentTilePlayerOn.rentLevels[currentTilePlayerOn.rentLevel]
      ">
        * you don't have enough money to pay rent, mortgage something
      </p>
    </GameModal>

    <!-- PAY CHANCE MODAL -->
    <GameModal v-if="
      gameState.currentTurn === username &&
      gameState.currentAction === 'chance' &&
      gameState.activeChance[0].type === 'minusBalance'
    ">
      <h1>Pay Chance</h1>
      <h3>{{ gameState.activeChance[0].text }}</h3>
      <BaseButton @click="
        () =>
          send(
            JSON.stringify({
              action: 'PAY_CHANCE',
              payload: { username, amount: gameState.activeChance[0].amount },
            }),
          )
      " bgColor="red" :disabled="player.balance < gameState.activeChance[0].amount || isSending
        ">PAY</BaseButton>
    </GameModal>

    <!-- PAY TAX MODAL -->
    <GameModal v-if="
      gameState.currentTurn === username &&
      gameState.currentAction === 'payTax'
    ">
      <h1>Pay Tax</h1>
      <h3>You need to pay ${{ currentTilePlayerOn.taxAmount }} tax</h3>
      <BaseButton @click="
        () =>
          send(
            JSON.stringify({
              action: 'PAY_TAX',
              payload: { username, tax: currentTilePlayerOn.taxAmount },
            }),
          )
      " bgColor="red" :disabled="player.balance < currentTilePlayerOn.taxAmount || isSending">PAY</BaseButton>
    </GameModal>

    <!--SEND TRADE MODAL -->
    <TradeModal v-if="tradePlayerUsername" :tradePlayerUsername="tradePlayerUsername" :tradeTiles="tradeTiles"
      :player="player" :players="gameState.players" :boardState="boardState"
      :yourTradableProperties="getYourTradableProperties()" :playerTradableProperties="getPlayerTradableProperties()"
      @setTradePlayerUsername="(username: string) => setTradePlayerUsername(username)" @sendTrade="sendTrade" send />



    <!-- RECEIVE TRADE MODAL -->
    <TradeModal v-if="
      gameState.currentAction === 'trade' &&
      gameState.activeTrade.to === username" :tradePlayerUsername="tradePlayerUsername"
      :activeTrade="gameState.activeTrade" :boardState="boardState" @acceptTrade="acceptTrade"
      @declineTrade="declineTrade" receive />

    <!-- GAME BOARD -->
    <GameBoard :tilesState="tilesState" :gameState="gameState" :showTileInfo="showTileInfo" :players="players"
      :player="player" @activateTrade="(username: string) => activateTrade(username)" />
  </div>

  <div v-else>
    Loading...
  </div>
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
