<script setup lang="ts">
import type { PropType } from "vue";
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
});

defineEmits(["joinGame"]);

const getSlotColor = (index: number) =>
  SLOT_COLORS[index % SLOT_COLORS.length];
</script>

<template>
  <article class="room-card">
    <div class="room-card__top">
      <div class="room-card__heading">
        <span class="room-card__tag">ROOM</span>
        <h3 class="room-card__id">#{{ props.gameId }}</h3>
      </div>
      <RetroBadge variant="primary">
        {{ props.players.length }} / {{ props.maxPlayers }} SEATS
      </RetroBadge>
    </div>

    <div class="players-grid">
      <div
        v-for="slotIndex in props.maxPlayers"
        :key="slotIndex"
        class="player-slot"
      >
        <template v-if="props.players[slotIndex - 1]">
          <div
            class="slot-avatar"
            :style="{ backgroundColor: getSlotColor(slotIndex - 1) }"
          >
            {{ getPlayerInitials(props.players[slotIndex - 1]) }}
          </div>
          <p class="slot-name" :title="props.players[slotIndex - 1]">
            {{ props.players[slotIndex - 1] }}
          </p>
        </template>

        <template v-else>
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
}

.room-card__top {
  display: flex;
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
  gap: 8px;
  width: 84px;
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
</style>