<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type PropType,
} from "vue";
import { useResizeObserver } from "@vueuse/core";
import type { GameState, Player, Tile } from "~/types";
import {
  SLOT_REFLOW_DURATION_MS,
  usePlayerMovementAnimation,
  type MeasuredTileRect,
} from "~/composables/usePlayerMovementAnimation";
import { getCoLocatedTokenOffset } from "~/utils/playerMovement";
import { getBotAvatarUrl } from "~/shared/constants/botNames";
import {
  getCartridgePlayerColor,
  getPlayerInitials,
} from "~/utils/cartridgeTheme";

const props = defineProps({
  tiles: {
    type: Array as PropType<Tile[]>,
    required: true,
  },
  gameState: {
    type: Object as PropType<GameState>,
    required: true,
  },
  showTileInfo: {
    type: Function,
    required: true,
  },
  players: {
    type: Array as PropType<Player[]>,
    required: true,
  },
  player: {
    type: Object as PropType<Player>,
    required: true,
  },
  selectedTileId: {
    type: Number as PropType<number | null>,
    default: null,
  },
});

const emit = defineEmits(["activateTrade", "animationStateChange"]);

const boardRef = ref<HTMLElement | null>(null);
const logRef = ref<HTMLElement | null>(null);
const tileRects = ref<Record<number, MeasuredTileRect>>({});
const isSuppressingLayoutTransition = ref(false);
let layoutSuppressRafId: number | null = null;

const { displayedPositions, activePose, isAnimating, isReducedMotion } =
  usePlayerMovementAnimation(
    () => props.gameState,
    () => tileRects.value
  );

const isDiceSpinning = ref(false);

const handleRollAnimationChange = (active: boolean) => {
  isDiceSpinning.value = active;
};

watch(
  [isAnimating, isDiceSpinning],
  ([moving, spinning]) => {
    emit("animationStateChange", moving || spinning);
  },
  { immediate: true }
);

const measureTilePositions = () => {
  const boardEl = boardRef.value;
  if (!boardEl) return;

  const boardRect = boardEl.getBoundingClientRect();
  if (boardRect.width === 0 || boardRect.height === 0) return;

  const measured: Record<number, MeasuredTileRect> = {};
  const tileEls = boardEl.querySelectorAll<HTMLElement>("[data-tile-id]");

  tileEls.forEach((el) => {
    const tileId = Number(el.dataset.tileId);
    if (!Number.isFinite(tileId)) return;
    const rect = el.getBoundingClientRect();
    measured[tileId] = {
      cx: rect.left - boardRect.left + rect.width / 2,
      cy: rect.top - boardRect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  });

  isSuppressingLayoutTransition.value = true;
  if (layoutSuppressRafId !== null) {
    cancelAnimationFrame(layoutSuppressRafId);
  }
  layoutSuppressRafId = requestAnimationFrame(() => {
    isSuppressingLayoutTransition.value = false;
    layoutSuppressRafId = null;
  });

  tileRects.value = measured;
};

useResizeObserver(boardRef, measureTilePositions);

onMounted(async () => {
  await nextTick();
  measureTilePositions();
  window.addEventListener("resize", measureTilePositions);
});

onUnmounted(() => {
  window.removeEventListener("resize", measureTilePositions);
  if (layoutSuppressRafId !== null) {
    cancelAnimationFrame(layoutSuppressRafId);
  }
});

watch(
  () => props.tiles.length,
  async (len) => {
    if (len > 0) {
      await nextTick();
      measureTilePositions();
    }
  }
);

watch(
  () => props.gameState?.gameLog?.length,
  async () => {
    await nextTick();
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight;
    }
  }
);

interface RenderedToken {
  player: Player;
  x: number;
  y: number;
  transitionDurationMs: number;
  transitionEasing: string;
  isMoving: boolean;
  lift: number;
}

const activePlayers = computed<Player[]>(() => props.gameState?.players ?? []);

