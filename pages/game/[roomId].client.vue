<script setup lang="ts">
import { onMounted, ref, watch, computed, useTemplateRef, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getTilePosition } from '../../utils/board'
import { onClickOutside } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const players = ref<any>([])
const gameState = ref<any>({} as any)
const username = sessionStorage.getItem('username')
const selectedTile = ref<any>(null)
const tileInfo = ref(null)
const isSending = ref(false)
const turnResult = ref({ left: 0, right: 0 })
const tradePlayerUsername = ref('')
const tradeTiles = ref({
  given: new Set(),
  received: new Set(),
  givenMoney: 0,
  receivedMoney: 0
})

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
  return gameState.value.players.find(p => p.username === username)
})

const currentTilePlayerOn = computed(() => {
  return tilesState.value?.find(t => t.id === player.value.position) ?? {}
})

const fullSetsGroups = computed(() => {
  return groupsState.value?.filter(g => g.isFullSet).map(g => g.groupId) ?? []
})

const getYourTradableProperties = () => {
  const ownedAndNotMortgaged = tilesState.value.filter(t => t.owner === username && ['car', 'property', 'bonus-property'].includes(t.type) && !t.mortgaged)
  const tradeable = ownedAndNotMortgaged.filter(t => {
    const isFullSet = fullSetsGroups.value.includes(t.groupId)
    const isAnyTileInFullSetUpgraded = tilesState.value.some(tile => tile.groupId === t.groupId && tile.rentLevel > 0)

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false
    }

    return true
  })

  return tradeable.map(t => t.id)
}

const getPlayerTradableProperties = () => {
  const ownedAndNotMortgaged = tilesState.value.filter(t => t.owner === tradePlayerUsername.value && ['car', 'property', 'bonus-property'].includes(t.type) && !t.mortgaged)
  console.log(ownedAndNotMortgaged);
  const tradeable = ownedAndNotMortgaged.filter(t => {
    const isFullSet = fullSetsGroups.value.includes(t.groupId)
    const isAnyTileInFullSetUpgraded = tilesState.value.some(tile => tile.groupId === t.groupId && tile.rentLevel > 0)

    if (isFullSet && isAnyTileInFullSetUpgraded) {
      return false
    }

    return true
  })

  return tradeable.map(t => t.id)
}

handleMessage((message) => {
  isSending.value = false
  gameState.value = JSON.parse(message)
})

const handleUserTurn = () => {
  isSending.value = true
  turnResult.value = rollDice()
  send(JSON.stringify({ action: 'ROLL_DICE', payload: { username, turnResult: turnResult.value } }))
}

const checkIfUpgradeable = (propertyId: number) => {
  const property = tilesState.value.find(t => t.id === propertyId)
  if (property.type !== 'property') return false

  const group = boardState.value.groups.find(g => g.groupId === property.groupId)
  if (!group) return false

  const propertiesInGroup = tilesState.value.filter(t => t.groupId === property.groupId)

  const allOwnedBySamePlayer = propertiesInGroup.every(p => p.owner === property.owner)
  if (!allOwnedBySamePlayer) return false

  const allAtMaxRentLevel = propertiesInGroup.every(p => p.rentLevel >= 5)
  if (allAtMaxRentLevel) return false

  const isAnyMortgaged = propertiesInGroup.some(p => p.mortgaged)
  if (isAnyMortgaged) return false

  const isOwner = player.value.properties.includes(propertyId)
  if (!isOwner) return false

  const isUpgradable = groupsState.value.find(g => g.groupId === property.groupId).isUpgradeAvailable
  if (!isUpgradable) return false

  const isFullSet = fullSetsGroups.value.includes(property.groupId)
  if (!isFullSet) return false

  const isLevelEvenlyUpgraded = propertiesInGroup.every(p => p.rentLevel >= property.rentLevel)

  return isLevelEvenlyUpgraded
}

const checkIfMortgageable = (propertyId: number) => {
  const property = tilesState.value.find(t => t.id === propertyId)
  if (property.type !== 'property') return false

  const group = boardState.value.groups.find(g => g.groupId === property.groupId)
  if (!group) return false


  const isOwner = player.value.properties.includes(propertyId)
  if (!isOwner) return false

  const isMortgaged = property.mortgaged
  if (isMortgaged) return false

  const isRentLevelZero = property.rentLevel === 0
  if (!isRentLevelZero) return false

  const propertiesInGroup = tilesState.value.filter(t => t.groupId === property.groupId)

  const isAnyPropertyUpgraded = propertiesInGroup.some(p => p.rentLevel > 0)

  return !isAnyPropertyUpgraded
}

const checkIfBuybackAble = (propertyId: number) => {
  const property = tilesState.value.find(t => t.id === propertyId)
  if (property.type !== 'property') return false

  const group = boardState.value.groups.find(g => g.groupId === property.groupId)
  if (!group) return false

  const isOwner = player.value.properties.includes(propertyId)
  if (!isOwner) return false

  const isMortgaged = property.mortgaged
  if (!isMortgaged) return false

  return true
}

