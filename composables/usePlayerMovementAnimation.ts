import { computed, onScopeDispose, ref, watch } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import type { GameState, MoveMode, MoveSegment, Player } from "~/types";
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

function buildPositionsMap(players: Player[]): Record<string, number> {
  const positions: Record<string, number> = {};
  for (const player of players) {
    positions[player.username] = player.position;
  }
  return positions;
}

function computeSlotCoord(
  username: string,
  tileId: number,
  players: Player[],
  positionsMap: Record<string, number>,
  rects: Record<number, MeasuredTileRect>
): Point2D | null {
  const rect = rects[tileId];
  if (!rect) return null;

  const group = players
    .filter((player) => (positionsMap[player.username] ?? player.position) === tileId)
    .map((player) => player.username);

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
}

export function prepareSegments(segments: MoveSegment[]): PreparedSegment[] {
  const prepared: PreparedSegment[] = [];

  for (const segment of segments) {
    let tileIds: number[];
    let durationMs: number;

    if (segment.mode === "step") {
      const steps = buildStepPath(segment.from, segment.to, DEFAULT_BOARD_SIZE);
      if (steps.length === 0) continue;
      tileIds = [segment.from, ...steps];
      durationMs = computeStepSegmentDurationMs(steps.length);
    } else if (segment.mode === "direct") {
      if (segment.from === segment.to) continue;
      tileIds = [segment.from, segment.to];
      durationMs = DIRECT_DURATION_MS;
    } else {
      continue;
    }

    prepared.push({
      mode: segment.mode,
      tileIds,
      durationMs,
      pauseBeforeMs: prepared.length > 0 ? DEFAULT_SEGMENT_PAUSE_MS : 0,
      isFirst: prepared.length === 0,
      isLast: false,
    });
  }

  if (prepared.length > 0) {
    prepared[prepared.length - 1].isLast = true;
  }

  return prepared;
}

function buildSegmentPolyline(
  segment: PreparedSegment,
  username: string,
  rects: Record<number, MeasuredTileRect>,
  initialRects: Record<number, MeasuredTileRect>,
  startPointSnapshot: Point2D,
  latestPlayers: Player[]
): Point2D[] | null {
  const rawPoints: Point2D[] = [];

  for (let i = 0; i < segment.tileIds.length; i++) {
    const tileId = segment.tileIds[i];
    const rect = rects[tileId];
    if (!rect) return null;

    if (i === 0 && segment.isFirst) {
      // Preserve exact takeoff slot unless the board resized mid-animation.
      rawPoints.push(
        rects === initialRects ? startPointSnapshot : { x: rect.cx, y: rect.cy }
      );
    } else if (i === segment.tileIds.length - 1 && segment.isLast) {
      const destCoord =
        computeSlotCoord(
          username,
          tileId,
          latestPlayers,
          buildPositionsMap(latestPlayers),
          rects
        ) ?? { x: rect.cx, y: rect.cy };
      rawPoints.push(destCoord);
    } else {
      rawPoints.push({ x: rect.cx, y: rect.cy });
    }
  }

  if (segment.mode === "step" && rawPoints.length >= 3) {
    return smoothPolylinePoints(rawPoints, 0.35, 8);
  }

  return rawPoints;
}

function computeSegmentPose(
  username: string,
  segment: PreparedSegment,
  polyline: Point2D[],
  rawT: number,
  easedT: number
): AnimatedTokenPose {
  const point = samplePolylineAtProgress(polyline, easedT);
  const sinWave = Math.sin(Math.PI * rawT);

  if (segment.mode === "direct") {
    const first = polyline[0];
    const last = polyline[polyline.length - 1];
    const dist = Math.hypot(last.x - first.x, last.y - first.y);
    const arcHeight = Math.min(26, dist * 0.08);
    return {
      username,
      x: point.x,
      y: point.y - sinWave * arcHeight,
      lift: sinWave * 1.25,
    };
  }

  return {
    username,
    x: point.x,
    y: point.y,
    lift: sinWave,
  };
}

export function buildFallbackSegment(from: number, to: number): MoveSegment {
  const clockwiseDistance = (to - from + DEFAULT_BOARD_SIZE) % DEFAULT_BOARD_SIZE;
  return {
    from,
    to,
    mode: clockwiseDistance > 0 && clockwiseDistance <= 12 ? "step" : "direct",
  };
}

