import { Circle, Point } from 'fabric';
import { Vec2 } from '../vectors';
import { FpWall } from './wall';
import { getGridSnapStepPx } from '../grid';
import { getActivePalette } from './palette';

export interface WallJunction {
  wall: FpWall;
  node: 1 | 2;
}

export class FpJunctionHandle extends Circle {
  _junctions: WallJunction[] = [];
  vector?: Vec2;

  constructor(options: any = {}) {
    super({
      radius: 4,
      originX: 'center',
      originY: 'center',
      fill: getActivePalette().junctionFill,
      stroke: getActivePalette().junctionStroke,
      strokeWidth: 1,
      opacity: 0,
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'move',
      ...options,
    });
    this.on('moving', (e: any) => this._adjustWalls(e));
    this.on('modified', () => {
      this.canvas?.requestRenderAll();
    });
    this.on('mouseover', () => {
      this.set({ radius: 6, opacity: 1 });
      this.canvas?.requestRenderAll();
    });
    this.on('mouseout', () => {
      this.set({ radius: 4, opacity: 0 });
      this.canvas?.requestRenderAll();
    });
  }

  _adjustWalls(_o: any) {
    const canvas = this.canvas as any;
    if (!canvas) return;
    const cp = this.getCenterPoint();
    const cpv = new Vec2(cp.x, cp.y);

    // snap to grid
    const zoom = canvas?.getZoom?.() ?? 1;
    const step = getGridSnapStepPx({ pxPerCm: canvas?.fpGrid?.pxPerCm ?? 1, zoom }) ?? 20;
    cpv.x = Math.round(cpv.x / step) * step;
    cpv.y = Math.round(cpv.y / step) * step;

    this.vector = cpv.clone();
    this.setPositionByOrigin(new Point(cpv.x, cpv.y), 'center', 'center');
    this.setCoords();

    const junctions = [...this._junctions];
    if (!junctions.length) return;
    const first = junctions.shift()!;
    if (first.node === 1 || first.node === 2) {
      const vectors: [Vec2, Vec2] =
        first.node === 1 ? [cpv, first.wall.vectors[1]] : [first.wall.vectors[0], cpv];
      first.wall.update({ vectors });
    }
    for (const j of junctions) {
      if (j.node === 1) {
        j.wall.update({ vectors: [cpv, j.wall.vectors[1]] });
      }
      if (j.node === 2) {
        j.wall.update({ vectors: [j.wall.vectors[0], cpv] });
      }
    }

    this.canvas?.requestRenderAll();
  }
}
