export interface CubeOrientation {
  rx: number;
  ry: number;
}

export interface CubeFramePose {
  rx: number;
  ry: number;
  rz: number;
  lift: number;
  scale: number;
  shadowScale: number;
  shadowOpacity: number;
  settled: boolean;
}

/**
 * Canonical 3D cube rotations bringing each die face (1..6) flush to the viewer.
 * Matches CSS 3D face placement:
 *   1: front  rotateY(0)
 *   6: back   rotateY(180deg)
 *   2: right  rotateY(90deg)
 *   5: left   rotateY(-90deg)
 *   3: top    rotateX(90deg)
 *   4: bottom rotateX(-90deg)
 */
export const FACE_TARGET_ORIENTATIONS: Record<number, CubeOrientation> = {
  1: { rx: 0, ry: 0 },
  2: { rx: 0, ry: -90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90, ry: 0 },
  5: { rx: 0, ry: 90 },
  6: { rx: 0, ry: 180 },
};

export const DIE_FACE_PIP_MAP: Record<number, number[]> = {
  1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
  3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
  5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  6: [1, 0, 1, 1, 0, 1, 1, 0, 1],
};

/**
 * Quintic ease-out: explosive initial spin speed that decays continuously
 * into a slow, suspenseful final crawl before settling flat on the face.
 */
export function easeOutQuint(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 5);
}

/**
 * Multi-bounce parabolic toss height (0 at ground, > 0 in air).
 * Primary high toss (0..0.52), secondary crisp bounce (0.52..0.78),
 * tiny final settle tap (0.78..0.92), flat rest (0.92..1).
 */
export function computeDieBounceLift(t: number, maxLiftPx = 44): number {
  const clamped = Math.max(0, Math.min(1, t));

  if (clamped < 0.52) {
    const u = clamped / 0.52;
    return Math.sin(u * Math.PI) * maxLiftPx;
  }

  if (clamped < 0.78) {
    const u = (clamped - 0.52) / 0.26;
    return Math.sin(u * Math.PI) * (maxLiftPx * 0.36);
  }

  if (clamped < 0.92) {
    const u = (clamped - 0.78) / 0.14;
    return Math.sin(u * Math.PI) * (maxLiftPx * 0.11);
  }

  return 0;
}

export interface DieSpinTrajectory {
  startRx: number;
  startRy: number;
  startRz: number;
  targetRx: number;
  targetRy: number;
  targetRz: number;
  maxLiftPx: number;
}

export function createDieSpinTrajectory(
  targetFace: number,
  dieIndex: 0 | 1,
  rollSeed: number
): DieSpinTrajectory {
  const safeFace =
    targetFace >= 1 && targetFace <= 6 ? Math.round(targetFace) : 1;
  const canonical = FACE_TARGET_ORIENTATIONS[safeFace];

  // Deterministic per-roll spin counts so animations feel varied and organic
  // while remaining testable and reproducible for a given rollId seed.
  const seedAbs = Math.abs(Math.floor(rollSeed)) + dieIndex * 17;
  const xSpins = 4 + (seedAbs % 3); // 4..6 full revolutions
  const ySpins = 4 + ((seedAbs >> 2) % 3); // 4..6 full revolutions
  const xDir = dieIndex === 0 ? 1 : -1;
  const yDir = (seedAbs % 2 === 0 ? 1 : -1) * (dieIndex === 0 ? 1 : -1);

  const startRx = ((seedAbs * 37) % 120) - 60;
  const startRy = ((seedAbs * 53) % 120) - 60;
  const startRz = (dieIndex === 0 ? -1 : 1) * (18 + (seedAbs % 20));

  return {
    startRx,
    startRy,
    startRz,
    targetRx: canonical.rx + xDir * xSpins * 360,
    targetRy: canonical.ry + yDir * ySpins * 360,
    targetRz: 0,
    maxLiftPx: dieIndex === 0 ? 46 : 52,
  };
}

export function sampleDieSpinPose(
  trajectory: DieSpinTrajectory,
  rawT: number
): CubeFramePose {
  const t = Math.max(0, Math.min(1, rawT));
  const eased = easeOutQuint(t);
  const settled = t >= 1;

  const rx = settled
    ? trajectory.targetRx
    : trajectory.startRx + (trajectory.targetRx - trajectory.startRx) * eased;
  const ry = settled
    ? trajectory.targetRy
    : trajectory.startRy + (trajectory.targetRy - trajectory.startRy) * eased;

  // Add subtle decaying Z wobble during spin that vanishes cleanly on settle.
  const zWobble = settled ? 0 : Math.sin(t * Math.PI * 5) * 10 * Math.pow(1 - t, 2);
  const rz = settled
    ? 0
    : trajectory.startRz * (1 - eased) + zWobble;

  const lift = settled ? 0 : computeDieBounceLift(t, trajectory.maxLiftPx);
  const liftRatio = trajectory.maxLiftPx > 0 ? lift / trajectory.maxLiftPx : 0;

  // Slight pop-scale on landing settle for tactile punch
  const scale = settled ? 1 : 1 + liftRatio * 0.14;
  const shadowScale = Math.max(0.58, 1 - liftRatio * 0.38);
  const shadowOpacity = Math.max(0.16, 0.38 - liftRatio * 0.2);

  return {
    rx,
    ry,
    rz,
    lift,
    scale,
    shadowScale,
    shadowOpacity,
    settled,
  };
}

export function hashRollId(rollId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < rollId.length; i++) {
    hash ^= rollId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
