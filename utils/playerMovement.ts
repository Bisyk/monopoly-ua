import type { MoveMode, MoveSegment } from "../types";

export const DEFAULT_BOARD_SIZE = 40;
export const DEFAULT_SEGMENT_PAUSE_MS = 200;

export interface MoveWaypoint {
  tileId: number;
  mode: MoveMode;
  pauseBeforeMs: number;
}

export interface TokenOffset {
  dx: number;
  dy: number;
}

/**
 * Returns the ordered list of clockwise tile IDs from `fromTileId` (exclusive)
 * to `toTileId` (inclusive), wrapping from `boardSize` back to `1`.
 */
export function buildStepPath(
  fromTileId: number,
  toTileId: number,
  boardSize: number = DEFAULT_BOARD_SIZE
): number[] {
  if (
    !Number.isInteger(fromTileId) ||
    !Number.isInteger(toTileId) ||
    boardSize < 1 ||
    fromTileId < 1 ||
    fromTileId > boardSize ||
    toTileId < 1 ||
    toTileId > boardSize ||
    fromTileId === toTileId
  ) {
    return [];
  }

  const path: number[] = [];
  let current = fromTileId;

  while (current !== toTileId) {
    current = (current % boardSize) + 1;
    path.push(current);
  }

  return path;
}

/**
 * Expands structured server movement segments into an ordered list of animation waypoints.
 */
export function expandMoveSegments(
  segments: MoveSegment[],
  boardSize: number = DEFAULT_BOARD_SIZE,
  segmentPauseMs: number = DEFAULT_SEGMENT_PAUSE_MS
): MoveWaypoint[] {
  const waypoints: MoveWaypoint[] = [];

  for (const segment of segments) {
    const hasPriorWaypoints = waypoints.length > 0;

    if (segment.mode === "step") {
      const steps = buildStepPath(segment.from, segment.to, boardSize);
      steps.forEach((tileId, stepIdx) => {
        waypoints.push({
          tileId,
          mode: "step",
          pauseBeforeMs: hasPriorWaypoints && stepIdx === 0 ? segmentPauseMs : 0,
        });
      });
    } else if (segment.mode === "direct") {
      if (
        Number.isInteger(segment.to) &&
        segment.to >= 1 &&
        segment.to <= boardSize &&
        segment.from !== segment.to
      ) {
        waypoints.push({
          tileId: segment.to,
          mode: "direct",
          pauseBeforeMs: hasPriorWaypoints ? segmentPauseMs : 0,
        });
      }
    }
  }

  return waypoints;
}

/**
 * Computes a deterministic, non-overlapping sub-tile offset for a player token
 * when multiple players occupy the same tile.
 */
