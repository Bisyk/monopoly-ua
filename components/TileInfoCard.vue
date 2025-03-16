<script setup lang="ts">
import type { PropType } from 'vue'
import type { BoardState, Group, Player, Tile } from '~/types'

defineEmits(['mortgageProperty', 'buyBackProperty', 'upgradeProperty', 'sellProperty'])

const props = defineProps({
  selectedTile: {
    type: Object as PropType<Tile>,
    required: true,
  },
  currentTurn: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  player: {
    type: Object as PropType<Player>,
    required: true,
  },
  tilesState: {
    type: Array as PropType<Tile[]>,
    required: true,
  },
  boardState: {
    type: Object as PropType<BoardState>,
    required: true,
  },
  groupsState: {
    type: Array as PropType<Group[]>,
    required: true,
  },
  fullSetsGroups: {
    type: Array as PropType<Number[]>,
    required: true,
  },
  tileInfoStyle: {
    type: Object,
    required: true,
  },
  isSending: {
    type: Boolean,
    required: true,
  },
})

const checkIfUpgradeable = (propertyId: number) => {
  const property = props.tilesState.find(t => t.id === propertyId)
  if (property!.type !== 'property') return false

  const group = props.boardState.groups.find(g => g.groupId === property!.groupId)
  if (!group) return false

  const propertiesInGroup = props.tilesState.filter(t => t.groupId === property!.groupId)

  const allOwnedBySamePlayer = propertiesInGroup.every(p => p.owner === property!.owner)
  if (!allOwnedBySamePlayer) return false

  const allAtMaxRentLevel = propertiesInGroup.every(p => p.rentLevel >= 5)
  if (allAtMaxRentLevel) return false

  const isAnyMortgaged = propertiesInGroup.some(p => p.mortgaged)
  if (isAnyMortgaged) return false

  const isOwner = props.player.properties.includes(propertyId)
  if (!isOwner) return false

  const isUpgradable = props.groupsState.find(g => g.groupId === property!.groupId)!.isUpgradeAvailable
  if (!isUpgradable) return false

  const isFullSet = props.fullSetsGroups.includes(property!.groupId)
  if (!isFullSet) return false

  const isLevelEvenlyUpgraded = propertiesInGroup.every(p => p.rentLevel >= property!.rentLevel)

  return isLevelEvenlyUpgraded
}

const checkIfMortgageable = (propertyId: number) => {
  const property = props.tilesState.find(t => t.id === propertyId)
  if (!['car', 'property', 'bonus-property'].includes(property!.type)) return false

  const isOwner = props.player.properties.includes(propertyId)
  if (!isOwner) return false

  const isMortgaged = property!.mortgaged
  if (isMortgaged) return false

  const isRentLevelZero = property!.rentLevel === 0
  if (!isRentLevelZero) return false

  const propertiesInGroup = props.tilesState.filter(t => t.groupId === property!.groupId)

  const isAnyPropertyUpgraded = propertiesInGroup.some(p => p.rentLevel > 0)

  return !isAnyPropertyUpgraded
}

const checkIfBuybackAble = (propertyId: number) => {
  const property = props.tilesState.find(t => t.id === propertyId)
  if (!['car', 'property', 'bonus-property'].includes(property!.type)) return false

  const isOwner = props.player.properties.includes(propertyId)
  if (!isOwner) return false

  const isMortgaged = property!.mortgaged
  if (!isMortgaged) return false

  return true
}

const checkIfSellable = (propertyId: number) => {
  const isOwner = props.player.properties.includes(propertyId)
  if (!isOwner) return false

  const property = props.tilesState.find(t => t.id === propertyId)
  if (property!.type !== 'property') return false

  if (property!.rentLevel < 1) return false

  const group = props.boardState.groups.find(g => g.groupId === property!.groupId)
  if (!group) return false

  const propertiesInGroup = props.tilesState.filter(t => t.groupId === property!.groupId)

  const notLowerThanAnyOtherProperty = propertiesInGroup.every(p => p.rentLevel <= property!.rentLevel)

  return notLowerThanAnyOtherProperty
}
</script>

<template>
  <div class="tileInfo" :style="`top: ${tileInfoStyle.top}px; left: ${tileInfoStyle.left}px`">
    <h3>{{ selectedTile.name }}</h3>
    <div style="display: flex; width: 100%; justify-content: center; gap: 1rem">
      <BaseButton v-if="
        checkIfMortgageable(selectedTile.id) &&
        props.currentTurn === username
      " @click="$emit('mortgageProperty', selectedTile.id)" bgColor="red" :disabled="isSending">
        MORTGAGE
      </BaseButton>

      <BaseButton v-if="
        checkIfBuybackAble(selectedTile.id) &&
        props.currentTurn === username
      " @click="$emit('buyBackProperty', selectedTile.id)" bgColor="green"
        :disabled="player.balance < selectedTile.buybackPrice || isSending">
        BUY BACK
      </BaseButton>

      <BaseButton v-if="
        checkIfSellable(selectedTile.id) &&
        props.currentTurn === username
      " @click="$emit('sellProperty', selectedTile.id)" bgColor="red" :disabled="isSending">
        SELL
      </BaseButton>

      <BaseButton v-if="
        checkIfUpgradeable(selectedTile.id) &&
        props.currentTurn === username
      " @click="$emit('upgradeProperty', selectedTile.id)" :disabled="player.balance <
        groupsState.find((g) => g.groupId === selectedTile.groupId)!
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
</template>

<style scoped lang="scss">
.tileInfo {
  position: absolute;
  z-index: 11;
  background-color: white;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  min-width: 10vw;
}
</style>