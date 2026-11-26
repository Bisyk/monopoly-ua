import {
  computed,
  onScopeDispose,
  ref,
  watch,
  type Ref,
} from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import type { GameState, MoveMode, MoveSegment, Player, PlayerMoveEvent } from "~/types";
import {
  buildStepPath,
  computeStepSegmentDurationMs,
  DEFAULT_BOARD_SIZE,
  DEFAULT_SEGMENT_PAUSE_MS,
  easeSmoothMove,
  getCoLocatedTokenOffset,
  samplePolylineAtProgress,
  smoothPolylinePoints,
  type Point2D,
} from "~/utils/playerMovement";

export interface MeasuredTileRect {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface AnimatedTokenPose {
  username: string;
  x: number;
  y: number;
  lift: number;
  mode: MoveMode | "idle";
}

export const DIRECT_DURATION_MS = 520;
export const SLOT_REFLOW_DURATION_MS = 260;
export const ANIMATION_WATCHDOG_MS = 5500;

interface PreparedSegment {
  mode: MoveMode;
  tileIds: number[];
  durationMs: number;
  pauseBeforeMs: number;
  isFirst: boolean;
  isLast: boolean;
}

export function usePlayerMovementAnimation(
  getGameState: () => GameState | undefined,
  getTileRects: () => Record<number, MeasuredTileRect>
) {
  const displayedPositions = ref<Record<string, number>>({});
  const activePose = ref<AnimatedTokenPose | null>(null);
  const movingUsername = ref<string | null>(null);
  const preferredReducedMotion = usePreferredReducedMotion();

  const isAnimating = computed(() => movingUsername.value !== null);

  let hasHydrated = false;
  let lastProcessedMoveId: string | null = null;
  let activeRunId = 0;
  let activeRunDeadline = 0;
  const activeTimers = new Set<ReturnType<typeof setTimeout>>();
  let activeRafId: number | null = null;

  const clearScheduledWork = () => {
    activeTimers.forEach((timer) => clearTimeout(timer));
    activeTimers.clear();
    if (activeRafId !== null) {
      cancelAnimationFrame(activeRafId);
      activeRafId = null;
    }
  };

  const scheduleTimeout = (cb: () => void, ms: number) => {
    const timer = setTimeout(() => {
      activeTimers.delete(timer);
      cb();
    }, ms);
    activeTimers.add(timer);
    return timer;
  };

  const computeSlotCoord = (
    username: string,
    tileId: number,
    players: Player[],
    positionsMap: Record<string, number>,
    rects: Record<number, MeasuredTileRect>
  ): Point2D | null => {
    const rect = rects[tileId];
    if (!rect) return null;

    const group = players
      .filter((p) => (positionsMap[p.username] ?? p.position) === tileId)
      .map((p) => p.username);

    const slotIndex = group.indexOf(username);
    if (slotIndex === -1) {
      return { x: rect.cx, y: rect.cy };
    }

    const offset = getCoLocatedTokenOffset(
      slotIndex,
      group.length,
      rect.width,
      rect.height
    );
    return { x: rect.cx + offset.dx, y: rect.cy + offset.dy };
  };

  const syncAllToAuthoritative = (players: Player[]) => {
    const nextPositions: Record<string, number> = {};
    for (const p of players) {
      nextPositions[p.username] = p.position;
    }
    displayedPositions.value = nextPositions;
    activePose.value = null;
    movingUsername.value = null;
    activeRunDeadline = 0;
  };

  const pruneEliminatedPlayers = (players: Player[]) => {
    const activeNames = new Set(players.map((p) => p.username));
    const currentPos = { ...displayedPositions.value };
    let changed = false;

    for (const name of Object.keys(currentPos)) {
      if (!activeNames.has(name)) {
        delete currentPos[name];
        changed = true;
      }
    }

    if (movingUsername.value && !activeNames.has(movingUsername.value)) {
      activeRunId += 1;
      clearScheduledWork();
      activePose.value = null;
      movingUsername.value = null;
      activeRunDeadline = 0;
    }

    if (changed) {
      displayedPositions.value = currentPos;
    }
  };

  const prepareSegments = (segments: MoveSegment[]): PreparedSegment[] => {
    const prepared: PreparedSegment[] = [];

    for (const segment of segments) {
      if (segment.mode === "step") {
        const steps = buildStepPath(segment.from, segment.to, DEFAULT_BOARD_SIZE);
        if (steps.length === 0) continue;
        prepared.push({
          mode: "step",
          tileIds: [segment.from, ...steps],
          durationMs: computeStepSegmentDurationMs(steps.length),
          pauseBeforeMs: prepared.length > 0 ? DEFAULT_SEGMENT_PAUSE_MS : 0,
          isFirst: prepared.length === 0,
          isLast: false,
        });
      } else if (segment.mode === "direct") {
        if (segment.from === segment.to) continue;
        prepared.push({
          mode: "direct",
          tileIds: [segment.from, segment.to],
          durationMs: DIRECT_DURATION_MS,
          pauseBeforeMs: prepared.length > 0 ? DEFAULT_SEGMENT_PAUSE_MS : 0,
          isFirst: prepared.length === 0,
          isLast: false,
        });
      }
    }

    if (prepared.length > 0) {
      prepared[prepared.length - 1].isLast = true;
    }

    return prepared;
  };

  const runSegments = (
    username: string,
    segments: MoveSegment[],
    authoritativePlayers: Player[]
  ) => {
    const prepared = prepareSegments(segments);
    if (prepared.length === 0) {
      syncAllToAuthoritative(authoritativePlayers);
      return;
    }

    if (preferredReducedMotion.value === "reduce") {
      syncAllToAuthoritative(authoritativePlayers);
      return;
    }

    const initialRects = getTileRects();
    const firstTileId = prepared[0].tileIds[0];
    if (!initialRects[firstTileId]) {
      syncAllToAuthoritative(authoritativePlayers);
      return;
    }

    // Snapshot takeoff position BEFORE updating displayedPositions so there is zero takeoff jump.
    const prevPositions = { ...displayedPositions.value };
    const startPointSnapshot =
      activePose.value?.username === username
        ? { x: activePose.value.x, y: activePose.value.y }
        : computeSlotCoord(
            username,
            firstTileId,
            authoritativePlayers,
            prevPositions,
            initialRects
          ) ?? { x: initialRects[firstTileId].cx, y: initialRects[firstTileId].cy };

    activeRunId += 1;
    const runId = activeRunId;
    clearScheduledWork();

    // Authoritative positions map (used to compute exact resting destination slot).
    const finalPositions: Record<string, number> = {};
    for (const p of authoritativePlayers) {
      finalPositions[p.username] = p.position;
    }

    // Update all stationary players (and destination tile) so co-located tokens gently make room.
    displayedPositions.value = finalPositions;
    movingUsername.value = username;
    activePose.value = {
      username,
      x: startPointSnapshot.x,
      y: startPointSnapshot.y,
      lift: 0,
      mode: prepared[0].mode,
    };

    const expectedTotalMs = prepared.reduce(
      (sum, seg) => sum + seg.pauseBeforeMs + seg.durationMs,
      0
    );
    activeRunDeadline = Date.now() + expectedTotalMs + 120;

    // Watchdog guarantees modals can never get stuck hidden.
    const watchdogMs = Math.max(ANIMATION_WATCHDOG_MS, expectedTotalMs + 1000);
    scheduleTimeout(() => {
      if (runId !== activeRunId) return;
      clearScheduledWork();
      const latestPlayers = getGameState()?.players ?? authoritativePlayers;
      syncAllToAuthoritative(latestPlayers);
    }, watchdogMs);

    const buildSegmentPolyline = (
      seg: PreparedSegment,
      rects: Record<number, MeasuredTileRect>,
      latestPlayers: Player[]
    ): Point2D[] | null => {
      const rawPoints: Point2D[] = [];

      for (let i = 0; i < seg.tileIds.length; i++) {
        const tileId = seg.tileIds[i];
        const rect = rects[tileId];
        if (!rect) return null;

        if (i === 0 && seg.isFirst) {
          // Use the exact takeoff slot if layout hasn't resized, else current tile center.
          const currentStart =
            rects === initialRects
              ? startPointSnapshot
              : { x: rect.cx, y: rect.cy };
          rawPoints.push(currentStart);
        } else if (i === seg.tileIds.length - 1 && seg.isLast) {
          const latestFinalMap: Record<string, number> = {};
          for (const p of latestPlayers) {
            latestFinalMap[p.username] = p.position;
          }
          const destCoord =
            computeSlotCoord(
              username,
              tileId,
              latestPlayers,
              latestFinalMap,
              rects
            ) ?? { x: rect.cx, y: rect.cy };
          rawPoints.push(destCoord);
        } else {
          rawPoints.push({ x: rect.cx, y: rect.cy });
        }
      }

      if (seg.mode === "step" && rawPoints.length >= 3) {
        return smoothPolylinePoints(rawPoints, 0.35, 8);
      }

      return rawPoints;
    };

    const playSegmentAt = (segIndex: number) => {
      if (runId !== activeRunId) return;

      if (segIndex >= prepared.length) {
        clearScheduledWork();
        const latestPlayers = getGameState()?.players ?? authoritativePlayers;
        syncAllToAuthoritative(latestPlayers);
        return;
      }

      const seg = prepared[segIndex];

      const startSegmentLoop = () => {
        if (runId !== activeRunId) return;

        let startTime: number | null = null;

        const tick = (now: number) => {
          if (runId !== activeRunId) return;

          if (startTime === null) {
            startTime = now;
          }

          const elapsed = now - startTime;
          const rawT = Math.max(0, Math.min(1, elapsed / seg.durationMs));
          const easedT = easeSmoothMove(rawT);

          const latestPlayers = getGameState()?.players ?? authoritativePlayers;
          const rects = getTileRects();
          const polyline = buildSegmentPolyline(seg, rects, latestPlayers);

          if (!polyline || polyline.length === 0) {
            clearScheduledWork();
            syncAllToAuthoritative(latestPlayers);
            return;
          }

          const point = samplePolylineAtProgress(polyline, easedT);
          let y = point.y;
          let lift = Math.sin(Math.PI * rawT);

          if (seg.mode === "direct") {
            const first = polyline[0];
            const last = polyline[polyline.length - 1];
            const dist = Math.hypot(last.x - first.x, last.y - first.y);
            const arcHeight = Math.min(26, dist * 0.08);
            y -= Math.sin(Math.PI * rawT) * arcHeight;
            lift = Math.sin(Math.PI * rawT) * 1.25;
          }

          activePose.value = {
            username,
            x: point.x,
            y,
            lift,
            mode: seg.mode,
          };

          if (rawT < 1) {
            activeRafId = requestAnimationFrame(tick);
          } else {
            activeRafId = null;
            playSegmentAt(segIndex + 1);
          }
        };

        activeRafId = requestAnimationFrame(tick);
      };

      if (seg.pauseBeforeMs > 0) {
        if (activePose.value) {
          activePose.value = {
            ...activePose.value,
            lift: 0,
            mode: "idle",
          };
        }
        scheduleTimeout(startSegmentLoop, seg.pauseBeforeMs);
      } else {
        startSegmentLoop();
      }
    };

    playSegmentAt(0);
  };

  const handleStateUpdate = (state: GameState | undefined) => {
    const players = state?.players;
    if (!players || players.length === 0) return;

    if (!hasHydrated) {
      hasHydrated = true;
      if (state.lastMove?.moveId) {
        lastProcessedMoveId = state.lastMove.moveId;
      }
      syncAllToAuthoritative(players);
      return;
    }

    pruneEliminatedPlayers(players);

    const incomingMove: PlayerMoveEvent | null | undefined = state.lastMove;
    if (
      incomingMove &&
      incomingMove.moveId &&
      incomingMove.moveId !== lastProcessedMoveId &&
      incomingMove.segments.length > 0
    ) {
      lastProcessedMoveId = incomingMove.moveId;

      const movingPlayerExists = players.some(
        (p) => p.username === incomingMove.username
      );
      if (movingPlayerExists) {
        runSegments(incomingMove.username, incomingMove.segments, players);
        return;
      }
    }

    // If an animation is active and a non-move state update arrives, don't interrupt
    // unless another player's authoritative position changed.
    if (movingUsername.value) {
      const othersChanged = players.some(
        (p) =>
          p.username !== movingUsername.value &&
          displayedPositions.value[p.username] !== undefined &&
          displayedPositions.value[p.username] !== p.position
      );
      if (!othersChanged) {
        for (const p of players) {
          if (displayedPositions.value[p.username] === undefined) {
            displayedPositions.value = {
              ...displayedPositions.value,
              [p.username]: p.position,
            };
          }
        }
        return;
      }
    }

    // Fallback: detect any position diff without lastMove metadata.
    const movedPlayer = players.find((p) => {
      const prev = displayedPositions.value[p.username];
      return prev !== undefined && prev !== p.position;
    });

    if (movedPlayer) {
      const from = displayedPositions.value[movedPlayer.username];
      const to = movedPlayer.position;
      const clockwiseDistance =
        (to - from + DEFAULT_BOARD_SIZE) % DEFAULT_BOARD_SIZE;
      const fallbackSegment: MoveSegment = {
        from,
        to,
        mode: clockwiseDistance > 0 && clockwiseDistance <= 12 ? "step" : "direct",
      };
      runSegments(movedPlayer.username, [fallbackSegment], players);
      return;
    }

    // Initialize any newly added players cleanly.
    const nextPositions = { ...displayedPositions.value };
    let added = false;
    for (const p of players) {
      if (nextPositions[p.username] === undefined) {
        nextPositions[p.username] = p.position;
        added = true;
      }
    }
    if (added) {
      displayedPositions.value = nextPositions;
    }
  };

  watch(getGameState, handleStateUpdate, { immediate: true, deep: false });

  const handleVisibilityChange = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      movingUsername.value
    ) {
      const deadlinePassed =
        activeRunDeadline > 0 && Date.now() >= activeRunDeadline;
      if (deadlinePassed || preferredReducedMotion.value === "reduce") {
        activeRunId += 1;
        clearScheduledWork();
        const latestPlayers = getGameState()?.players ?? [];
        syncAllToAuthoritative(latestPlayers);
      }
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  onScopeDispose(() => {
    activeRunId += 1;
    clearScheduledWork();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  });

  const isReducedMotion = computed(
    () => preferredReducedMotion.value === "reduce"
  );

  return {
    displayedPositions: displayedPositions as Ref<Record<string, number>>,
    activePose,
    movingUsername,
    isAnimating,
    isReducedMotion,
  };
}
