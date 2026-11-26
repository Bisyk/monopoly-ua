import test from "node:test";
import assert from "node:assert/strict";
import { effectScope, nextTick, ref } from "vue";
import {
  buildFallbackSegment,
  DIRECT_DURATION_MS,
  prepareSegments,
  usePlayerMovementAnimation,
} from "~/composables/usePlayerMovementAnimation";
import {
  computeStepSegmentDurationMs,
  DEFAULT_SEGMENT_PAUSE_MS,
} from "~/utils/playerMovement";

function createFakeRaf() {
  let nextId = 1;
  const callbacks = new Map();

  const origRaf = globalThis.requestAnimationFrame;
  const origCancel = globalThis.cancelAnimationFrame;

  globalThis.requestAnimationFrame = (cb) => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    callbacks.delete(id);
  };

  return {
    pendingCount: () => callbacks.size,
    flushFrame(timestamp) {
      const entries = [...callbacks.entries()];
      callbacks.clear();
      for (const [, cb] of entries) {
        cb(timestamp);
      }
    },
    restore() {
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCancel;
    },
  };
}

function createTileRects(tileIds = Array.from({ length: 40 }, (_, i) => i + 1)) {
  const rects = {};
  for (const id of tileIds) {
    rects[id] = { cx: id * 50, cy: 100, width: 50, height: 100 };
  }
  return rects;
}

function makeGameState(players, lastMove = null) {
  return {
    id: "game-1",
    associatedRoomId: "room-1",
    status: "STARTED",
    winnerUsername: null,
    eliminatedPlayers: [],
    gameLog: [],
    board: { tiles: [], groups: [] },
    activeChance: { type: null },
    currentTurn: players[0]?.username ?? "",
    currentAction: "roll",
    auctionParticipants: [],
    activeTrade: null,
    players,
    lastMove,
  };
}

function makePlayer(username, position) {
  return {
    username,
    color: "#9999FF",
    position,
    balance: 1500,
    properties: [],
    ownedPropertyGroupIds: [],
    jailed: false,
    turnsInJail: 0,
    doublesInRow: 0,
    bonusRoll: false,
  };
}

test("prepareSegments builds step and direct segments with inter-segment pause and edge flags", () => {
  const prepared = prepareSegments([
    { from: 29, to: 31, mode: "step" },
    { from: 31, to: 11, mode: "direct" },
  ]);

  assert.deepEqual(prepared, [
    {
      mode: "step",
      tileIds: [29, 30, 31],
      durationMs: computeStepSegmentDurationMs(2),
      pauseBeforeMs: 0,
      isFirst: true,
      isLast: false,
    },
    {
      mode: "direct",
      tileIds: [31, 11],
      durationMs: DIRECT_DURATION_MS,
      pauseBeforeMs: DEFAULT_SEGMENT_PAUSE_MS,
      isFirst: false,
      isLast: true,
    },
  ]);
});

test("prepareSegments skips no-op segments", () => {
  assert.deepEqual(
    prepareSegments([
      { from: 5, to: 5, mode: "step" },
      { from: 11, to: 11, mode: "direct" },
    ]),
    []
  );
});

test("buildFallbackSegment chooses step for <=12 clockwise steps and direct otherwise", () => {
  assert.deepEqual(buildFallbackSegment(1, 7), { from: 1, to: 7, mode: "step" });
  assert.deepEqual(buildFallbackSegment(38, 3), { from: 38, to: 3, mode: "step" });
  assert.deepEqual(buildFallbackSegment(31, 11), { from: 31, to: 11, mode: "direct" });
});

test("usePlayerMovementAnimation hydrates without replaying pre-existing lastMove", async () => {
  const raf = createFakeRaf();
  const scope = effectScope();

  try {
    const gameState = ref(
      makeGameState([makePlayer("alice", 7)], {
        moveId: "initial-move",
        username: "alice",
        segments: [{ from: 1, to: 7, mode: "step" }],
      })
    );
    const tileRects = ref(createTileRects());

    const api = scope.run(() =>
      usePlayerMovementAnimation(
        () => gameState.value,
        () => tileRects.value
      )
    );

    assert.equal(api.isAnimating.value, false);
    assert.deepEqual(api.displayedPositions.value, { alice: 7 });
    assert.equal(raf.pendingCount(), 0);

    // Repeating the same moveId must not animate
    gameState.value = makeGameState([makePlayer("alice", 7)], {
      moveId: "initial-move",
      username: "alice",
      segments: [{ from: 1, to: 7, mode: "step" }],
    });
    await nextTick();
    assert.equal(api.isAnimating.value, false);
    assert.equal(raf.pendingCount(), 0);
  } finally {
    scope.stop();
    raf.restore();
  }
});

