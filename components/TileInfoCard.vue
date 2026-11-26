<script setup lang="ts">
import { computed, type PropType } from "vue";
import type { BoardState, Group, Player, Tile } from "~/types";
import {
  getCartridgeGroupColor,
  getCartridgeGroupName,
  getTileSpriteUrl,
} from "~/utils/cartridgeTheme";

defineEmits([
  "mortgageProperty",
  "buyBackProperty",
  "upgradeProperty",
  "sellProperty",
]);

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
  tiles: {
    type: Array as PropType<Tile[]>,
    required: true,
  },
  board: {
    type: Object as PropType<BoardState>,
    required: true,
  },
  propertyGroups: {
    type: Array as PropType<Group[]>,
    required: true,
  },
  fullSetsGroups: {
    type: Array as PropType<number[]>,
    required: true,
  },
  tileInfoStyle: {
    type: Object as PropType<{ top: number; left: number }>,
    required: true,
  },
  isSending: {
    type: Boolean,
    required: true,
  },
});

const checkIfUpgradeable = (propertyId: number) => {
  const property = props.tiles.find((t) => t.id === propertyId);
  if (!property || property.type !== "property") return false;

  const group = props.board.groups.find((g) => g.groupId === property.groupId);
  if (!group) return false;

  const propertiesInGroup = props.tiles.filter(
    (t) => t.groupId === property.groupId
  );

  const allOwnedBySamePlayer = propertiesInGroup.every(
    (p) => p.owner === property.owner
  );
  if (!allOwnedBySamePlayer) return false;

  const allAtMaxRentLevel = propertiesInGroup.every(
    (p) => (p.rentLevel ?? 0) >= 5
  );
  if (allAtMaxRentLevel) return false;

  const isAnyMortgaged = propertiesInGroup.some((p) => p.mortgaged);
  if (isAnyMortgaged) return false;

  const isOwner = props.player.properties.includes(propertyId);
  if (!isOwner) return false;

  const propGroup = props.propertyGroups.find(
    (g) => g.groupId === property.groupId
  );
  if (!propGroup?.isUpgradeAvailable) return false;

  const isFullSet = props.fullSetsGroups.includes(property.groupId ?? -1);
  if (!isFullSet) return false;

  return propertiesInGroup.every(
    (p) => (p.rentLevel ?? 0) >= (property.rentLevel ?? 0)
  );
};

const checkIfMortgageable = (propertyId: number) => {
  const property = props.tiles.find((t) => t.id === propertyId);
  if (!property || !["car", "property", "bonus-property"].includes(property.type))
    return false;

  if (!props.player.properties.includes(propertyId)) return false;
  if (property.mortgaged) return false;
  if ((property.rentLevel ?? 0) !== 0) return false;

  if (property.groupId != null) {
    const propertiesInGroup = props.tiles.filter(
      (t) => t.groupId === property.groupId
    );
    if (propertiesInGroup.some((p) => (p.rentLevel ?? 0) > 0)) return false;
  }

  return true;
};

const checkIfBuybackAble = (propertyId: number) => {
  const property = props.tiles.find((t) => t.id === propertyId);
  if (!property || !["car", "property", "bonus-property"].includes(property.type))
    return false;
  if (!props.player.properties.includes(propertyId)) return false;
  return Boolean(property.mortgaged);
};

const checkIfSellable = (propertyId: number) => {
  if (!props.player.properties.includes(propertyId)) return false;
  const property = props.tiles.find((t) => t.id === propertyId);
  if (!property || property.type !== "property") return false;
  if ((property.rentLevel ?? 0) < 1) return false;

  const group = props.board.groups.find((g) => g.groupId === property.groupId);
  if (!group) return false;

  const propertiesInGroup = props.tiles.filter(
    (t) => t.groupId === property.groupId
  );
  return propertiesInGroup.every(
    (p) => (p.rentLevel ?? 0) <= (property.rentLevel ?? 0)
  );
};

const bannerColor = computed(() =>
  getCartridgeGroupColor(props.selectedTile.groupId)
);

