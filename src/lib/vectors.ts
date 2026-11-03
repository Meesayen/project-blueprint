import { Point } from 'fabric';
import { uid } from 'uid/single';

export class Vec2 {
  x: number;
  y: number;
  id: string;
  uuid: string;

  constructor(x: number, y: number, uuid = `uid-${uid(8)}`) {
    this.x = x;
    this.y = y;
    this.id = `(${x.toFixed(2)}, ${y.toFixed(2)})`;
    this.uuid = uuid;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y, this.uuid);
  }

  mix(v: { x: number; y: number }, t: number): Vec2 {
    return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t, this.uuid);
  }

  rotateDeg(degrees: number): Vec2 {
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos, this.uuid);
  }

  divideScalar(s: number): Vec2 {
    return new Vec2(this.x / s, this.y / s, this.uuid);
  }

  subtractScalarY(s: number): Vec2 {
    return new Vec2(this.x, this.y - s, this.uuid);
  }

  addScalarY(s: number): Vec2 {
    return new Vec2(this.x, this.y + s, this.uuid);
  }

  multiplyScalar(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s, this.uuid);
  }

  add(v: Vec2 | { x: number; y: number }): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y, this.uuid);
  }

  subtract(v: Vec2 | { x: number; y: number }): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y, this.uuid);
  }

  distance(v: Vec2 | { x: number; y: number }): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  distanceSq(v: Vec2 | { x: number; y: number }): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  isInCloseProximityTo(v: Vec2 | { x: number; y: number }, tolerance = 2): boolean {
    return this.distanceSq(v) < tolerance * tolerance;
  }

  isAlmostIdenticalTo(v: Vec2 | { x: number; y: number }): boolean {
    return this.x === v.x && this.y === v.y;
  }

  isEqualTo(v: Vec2 | { x: number; y: number }): boolean {
    return this.x === v.x && this.y === v.y;
  }

  rotateByDeg(degrees: number, pivot?: Vec2 | { x: number; y: number }): Vec2 {
    const p = pivot || { x: 0, y: 0 };
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    return new Vec2(p.x + dx * cos - dy * sin, p.y + dx * sin + dy * cos, this.uuid);
  }

  toString(): string {
    return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }

  static toPoint(v: Vec2 | { x: number; y: number }): Point {
    return new Point(v.x, v.y);
  }

  static fromPoint(p: { x: number; y: number }): Vec2 {
    return new Vec2(p.x, p.y);
  }
}

export function getPolyCentroid(poly: Array<{ x: number; y: number }>) {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const a = xi * yj - xj * yi;
    area += a;
    cx += (xi + xj) * a;
    cy += (yi + yj) * a;
  }
  area /= 2;
  if (area === 0) return new Vec2(0, 0);
  cx /= 6 * area;
  cy /= 6 * area;
  return new Vec2(cx, cy);
}

