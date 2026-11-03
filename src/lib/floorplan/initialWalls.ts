import { Vec2 } from '../vectors';
import { FpWall } from './wall';

// Two adjacent rooms seeded on first load:
// - big room 220x200 at (320, 200)
// - small room 120x200 to its right, sharing the vertical wall at x=540
const SEGMENTS: Array<[number, number, number, number]> = [
  // big room
  [320, 200, 540, 200],
  [540, 200, 540, 400],
  [540, 400, 320, 400],
  [320, 400, 320, 200],
  // small room (shares the x=540 wall)
  [540, 200, 660, 200],
  [660, 200, 660, 400],
  [660, 400, 540, 400],
];

export function createInitialWalls(): FpWall[] {
  return SEGMENTS.map(([x1, y1, x2, y2]) => FpWall.fromVectors(new Vec2(x1, y1), new Vec2(x2, y2)));
}
