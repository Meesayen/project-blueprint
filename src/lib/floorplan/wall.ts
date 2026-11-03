import { Line, Point, util } from 'fabric';
import {
  Vec2,
  computeTipShear,
  getVectorsAngle,
  isVectorInPoly,
  rotateVector,
  getPerpendicularPorjectionOnLine,
} from '../vectors';
import { FpRoom } from './room';
import { getGridSnapStepPx } from '../grid';
import { getActivePalette } from './palette';

type Quad = [Vec2, Vec2, Vec2, Vec2];
type RoomSides = [boolean, boolean, boolean, boolean];

const SIDE_PROBE_MIX = 0.05;
const SIDE_PROBE_ANGLE = 15;

// Samples four points just off the wall's end caps to learn which sides face a room.
function probeRoomSides(v1: Vec2, v2: Vec2, isInsideRoom: (point: Vec2) => boolean): RoomSides {
  const nearV1 = v1.mix(v2, SIDE_PROBE_MIX);
  const nearV2 = v2.mix(v1, SIDE_PROBE_MIX);
  const samples = [
    nearV1.clone().subtract(v1).rotateByDeg(-SIDE_PROBE_ANGLE).add(v1),
    nearV2.clone().subtract(v2).rotateByDeg(SIDE_PROBE_ANGLE).add(v2),
    nearV2.clone().subtract(v2).rotateByDeg(-SIDE_PROBE_ANGLE).add(v2),
    nearV1.clone().subtract(v1).rotateByDeg(SIDE_PROBE_ANGLE).add(v1),
  ];
  return samples.map(isInsideRoom) as RoomSides;
}

function offsetEnds(v1: Vec2, v2: Vec2, tip1: Vec2, tip2: Vec2): Quad {
  return [
    v1.clone().subtract(tip1),
    v2.clone().subtract(tip2),
    v2.clone().add(tip2),
    v1.clone().add(tip1),
  ];
}

function halfWidthEnds(v1: Vec2, v2: Vec2, tip1: Vec2, tip2: Vec2): Quad {
  return offsetEnds(v1, v2, tip1.divideScalar(2), tip2.divideScalar(2));
}

// Room-side clipping: caps that face a room get pulled onto the centerline so the
// wall reads as sitting outside that room instead of overlapping it.
function clipCapsToRooms(base: Vec2[], v1: Vec2, v2: Vec2, sides: RoomSides) {
  const quad: Quad = base.map((corner) => corner.clone()) as Quad;
  const tip1 = v1.clone().subtract(base[0]);
  const tip2 = v2.clone().subtract(base[1]);
  let touched = 0;

  if (sides[0]) {
    touched++;
    quad[0] = v1.clone();
    quad[3] = quad[3].add(tip1);
  }
  if (sides[1]) {
    touched++;
    quad[1] = v2.clone();
    quad[2] = quad[2].add(tip2);
  }
  if (sides[2]) {
    touched++;
    quad[2] = v2.clone();
    quad[1] = quad[1].subtract(tip2);
  }
  if (sides[3]) {
    touched++;
    quad[3] = v1.clone();
    quad[0] = quad[0].subtract(tip1);
  }

  return { quad, touched, tip1, tip2 };
}

function flattenTipPair(quad: Quad, end: 'v1' | 'v2', tip: Vec2, halfThickness: number) {
  if (end === 'v1') {
    quad[0] = quad[0].add(tip).subtractScalarY(halfThickness);
    quad[3] = quad[3].subtract(tip).addScalarY(halfThickness);
  } else {
    quad[1] = quad[1].add(tip).subtractScalarY(halfThickness);
    quad[2] = quad[2].subtract(tip).addScalarY(halfThickness);
  }
}

function traceQuad(ctx: CanvasRenderingContext2D, quad: Vec2[]) {
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  for (let i = 1; i < quad.length; i++) {
    ctx.lineTo(quad[i].x, quad[i].y);
  }
  ctx.closePath();
}

function paintQuad(
  ctx: CanvasRenderingContext2D,
  quad: Vec2[],
  paint: { fill?: string; stroke?: string; lineWidth?: number },
  scaleX: number,
  scaleY: number,
) {
  traceQuad(ctx, quad);
  ctx.save();
  ctx.scale(1 / scaleX, 1 / scaleY);
  if (paint.fill != null) {
    ctx.fillStyle = paint.fill;
    ctx.fill();
  }
  if (paint.stroke != null) {
    ctx.strokeStyle = paint.stroke;
    ctx.lineWidth = paint.lineWidth ?? 1;
    ctx.stroke();
  }
  ctx.restore();
}