test("usePlayerMovementAnimation animates new lastMove and completes cleanly", async () => {
  const raf = createFakeRaf();
  const scope = effectScope();

  try {
    const gameState = ref(makeGameState([makePlayer("alice", 1), makePlayer("bob", 1)]));
    const tileRects = ref(createTileRects());

    const api = scope.run(() =>
      usePlayerMovementAnimation(
        () => gameState.value,
        () => tileRects.value
      )
    );

    gameState.value = makeGameState([makePlayer("alice", 4), makePlayer("bob", 1)], {
      moveId: "move-1",
      username: "alice",
      segments: [{ from: 1, to: 4, mode: "step" }],
    });
    await nextTick();

    assert.equal(api.isAnimating.value, true);
    assert.equal(api.movingUsername.value, "alice");
    assert.equal(api.displayedPositions.value.alice, 4);

    // Mid-frame
    raf.flushFrame(0);
    raf.flushFrame(200);
    assert.equal(api.isAnimating.value, true);
    assert.ok(api.activePose.value.lift > 0);

    // Finish past duration
    raf.flushFrame(2000);
    assert.equal(api.isAnimating.value, false);
    assert.equal(api.activePose.value, null);
    assert.equal(raf.pendingCount(), 0);
  } finally {
    scope.stop();
    raf.restore();
  }
});

test("usePlayerMovementAnimation cancels in-flight animation on runSegments early return", async () => {
  const raf = createFakeRaf();
  const scope = effectScope();

  try {
    const gameState = ref(makeGameState([makePlayer("alice", 1), makePlayer("bob", 1)]));
    const tileRects = ref(createTileRects());

    const api = scope.run(() =>
      usePlayerMovementAnimation(
        () => gameState.value,
        () => tileRects.value
      )
    );

    // Start first animation
    gameState.value = makeGameState([makePlayer("alice", 6), makePlayer("bob", 1)], {
      moveId: "move-1",
      username: "alice",
      segments: [{ from: 1, to: 6, mode: "step" }],
    });
    await nextTick();
    assert.equal(api.isAnimating.value, true);
    assert.equal(raf.pendingCount(), 1);

    // Trigger a second move whose segments prepare to empty (no-op early return)
    gameState.value = makeGameState([makePlayer("alice", 6), makePlayer("bob", 1)], {
      moveId: "move-2",
      username: "bob",
      segments: [{ from: 1, to: 1, mode: "step" }],
    });
    await nextTick();

    assert.equal(api.isAnimating.value, false);
    assert.equal(api.activePose.value, null);
    assert.equal(raf.pendingCount(), 0);

    // Even if a frame fires, stale animation must not resurrect activePose
    raf.flushFrame(50);
    assert.equal(api.isAnimating.value, false);
    assert.equal(api.activePose.value, null);
  } finally {
    scope.stop();
    raf.restore();
  }
});

test("usePlayerMovementAnimation cancels active animation when moving player is eliminated", async () => {
  const raf = createFakeRaf();
  const scope = effectScope();

  try {
    const gameState = ref(makeGameState([makePlayer("alice", 1), makePlayer("bob", 1)]));
    const tileRects = ref(createTileRects());

    const api = scope.run(() =>
      usePlayerMovementAnimation(
        () => gameState.value,
        () => tileRects.value
      )
    );

    gameState.value = makeGameState([makePlayer("alice", 5), makePlayer("bob", 1)], {
      moveId: "move-1",
      username: "alice",
      segments: [{ from: 1, to: 5, mode: "step" }],
    });
    await nextTick();
    assert.equal(api.isAnimating.value, true);

    // Eliminate alice mid-animation
    gameState.value = makeGameState([makePlayer("bob", 1)]);
    await nextTick();

    assert.equal(api.isAnimating.value, false);
    assert.equal(api.displayedPositions.value.alice, undefined);
    assert.equal(raf.pendingCount(), 0);
  } finally {
    scope.stop();
    raf.restore();
  }
});
