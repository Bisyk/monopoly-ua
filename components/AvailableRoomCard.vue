<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import type { BotDifficulty, BotSlot } from "~/types";
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABELS,
  getBotPersonaByUsername,
} from "~/shared/constants/botNames";
import { getPlayerInitials } from "~/utils/cartridgeTheme";

const SLOT_COLORS = [
  "#2667E8",
  "#E63956",
  "#1EB554",
  "#D99100",
  "#7B4CE2",
  "#F26B21",
];

const props = defineProps({
  maxPlayers: {
    type: Number,
    required: true,
  },
  players: {
    type: Array as PropType<string[]>,
    required: true,
  },
  gameId: {
    type: String,
    required: true,
  },
  bots: {
    type: Array as PropType<BotSlot[]>,
    default: () => [],
  },
  createdBy: {
    type: String,
    default: "",
  },
  currentUsername: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    default: "PENDING",
  },
});

const emit = defineEmits<{
  (e: "joinGame", roomId: string): void;
  (e: "addBot", payload: { roomId: string; difficulty: BotDifficulty }): void;
  (e: "removeBot", payload: { roomId: string; botUsername: string }): void;
  (e: "spectateGame", roomId: string): void;
}>();

const selectedDifficulty = ref<BotDifficulty>("MEDIUM");

const isPending = computed(() => props.status === "PENDING");
const isStarted = computed(() => props.status === "STARTED");
const isCreator = computed(
  () => Boolean(props.currentUsername) && props.createdBy === props.currentUsername
);
const isCurrentUserInRoom = computed(
  () =>
    Boolean(props.currentUsername) &&
    props.players.includes(props.currentUsername)
);
const hasOpenSlots = computed(() => props.players.length < props.maxPlayers);

const getBotSlot = (username: string): BotSlot | null =>
  props.bots?.find((bot) => bot.username === username) ?? null;

const getSlotPersona = (username: string) =>
  getBotSlot(username) ? getBotPersonaByUsername(username) : null;

const getSlotColor = (index: number, username?: string) => {
  if (username) {
    const persona = getSlotPersona(username);
    if (persona) {
      return persona.bgColor;
    }
  }
  return SLOT_COLORS[index % SLOT_COLORS.length];
};

const getBotLabel = (difficulty: BotDifficulty) =>
  `BOT · ${BOT_DIFFICULTY_LABELS[difficulty] ?? "MED"}`;

const getBotPillClass = (difficulty: BotDifficulty) =>
  `bot-badge--${difficulty.toLowerCase()}`;

const handleAddBot = () => {
  if (!isPending.value || !isCreator.value || !hasOpenSlots.value) return;
  emit("addBot", {
    roomId: props.gameId,
    difficulty: selectedDifficulty.value,
  });
};

const handleRemoveBot = (botUsername: string) => {
  if (!isPending.value || !isCreator.value) return;
  emit("removeBot", {
    roomId: props.gameId,
    botUsername,
  });
};
</script>

<template>
  <article class="room-card" :class="{ 'room-card--live': isStarted }">
    <div class="room-card__top">
      <div class="room-card__heading">
        <span class="room-card__tag">ROOM</span>
        <h3 class="room-card__id">#{{ props.gameId }}</h3>
      </div>

      <div class="room-card__meta">
        <RetroBadge v-if="isStarted" variant="positive">
          <span class="live-dot" />
          LIVE
        </RetroBadge>
        <RetroBadge variant="primary">
          {{ props.players.length }} / {{ props.maxPlayers }} SEATS
        </RetroBadge>
        <BaseButton
          v-if="isStarted"
          variant="secondary"
          size="sm"
          @click="$emit('spectateGame', props.gameId)"
        >
          <GameIcon name="bolt" :size="15" />
          <span>SPECTATE</span>
        </BaseButton>
      </div>
    </div>

    <div class="players-grid">
      <div
        v-for="slotIndex in props.maxPlayers"
        :key="slotIndex"
        class="player-slot"
      >
        <template v-if="props.players[slotIndex - 1]">
          <div class="slot-avatar-wrap">
            <div
              class="slot-avatar"
              :style="{
                backgroundColor: getSlotColor(
                  slotIndex - 1,
                  props.players[slotIndex - 1]
                ),
              }"
              :title="
                getSlotPersona(props.players[slotIndex - 1])
                  ? `${props.players[slotIndex - 1]} · ${getSlotPersona(props.players[slotIndex - 1])!.title}`
                  : props.players[slotIndex - 1]
              "
            >
              <img
                v-if="getSlotPersona(props.players[slotIndex - 1])?.avatarUrl"
                :src="getSlotPersona(props.players[slotIndex - 1])!.avatarUrl"
                :alt="props.players[slotIndex - 1]"
                class="slot-avatar__img"
              />
              <template v-else>
                {{ getPlayerInitials(props.players[slotIndex - 1]) }}
              </template>
            </div>

            <button
              v-if="
                isPending &&
                isCreator &&
                getBotSlot(props.players[slotIndex - 1])
              "
              type="button"
              class="slot-remove-btn"
              :aria-label="`Remove bot ${props.players[slotIndex - 1]}`"
              :title="`Remove ${props.players[slotIndex - 1]}`"
              @click="handleRemoveBot(props.players[slotIndex - 1])"
            >
              <GameIcon name="close" :size="12" />
            </button>
          </div>

          <p
            class="slot-name"
            :title="
              getSlotPersona(props.players[slotIndex - 1])
                ? `${props.players[slotIndex - 1]} — ${getSlotPersona(props.players[slotIndex - 1])!.title}`
                : props.players[slotIndex - 1]
            "
          >
            {{ props.players[slotIndex - 1] }}
          </p>

          <span
            v-if="getBotSlot(props.players[slotIndex - 1])"
            class="bot-badge"
            :class="
              getBotPillClass(
                getBotSlot(props.players[slotIndex - 1])!.difficulty
              )
            "
          >
            {{
              getBotLabel(getBotSlot(props.players[slotIndex - 1])!.difficulty)
            }}
          </span>
        </template>

        <template v-else-if="isPending">
          <template v-if="isCreator">
            <button
              type="button"
              class="slot-join-btn slot-join-btn--bot"
              :aria-label="`Add ${BOT_DIFFICULTY_LABELS[selectedDifficulty]} bot to room ${props.gameId}`"
              @click="handleAddBot"
            >
              <GameIcon name="plus" :size="24" />
            </button>
            <p class="slot-name slot-name--open">+ BOT</p>
          </template>

          <template v-else-if="!isCurrentUserInRoom">
            <button
              type="button"
              class="slot-join-btn"
              :aria-label="`Join room ${props.gameId}`"
              @click="$emit('joinGame', props.gameId)"
            >
              <GameIcon name="plus" :size="26" />
            </button>
            <p class="slot-name slot-name--open">JOIN SLOT</p>
          </template>

          <template v-else>
            <div class="slot-waiting">
              <GameIcon name="clock" :size="22" />
            </div>
            <p class="slot-name slot-name--waiting">OPEN SEAT</p>
          </template>
        </template>
      </div>
    </div>

    <div
      v-if="isPending && isCreator && hasOpenSlots"
      class="room-card__bot-bar"
    >
      <span class="bot-bar__label">FILL OPEN SEAT WITH BOT:</span>

      <div class="bot-bar__controls">
        <div class="diff-group" role="group" aria-label="Bot difficulty">
          <button
            v-for="diff in BOT_DIFFICULTIES"
            :key="diff"
            type="button"
            class="diff-btn"
            :class="[
              `diff-btn--${diff.toLowerCase()}`,
              { 'is-active': selectedDifficulty === diff },
            ]"
            @click="selectedDifficulty = diff"
          >
            {{ BOT_DIFFICULTY_LABELS[diff] }}
          </button>
        </div>

        <BaseButton variant="secondary" size="sm" @click="handleAddBot">
          <GameIcon name="plus" :size="14" />
          <span>ADD BOT</span>
        </BaseButton>
      </div>
    </div>
  </article>
