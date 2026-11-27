<script setup lang="ts">
import { computed, ref, useTemplateRef, type PropType } from "vue";
import { onClickOutside } from "@vueuse/core";
import type { Player, Tile } from "~/types";
import {
  BOT_DIFFICULTY_LABELS,
  getBotPersonaByUsername,
  normalizeBotDifficulty,
} from "~/shared/constants/botNames";
import {
  getCartridgeGroupColor,
  getCartridgePlayerColor,
  getPlayerInitials,
} from "~/utils/cartridgeTheme";

const props = defineProps({
  playerFromPlayers: {
    type: Object as PropType<Player>,
    required: true,
  },
  player: {
    type: Object as PropType<Player | null>,
    default: null,
  },
  currentTurn: {
    type: String,
    default: "",
  },
  tiles: {
    type: Array as PropType<Tile[]>,
    default: () => [],
  },
  isSpectator: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["activateTrade"]);

const isPlayerActionsVisible = ref(false);
const target = useTemplateRef<HTMLElement>("target");

const effectiveIsSpectator = computed(
  () => props.isSpectator || !props.player?.username
);

const isSelf = computed(
  () =>
    !effectiveIsSpectator.value &&
    props.playerFromPlayers.username === props.player?.username
);

const canInteract = computed(
  () => !effectiveIsSpectator.value && !isSelf.value
);

const isActiveTurn = computed(
  () => props.currentTurn === props.playerFromPlayers.username
);

const isBot = computed(() => Boolean(props.playerFromPlayers.isBot));

const botPersona = computed(() =>
  isBot.value
    ? getBotPersonaByUsername(props.playerFromPlayers.username)
    : null
);

const botDifficulty = computed(() =>
  normalizeBotDifficulty(props.playerFromPlayers.botDifficulty)
);

const botBadgeLabel = computed(
  () => `BOT · ${BOT_DIFFICULTY_LABELS[botDifficulty.value]}`
);

const botBadgeVariant = computed(() => {
  if (botDifficulty.value === "EASY") return "positive";
  if (botDifficulty.value === "HARD") return "danger";
  return "gold";
});

const playerColor = computed(() =>
  getCartridgePlayerColor(props.playerFromPlayers.color)
);

const initials = computed(() =>
  getPlayerInitials(props.playerFromPlayers.username)
);

const ownedTiles = computed(() =>
  props.tiles.filter((t) => t.owner === props.playerFromPlayers.username)
);

const togglePlayerActions = () => {
  if (!canInteract.value) return;
  isPlayerActionsVisible.value = !isPlayerActionsVisible.value;
};

const handleTradeClick = (event: MouseEvent) => {
  event.stopPropagation();
  if (!canInteract.value) return;
  isPlayerActionsVisible.value = false;
  emit("activateTrade", props.playerFromPlayers.username);
};

onClickOutside(target, () => {
  isPlayerActionsVisible.value = false;
});
</script>

<template>
  <div
    ref="target"
    class="player-card"
    :class="{
      'is-active': isActiveTurn,
      'is-clickable': canInteract,
    }"
    @click="togglePlayerActions"
  >
    <div
      class="player-card__stripe"
      :style="{ backgroundColor: playerColor }"
    />

    <div class="player-card__body">
      <div class="player-card__head">
        <div class="player-card__identity">
          <div
            class="player-card__badge"
            :class="{ 'player-card__badge--avatar': Boolean(botPersona) }"
            :style="{ backgroundColor: playerColor }"
            :title="
              botPersona
                ? `${playerFromPlayers.username} — ${botPersona.title}`
                : playerFromPlayers.username
            "
          >
            <img
              v-if="botPersona"
              :src="botPersona.avatarUrl"
              :alt="playerFromPlayers.username"
              class="player-card__avatar-img"
            />
            <template v-else>{{ initials }}</template>
          </div>
          <div class="player-card__name-wrap">
            <h2
              class="player-card__name"
              :title="
                botPersona
                  ? `${playerFromPlayers.username} — ${botPersona.title}`
                  : playerFromPlayers.username
              "
            >
              {{ playerFromPlayers.username }}
            </h2>
            <div v-if="isBot" class="player-card__bot-meta">
              <RetroBadge
                :variant="botBadgeVariant"
                class="player-card__bot-badge"
              >
                {{ botBadgeLabel }}
              </RetroBadge>
              <span
                v-if="botPersona?.title"
                class="player-card__persona-title"
                :title="botPersona.title"
              >
                {{ botPersona.title }}
              </span>
            </div>
          </div>
        </div>

        <div class="player-card__status">
          <RetroBadge v-if="isActiveTurn" variant="primary">TURN</RetroBadge>
          <RetroBadge v-else-if="playerFromPlayers.jailed" variant="danger">
            JAIL
          </RetroBadge>
          <RetroBadge v-else-if="isSelf" variant="gold">YOU</RetroBadge>
        </div>
      </div>

      <div class="player-card__balance">
        ${{ Number(playerFromPlayers.balance).toLocaleString() }}
      </div>

      <div class="player-card__foot">
        <div class="player-card__deeds" :title="`${ownedTiles.length} deeds owned`">
          <span
            v-for="tile in ownedTiles"
            :key="tile.id"
            class="deed-dot"
            :class="{ 'is-mortgaged': tile.mortgaged }"
            :style="{ backgroundColor: getCartridgeGroupColor(tile.groupId) }"
            :title="tile.name"
          />
          <span v-if="ownedTiles.length === 0" class="deeds-empty">
            0 DEEDS
          </span>
        </div>

        <BaseButton
          v-if="canInteract"
          variant="secondary"
          size="sm"
          class="trade-trigger"
          @click="handleTradeClick"
        >
          <GameIcon name="swap" :size="14" />
          <span>TRADE</span>
        </BaseButton>
        <span v-else-if="ownedTiles.length > 0" class="deeds-count">
          {{ ownedTiles.length }} {{ ownedTiles.length === 1 ? "DEED" : "DEEDS" }}
        </span>
      </div>
    </div>

    <div
      v-if="isPlayerActionsVisible && canInteract"
      class="player-actions-popover"
      @click.stop
    >
      <BaseButton variant="ghost" size="sm" block>
        <GameIcon name="user" :size="15" />
        <span>PROFILE</span>
      </BaseButton>
      <BaseButton variant="primary" size="sm" block @click="handleTradeClick">
        <GameIcon name="swap" :size="15" />
        <span>TRADE</span>
      </BaseButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.player-card {
  position: relative;
  background: var(--surface);
  border: var(--panel-border);
  border-radius: var(--radius-md);
  box-shadow: var(--card-shadow);
  width: 100%;
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &.is-clickable {
    cursor: pointer;

    &:hover {
      transform: translateY(-1px);
    }
  }

  &.is-active {
    border-color: var(--accent);
    box-shadow:
      0 0 0 2px var(--accent),
      0 5px 0 var(--outline);
  }
}

