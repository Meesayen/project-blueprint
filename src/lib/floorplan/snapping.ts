import { Vec2, getDistanceFromPointToQuad, getPerpendicularPorjectionOnLine } from '../vectors';
import { FpWall } from './wall';
import { getGridSnapStepPx } from '../grid';

export type WallSnap = {
  wall: FpWall;
  point: Vec2;
  kind: 'endpoint' | 'edge';
  distance: number;
};

export type AlignmentGuide = {
  axis: 'x' | 'y';
  anchor: Vec2;
  point: Vec2;
};

type Axis = 'x' | 'y';

type SnapProbe = {
  pointer: Vec2;
  maxDistance: number;
  endpointDistance: number;
};

export function collectWallEndpoints(canvas: any): Vec2[] {
  const endpoints = new Map<string, Vec2>();
  for (const object of canvas?.getObjects?.() ?? []) {
    if (!(object instanceof FpWall) || object.isDraft) continue;
    const [from, to] = object.calcVectors();
    if (from.distance(to) < 2) continue;
    endpoints.set(from.id, from);
    endpoints.set(to.id, to);
  }
  return [...endpoints.values()];
}

function probeWall(wall: FpWall, probe: SnapProbe): WallSnap | null {
  if (wall.isDraft) return null;

  const distance = getDistanceFromPointToQuad(probe.pointer, wall.imprintQuad as any);
  if (distance > probe.maxDistance) return null;

  const [from, to] = wall.vectors;
  const onCenterline = getPerpendicularPorjectionOnLine(probe.pointer, from, to, true);
  const projected = new Vec2(onCenterline.x, onCenterline.y);

  const atFrom = projected.distance(from) < probe.endpointDistance;
  const atTo = projected.distance(to) < probe.endpointDistance;

  if (atFrom || atTo) {
    return {
      wall,
      point: (atFrom ? from : to).clone(),
      kind: 'endpoint',
      distance,
    };
  }

  return { wall, point: projected, kind: 'edge', distance };
}

export function findNearestWallSnap(
  canvas: any,
  pointerVec: Vec2,
  ignoreWalls: FpWall[] = [],
  distancePx = 8,
): WallSnap | null {
  const zoom = canvas?.getZoom?.() ?? 1;
  const probe: SnapProbe = {
    pointer: pointerVec,
    maxDistance: distancePx / zoom,
    endpointDistance: 8 / zoom,
  };

  // First qualifying wall wins, matching the draw pipeline's wall ordering.
  for (const object of canvas?.getObjects?.() ?? []) {
    if (!(object instanceof FpWall) || ignoreWalls.includes(object)) continue;
    const hit = probeWall(object, probe);
    if (hit) return hit;
  }

  return null;
}

function snapAxis(
  mutVec: Vec2,
  anchors: Vec2[],
  axis: Axis,
  tolerance: number,
  pivotVec: Vec2 | null,
  guides: AlignmentGuide[],
) {
  for (const anchor of anchors) {
    if (anchor.id === mutVec.id) continue;
    if (pivotVec && anchor.distance(pivotVec) < 0.5) continue;

    const current = axis === 'x' ? mutVec.x : mutVec.y;
    const target = axis === 'x' ? anchor.x : anchor.y;
    if (Math.abs(current - target) >= tolerance) continue;

    if (axis === 'x') mutVec.x = target;
    else mutVec.y = target;

    guides.push({ axis, anchor: anchor.clone(), point: mutVec.clone() });
  }
}

export function alignToJunctionAxes(
  canvas: any,
  junctionVectors: Vec2[],
  mutVec: Vec2,
  opts: { pivotVec: Vec2 | null; tolerancePx: number; onlyAxis: Axis | null },
): AlignmentGuide[] {
  const zoom = canvas?.getZoom?.() ?? 1;
  const tolerance = opts.tolerancePx / (zoom || 1);
  const anchors = [...junctionVectors].sort((a, b) => b.distance(mutVec) - a.distance(mutVec));
  const guides: AlignmentGuide[] = [];

  if (opts.onlyAxis !== 'y') {
    snapAxis(mutVec, anchors, 'x', tolerance, opts.pivotVec, guides);
  }
  if (opts.onlyAxis !== 'x') {
    snapAxis(mutVec, anchors, 'y', tolerance, opts.pivotVec, guides);
  }

  return guides;
}

export function lockDominantAxis(mutVec: Vec2, pivotVec: Vec2): Axis {
  if (Math.abs(mutVec.x - pivotVec.x) >= Math.abs(mutVec.y - pivotVec.y)) {
    mutVec.y = pivotVec.y;
    return 'y';
  }
  mutVec.x = pivotVec.x;
  return 'x';
}

function nearestMultiple(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function snapToGrid(canvas: any, mutVec: Vec2, options: { axis?: 'both' | Axis } = {}) {
  const zoom = canvas?.getZoom?.() ?? 1;
  const pxPerCm = canvas?.fpGrid?.pxPerCm ?? 1;
  const step = getGridSnapStepPx({ pxPerCm, zoom }) ?? 20;
  const axis = options.axis ?? 'both';

  if (axis !== 'y') mutVec.x = nearestMultiple(mutVec.x, step);
  if (axis !== 'x') mutVec.y = nearestMultiple(mutVec.y, step);
}