export function getCoLocatedTokenOffset(
  slotIndex: number,
  totalOnTile: number,
  tileWidth: number,
  tileHeight: number
): TokenOffset {
  if (totalOnTile <= 1 || tileWidth <= 0 || tileHeight <= 0) {
    return { dx: 0, dy: 0 };
  }

  const clampedSlot = Math.max(0, Math.min(slotIndex, totalOnTile - 1));
  const isWideOrSquare = tileWidth >= tileHeight;

  let cols: number;
  let rows: number;

  if (totalOnTile === 2) {
    cols = isWideOrSquare ? 2 : 1;
    rows = isWideOrSquare ? 1 : 2;
  } else if (totalOnTile <= 4) {
    cols = 2;
    rows = 2;
  } else if (totalOnTile <= 6) {
    cols = isWideOrSquare ? 3 : 2;
    rows = isWideOrSquare ? 2 : 3;
  } else {
    cols = isWideOrSquare ? 4 : 2;
    rows = isWideOrSquare ? 2 : 4;
  }

  const row = Math.floor(clampedSlot / cols);
  const col = clampedSlot % cols;

  // Center items on a partially filled final row (e.g., 3 players in a 2x2 grid).
  const itemsInThisRow =
    row === rows - 1 ? totalOnTile - row * cols : cols;
  const effectiveCols = Math.max(1, Math.min(cols, itemsInThisRow));

  const usableWidth = tileWidth * 0.58;
  const usableHeight = tileHeight * 0.58;

  const dx =
    effectiveCols === 1
      ? 0
      : ((col + 0.5) / effectiveCols - 0.5) * usableWidth;
  const dy =
    rows === 1 ? 0 : ((row + 0.5) / rows - 0.5) * usableHeight;

  return { dx, dy };
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Smooths sharp turns (such as board corners) in a polyline by replacing
 * high-angle vertices with quadratic Bezier fillets while preserving start and end points.
 */
export function smoothPolylinePoints(
  points: Point2D[],
  cornerRadiusRatio: number = 0.35,
  samplesPerCorner: number = 6
): Point2D[] {
  if (points.length <= 2) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  const result: Point2D[] = [{ x: points[0].x, y: points[0].y }];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const vInX = curr.x - prev.x;
    const vInY = curr.y - prev.y;
    const vOutX = next.x - curr.x;
    const vOutY = next.y - curr.y;

    const lenIn = Math.hypot(vInX, vInY);
    const lenOut = Math.hypot(vOutX, vOutY);

    if (lenIn < 1e-3 || lenOut < 1e-3) {
      continue;
    }

    const cosAngle = (vInX * vOutX + vInY * vOutY) / (lenIn * lenOut);
    // Only round noticeable turns (e.g., ~90° board corners where cosAngle ≈ 0).
    if (cosAngle > 0.85) {
      result.push({ x: curr.x, y: curr.y });
      continue;
    }

    const cutIn = Math.min(lenIn * cornerRadiusRatio, lenOut * cornerRadiusRatio);
    const cutOut = cutIn;

    const pStart: Point2D = {
      x: curr.x - (vInX / lenIn) * cutIn,
      y: curr.y - (vInY / lenIn) * cutIn,
    };
    const pEnd: Point2D = {
      x: curr.x + (vOutX / lenOut) * cutOut,
      y: curr.y + (vOutY / lenOut) * cutOut,
    };

    for (let s = 0; s <= samplesPerCorner; s++) {
      const t = s / samplesPerCorner;
      const omt = 1 - t;
      result.push({
        x: omt * omt * pStart.x + 2 * omt * t * curr.x + t * t * pEnd.x,
        y: omt * omt * pStart.y + 2 * omt * t * curr.y + t * t * pEnd.y,
      });
    }
  }

  const last = points[points.length - 1];
  result.push({ x: last.x, y: last.y });
  return result;
}

/**
 * Samples a polyline at normalized arc-length progress `t` in [0, 1],
 * ensuring uniform travel speed across segments of differing lengths (e.g., regular vs corner tiles).
 */
export function samplePolylineAtProgress(
  points: Point2D[],
  progress: number
): Point2D {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1 || progress <= 0) {
    return { x: points[0].x, y: points[0].y };
  }
  if (progress >= 1) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y };
  }

  const cumulative: number[] = [0];
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    totalLength += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
    cumulative.push(totalLength);
  }

  if (totalLength < 1e-6) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y };
  }

  const targetDist = progress * totalLength;

  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i] >= targetDist) {
      const segStart = cumulative[i - 1];
      const segLen = cumulative[i] - segStart;
      const localT = segLen > 1e-6 ? (targetDist - segStart) / segLen : 1;
      const a = points[i - 1];
      const b = points[i];
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
      };
    }
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

/**
 * Silky S-curve easing blending cubic and sine ease-in-out for gentle takeoff,
 * steady cruise across the board, and plush deceleration into the target tile.
 */
export function easeSmoothMove(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const cubic =
    clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  const sine = -(Math.cos(Math.PI * clamped) - 1) / 2;
  return 0.65 * cubic + 0.35 * sine;
}

/**
 * Computes total duration for a continuous multi-tile perimeter glide.
 */
export function computeStepSegmentDurationMs(stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.round(220 + stepCount * 115);
}