export function usePlayerMovementAnimation(
  getGameState: () => GameState | undefined,
  getTileRects: () => Record<number, MeasuredTileRect>
) {
  const displayedPositions = ref<Record<string, number>>({});
  const activePose = ref<AnimatedTokenPose | null>(null);
  const preferredReducedMotion = usePreferredReducedMotion();

  const movingUsername = computed(() => activePose.value?.username ?? null);
  const isAnimating = computed(() => activePose.value !== null);
  const isReducedMotion = computed(() => preferredReducedMotion.value === "reduce");

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

  const syncAllToAuthoritative = (players: Player[]) => {
    displayedPositions.value = buildPositionsMap(players);
    activePose.value = null;
    activeRunDeadline = 0;
  };

  const cancelActiveRun = () => {
    activeRunId += 1;
    clearScheduledWork();
    activePose.value = null;
    activeRunDeadline = 0;
  };

  const finishRun = (fallbackPlayers: Player[]) => {
    clearScheduledWork();
    syncAllToAuthoritative(getGameState()?.players ?? fallbackPlayers);
  };

  const addMissingPlayers = (players: Player[]) => {
    const nextPositions = { ...displayedPositions.value };
    let added = false;

    for (const player of players) {
      if (nextPositions[player.username] === undefined) {
        nextPositions[player.username] = player.position;
        added = true;
      }
    }

    if (added) {
      displayedPositions.value = nextPositions;
    }
  };

  const pruneEliminatedPlayers = (players: Player[]) => {
    const activeNames = new Set(players.map((player) => player.username));
    const currentPos = { ...displayedPositions.value };
    let changed = false;

    for (const name of Object.keys(currentPos)) {
      if (!activeNames.has(name)) {
        delete currentPos[name];
        changed = true;
      }
    }

    if (movingUsername.value && !activeNames.has(movingUsername.value)) {
      cancelActiveRun();
    }

    if (changed) {
      displayedPositions.value = currentPos;
    }
  };

  const runSegments = (
    username: string,
    segments: MoveSegment[],
    authoritativePlayers: Player[]
  ) => {
    const prepared = prepareSegments(segments);
    if (prepared.length === 0 || isReducedMotion.value) {
      cancelActiveRun();
      syncAllToAuthoritative(authoritativePlayers);
      return;
    }

    const initialRects = getTileRects();
    const firstTileId = prepared[0].tileIds[0];
    if (!initialRects[firstTileId]) {
      cancelActiveRun();
      syncAllToAuthoritative(authoritativePlayers);
      return;
    }

    // Snapshot takeoff position before updating displayedPositions so there is zero takeoff jump.
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

    // Update resting positions immediately so co-located tokens gently reflow to make room.
    displayedPositions.value = buildPositionsMap(authoritativePlayers);
    activePose.value = {
      username,
      x: startPointSnapshot.x,
      y: startPointSnapshot.y,
      lift: 0,
    };

    const expectedTotalMs = prepared.reduce(
      (sum, seg) => sum + seg.pauseBeforeMs + seg.durationMs,
      0
    );
    activeRunDeadline = Date.now() + expectedTotalMs + 120;

    // Watchdog guarantees turn modals can never get stuck hidden.
    const watchdogMs = Math.max(ANIMATION_WATCHDOG_MS, expectedTotalMs + 1000);
    scheduleTimeout(() => {
      if (runId !== activeRunId) return;
      finishRun(authoritativePlayers);
    }, watchdogMs);

    const animateSegment = (segment: PreparedSegment, onComplete: () => void) => {
      if (runId !== activeRunId) return;

      let startTime: number | null = null;

      const tick = (now: number) => {
        if (runId !== activeRunId) return;

        startTime ??= now;
        const rawT = Math.max(0, Math.min(1, (now - startTime) / segment.durationMs));
        const easedT = easeSmoothMove(rawT);

        const latestPlayers = getGameState()?.players ?? authoritativePlayers;
        const polyline = buildSegmentPolyline(
          segment,
          username,
          getTileRects(),
          initialRects,
          startPointSnapshot,
          latestPlayers
        );

        if (!polyline || polyline.length === 0) {
          finishRun(latestPlayers);
          return;
        }

        activePose.value = computeSegmentPose(username, segment, polyline, rawT, easedT);

        if (rawT < 1) {
          activeRafId = requestAnimationFrame(tick);
        } else {
          activeRafId = null;
          onComplete();
        }
      };

      activeRafId = requestAnimationFrame(tick);
    };

    const playSegmentAt = (segIndex: number) => {
      if (runId !== activeRunId) return;

      if (segIndex >= prepared.length) {
        finishRun(authoritativePlayers);
        return;
      }

      const segment = prepared[segIndex];
      const startNext = () => playSegmentAt(segIndex + 1);

      if (segment.pauseBeforeMs > 0) {
        if (activePose.value) {
          activePose.value = { ...activePose.value, lift: 0 };
        }
        scheduleTimeout(() => animateSegment(segment, startNext), segment.pauseBeforeMs);
      } else {
        animateSegment(segment, startNext);
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

    const incomingMove = state.lastMove;
    if (
      incomingMove?.moveId &&
      incomingMove.moveId !== lastProcessedMoveId &&
      incomingMove.segments.length > 0
    ) {
      lastProcessedMoveId = incomingMove.moveId;
      const movingPlayerExists = players.some(
        (player) => player.username === incomingMove.username
      );
      if (movingPlayerExists) {
        runSegments(incomingMove.username, incomingMove.segments, players);
        return;
      }
    }

    // Don't interrupt an active animation on unrelated updates unless another player moved.
    if (movingUsername.value) {
      const othersChanged = players.some(
        (player) =>
          player.username !== movingUsername.value &&
          displayedPositions.value[player.username] !== undefined &&
          displayedPositions.value[player.username] !== player.position
      );
      if (!othersChanged) {
        addMissingPlayers(players);
        return;
      }
    }

    // Fallback: animate any position diff arriving without lastMove metadata.
    const movedPlayer = players.find((player) => {
      const prev = displayedPositions.value[player.username];
      return prev !== undefined && prev !== player.position;
    });

    if (movedPlayer) {
      const from = displayedPositions.value[movedPlayer.username];
      runSegments(
        movedPlayer.username,
        [buildFallbackSegment(from, movedPlayer.position)],
        players
      );
      return;
    }

    addMissingPlayers(players);
  };

  watch(getGameState, handleStateUpdate, { immediate: true, deep: false });

  const handleVisibilityChange = () => {
    if (
      typeof document === "undefined" ||
      document.visibilityState !== "visible" ||
      !movingUsername.value
    ) {
      return;
    }

    const deadlinePassed =
      activeRunDeadline > 0 && Date.now() >= activeRunDeadline;
    if (deadlinePassed || isReducedMotion.value) {
      cancelActiveRun();
      syncAllToAuthoritative(getGameState()?.players ?? []);
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

  return {
    displayedPositions,
    activePose,
    movingUsername,
    isAnimating,
    isReducedMotion,
  };
}