const groupName = computed(() =>
  getCartridgeGroupName(props.selectedTile.groupId, props.selectedTile.type)
);

const spriteUrl = computed(() => getTileSpriteUrl(props.selectedTile.assetId));

const upgradePrice = computed(() => {
  const grp = props.propertyGroups.find(
    (g) => g.groupId === props.selectedTile.groupId
  );
  return grp?.upgradePrice ?? 0;
});

const statusText = computed(() => {
  if (props.selectedTile.mortgaged) return "LOCKED";
  if (props.selectedTile.owner) return `OWNER: ${props.selectedTile.owner}`;
  return "FOR SALE";
});

const rentRows = computed(() => {
  const levels = props.selectedTile.rentLevels ?? [];
  if (props.selectedTile.type === "property") {
    const labels = ["Base", "Lv 1", "Lv 2", "Lv 3", "Lv 4", "HQ"];
    return levels.map((val, idx) => ({
      label: labels[idx] ?? `Lv ${idx}`,
      lvl: idx,
      val: `$${val}`,
    }));
  }
  if (props.selectedTile.type === "car") {
    return levels.map((val, idx) => ({
      label: `${idx + 1} ${idx === 0 ? "Car" : "Cars"}`,
      lvl: idx,
      val: `$${val}`,
    }));
  }
  if (props.selectedTile.type === "bonus-property") {
    return levels.map((val, idx) => ({
      label: `${idx + 1} ${idx === 0 ? "Util" : "Utils"}`,
      lvl: idx,
      val: `${val}x Dice`,
    }));
  }
  return [];
});

const isMyTurn = computed(() => props.currentTurn === props.username);
const canMortgage = computed(
  () => isMyTurn.value && checkIfMortgageable(props.selectedTile.id)
);
const canBuyback = computed(
  () => isMyTurn.value && checkIfBuybackAble(props.selectedTile.id)
);
const canSell = computed(
  () => isMyTurn.value && checkIfSellable(props.selectedTile.id)
);
const canUpgrade = computed(
  () => isMyTurn.value && checkIfUpgradeable(props.selectedTile.id)
);
const hasAnyAction = computed(
  () =>
    canMortgage.value || canBuyback.value || canSell.value || canUpgrade.value
);
</script>