</template>

<style lang="scss" scoped>
.room-card {
  background: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-md);
  box-shadow: var(--card-shadow);
  padding: 16px 18px;

  &--live {
    border-color: var(--outline);
  }
}

.room-card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 2px solid var(--surface-alt);
}

.room-card__heading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.room-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--gold-light);
  border: 1px solid var(--outline);
}

.room-card__tag {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--gold-light);
  border: 1.5px solid var(--outline);
  color: var(--ink);
}

.room-card__id {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.players-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.player-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 90px;
}

.slot-avatar-wrap {
  position: relative;
}

.slot-avatar {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  border: 2.5px solid var(--outline);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.3),
    0 4px 0 var(--outline);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.03em;
  overflow: hidden;
}

.slot-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.slot-remove-btn {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 2px solid var(--outline);
  background: var(--danger);
  color: #ffffff;
  box-shadow: 0 2px 0 var(--outline);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease;

  &:hover {
    filter: brightness(1.08);
  }

  &:active {
    transform: translateY(2px);
    box-shadow: 0 0 0 var(--outline);
  }
}

.slot-join-btn {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  border: 2.5px solid var(--outline);
  background: var(--gold-light);
  color: var(--ink);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.55),
    0 4px 0 var(--gold-dark),
    0 6px 0 var(--outline);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease, background-color 0.08s ease;

  &:hover {
    background: var(--gold);
  }

  &:active {
    transform: translateY(4px);
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.3),
      0 0 0 var(--gold-dark),
      0 2px 0 var(--outline);
  }

  &--bot {
    background: var(--surface-alt);
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.6),
      0 4px 0 var(--outline);

    &:hover {
      background: var(--gold-light);
    }

    &:active {
      box-shadow: 0 1px 0 var(--outline);
    }
  }
}

.slot-waiting {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  border: 2px dashed var(--rule-muted);
  background: var(--surface-alt);
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.slot-name {
  width: 100%;
  text-align: center;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slot-name--open {
  color: var(--accent);
  letter-spacing: 0.04em;
}

.slot-name--waiting {
  color: var(--ink-muted);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.bot-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 1.5px solid var(--outline);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.03em;
  line-height: 1.1;
  white-space: nowrap;

  &--easy {
    background: var(--positive);
    color: #ffffff;
  }

  &--medium {
    background: var(--gold);
    color: var(--ink);
  }

  &--hard {
    background: var(--danger);
    color: #ffffff;
  }
}

.room-card__bot-bar {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 2px dashed var(--rule-muted);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.bot-bar__label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}

.bot-bar__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.diff-group {
  display: inline-flex;
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface-alt);
}

.diff-btn {
  appearance: none;
  border: none;
  border-right: 1.5px solid var(--outline);
  padding: 6px 9px;
  background: transparent;
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background-color 0.08s ease, color 0.08s ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: var(--surface);
    color: var(--ink);
  }

  &.is-active.diff-btn--easy {
    background: var(--positive);
    color: #ffffff;
  }

  &.is-active.diff-btn--medium {
    background: var(--gold);
    color: var(--ink);
  }

  &.is-active.diff-btn--hard {
    background: var(--danger);
    color: #ffffff;
  }
}
</style>