export class FpWall extends Line {
  thickness = 8;
  _vectors: [Vec2, Vec2] = [new Vec2(0, 0), new Vec2(0, 0)];
  get vectors(): [Vec2, Vec2] {
    return [this._vectors[0].clone(), this._vectors[1].clone()];
  }
  set vectors(vectors: [Vec2, Vec2]) {
    this.adjustVectors(vectors[0], vectors[1]);
  }
  get imprintQuad(): [Vec2, Vec2, Vec2, Vec2] {
    if (this._quadsDirty || !this._drawQuad.length) this.rebuildQuads();
    return this.toWorldQuad(this._drawQuad) as [Vec2, Vec2, Vec2, Vec2];
  }
  connections: { v1?: { wall: FpWall; v: Vec2 }[]; v2?: { wall: FpWall; v: Vec2 }[] } = {};
  _baseQuad: Vec2[] = [];
  _drawQuad: Vec2[] = [];
  _roomSides: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  _neighborVectors: {
    v1: { wall: FpWall; v: Vec2 }[];
    v2: { wall: FpWall; v: Vec2 }[];
  } = {
    v1: [],
    v2: [],
  };
  _frozenRoomSides = false;
  _frozenRoomSidesCache: [boolean, boolean, boolean, boolean] | null = null;
  _quadsDirty = true;
  isDraft = false;

  constructor(
    coords: [number, number, number, number] = [0, 0, 0, 0],
    options: Record<string, unknown> = {},
  ) {
    const thickness = (options.thickness as number) ?? 8;
    super(coords, {
      selectable: true,
      evented: true,
      visible: true,
      objectCaching: false,
      hasControls: false,
      hasBorders: false,
      fill: getActivePalette().wallFill,
      stroke: getActivePalette().wallStroke,
      strokeWidth: 2,
      ...options,
    });
    this.thickness = thickness;
    this.padding = thickness;
    this.on('modified', () => {
      this.calcVectors();
      this.canvas?.requestRenderAll();
    });
    this.on('moving', (e: any) => this._handleMovement(e));
    this.calcVectors();
  }

  adjustVectors(v1: Vec2, v2: Vec2, { fireModified = true }: { fireModified?: boolean } = {}) {
    const rulerCenterVec = v1.clone().mix(v2, 0.5);
    const rulerLen = v2.distance(v1);
    const angle = (Math.atan2(v2.y - v1.y, v2.x - v1.x) * 180) / Math.PI;

    const tw = new Line([v1.x, v1.y, rulerLen + v1.x, v1.y], {});
    tw.set('angle', angle);
    tw.setPositionByOrigin(Vec2.toPoint(rulerCenterVec), 'center', 'center');
    tw.setCoords();

    this.set({
      angle,
      top: tw.top,
      left: tw.left,
      width: tw.width,
      height: tw.height,
    });
    this.x1 = tw.x1;
    this.y1 = tw.y1;
    this.x2 = tw.x2;
    this.y2 = tw.y2;
    this.setCoords();
    this.calcVectors();
    if (fireModified) this.fire('modified');
  }

  updateEndpoints(x1: number, y1: number, x2: number, y2: number) {
    this.adjustVectors(new Vec2(x1, y1), new Vec2(x2, y2));
  }

  update(config: any) {
    if (config?.vectors) {
      this.adjustVectors(config.vectors[0], config.vectors[1], { fireModified: false });
    }
    this.setCoords();
    this.canvas?.requestRenderAll();
    return this;
  }

  connect(end: 1 | 2, wall: FpWall, v: Vec2) {
    const key = end === 1 ? 'v1' : 'v2';
    this.connections[key] = this.connections[key] || [];
    this.connections[key]!.push({ wall, v });
  }

  disconnect(end: 1 | 2) {
    const key = end === 1 ? 'v1' : 'v2';
    delete this.connections[key];
  }

  calcVectors() {
    const mat = this.calcTransformMatrix();
    const { x1, x2, y1, y2 } = this.calcLinePoints();
    const p1 = util.transformPoint(new Point(x1, y1), mat);
    const p2 = util.transformPoint(new Point(x2, y2), mat);
    const [prevV1, prevV2] = this._vectors;
    this._vectors = [new Vec2(p1.x, p1.y, prevV1?.uuid), new Vec2(p2.x, p2.y, prevV2?.uuid)];
    this._quadsDirty = true;
    return this.vectors;
  }

