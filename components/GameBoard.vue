<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch, type PropType } from "vue";
  import { useResizeObserver } from "@vueuse/core";
  import type { GameState, Player, Tile } from "~/types";
  import {
    SLOT_REFLOW_DURATION_MS,
    usePlayerMovementAnimation,
    type MeasuredTileRect,
  } from "~/composables/usePlayerMovementAnimation";
  import { getCoLocatedTokenOffset } from "~/utils/playerMovement";

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
      type: Array,
      required: true,
    },
    player: {
      type: Object,
      required: true,
    },
  });

  const emit = defineEmits(["activateTrade", "animationStateChange"]);

  const boardRef = ref<HTMLElement | null>(null);
  const tileRects = ref<Record<number, MeasuredTileRect>>({});
  const isSuppressingLayoutTransition = ref(false);
  let layoutSuppressRafId: number | null = null;

  const {
    displayedPositions,
    activePose,
    movingUsername,
    isAnimating,
    isReducedMotion,
  } = usePlayerMovementAnimation(
    () => props.gameState,
    () => tileRects.value
  );

  watch(
    isAnimating,
    (animating) => {
      emit("animationStateChange", animating);
    },
    { immediate: true }
  );

  const measureTilePositions = (suppressTransition = false) => {
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

    if (suppressTransition) {
      isSuppressingLayoutTransition.value = true;
      if (layoutSuppressRafId !== null) {
        cancelAnimationFrame(layoutSuppressRafId);
      }
      layoutSuppressRafId = requestAnimationFrame(() => {
        isSuppressingLayoutTransition.value = false;
        layoutSuppressRafId = null;
      });
    }

    tileRects.value = measured;
  };

  useResizeObserver(boardRef, () => {
    measureTilePositions(true);
  });

  const handleWindowResize = () => {
    measureTilePositions(true);
  };

  onMounted(async () => {
    await nextTick();
    measureTilePositions(true);
    window.addEventListener("resize", handleWindowResize);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", handleWindowResize);
    if (layoutSuppressRafId !== null) {
      cancelAnimationFrame(layoutSuppressRafId);
    }
  });

  watch(
    () => props.tiles.length,
    async (len) => {
      if (len > 0) {
        await nextTick();
        measureTilePositions(true);
      }
    }
  );

  const activePlayers = computed<Player[]>(() => props.gameState?.players ?? []);

  const renderedTokens = computed(() => {
    const playersList = activePlayers.value;
    const pose = activePose.value;
    const groupedByTile = new Map<number, string[]>();

    for (const p of playersList) {
      const tileId = displayedPositions.value[p.username] ?? p.position;
      const group = groupedByTile.get(tileId) ?? [];
      group.push(p.username);
      groupedByTile.set(tileId, group);
    }

    return playersList
      .map((p) => {
        if (pose && pose.username === p.username) {
          return {
            player: p,
            x: pose.x,
            y: pose.y,
            transitionDurationMs: 0,
            transitionEasing: "linear",
            isMoving: true,
            moveMode: pose.mode,
            lift: pose.lift,
          };
        }

        const tileId = displayedPositions.value[p.username] ?? p.position;
        const rect = tileRects.value[tileId];
        if (!rect) return null;

        const group = groupedByTile.get(tileId) ?? [p.username];
        const slotIndex = group.indexOf(p.username);
        const offset = getCoLocatedTokenOffset(
          slotIndex,
          group.length,
          rect.width,
          rect.height
        );

        return {
          player: p,
          x: rect.cx + offset.dx,
          y: rect.cy + offset.dy,
          transitionDurationMs:
            isSuppressingLayoutTransition.value || isReducedMotion.value
              ? 0
              : SLOT_REFLOW_DURATION_MS,
          transitionEasing: "cubic-bezier(0.22, 1, 0.36, 1)",
          isMoving: movingUsername.value === p.username,
          moveMode: "idle" as const,
          lift: 0,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  });
</script>

<template>
  <div class="main-container">
    <div class="table">
      <div class="players-container">
        <PlayerContainer
          v-for="playerFromPlayers in gameState.players"
          :key="playerFromPlayers.username"
          :player="player"
          :playerFromPlayers="playerFromPlayers"
          @activateTrade="$emit('activateTrade', playerFromPlayers.username)"
        />
      </div>

      <div
        v-if="tiles && tiles.length"
        ref="boardRef"
        class="board"
      >
        <div class="center">
          <div>
            <div
              v-if="gameState.gameLog && gameState?.gameLog.length"
              class="gameLog"
            >
              <p v-for="entry in gameState?.gameLog">
                {{ entry.username }}: {{ entry.msg }}
              </p>
            </div>
          </div>
        </div>
        <!-- Go Tile -->
        <BoardTile
          :tile="tiles[0]"
          :players="gameState.players"
        />
        <!-- Top Row -->
        <div class="row horizontal-row top-row">
          <BoardTile
            v-for="tile in tiles.slice(1, 10)"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.board.groups[0],
              gameState.board.groups[1],
            ]"
          />
        </div>
        <!-- Jail Tile -->
        <BoardTile
          :tile="tiles[10]"
          :type="tiles[10].type"
          :players="gameState.players"
        />
        <!-- Right Row -->
        <div class="row vertical-row right-row">
          <BoardTile
            v-for="tile in tiles.slice(11, 20)"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.board.groups[2],
              gameState.board.groups[3],
            ]"
          />
        </div>
        <!-- Free Parking Tile -->
        <BoardTile
          :tile="tiles[20]"
          :players="gameState.players"
        />
        <!-- Bottom Row -->
        <div class="row horizontal-row bottom-row">
          <BoardTile
            v-for="tile in tiles.slice(21, 30).reverse()"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.board.groups[4],
              gameState.board.groups[5],
            ]"
          />
        </div>
        <!-- Go to Jail Tile -->
        <BoardTile
          :tile="tiles[30]"
          :players="gameState.players"
        />
        <!-- Left Row -->
        <div class="row vertical-row left-row">
          <BoardTile
            v-for="tile in tiles.slice(31, 40).reverse()"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.board.groups[6],
              gameState.board.groups[7],
            ]"
          />
        </div>

        <!-- Persistent Player Tokens Overlay -->
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
            :move-mode="token.moveMode"
            :lift="token.lift"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  $tile-size: 7vmin;
  $corner-tile-size: 14vmin;

  $tile-size-l: 6vmin;
  $corner-tile-size-l: 12vmin;

  .gameLog {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .main-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    aspect-ratio: 4/3;
  }

  .table {
    display: flex;
    flex-direction: row;
    place-items: center;
    height: 100vh;
    gap: 4vmin;
    margin-right: 10vmin;

    .players-container {
      padding: 3.5vmin 0 3.5vmin 0;
      display: flex;
      flex-direction: column;
      width: 15vmin;
      height: 100%;
      gap: 2vmin;
      justify-content: center;
    }
  }

  .board {
    position: relative;
    display: grid;
    grid-template-columns: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for columns
    grid-template-rows: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for rows
    grid-gap: 2px;
    max-height: 95vmin;
    width: fit-content;
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
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(7, 1fr);
    justify-items: center;
    align-items: center;
  }

  // =================
  // Rows and Spaces
  // =================

  .row {
    display: grid;
    grid-gap: 2px;
  }

  .horizontal-row {
    grid-template-columns: repeat(
      9,
      $tile-size
    ); // Adjust column size based on viewport width
    grid-template-rows: calc($corner-tile-size);
  }

  .vertical-row {
    grid-template-columns: $corner-tile-size;
    grid-template-rows: repeat(
      9,
      $tile-size
    ); // Adjust row size based on viewport width

    .container {
      top: 50%;
      left: 50%;
    }
  }

  // Specific space styles for different rows
  .bottom-row {
    grid-column: 2 / 11;
    grid-row: 11;
  }

  .left-row {
    grid-column: 1;
    grid-row: 2 / 11;

    .container {
      transform: translate(-50%, -50%) rotate(90deg);
    }
  }

  .top-row {
    grid-column: 2 / 11;
    grid-row: 1;

    .container {
      transform: rotate(0deg);
    }
  }

  .right-row {
    grid-column: 11;
    grid-row: 2 / 11;

    .container {
      transform: translate(-50%, -50%) rotate(-90deg);
    }
  }

  .gameLog {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(126, 126, 126, 0.1);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: scroll;
    scrollbar-width: thin;
    scrollbar-color: #ccc transparent;
    border-radius: 2rem;
  }

  @media (max-width: 890px) {
    .board {
      display: grid;
      grid-template-columns: $corner-tile-size-l repeat(9, $tile-size-l) $corner-tile-size-l; // Use viewport width units for columns
      grid-template-rows: $corner-tile-size-l repeat(9, $tile-size-l) $corner-tile-size-l; // Use viewport width units for rows
      grid-gap: 2px;
      max-height: 95vmin;
      width: fit-content;
    }

    .horizontal-row {
      grid-template-columns: repeat(
        9,
        $tile-size-l
      ); // Adjust column size based on viewport width
      grid-template-rows: calc($corner-tile-size-l);
    }

    .vertical-row {
      grid-template-columns: $corner-tile-size-l;
      grid-template-rows: repeat(
        9,
        $tile-size-l
      ); // Adjust row size based on viewport width

      .container {
        top: 50%;
        left: 50%;
      }
    }

    .players-container {
      width: 10vmin;
    }
  }
</style>