const renderedTokens = computed<RenderedToken[]>(() => {
  const playersList = activePlayers.value;
  const pose = activePose.value;
  const groupedByTile = new Map<number, string[]>();

  for (const player of playersList) {
    const tileId = displayedPositions.value[player.username] ?? player.position;
    const group = groupedByTile.get(tileId) ?? [];
    group.push(player.username);
    groupedByTile.set(tileId, group);
  }

  const reflowDurationMs =
    isSuppressingLayoutTransition.value || isReducedMotion.value
      ? 0
      : SLOT_REFLOW_DURATION_MS;

  const tokens: RenderedToken[] = [];
  for (const player of playersList) {
    if (pose && pose.username === player.username) {
      tokens.push({
        player,
        x: pose.x,
        y: pose.y,
        transitionDurationMs: 0,
        transitionEasing: "linear",
        isMoving: true,
        lift: pose.lift,
      });
      continue;
    }

    const tileId = displayedPositions.value[player.username] ?? player.position;
    const rect = tileRects.value[tileId];
    if (!rect) continue;

    const group = groupedByTile.get(tileId) ?? [player.username];
    const offset = getCoLocatedTokenOffset(
      group.indexOf(player.username),
      group.length,
      rect.width,
      rect.height
    );

    tokens.push({
      player,
      x: rect.cx + offset.dx,
      y: rect.cy + offset.dy,
      transitionDurationMs: reflowDurationMs,
      transitionEasing: "cubic-bezier(0.22, 1, 0.36, 1)",
      isMoving: false,
      lift: 0,
    });
  }

  return tokens;
});

const getLogActorColor = (username: string) => {
  const found = activePlayers.value.find((p) => p.username === username);
  return found ? getCartridgePlayerColor(found.color) : "#2667E8";
};

const roomLabel = computed(() =>
  props.gameState?.associatedRoomId
    ? `ROOM #${props.gameState.associatedRoomId.slice(0, 6).toUpperCase()}`
    : "MONOPOLY UA"
);

const latestLogEntry = computed(() => {
  const entries = props.gameState?.gameLog;
  if (!entries || !entries.length) return null;
  return entries[entries.length - 1];
});
</script>