  toWorldQuad(vectors: Vec2[]): [Vec2, Vec2, Vec2, Vec2] {
    const [a, b, c, d] = vectors;
    const mat = this.calcTransformMatrix();
    const pA = util.transformPoint(Vec2.toPoint(a), mat);
    const pB = util.transformPoint(Vec2.toPoint(b), mat);
    const pC = util.transformPoint(Vec2.toPoint(c), mat);
    const pD = util.transformPoint(Vec2.toPoint(d), mat);
    return [new Vec2(pA.x, pA.y), new Vec2(pB.x, pB.y), new Vec2(pC.x, pC.y), new Vec2(pD.x, pD.y)];
  }

  rebuildQuads() {
    this.buildBaseQuad();
    if (this._frozenRoomSides && this._frozenRoomSidesCache) {
      this._roomSides = [...this._frozenRoomSidesCache];
    } else {
      this.detectRoomSides();
    }
    this.buildDrawQuad();
    this.dirty = true;
    this._quadsDirty = false;
  }

  freezeQuadsForDrag() {
    // kept for API parity with v4; render vectors are recomputed every draw anyway
    this.rebuildQuads();
  }

  unfreezeQuadsForDrag() {
    // no-op (kept for API parity)
  }

  freezeRoomSidesForDrag() {
    if (this._frozenRoomSides) return;
    this.detectRoomSides();
    this._frozenRoomSidesCache = [...this._roomSides];
    this._frozenRoomSides = true;
  }

  unfreezeRoomSidesForDrag() {
    this._frozenRoomSides = false;
    this._frozenRoomSidesCache = null;
  }

  private buildBaseQuad() {
    const [from, to] = this.vectors;
    const wallVectors: [Vec2, Vec2] = [from, to];
    const startCtx = this.resolveEndpointContext(1, wallVectors);
    const endCtx = this.resolveEndpointContext(2, wallVectors);

    this._neighborVectors.v1 = this._cloneWallConnections(startCtx.terminalVectors);
    this._neighborVectors.v2 = this._cloneWallConnections(endCtx.terminalVectors);

    const tip1 = new Vec2(0, this.thickness);
    const tip2 = new Vec2(0, this.thickness);

    if (startCtx.widestConnectionVector) {
      tip1.x -= tip1.y * computeTipShear(to, from, startCtx.widestConnectionVector);
    }
    if (endCtx.widestConnectionVector) {
      tip2.x -= tip2.y * computeTipShear(from, to, endCtx.widestConnectionVector);
    }

    const { x1, x2, y1, y2 } = this.calcLinePoints();
    this._baseQuad = offsetEnds(new Vec2(x1, y1), new Vec2(x2, y2), tip1, tip2);
  }

  private detectRoomSides() {
    if (this._frozenRoomSides && this._frozenRoomSidesCache) {
      this._roomSides = [...this._frozenRoomSidesCache] as RoomSides;
      return;
    }

    const sides: RoomSides = [false, false, false, false];
    const [from, to] = this.vectors;

    for (const object of this.canvas?.getObjects?.() ?? []) {
      if (!(object instanceof FpRoom) || typeof object.containsVector !== 'function') continue;
      const hits = probeRoomSides(from, to, (point) => object.containsVector(point));
      for (let i = 0; i < hits.length; i++) {
        if (hits[i]) sides[i] = true;
      }
    }

    this._roomSides = sides;
  }

  isInteriorWall() {
    const count = this._roomSides.filter(Boolean).length;
    return count >= 3 || count <= 1;
  }

  private buildDrawQuad() {
    const { x1, x2, y1, y2 } = this.calcLinePoints();
    const v1 = new Vec2(x1, y1);
    const v2 = new Vec2(x2, y2);

    const { quad, touched, tip1, tip2 } = clipCapsToRooms(this._baseQuad, v1, v2, this._roomSides);
    this._drawQuad = quad;

    const externalEnabled = (this.canvas as any)?.spkSettings?.externalWallsEnabled !== false;
    if (externalEnabled && touched === 2) return;

    const halfThickness = this.thickness / 2;
    const innerQuad = halfWidthEnds(v1, v2, tip1, tip2);

    if (this._neighborVectors.v1.length > 1) {
      flattenTipPair(innerQuad, 'v1', tip1.divideScalar(2), halfThickness);
    }
    if (this._neighborVectors.v2.length > 1) {
      flattenTipPair(innerQuad, 'v2', tip2.divideScalar(2), halfThickness);
    }

    this._drawQuad = innerQuad;
  }

