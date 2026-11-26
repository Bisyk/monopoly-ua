<script setup lang="ts">
import { computed, type PropType } from "vue";
import type { Group, Player, Tile } from "~/types";
import {
  getCartridgeGroupColor,
  getCartridgePlayerColor,
  getTileSpriteUrl,
} from "~/utils/cartridgeTheme";

const props = defineProps({
  tile: {
    type: Object as PropType<Tile>,
    required: true,
  },
  players: {
    type: Array as PropType<Player[]>,
    required: true,
  },
  tileGroups: {
    type: Array as PropType<Group[]>,
    required: false,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["showTileInfo"]);

const CORNER_LABELS: Record<string, string> = {
  go: "GO +$200",
  jail: "JAIL",
  parking: "PARKING",
  goToJail: "GO JAIL",
};

const isCorner = computed(() =>
  ["go", "jail", "parking", "goToJail"].includes(props.tile.type)
);

const isInspectable = computed(() =>
  ["property", "bonus-property", "car"].includes(props.tile.type)
);

const tileSide = computed<"corner" | "top" | "right" | "bottom" | "left">(() => {
  const id = props.tile.id;
  if (isCorner.value || [1, 11, 21, 31].includes(id)) return "corner";
  if (id >= 2 && id <= 10) return "top";
  if (id >= 12 && id <= 20) return "right";
  if (id >= 22 && id <= 30) return "bottom";
  return "left";
});

const gridPlacement = computed(() => {
  const id = props.tile.id;
  if (id === 1) return { gridColumn: 1, gridRow: 1 };
  if (id >= 2 && id <= 10) return { gridColumn: id, gridRow: 1 };
  if (id === 11) return { gridColumn: 11, gridRow: 1 };
  if (id >= 12 && id <= 20) return { gridColumn: 11, gridRow: id - 10 };
  if (id === 21) return { gridColumn: 11, gridRow: 11 };
  if (id >= 22 && id <= 30) return { gridColumn: 32 - id, gridRow: 11 };
  if (id === 31) return { gridColumn: 1, gridRow: 11 };
  return { gridColumn: 1, gridRow: 42 - id };
});

const groupColor = computed(() => {
  if (!props.tile.groupId) return null;
  const fallback = props.tileGroups?.find((g) =>
    g.properties.includes(props.tile.id)
  )?.color;
  return getCartridgeGroupColor(props.tile.groupId, fallback);
});

const ownerColor = computed(() => {
  if (!props.tile.owner) return null;
  const owner = props.players.find((p) => p.username === props.tile.owner);
  return owner ? getCartridgePlayerColor(owner.color) : "#2667E8";
});

const rentLevel = computed(() => props.tile.rentLevel ?? 0);

const priceLabel = computed(() => {
  if (
    props.tile.owner &&
    props.tile.rentLevels &&
    props.tile.rentLevels.length > 0
  ) {
    const val = props.tile.rentLevels[rentLevel.value];
    return props.tile.type === "bonus-property" ? `${val}X` : `$${val}`;
  }
  if (props.tile.price) {
    return `$${props.tile.price}`;
  }
  if (props.tile.taxAmount) {
    return `$${props.tile.taxAmount}`;
  }
  return "";
});

const formattedIndex = computed(() => String(props.tile.id).padStart(2, "0"));
const spriteUrl = computed(() => getTileSpriteUrl(props.tile.assetId));
const cornerLabel = computed(
  () => CORNER_LABELS[props.tile.type] || props.tile.name
);

const handleClick = (event: MouseEvent) => {
  if (isInspectable.value) {
    emit("showTileInfo", event, props.tile);
  }
};
</script>

<template>
  <div
    :data-tile-id="props.tile.id"
    class="board-tile"
    :class="[
      `side-${tileSide}`,
      props.tile.type,
      {
        'is-inspectable': isInspectable,
        'is-selected': props.isSelected,
      },
    ]"
    :style="gridPlacement"
    :title="`${formattedIndex} · ${props.tile.name}${priceLabel ? ` (${priceLabel})` : ''}`"
    @click="handleClick"
  >
    <!-- Outer owner color rail (keeps white background & brand logo crisp) -->
    <div
      v-if="ownerColor && !isCorner"
      class="tile-owner-rail"
      :style="{ backgroundColor: ownerColor }"
    />

    <!-- Mortgaged diagonal hatch overlay + lock stamp -->
    <div v-if="props.tile.mortgaged" class="tile-mortgaged">
      <span class="tile-mortgaged__stamp">
        <GameIcon name="lock" :size="11" />
        <span>LOCK</span>
      </span>
    </div>

    <!-- Inner color band with tile index or upgrade pips -->
    <div
      v-if="groupColor"
      class="tile-band"
      :style="{ backgroundColor: groupColor }"
    >
      <template v-if="props.tile.type === 'property' && rentLevel > 0">
        <span
          v-if="rentLevel >= 5"
          class="upgrade-pip upgrade-pip--hq"
          title="HQ / Level 5"
        />
        <template v-else>
          <span
            v-for="n in rentLevel"
            :key="n"
            class="upgrade-pip"
          />
        </template>
      </template>
      <span v-else class="tile-band__idx">{{ formattedIndex }}</span>
    </div>

    <!-- Corner artwork + label -->
    <template v-if="isCorner">
      <div class="tile-logo-box tile-logo-box--corner">
        <img
          :src="spriteUrl"
          :alt="props.tile.name"
          class="tile-logo"
          draggable="false"
        />
      </div>
      <span class="tile-corner-label">{{ cornerLabel }}</span>
    </template>

    <!-- Property / Car / Chance / Tax body with oversized brand sprite -->
    <template v-else>
      <div class="tile-body">
        <span
          v-if="priceLabel"
          class="tile-price"
          :class="{ 'is-rent': !!ownerColor }"
          :style="ownerColor ? { backgroundColor: ownerColor } : undefined"
        >
          {{ priceLabel }}
        </span>
        <div class="tile-logo-box">
          <img
            :src="spriteUrl"
            :alt="props.tile.name"
            class="tile-logo"
            draggable="false"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.board-tile {
  position: relative;
  background: var(--surface);
  display: flex;
  overflow: hidden;
  user-select: none;
  min-width: 0;
  min-height: 0;
  transition: outline-color 0.1s ease, box-shadow 0.1s ease;

  &.is-inspectable {
    cursor: pointer;

    &:hover {
      z-index: 5;
      outline: 2.5px solid var(--accent);
      outline-offset: -1px;
    }
  }

  &.is-selected {
    z-index: 5;
    outline: 3px solid var(--accent);
    outline-offset: -1px;
    box-shadow: inset 0 0 0 2px var(--surface);
  }
}

.side-top {
  flex-direction: column-reverse;
}

.side-bottom {
  flex-direction: column;
}

.side-left {
  flex-direction: row-reverse;
}

.side-right {
  flex-direction: row;
}

.side-corner {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--gold-light);
  padding: 4px;
  gap: 3px;
}

