import { Polygon } from 'fabric';
import { Vec2 } from '../vectors';
import { getActivePalette } from './palette';

export class FpRoom extends Polygon {
  pointsVec: Vec2[] = [];

  constructor(points: Array<{ x: number; y: number }>, options: Record<string, unknown> = {}) {
    super(points, {
      fill: getActivePalette().roomFill,
      stroke: getActivePalette().roomStroke,
      strokeWidth: 2,
      opacity: 0.6,
      selectable: false,
      evented: false,
      ...options,
    });
    this.pointsVec = points.map((p) => new Vec2(p.x, p.y));
  }

  containsVector(vec: { x: number; y: number }) {
    // simple point-in-polygon
    let inside = false;
    const pts = this.pointsVec;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      const intersect =
        yi > vec.y !== yj > vec.y && vec.x < ((xj - xi) * (vec.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static fromVectors(vectors: Vec2[], options: Record<string, unknown> = {}) {
    return new FpRoom(
      vectors.map((v) => ({ x: v.x, y: v.y })),
      options,
    );
  }
}