const checkIfSellable = (propertyId: number) => {
  const property = tilesState.value.find(t => t.id === propertyId)
  if (property.type !== 'property') return false

  if (property.rentLevel < 1) return false

  const group = boardState.value.groups.find(g => g.groupId === property.groupId)
  if (!group) return false

  const propertiesInGroup = tilesState.value.filter(t => t.groupId === property.groupId)

  const notLowerThanAnyOtherProperty = propertiesInGroup.every(p => p.rentLevel <= property.rentLevel)

  return notLowerThanAnyOtherProperty
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

const showTileInfo = async (event, tile) => {
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
  }

  if (position === 'bottom') {
    top -= tileRect.height / 2
  }

  if (position === 'left') {
    left += tileRect.width
  }

  if (tileInfo.value) {
    tileInfo.value.style.top = `${top}px`;
    tileInfo.value.style.left = `${left}px`;
  }
}

const activateTrade = (username) => {
  if (gameState.value.currentTurn !== player.value.username) return
  tradePlayerUsername.value = username
}

const setTradePlayerUsername = (username) => {
  tradePlayerUsername.value = username
}

onClickOutside(tileInfo, event => {
  selectedTile.value = null
})

onMounted(async () => {
  const username = sessionStorage.getItem('username')
  const { body } = await $fetch(`/games/${route.params.roomId}`)
  const { game } = JSON.parse(body)

  gameState.value = game
  players.value = game.players

  if (!game.players.some(p => p.username === username)) {
    router.push({ path: '/' })
  }
})


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
    <!-- Tile Info -->
    <div v-if="selectedTile" class="tileInfo" ref="tileInfo">
      <h3>{{ selectedTile.name }}</h3>
      <div style="display: flex; width: 100%; justify-content: center; gap: 1rem">
        <BaseButton v-if="
          checkIfMortgageable(selectedTile.id) &&
          gameState.currentTurn === username
        " @click="handleMortgageProperty(selectedTile.id)" bgColor="red" :disabled="isSending">
          MORTGAGE
        </BaseButton>

        <BaseButton v-if="
          checkIfBuybackAble(selectedTile.id) &&
          gameState.currentTurn === username
        " @click="handleBuyBackProperty(selectedTile.id)" bgColor="green"
          :disabled="player.balance < selectedTile.buybackPrice || isSending">
          BUY BACK
        </BaseButton>

        <BaseButton v-if="
          checkIfSellable(selectedTile.id) &&
          gameState.currentTurn === username
        " @click="handleSellProperty(selectedTile.id)" bgColor="red" :disabled="isSending">
          SELL
        </BaseButton>

        <BaseButton v-if="
          checkIfUpgradeable(selectedTile.id) &&
          gameState.currentTurn === username
        " @click="handleUpgradeProperty(selectedTile.id)" :disabled="player.balance <
          groupsState.find((g) => g.groupId === selectedTile.groupId)
            .upgradePrice || isSending
          " bgColor="green">
          UPGRADE
        </BaseButton>
      </div>

      <div v-if="selectedTile.type === 'property'">
        <p>💰 Base Rent: {{ selectedTile.rentLevels[0] }}</p>
        <div style="display: flex; flex-direction: column; gap: 1rem">
          <div style="display: flex; justify-content: space-between">
            <div>⭐</div>
            <div>{{ selectedTile.rentLevels[1] }}</div>
          </div>
          <div style="display: flex; justify-content: space-between">
            <div>⭐⭐</div>
            <div>{{ selectedTile.rentLevels[2] }}</div>
          </div>
          <div style="display: flex; justify-content: space-between">
            <div>⭐⭐⭐</div>
            <div>{{ selectedTile.rentLevels[3] }}</div>
          </div>
          <div style="display: flex; justify-content: space-between">
            <div>⭐⭐⭐⭐</div>
            <div>{{ selectedTile.rentLevels[4] }}</div>
          </div>
          <div style="display: flex; justify-content: space-between">
            <div>🌟</div>
            <div>{{ selectedTile.rentLevels[5] }}</div>
          </div>
        </div>
      </div>
      <p>💰 Buy Price: {{ selectedTile.price }}</p>
      <p>💰 Mortgage Price: {{ selectedTile.mortgagePrice }}</p>
      <p>💰 Buyback Price: {{ selectedTile.buybackPrice }}</p>
    </div>

    <!-- ROLL MODAL -->
    <GameModal v-if="
      gameState.currentTurn === username &&
      gameState.currentAction === 'roll' &&
      !player.jailed
    ">
      <div>
        <h1>It's your turn!</h1>
        <h3 style="margin-bottom: 1rem">Roll the dice to move your piece.</h3>
      </div>
      <BaseButton @click="handleUserTurn" style="position: absolute; z-index: 11111" :disabled="isSending">ROLL DICE
      </BaseButton>
    </GameModal>

    <!-- Jail Modal -->
    <GameModal v-if="gameState.currentTurn === username && player.jailed">
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
    </GameModal>

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
          tilesState.filter((t) => t.id === gameState.tileOnAuction)[0].name
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
      @setTradePlayerUsername="(username) => setTradePlayerUsername(username)" @sendTrade="sendTrade" send />



    <!-- RECEIVE TRADE MODAL -->
    <TradeModal v-if="
      gameState.currentAction === 'trade' &&
      gameState.activeTrade.to === username" :tradePlayerUsername="tradePlayerUsername"
      :activeTrade="gameState.activeTrade" :boardState="boardState" @acceptTrade="acceptTrade"
      @declineTrade="declineTrade" receive />

    <!-- GAME BOARD -->
    <GameBoard :tilesState="tilesState" :gameState="gameState" :showTileInfo="showTileInfo" :players="players"
      :player="player" @activateTrade="(username) => activateTrade(username)" />
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

  .tileInfo {
    position: absolute;
    z-index: 11;
    background-color: white;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    min-width: 10vw;
  }

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