/* Color Band */
.tile-band {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-color: var(--outline);

  .side-top & {
    height: clamp(10px, 1.45vmin, 14px);
    width: 100%;
    border-top: 1.5px solid var(--outline);
  }

  .side-bottom & {
    height: clamp(10px, 1.45vmin, 14px);
    width: 100%;
    border-bottom: 1.5px solid var(--outline);
  }

  .side-left & {
    width: clamp(10px, 1.45vmin, 14px);
    height: 100%;
    flex-direction: column;
    border-left: 1.5px solid var(--outline);
  }

  .side-right & {
    width: clamp(10px, 1.45vmin, 14px);
    height: 100%;
    flex-direction: column;
    border-right: 1.5px solid var(--outline);
  }
}

.tile-band__idx {
  font-family: var(--font-mono);
  font-size: clamp(6.5px, 0.85vmin, 8.5px);
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
  line-height: 1;
}

.upgrade-pip {
  width: clamp(5px, 0.72vmin, 7px);
  height: clamp(5px, 0.72vmin, 7px);
  background: #fffdf7;
  border: 1.2px solid var(--outline);
  border-radius: 1px;

  &--hq {
    width: clamp(9px, 1.2vmin, 12px);
    height: clamp(6px, 0.8vmin, 8px);
    background: var(--danger);
  }

  .side-left &--hq,
  .side-right &--hq {
    width: clamp(6px, 0.8vmin, 8px);
    height: clamp(9px, 1.2vmin, 12px);
  }
}

/* Outer Ownership Edge Rail */
.tile-owner-rail {
  position: absolute;
  z-index: 3;
  pointer-events: none;

  .side-top & {
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
  }

  .side-bottom & {
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
  }

  .side-left & {
    top: 0;
    bottom: 0;
    left: 0;
    width: 4px;
  }

  .side-right & {
    top: 0;
    bottom: 0;
    right: 0;
    width: 4px;
  }
}

/* Tile Body + Oversized Sprite Stage */
.tile-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 2px;
  gap: 2px;

  .side-top & {
    flex-direction: column;
    padding-top: 5px;
  }

  .side-bottom & {
    flex-direction: column-reverse;
    padding-bottom: 5px;
  }

  .side-left & {
    flex-direction: row;
    padding-left: 5px;
  }

  .side-right & {
    flex-direction: row-reverse;
    padding-right: 5px;
  }
}

.tile-price {
  font-family: var(--font-mono);
  font-size: clamp(7.5px, 0.98vmin, 10px);
  font-weight: 800;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 2px;
  background: var(--ink);
  color: var(--gold-light);
  border: 1px solid var(--outline);
  white-space: nowrap;
  flex-shrink: 0;
  z-index: 2;

  .side-left &,
  .side-right & {
    writing-mode: vertical-rl;
    padding: 4px 2px;
  }

  .side-left & {
    transform: rotate(180deg);
  }

  &.is-rent {
    color: #ffffff;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
  }
}

.tile-logo-box {
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1px;

  &--corner {
    flex: 1;
    width: 82%;
    max-height: 76%;
    padding: 2px;
  }
}

.tile-logo {
  width: 94%;
  height: 94%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.tile-corner-label {
  font-family: var(--font-mono);
  font-size: clamp(7px, 0.92vmin, 9.5px);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink);
  line-height: 1;
  text-align: center;
}

/* Mortgaged Overlay */
.tile-mortgaged {
  position: absolute;
  inset: 0;
  z-index: 4;
  background: repeating-linear-gradient(
    45deg,
    rgba(30, 27, 58, 0.16),
    rgba(30, 27, 58, 0.16) 4px,
    rgba(255, 255, 255, 0.85) 4px,
    rgba(255, 255, 255, 0.85) 8px
  );
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.tile-mortgaged__stamp {
  background: var(--surface);
  color: var(--danger);
  border: 2px solid var(--outline);
  box-shadow: 2px 2px 0 var(--outline);
  padding: 2px 5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-size: clamp(7px, 0.9vmin, 9px);
  font-weight: 800;
  transform: rotate(-8deg);
}
</style>