<template>
  <div
    class="tile-deed"
    :style="{
      top: `${tileInfoStyle.top}px`,
      left: `${tileInfoStyle.left}px`,
    }"
  >
    <div class="tile-deed__banner" :style="{ backgroundColor: bannerColor }">
      <span>#{{ String(selectedTile.id).padStart(2, "0") }} · {{ groupName }}</span>
      <span>{{ statusText }}</span>
    </div>

    <div class="tile-deed__head">
      <div class="tile-deed__logo">
        <img :src="spriteUrl" :alt="selectedTile.name" />
      </div>
      <div class="tile-deed__title-wrap">
        <h3 class="tile-deed__name">{{ selectedTile.name }}</h3>
        <p class="tile-deed__sub">
          {{
            selectedTile.mortgaged
              ? "Mortgaged — rent paused"
              : selectedTile.owner
                ? `Owned by ${selectedTile.owner}`
                : "Available to buy"
          }}
        </p>
      </div>
    </div>

    <div class="tile-deed__body">
      <div v-if="rentRows.length" class="rent-list">
        <div
          v-for="row in rentRows"
          :key="row.lvl"
          class="rent-row"
          :class="{
            'is-active':
              selectedTile.owner &&
              !selectedTile.mortgaged &&
              (selectedTile.rentLevel ?? 0) === row.lvl,
          }"
        >
          <span class="rent-row__left">
            <span>{{ row.label }}</span>
            <span
              v-if="selectedTile.type === 'property' && row.lvl > 0"
              class="rent-row__icons"
            >
              <GameIcon v-if="row.lvl >= 5" name="hq" :size="15" />
              <template v-else>
                <GameIcon
                  v-for="n in row.lvl"
                  :key="n"
                  name="house"
                  :size="13"
                />
              </template>
            </span>
          </span>
          <span class="rent-row__val">{{ row.val }}</span>
        </div>
      </div>

      <div v-if="selectedTile.price" class="deed-stats">
        <div class="deed-stat">
          <span class="deed-stat__k">Price</span>
          <span class="deed-stat__v">${{ selectedTile.price }}</span>
        </div>
        <div class="deed-stat">
          <span class="deed-stat__k">Mortgage</span>
          <span class="deed-stat__v">${{ selectedTile.mortgagePrice ?? Math.floor(selectedTile.price / 2) }}</span>
        </div>
        <div class="deed-stat">
          <span class="deed-stat__k">Buyback</span>
          <span class="deed-stat__v">${{ selectedTile.buybackPrice ?? Math.floor(selectedTile.price * 0.6) }}</span>
        </div>
      </div>

      <div v-if="hasAnyAction" class="deed-actions">
        <BaseButton
          v-if="canUpgrade"
          variant="positive"
          size="sm"
          :disabled="player.balance < upgradePrice || isSending"
          @click="$emit('upgradeProperty', selectedTile.id)"
        >
          <GameIcon name="up" :size="15" />
          <span>UPGRADE ${{ upgradePrice }}</span>
        </BaseButton>

        <BaseButton
          v-if="canSell"
          variant="danger"
          size="sm"
          :disabled="isSending"
          @click="$emit('sellProperty', selectedTile.id)"
        >
          <GameIcon name="down" :size="15" />
          <span>SELL LV</span>
        </BaseButton>

        <BaseButton
          v-if="canMortgage"
          variant="danger"
          size="sm"
          :disabled="isSending"
          @click="$emit('mortgageProperty', selectedTile.id)"
        >
          <GameIcon name="lock" :size="15" />
          <span>MORTGAGE</span>
        </BaseButton>

        <BaseButton
          v-if="canBuyback"
          variant="positive"
          size="sm"
          block
          class="deed-actions__full"
          :disabled="
            player.balance < (selectedTile.buybackPrice ?? 0) || isSending
          "
          @click="$emit('buyBackProperty', selectedTile.id)"
        >
          <GameIcon name="coin" :size="16" />
          <span>BUY BACK ${{ selectedTile.buybackPrice }}</span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tile-deed {
  position: fixed;
  z-index: 40;
  width: 296px;
  max-width: calc(100vw - 24px);
  background: var(--surface);
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--modal-shadow);
  overflow: hidden;
}

.tile-deed__banner {
  padding: 8px 14px;
  border-bottom: 2.5px solid var(--outline);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #ffffff;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
}

.tile-deed__head {
  padding: 13px 15px;
  display: flex;
  align-items: center;
  gap: 13px;
  border-bottom: 2px solid var(--outline);
}

.tile-deed__logo {
  width: 60px;
  height: 60px;
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  box-shadow: 2.5px 2.5px 0 var(--outline);
  display: grid;
  place-items: center;
  padding: 5px;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.tile-deed__title-wrap {
  min-width: 0;
}

.tile-deed__name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.05;
  text-transform: uppercase;
  color: var(--ink);
}

.tile-deed__sub {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ink-muted);
  margin-top: 4px;
}

.tile-deed__body {
  padding: 13px 15px 15px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.rent-list {
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.rent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1.5px solid var(--rule-muted);
  background: var(--surface);
  color: var(--ink-muted);

  &:last-child {
    border-bottom: none;
  }

  &.is-active {
    background: var(--accent);
    color: #ffffff;
  }
}

.rent-row__left {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.rent-row__icons {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.rent-row__val {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
}

.deed-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.deed-stat {
  background: var(--surface-alt);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  padding: 7px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.deed-stat__k {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.deed-stat__v {
  font-family: var(--font-mono);
  font-size: 13.5px;
  font-weight: 800;
  color: var(--ink);
  margin-top: 2px;
}

.deed-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
  padding-bottom: 4px;

  &__full {
    grid-column: 1 / -1;
  }
}
</style>