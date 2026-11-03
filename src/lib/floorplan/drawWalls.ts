import { FpWall } from './wall';
import { Vec2 } from '../vectors';
import {
  collectWallEndpoints,
  findNearestWallSnap,
  alignToJunctionAxes,
  lockDominantAxis,
  snapToGrid,
  type AlignmentGuide,
  type WallSnap,
} from './snapping';
import { getActivePalette } from './palette';

export function setupDrawWalls(canvas: any, onWallAdded?: () => void) {
  let startingPoint: Vec2 | null = null;
  let pointer: Vec2 | null = null;
  let draftWall: FpWall | null = null;
  let connection: WallSnap | null = null;
  let guidelines: AlignmentGuide[] = [];

  const pointerRadiusPx = 6;
  const pointerStrokePx = 2;
  const draftThicknessPx = 6;
  const draftPointEpsilon = 0.0001;

  function createDraftWall(from: Vec2, to: Vec2, zoom: number) {
    const draft = FpWall.fromVectors(from, to);
    draft.isDraft = true;
    draft.fill = getActivePalette().draftFill;
    draft.thickness = draftThicknessPx / zoom;
    draft.evented = false;
    draft.selectable = false;
    draft.excludeFromExport = true;
    canvas.add(draft);
    return draft;
  }

  function applyPalette() {
    if (draftWall) draftWall.fill = getActivePalette().draftFill;
    canvas.requestRenderAll();
  }

  function splitWallAt(wall: FpWall, at: Vec2) {
    const [v1, v2] = wall.vectors;
    if (at.distance(v1) < 2 || at.distance(v2) < 2) return;
    canvas.remove(wall);
    canvas.add(FpWall.fromVectors(v1, at));
    canvas.add(FpWall.fromVectors(at, v2));
  }

  function softReset() {
    if (draftWall) {
      canvas.remove(draftWall);
      draftWall = null;
    }
    guidelines = [];
    connection = null;
    canvas.requestRenderAll();
  }

  function getSnappedPointerVec(rawPointer: Vec2, e: any): Vec2 {
    const pointerVec = rawPointer.clone();
    const shift = !!(e && e.shiftKey);
    const axisLock = shift;
    const grid = true;
    const align = true;
    const freeform = false;

    if (freeform) return pointerVec;

    const rawVec = pointerVec.clone();

    let freeAxis: 'x' | 'y' | null = null;
    if (startingPoint && axisLock) {
      freeAxis = lockDominantAxis(pointerVec, startingPoint);
    }

    if (startingPoint && align) {
      guidelines = alignToJunctionAxes(canvas, collectWallEndpoints(canvas), pointerVec, {
        pivotVec: startingPoint,
        tolerancePx: grid ? 3 : 15,
        onlyAxis: freeAxis,
      });
    } else {
      guidelines = [];
    }

    const ignore = draftWall ? [draftWall] : [];
    const snapDistPx = startingPoint && !freeAxis ? 8 : 32;
    let snap = findNearestWallSnap(canvas, rawVec, ignore, snapDistPx);
    if (snap && snap.kind === 'edge' && freeAxis) {
      snap = findNearestWallSnap(canvas, pointerVec, ignore, snapDistPx) ?? snap;
    }

    if (snap) {
      pointerVec.x = snap.point.x;
      pointerVec.y = snap.point.y;
      connection = { ...snap, point: snap.point.clone() };
      return pointerVec;
    }
    connection = null;
    snapToGrid(canvas, pointerVec, { axis: freeAxis ?? 'both' });
    return pointerVec;
  }

  function eventScenePoint(o: any): Vec2 {
    const p = o?.scenePoint ?? (o?.e ? canvas.getScenePoint(o.e) : { x: 0, y: 0 });
    return new Vec2(p.x, p.y);
  }

  function onMouseMove(o: any) {
    const zoom = canvas?.getZoom?.() ?? 1;
    const raw = eventScenePoint(o);
    pointer = getSnappedPointerVec(raw, o.e);

    if (draftWall && startingPoint) {
      const start = startingPoint.clone();
      const end = pointer.clone();
      if (start.distance(end) < draftPointEpsilon) end.x += draftPointEpsilon;
      draftWall.adjustVectors(start, end);
      draftWall.thickness = draftThicknessPx / zoom;
      draftWall._quadsDirty = true;
    }
    canvas.requestRenderAll();
  }

  function onMouseDown(o: any) {
    const zoom = canvas?.getZoom?.() ?? 1;
    const raw = eventScenePoint(o);
    const snapped = getSnappedPointerVec(raw, o.e);

    if (!startingPoint) {
      startingPoint = snapped.clone();
      const startConn = connection ? { ...connection, point: connection.point.clone() } : null;
      if (startConn && startConn.kind === 'edge') {
        splitWallAt(startConn.wall, startConn.point);
      }

      const end = snapped.clone();
      if (startingPoint.distance(end) < draftPointEpsilon) end.x += draftPointEpsilon;
      draftWall = createDraftWall(startingPoint, end, zoom);
      canvas.requestRenderAll();
      return;
    }

    if (startingPoint.distance(snapped) < 10) return;

    const startVec = startingPoint.clone();
    const endVec = connection?.point ? connection.point.clone() : snapped.clone();

    const endConn = connection;
    if (endConn && endConn.kind === 'edge') {
      splitWallAt(endConn.wall, endConn.point);
    }

    if (draftWall) {
      canvas.remove(draftWall);
      draftWall = null;
    }

    const wall = FpWall.fromVectors(startVec, endVec);
    canvas.add(wall);

    onWallAdded?.();

    startingPoint = endVec.clone();
    const nextEnd = endVec.clone();
    if (startingPoint.distance(nextEnd) < draftPointEpsilon) nextEnd.x += draftPointEpsilon;
    draftWall = createDraftWall(startingPoint, nextEnd, zoom);
    canvas.requestRenderAll();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      softReset();
      startingPoint = null;
      pointer = null;
      canvas.requestRenderAll();
    }
  }

  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const palette = getActivePalette();
    const vpt = canvas.viewportTransform;
    const toScreen = (p: { x: number; y: number }) => ({
      x: p.x * vpt[0] + p.y * vpt[2] + vpt[4],
      y: p.x * vpt[1] + p.y * vpt[3] + vpt[5],
    });

    ctx.save();
    // junction alignment guidelines
    ctx.strokeStyle = palette.guidelineStroke;
    ctx.lineWidth = 1;
    for (const g of guidelines) {
      const a = toScreen(g.anchor);
      const b = toScreen(g.point);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // start point dot (palette start fill + stroke)
    if (startingPoint) {
      const p = toScreen(startingPoint);
      ctx.beginPath();
      ctx.arc(p.x, p.y, pointerRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = palette.startFill;
      ctx.fill();
      ctx.lineWidth = pointerStrokePx;
      ctx.strokeStyle = palette.startStroke;
      ctx.stroke();
    }
    // pointer dot (lighter when free, darker when snapped)
    if (pointer) {
      const p = toScreen(pointer);
      ctx.beginPath();
      ctx.arc(p.x, p.y, pointerRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = connection ? palette.cursorSnapFill : palette.cursorFill;
      ctx.fill();
      ctx.lineWidth = pointerStrokePx;
      ctx.strokeStyle = palette.cursorStroke;
      ctx.stroke();
    }
    ctx.restore();
  }

  function reset() {
    softReset();
    startingPoint = null;
    pointer = null;
    draftWall = null;
    connection = null;
    guidelines = [];
    canvas.requestRenderAll();
  }

  return {
    enter() {
      canvas.defaultCursor = 'crosshair';
      canvas.on('mouse:move', onMouseMove);
      canvas.on('mouse:down', onMouseDown);
      window.addEventListener('keydown', onKeyDown);
      canvas.requestRenderAll();
    },
    exit() {
      reset();
      canvas.defaultCursor = 'default';
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:down', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      canvas.requestRenderAll();
    },
    drawOverlay,
    applyPalette,
    reset,
  };
}