<template>
  <div class="main-container">
    <div class="table">
      <!-- Left Rail: Squad / Players -->
      <aside class="rail rail--players">
        <div class="rail-panel">
          <div class="rail-head">
            <div class="rail-head__title">
              <GameIcon name="user" :size="15" />
              <span>PLAYERS</span>
            </div>
            <span class="rail-head__meta">{{ gameState.players.length }} ACTIVE</span>
          </div>

          <div class="players-container">
            <PlayerContainer
              v-for="playerFromPlayers in gameState.players"
              :key="playerFromPlayers.username"
              :player="player"
              :playerFromPlayers="playerFromPlayers"
              :currentTurn="gameState.currentTurn"
              :tiles="tiles"
              @activateTrade="$emit('activateTrade', playerFromPlayers.username)"
            />
          </div>
        </div>
      </aside>

      <!-- Center: Dead-Center Gold-Framed 16-Bit Cartridge Board -->
      <div v-if="tiles && tiles.length" class="board-chassis">
        <div ref="boardRef" class="board">
          <!-- Center Arena -->
          <div class="center">
            <div class="center-inner-frame" />

            <div class="center-top">
              <span class="center-room-pill">{{ roomLabel }}</span>
              <div class="turn-stamp">
                <span class="turn-led" />
                <span>{{ gameState.currentTurn }}</span>
              </div>
            </div>

            <div class="center-crest">
              <div class="crest-card">
                <div class="crest-flag">
                  <img src="/assets/ukr-flag.png" alt="Ukraine" />
                </div>
                <h1 class="center-title">MONOPOLY UA</h1>
                <div class="crest-divider" />
                <span class="crest-players">
                  {{ gameState.players.length }} PLAYERS
                </span>
              </div>
            </div>

            <div class="center-ticker">
              <template v-if="latestLogEntry">
                <span
                  class="log-tag"
                  :class="{
                    'log-tag--avatar': Boolean(
                      getBotAvatarUrl(latestLogEntry.username)
                    ),
                  }"
                  :style="{
                    backgroundColor: getLogActorColor(latestLogEntry.username),
                  }"
                >
                  <img
                    v-if="getBotAvatarUrl(latestLogEntry.username)"
                    :src="getBotAvatarUrl(latestLogEntry.username)!"
                    :alt="latestLogEntry.username"
                    class="log-tag__img"
                  />
                  <template v-else>
                    {{ getPlayerInitials(latestLogEntry.username) }}
                  </template>
                </span>
                <span class="ticker-text">
                  <strong>{{ latestLogEntry.username }}</strong>
                  {{ latestLogEntry.msg }}
                </span>
              </template>
              <span v-else class="ticker-hint">
                Roll the dice to begin the match.
              </span>
            </div>

            <DiceSpinStage
              :lastRoll="gameState.lastRoll"
              :players="gameState.players"
              @rollAnimationChange="handleRollAnimationChange"
            />
          </div>

          <!-- All 40 Board Tiles -->
          <BoardTile
            v-for="tile in tiles"
            :key="tile.id"
            :tile="tile"
            :players="gameState.players"
            :tileGroups="gameState.board?.groups"
            :isSelected="selectedTileId === tile.id"
            @show-tile-info="(e: Event, t: Tile) => showTileInfo(e, t)"
          />

          <!-- Persistent Animated Player Tokens Overlay -->
          <div class="player-tokens-layer">
            <PlayerBase
              v-for="token in renderedTokens"
              :key="token.player.username"
              :player="token.player"
              :x="token.x"
              :y="token.y"
              :transition-duration-ms="token.transitionDurationMs"
              :transition-easing="token.transitionEasing"
              :is-moving="token.isMoving"
              :lift="token.lift"
              :is-active-turn="gameState.currentTurn === token.player.username"
            />
          </div>
        </div>
      </div>

      <!-- Right Rail: Full-Height Match Log -->
      <aside class="rail rail--log">
        <div class="rail-panel rail-panel--full">
          <div class="rail-head rail-head--accent">
            <div class="rail-head__title">
              <GameIcon name="dice" :size="15" />
              <span>MATCH LOG</span>
            </div>
            <span class="live-pill">
              <span class="live-dot" />
              LIVE
            </span>
          </div>

          <div ref="logRef" class="log-rows">
            <template v-if="gameState.gameLog && gameState.gameLog.length">
              <div
                v-for="(entry, index) in gameState.gameLog"
                :key="index"
                class="log-row"
              >
                <span
                  class="log-tag"
                  :class="{
                    'log-tag--avatar': Boolean(getBotAvatarUrl(entry.username)),
                  }"
                  :style="{
                    backgroundColor: getLogActorColor(entry.username),
                  }"
                >
                  <img
                    v-if="getBotAvatarUrl(entry.username)"
                    :src="getBotAvatarUrl(entry.username)!"
                    :alt="entry.username"
                    class="log-tag__img"
                  />
                  <template v-else>
                    {{ getPlayerInitials(entry.username) }}
                  </template>
                </span>
                <span class="log-msg">
                  <strong>{{ entry.username }}</strong> {{ entry.msg }}
                </span>
              </div>
            </template>
            <div v-else class="log-empty">
              Roll the dice to begin the match.
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.main-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  padding: 14px 20px;
}

.table {
  display: grid;
  grid-template-columns:
    clamp(220px, 18.5vw, 276px)
    auto
    clamp(220px, 18.5vw, 276px);
  align-items: stretch;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 1480px;
}

.rail {
  height: 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.rail-panel {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  background: var(--surface);
  border: var(--panel-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--panel-shadow);
  overflow: hidden;

  &--full {
    height: 100%;
  }
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface-alt);
  border-bottom: 2px solid var(--outline);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--ink);
  flex-shrink: 0;

  &--accent {
    background: var(--accent);
    color: #ffffff;
  }
}

.rail-head__title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.rail-head__meta {
  font-size: 10px;
  color: var(--ink-muted);
}

.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  background: rgba(255, 255, 255, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  border-radius: 4px;
  font-size: 9.5px;
  color: #ffffff;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--gold-light);
  border: 1px solid var(--outline);
}

.players-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overflow-y: auto;
  background: var(--surface-alt);
  scrollbar-width: thin;
  scrollbar-color: var(--accent) transparent;
}

.board-chassis {
  background: var(--gold);
  border: 3px solid var(--outline);
  border-radius: var(--radius-board);
  padding: 9px;
  box-shadow: 0 8px 0 var(--outline);
  flex-shrink: 0;
  align-self: center;
}

.board {
  position: relative;
  display: grid;
  grid-template-columns: 1.48fr repeat(9, 1fr) 1.48fr;
  grid-template-rows: 1.48fr repeat(9, 1fr) 1.48fr;
  gap: 2px;
  aspect-ratio: 1 / 1;
  width: min(calc(100vh - 52px), calc(100vw - 530px), 840px);
  background: var(--outline);
  border: 2px solid var(--outline);
  border-radius: 6px;
  overflow: hidden;
}

