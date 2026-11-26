import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStepPath,
  computeStepSegmentDurationMs,
  easeSmoothMove,
  expandMoveSegments,
  getCoLocatedTokenOffset,
  samplePolylineAtProgress,
  smoothPolylinePoints,
} from "../utils/playerMovement.ts";

test("buildStepPath handles normal clockwise movement", () => {
  assert.deepEqual(buildStepPath(1, 5), [2, 3, 4, 5]);
  assert.deepEqual(buildStepPath(10, 12), [11, 12]);
});

test("buildStepPath wraps around Go (40 -> 1)", () => {
  assert.deepEqual(buildStepPath(38, 3), [39, 40, 1, 2, 3]);
  assert.deepEqual(buildStepPath(40, 1), [1]);
});

test("buildStepPath returns empty array for no-op or out-of-range inputs", () => {
  assert.deepEqual(buildStepPath(5, 5), []);
  assert.deepEqual(buildStepPath(0, 5), []);
  assert.deepEqual(buildStepPath(1, 41), []);
});

test("expandMoveSegments expands single step segment", () => {
  const waypoints = expandMoveSegments([{ from: 39, to: 2, mode: "step" }]);
  assert.deepEqual(waypoints, [
    { tileId: 40, mode: "step", pauseBeforeMs: 0 },
    { tileId: 1, mode: "step", pauseBeforeMs: 0 },
    { tileId: 2, mode: "step", pauseBeforeMs: 0 },
  ]);
});

test("expandMoveSegments expands roll + direct Go to Jail with inter-segment pause", () => {
  const waypoints = expandMoveSegments(
    [
      { from: 29, to: 31, mode: "step" },
      { from: 31, to: 11, mode: "direct" },
    ],
    40,
    200
  );

  assert.deepEqual(waypoints, [
    { tileId: 30, mode: "step", pauseBeforeMs: 0 },
    { tileId: 31, mode: "step", pauseBeforeMs: 0 },
    { tileId: 11, mode: "direct", pauseBeforeMs: 200 },
  ]);
});

test("expandMoveSegments handles single direct segment without pause", () => {
  const waypoints = expandMoveSegments([{ from: 15, to: 11, mode: "direct" }]);
  assert.deepEqual(waypoints, [{ tileId: 11, mode: "direct", pauseBeforeMs: 0 }]);
});

test("getCoLocatedTokenOffset centers single player and separates 2-8 co-located players within bounds", () => {
  assert.deepEqual(getCoLocatedTokenOffset(0, 1, 100, 100), { dx: 0, dy: 0 });

  const tileShapes = [
    [140, 140], // corner
    [70, 140], // top/bottom tile
    [140, 70], // left/right tile
  ];

  for (const [width, height] of tileShapes) {
    for (let total = 2; total <= 8; total++) {
      const seen = new Set();
      for (let slot = 0; slot < total; slot++) {
        const { dx, dy } = getCoLocatedTokenOffset(slot, total, width, height);
        assert.ok(
          Math.abs(dx) <= width / 2,
          `dx=${dx} exceeds half width ${width / 2}`
        );
        assert.ok(
          Math.abs(dy) <= height / 2,
          `dy=${dy} exceeds half height ${height / 2}`
        );
        seen.add(`${dx.toFixed(2)},${dy.toFixed(2)}`);
      }
      assert.equal(
        seen.size,
        total,
        `expected ${total} distinct slots for ${width}x${height}`
      );
    }
  }
});

test("smoothPolylinePoints preserves endpoints and rounds 90-degree corners", () => {
  const raw = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];
  const smoothed = smoothPolylinePoints(raw, 0.35, 6);
  assert.deepEqual(smoothed[0], { x: 0, y: 0 });
  assert.deepEqual(smoothed[smoothed.length - 1], { x: 100, y: 100 });
  assert.ok(smoothed.length > raw.length);

  // Midpoint of the corner fillet should curve gently inside the 90-degree bend
  const mid = smoothed[Math.floor(smoothed.length / 2)];
  assert.ok(mid.x > 65 && mid.x < 100);
  assert.ok(mid.y > 0 && mid.y < 35);
});

test("samplePolylineAtProgress interpolates uniformly by arc length", () => {
  const polyline = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  assert.deepEqual(samplePolylineAtProgress(polyline, 0), { x: 0, y: 0 });
  assert.deepEqual(samplePolylineAtProgress(polyline, 1), { x: 100, y: 100 });

  const half = samplePolylineAtProgress(polyline, 0.5);
  assert.ok(Math.abs(half.x - 100) < 1e-6);
  assert.ok(Math.abs(half.y - 0) < 1e-6);

  const quarter = samplePolylineAtProgress(polyline, 0.25);
  assert.ok(Math.abs(quarter.x - 50) < 1e-6);
  assert.ok(Math.abs(quarter.y - 0) < 1e-6);
});

test("easeSmoothMove is monotonic with exact endpoints", () => {
  assert.equal(easeSmoothMove(0), 0);
  assert.equal(easeSmoothMove(1), 1);

  let prev = 0;
  for (let i = 1; i <= 20; i++) {
    const val = easeSmoothMove(i / 20);
    assert.ok(val >= prev, `expected monotonic easing at step ${i}`);
    prev = val;
  }
});

test("computeStepSegmentDurationMs scales smoothly with step count", () => {
  assert.equal(computeStepSegmentDurationMs(0), 0);
  assert.ok(computeStepSegmentDurationMs(2) < computeStepSegmentDurationMs(6));
  assert.ok(computeStepSegmentDurationMs(6) < computeStepSegmentDurationMs(12));
});