  private neighborsAtNode(node: 1 | 2, wallVectors: [Vec2, Vec2]) {
    const map = (this.canvas as any)?.fpWallJunctions as
      | Map<string, Set<{ wall: FpWall; node: 1 | 2 }>>
      | undefined;
    if (!map) return [];
    if (this.isDraft) return [];
    const junctionVector = wallVectors[node === 1 ? 0 : 1];
    const id = junctionVector.id;
    const set = map.get(id);
    if (!set) return [];
    return [...set].flatMap((j) => {
      if (j.wall === this) return [];
      return { v: j.wall.vectors[j.node === 1 ? 1 : 0], wall: j.wall };
    }) as { wall: FpWall; v: Vec2 }[];
  }

  private pickWidestNeighbor(
    node: 1 | 2,
    terminalVectors: { wall: FpWall; v: Vec2 }[],
    wallVectors: [Vec2, Vec2],
  ) {
    const junctionVector = node === 1 ? wallVectors[0] : wallVectors[1];
    const oppositeVector = node === 1 ? wallVectors[1] : wallVectors[0];
    let widestAngle: number | null = null;
    let widestVec: Vec2 | null = null;
    for (const t of terminalVectors) {
      if (t.wall.isInteriorWall() && !this.isInteriorWall()) continue;
      const angle = getVectorsAngle(oppositeVector, t.v, junctionVector);
      if (widestAngle === null || widestAngle === 0 || angle > widestAngle) {
        widestAngle = angle;
        widestVec = t.v.clone();
      }
    }
    return widestVec;
  }

  private resolveEndpointContext(node: 1 | 2, wallVectors: [Vec2, Vec2]) {
    const terminalVectors = this.neighborsAtNode(node, wallVectors);
    return {
      terminalVectors,
      widestConnectionVector: this.pickWidestNeighbor(node, terminalVectors, wallVectors),
    };
  }

  private _cloneWallConnections(connections: { wall: FpWall; v: Vec2 }[]) {
    return connections.map((c) => ({ wall: c.wall, v: c.v.clone() }));
  }

  getJunctions() {
    const junctions = (this.canvas as any)?.fpWallJunctions as
      | Map<string, Set<{ wall: FpWall; node: 1 | 2 }>>
      | undefined;
    if (!junctions) return [];
    return [...junctions.values()].filter((group) =>
      [...group].some((junction) => junction.wall === this),
    );
  }

  private _adjustJunctions() {
    const [v1, v2] = this.calcVectors();
    const canvas = this.canvas as any;
    const run = () => {
      for (const set of this.getJunctions()) {
        const movingNode = [...set].find((j) => j.wall === this)?.node;
        for (const { wall, node } of set) {
          if (wall === this) continue;
          if (node === 1) {
            if (movingNode === 1) wall.set({ vectors: [v1, wall.vectors[1]] });
            else wall.set({ vectors: [v2, wall.vectors[1]] });
          }
          if (node === 2) {
            if (movingNode === 1) wall.set({ vectors: [wall.vectors[0], v1] });
            else wall.set({ vectors: [wall.vectors[0], v2] });
          }
        }
      }
    };
    if (typeof canvas?.runWithoutHistory === 'function') canvas.runWithoutHistory(run);
    else run();
    canvas?.requestRenderAll();
  }

