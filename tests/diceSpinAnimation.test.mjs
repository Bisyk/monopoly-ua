import test from "node:test";
import assert from "node:assert/strict";
import { effectScope, nextTick, ref } from "vue";
import {
  DICE_JAIL_HOLD_EXTRA_MS,
  DICE_LEAD_IN_MS,
} from "~/shared/constants/animationTimings";
import {
  computeDieBounceLift,
  createDieSpinTrajectory,
  easeOutQuint,
  FACE_TARGET_ORIENTATIONS,
  hashRollId,
  sampleDieSpinPose,
} from "~/utils/diceSpinPhysics";
import { usePlayerMovementAnimation } from "~/composables/usePlayerMovementAnimation";

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

test("easeOutQuint starts fast and decelerates monotonically to 1", () => {
  const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(easeOutQuint);

  assert.equal(samples[0], 0);
  assert.equal(samples[samples.length - 1], 1);

  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i] > samples[i - 1], "easeOutQuint must strictly increase");
  }

  // Verify angular velocity strictly decreases over time (decelerating spin)
  const dt = 0.01;
  const vEarly = (easeOutQuint(0.1 + dt) - easeOutQuint(0.1)) / dt;
  const vMid = (easeOutQuint(0.45 + dt) - easeOutQuint(0.45)) / dt;
  const vLate = (easeOutQuint(0.8 + dt) - easeOutQuint(0.8)) / dt;
  const vEnd = (easeOutQuint(0.95 + dt) - easeOutQuint(0.95)) / dt;

  assert.ok(vEarly > vMid, `Expected vEarly (${vEarly}) > vMid (${vMid})`);
  assert.ok(vMid > vLate, `Expected vMid (${vMid}) > vLate (${vLate})`);
  assert.ok(vLate > vEnd, `Expected vLate (${vLate}) > vEnd (${vEnd})`);
  assert.ok(vEnd > 0);
});

test("every die face 1..6 lands flush on its exact canonical 3D orientation at t=1", () => {
  const seed = hashRollId("roll-test-123");

  for (let face = 1; face <= 6; face++) {
    for (const dieIdx of [0, 1]) {
      const traj = createDieSpinTrajectory(face, dieIdx, seed + face * 31);
      const startPose = sampleDieSpinPose(traj, 0);
      const midPose = sampleDieSpinPose(traj, 0.4);
      const endPose = sampleDieSpinPose(traj, 1);

      assert.equal(startPose.settled, false);
      assert.equal(midPose.settled, false);
      assert.equal(endPose.settled, true);
      assert.equal(endPose.lift, 0);
      assert.equal(endPose.rz, 0);

      // Must perform multiple full spins (> 1080 degrees total travel on X and Y)
      assert.ok(Math.abs(traj.targetRx - traj.startRx) > 1080);
      assert.ok(Math.abs(traj.targetRy - traj.startRy) > 1080);

      // Must land on exact canonical orientation mod 360
      const expected = FACE_TARGET_ORIENTATIONS[face];
      assert.equal(
        normalizeAngle(endPose.rx),
        normalizeAngle(expected.rx),
        `Face ${face} die ${dieIdx} rx mismatch`
      );
      assert.equal(
        normalizeAngle(endPose.ry),
        normalizeAngle(expected.ry),
        `Face ${face} die ${dieIdx} ry mismatch`
      );
    }
  }
});

test("computeDieBounceLift arcs upward then bounces with diminishing peaks and settles at 0", () => {
  assert.equal(computeDieBounceLift(0), 0);
  const peak1 = computeDieBounceLift(0.26);
  const peak2 = computeDieBounceLift(0.65);
  const peak3 = computeDieBounceLift(0.85);
  assert.ok(peak1 > peak2 && peak2 > peak3 && peak3 > 0);
  assert.equal(computeDieBounceLift(0.95), 0);
  assert.equal(computeDieBounceLift(1), 0);
});

test("usePlayerMovementAnimation delays token takeoff by DICE_LEAD_IN_MS when lastRoll accompanies lastMove", async () => {
  const scheduled = [];
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  const origRaf = globalThis.requestAnimationFrame;
  const origCancelRaf = globalThis.cancelAnimationFrame;

  let nextTimerId = 1;
  globalThis.setTimeout = (cb, ms) => {
    const id = nextTimerId++;
    scheduled.push({ id, cb, ms, cleared: false });
    return id;
  };
  globalThis.clearTimeout = (id) => {
    const found = scheduled.find((t) => t.id === id);
    if (found) found.cleared = true;
  };
  let rafCalled = 0;
  globalThis.requestAnimationFrame = () => {
    rafCalled += 1;
    return rafCalled;
  };
  globalThis.cancelAnimationFrame = () => {};

  const rects = {};
  for (let i = 1; i <= 40; i++) {
    rects[i] = { cx: i * 50, cy: 100, width: 50, height: 100 };
  }

  const makeState = (pos, lastMove = null, lastRoll = null) => ({
    id: "game-1",
    associatedRoomId: "room-1",
    status: "STARTED",
    winnerUsername: null,
    eliminatedPlayers: [],
    gameLog: [],
    board: { tiles: [], groups: [] },
    activeChance: { type: null },
    currentTurn: "alice",
    currentAction: "roll",
    auctionParticipants: [],
    activeTrade: null,
    players: [
      {
        username: "alice",
        color: "#9999FF",
        position: pos,
        balance: 1500,
        properties: [],
        ownedPropertyGroupIds: [],
        jailed: false,
        turnsInJail: 0,
        doublesInRow: 0,
        bonusRoll: false,
      },
    ],
    lastMove,
    lastRoll,
  });

  const scope = effectScope();
  try {
    const stateRef = ref(makeState(1));
    let api;
    scope.run(() => {
      api = usePlayerMovementAnimation(
        () => stateRef.value,
        () => rects
      );
    });

    await nextTick();
    assert.equal(api.displayedPositions.value.alice, 1);

    // Emit roll + move together
    stateRef.value = makeState(
      8,
      {
        moveId: "move-1",
        username: "alice",
        segments: [{ from: 1, to: 8, mode: "step" }],
      },
      {
        rollId: "roll-1",
        username: "alice",
        left: 3,
        right: 4,
        isDoubles: false,
      }
    );

    await nextTick();

    // During dice spin lead-in: animation is active, token pinned at start tile, RAF not started yet
    assert.equal(api.isAnimating.value, true);
    assert.equal(api.displayedPositions.value.alice, 1);
    assert.equal(rafCalled, 0);

    const leadInTimer = scheduled.find(
      (t) => !t.cleared && t.ms === DICE_LEAD_IN_MS
    );
    assert.ok(leadInTimer, `Expected a ${DICE_LEAD_IN_MS}ms lead-in timer`);

    // Fire the lead-in timer -> token updates resting target and starts gliding!
    leadInTimer.cb();
    assert.equal(api.displayedPositions.value.alice, 8);
    assert.equal(rafCalled, 1);
  } finally {
    scope.stop();
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCancelRaf;
  }
});

test("DICE_LEAD_IN_MS and DICE_JAIL_HOLD_EXTRA_MS are positive suspense durations", () => {
  assert.ok(DICE_LEAD_IN_MS >= 2000);
  assert.ok(DICE_JAIL_HOLD_EXTRA_MS >= 300);
});