.player-card__stripe {
  height: 6px;
  border-bottom: 1.5px solid var(--outline);
  border-radius: 3px 3px 0 0;
}

.player-card__body {
  padding: 10px 12px;
}

.player-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.player-card__identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.player-card__name-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}

.player-card__bot-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
}

.player-card__bot-badge {
  font-size: 8.5px;
  padding: 2px 5px;
  flex-shrink: 0;
}

.player-card__persona-title {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.player-card__status {
  flex-shrink: 0;
}

.player-card__badge {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  border: 2px solid var(--outline);
  box-shadow:
    2px 2px 0 var(--outline),
    inset 0 2px 0 rgba(255, 255, 255, 0.35);
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
  overflow: hidden;

  &--avatar {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    box-shadow: 2px 2px 0 var(--outline);
  }
}

.player-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.player-card__name {
  font-family: var(--font-body);
  font-size: 13.5px;
  font-weight: 800;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.player-card__balance {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 800;
  color: var(--ink);
  letter-spacing: -0.02em;
  margin: 2px 0 8px;
}

.player-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 8px;
  border-top: 1.5px dashed var(--rule-muted);
}

.player-card__deeds {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.deed-dot {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 1.5px solid var(--outline);

  &.is-mortgaged {
    opacity: 0.35;
  }
}

.deeds-empty,
.deeds-count {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-muted);
}

.trade-trigger {
  padding: 5px 8px;
  font-size: 10px;
}

.player-actions-popover {
  display: flex;
  gap: 8px;
  padding: 8px 12px 10px;
  background: var(--surface-alt);
  border-top: 2px solid var(--outline);
  border-radius: 0 0 6px 6px;
}
</style>