  private _handleMovement(e: any) {
    if (!e.transform) return;
    const original = e.transform.original;
    const target = e.transform.target;
    const startVec = new Vec2(original.left, original.top);
    const movementVec = new Vec2(target.left, target.top);
    let nextTop = movementVec.y;
    let nextLeft = movementVec.x;

    const canvas = this.canvas as any;
    const snapStep = getSnapStep(canvas);

    if (e.e?.shiftKey) {
      const angleDeg =
        (Math.atan2(movementVec.y - startVec.y, movementVec.x - startVec.x) * 180) / Math.PI;
      const dirDeg = (this.angle ?? 0) + 90 * (angleDeg > 0 ? -1 : 1);
      const perpendicularLineEndVec = rotateVector(
        { x: startVec.x * 2, y: startVec.y },
        dirDeg,
        startVec,
      );
      const perpendicularMovementVec = getPerpendicularPorjectionOnLine(
        movementVec,
        startVec,
        perpendicularLineEndVec,
      );
      const parallelLineEndVec = rotateVector(
        { x: startVec.x * 2, y: startVec.y },
        (this.angle ?? 0) * (angleDeg > 0 ? -1 : 1),
        startVec,
      );
      const parallelMovementVec = getPerpendicularPorjectionOnLine(
        movementVec,
        startVec,
        parallelLineEndVec,
      );
      if (
        Math.hypot(
          perpendicularMovementVec.x - movementVec.x,
          perpendicularMovementVec.y - movementVec.y,
        ) > Math.hypot(parallelMovementVec.x - movementVec.x, parallelMovementVec.y - movementVec.y)
      ) {
        nextTop = parallelMovementVec.y;
        nextLeft = parallelMovementVec.x;
      } else {
        nextTop = perpendicularMovementVec.y;
        nextLeft = perpendicularMovementVec.x;
      }
    }

    if (snapStep && canvas) {
      const [v1, v2] = this.calcVectors().map((v) => v.clone());
      const movementDelta = new Vec2(nextLeft - movementVec.x, nextTop - movementVec.y);
      const nextV1 = v1.clone().add(movementDelta);
      const nextV2 = v2.clone().add(movementDelta);
      const getCorrection = (vector: { x: number; y: number }) => {
        const originalVec = new Vec2(vector.x, vector.y);
        const snapped = originalVec.clone();
        snapped.x = Math.round(snapped.x / snapStep) * snapStep;
        snapped.y = Math.round(snapped.y / snapStep) * snapStep;
        return snapped.subtract(originalVec);
      };
      const correctionFromV1 = getCorrection(nextV1);
      const correctionFromV2 = getCorrection(nextV2);
      const zero = new Vec2(0, 0);
      const correction =
        correctionFromV1.distanceSq(zero) <= correctionFromV2.distanceSq(zero)
          ? correctionFromV1
          : correctionFromV2;
      nextTop += correction.y;
      nextLeft += correction.x;
    }

    this.set({ top: nextTop, left: nextLeft });
    this.setCoords();
    this._adjustJunctions();
  }

  // fabric 7 target finding uses getCoords(), not containsPoint
  override getCoords() {
    if (this._quadsDirty || !this._drawQuad.length) this.rebuildQuads();
    const real = this.toWorldQuad(this._drawQuad);
    return real.map((v) => new Point(v.x, v.y)) as any;
  }

  override containsPoint(point: { x: number; y: number }) {
    if (this._quadsDirty || !this._drawQuad.length) this.rebuildQuads();
    return isVectorInPoly(point, this.toWorldQuad(this._drawQuad));
  }

  override drawBorders(ctx: CanvasRenderingContext2D) {
    if (this._quadsDirty || !this._drawQuad.length) this.rebuildQuads();
    paintQuad(
      ctx,
      this._drawQuad,
      { stroke: getActivePalette().wallHighlight, lineWidth: 2 },
      this.scaleX,
      this.scaleY,
    );
    return this;
  }

  renderHighlight(ctx: CanvasRenderingContext2D) {
    if (this._quadsDirty || !this._drawQuad.length) this.rebuildQuads();
    const toScreen = util.multiplyTransformMatrices(
      this.getViewportTransform(),
      this.calcTransformMatrix(),
    );
    ctx.save();
    ctx.transform(toScreen[0], toScreen[1], toScreen[2], toScreen[3], toScreen[4], toScreen[5]);
    this.drawBorders(ctx);
    ctx.restore();
  }

  override drawObject(ctx: CanvasRenderingContext2D, forClipping?: boolean) {
    if ((this.canvas as any)?.fpWallJunctions?.size || this.isDraft) {
      this.rebuildQuads();
    }
    super.drawObject(ctx, forClipping, {} as any);
  }

  override _render(ctx: CanvasRenderingContext2D) {
    if (this._quadsDirty || !this._drawQuad.length) {
      this.rebuildQuads();
    }
    paintQuad(ctx, this._drawQuad, { fill: this.fill as string }, this.scaleX, this.scaleY);
  }

  override isOnScreen() {
    return true;
  }

  override isPartiallyOnScreen() {
    return true;
  }

  static fromVectors(v1: Vec2, v2: Vec2, options: Record<string, unknown> = {}) {
    const wall = new FpWall([v1.x, v1.y, v2.distance(v1) + v1.x, v1.y], options);
    wall.adjustVectors(v1, v2, { fireModified: false });
    return wall;
  }
}

function getSnapStep(canvas: any): number {
  if (!canvas) return 20;
  try {
    const zoom = canvas.getZoom?.() ?? 1;
    const pxPerCm = canvas.fpGrid?.pxPerCm ?? 1;
    const step = getGridSnapStepPx({ pxPerCm, zoom });
    return step ?? 20;
  } catch {
    return 20;
  }
}