.player-tokens-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}

.center {
  position: relative;
  grid-column: 2 / 11;
  grid-row: 2 / 11;
  background-color: #f2f7ff;
  background-image:
    linear-gradient(90deg, rgba(38, 103, 232, 0.065) 1px, transparent 1px),
    linear-gradient(rgba(38, 103, 232, 0.065) 1px, transparent 1px);
  background-size: 16px 16px;
  padding: clamp(14px, 2.2vmin, 22px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  overflow: hidden;
}

.center-inner-frame {
  position: absolute;
  inset: 8px;
  border: 2px solid var(--accent);
  pointer-events: none;
}

.center-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.center-room-pill {
  padding: 5px 9px;
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  box-shadow: 2px 2px 0 var(--outline);
  font-family: var(--font-mono);
  font-size: clamp(9px, 1.05vmin, 11px);
  font-weight: 800;
  color: var(--ink);
  letter-spacing: 0.05em;
}

.turn-stamp {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  background: var(--positive);
  color: #ffffff;
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  box-shadow: 3px 3px 0 var(--outline);
  font-family: var(--font-mono);
  font-size: clamp(9.5px, 1.15vmin, 11.5px);
  font-weight: 800;
  text-transform: uppercase;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.turn-led {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--gold-light);
  border: 1.5px solid var(--outline);
  flex-shrink: 0;
}

.center-crest {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crest-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: clamp(16px, 2.8vmin, 26px) clamp(20px, 3.6vmin, 34px);
  background: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: 5px 5px 0 var(--outline);
  text-align: center;
}

.crest-flag {
  width: clamp(36px, 4.8vmin, 48px);
  height: clamp(36px, 4.8vmin, 48px);
  padding: 5px;
  background: var(--gold-light);
  border: 2px solid var(--outline);
  border-radius: 6px;
  box-shadow: 0 3px 0 var(--outline);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
}

.center-title {
  font-family: var(--font-display);
  font-size: clamp(22px, 3.6vmin, 36px);
  line-height: 0.95;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ink);
  text-shadow: 3px 3px 0 var(--gold);
}

.crest-divider {
  width: 100%;
  height: 2px;
  background: var(--surface-alt);
  border-top: 1.5px dashed var(--rule-muted);
}

.crest-players {
  font-family: var(--font-mono);
  font-size: clamp(9.5px, 1.1vmin, 11px);
  font-weight: 700;
  color: var(--ink-muted);
}

.center-ticker {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
  box-shadow: 3px 3px 0 var(--outline);
  min-height: 36px;
}

.ticker-text {
  font-size: clamp(11px, 1.25vmin, 12.5px);
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ticker-hint {
  width: 100%;
  text-align: center;
  font-family: var(--font-mono);
  font-size: clamp(9.5px, 1.1vmin, 11px);
  font-weight: 700;
  color: var(--ink-muted);
}

.log-rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  scrollbar-width: thin;
  scrollbar-color: var(--accent) transparent;
}

.log-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 11px;
  border-bottom: 1px solid var(--rule-muted);
  font-size: 12px;
  line-height: 1.38;
  color: var(--ink);

  &:last-child {
    border-bottom: none;
  }
}

.log-tag {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 800;
  padding: 2px 5px;
  color: #ffffff;
  border: 1.5px solid var(--outline);
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 1px;

  &--avatar {
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 4px;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 0;
  }
}

.log-tag__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.log-msg {
  min-width: 0;
  word-break: break-word;
}

.log-empty {
  padding: 22px 14px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-muted);
}

@media (max-width: 1120px) {
  .main-container {
    align-items: flex-start;
    padding: 16px;
  }

  .table {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "board board"
      "players log";
    gap: 16px;
    max-width: 820px;
  }

  .board-chassis {
    grid-area: board;
    justify-self: center;
  }

  .board {
    width: min(92vw, 760px);
  }

  .rail {
    height: auto;
    min-height: 0;
  }

  .rail--players {
    grid-area: players;
  }

  .rail--log {
    grid-area: log;
    max-height: 360px;
  }
}

@media (max-width: 680px) {
  .table {
    grid-template-columns: 1fr;
    grid-template-areas:
      "board"
      "players"
      "log";
  }

  .players-container {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