export function isVectorInPoly(
  v: { x: number; y: number },
  poly: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > v.y !== yj > v.y && v.x < ((xj - xi) * (v.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getVectorsAngle(
  v1: { x: number; y: number },
  v2: { x: number; y: number },
  originatingFrom?: { x: number; y: number },
) {
  if (!originatingFrom) {
    return (Math.atan2(v2.y - v1.y, v2.x - v1.x) * 180) / Math.PI;
  }
  const a1 = v1.x - originatingFrom.x;
  const a2 = v1.y - originatingFrom.y;
  const b1 = v2.x - originatingFrom.x;
  const b2 = v2.y - originatingFrom.y;
  const dot = a1 * b1 + a2 * b2;
  const lenA = Math.hypot(a1, a2);
  const lenB = Math.hypot(b1, b2);
  if (lenA === 0 || lenB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (lenA * lenB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function getPerpendicularPorjectionOnLine(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  clampToSegment = false,
) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const denom = dx * dx + dy * dy || 1;
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / denom;
  if (clampToSegment) t = Math.max(0, Math.min(1, t));
  return { x: lineStart.x + t * dx, y: lineStart.y + t * dy };
}

export function isPointInsideConvexQuad(
  v: { x: number; y: number },
  quad: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ],
) {
  const side = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    (p2.x - p1.x) * (v.y - p1.y) - (p2.y - p1.y) * (v.x - p1.x);
  const signs = [
    side(quad[0], quad[1]),
    side(quad[1], quad[2]),
    side(quad[2], quad[3]),
    side(quad[3], quad[0]),
  ]
    .map(Math.sign)
    .filter((s) => s !== 0);
  if (signs.length === 0) return true;
  return signs.every((s) => s === signs[0]);
}

export function getDistanceFromPointToQuad(
  v: { x: number; y: number },
  quad: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ],
) {
  const edges: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
    [quad[0], quad[1]],
    [quad[1], quad[2]],
    [quad[2], quad[3]],
    [quad[3], quad[0]],
  ];
  let minDist = Infinity;
  for (const [p1, p2] of edges) {
    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) <= 1e-9) {
      minDist = Math.min(minDist, Math.hypot(v.x - p1.x, v.y - p1.y));
      continue;
    }
    const foot = getPerpendicularPorjectionOnLine(v, p1, p2, true);
    minDist = Math.min(minDist, Math.hypot(v.x - foot.x, v.y - foot.y));
  }
  if (minDist === 0) return 0;
  const [a, b, c, d] = quad;
  const area =
    Math.abs(
      a.x * b.y - b.x * a.y + b.x * c.y - c.x * b.y + c.x * d.y - d.x * c.y + d.x * a.y - a.x * d.y,
    ) / 2;
  if (area === 0) return minDist;
  return isPointInsideConvexQuad(v, quad) ? 0 : minDist;
}

export function getDistanceFromPerpendicularProjection(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
) {
  const proj = getPerpendicularPorjectionOnLine(point, lineStart, lineEnd);
  return Math.hypot(point.x - proj.x, point.y - proj.y);
}

export function findIntersectionBetweenSegments(
  s1: Array<{ x: number; y: number }>,
  s2: Array<{ x: number; y: number }>,
) {
  const [a, b] = s1;
  const [c, d] = s2;
  const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (denom === 0) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return new Vec2(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
  }
  return null;
}

export function rotateVector(
  v: { x: number; y: number },
  degrees: number,
  pivot?: { x: number; y: number },
) {
  const p = pivot || { x: 0, y: 0 };
  const rad = (degrees * Math.PI) / 180;
  return {
    x: p.x + (v.x - p.x) * Math.cos(rad) - (v.y - p.y) * Math.sin(rad),
    y: p.y + (v.x - p.x) * Math.sin(rad) + (v.y - p.y) * Math.cos(rad),
  };
}

export function getPathTurnDirection(
  startVec: { x: number; y: number },
  pivotVec: { x: number; y: number },
  endVec: { x: number; y: number },
  tolerance = 0,
) {
  const dx1 = pivotVec.x - startVec.x;
  const dy1 = pivotVec.y - startVec.y;
  const len1 = Math.hypot(dx1, dy1) || 1;
  const nx1 = dx1 / len1;
  const ny1 = dy1 / len1;
  const dx2 = endVec.x - startVec.x;
  const dy2 = endVec.y - startVec.y;
  const len2 = Math.hypot(dx2, dy2) || 1;
  const nx2 = dx2 / len2;
  const ny2 = dy2 / len2;
  const cross = nx1 * ny2 - ny1 * nx2;
  return cross > tolerance ? 'right' : cross < -tolerance ? 'left' : 'straight';
}

export function computeTipShear(
  startVec: { x: number; y: number },
  jointVec: { x: number; y: number },
  endVec: { x: number; y: number },
) {
  const angle = getVectorsAngle(startVec, endVec, jointVec);
  const halfAngle = Math.max(10, angle / 2);
  const shearFactor = 1 / Math.tan((halfAngle * Math.PI) / 180);
  const isRightTurn = getPathTurnDirection(startVec, jointVec, endVec) === 'right';
  return shearFactor * (isRightTurn ? 1 : -1);
}
