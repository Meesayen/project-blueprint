import { Vec2, getPolyCentroid, getVectorsAngle } from '../vectors';
import { FpWall } from './wall';
import { FpRoom } from './room';

type JunctionEntry = { wall: FpWall; node: 1 | 2 };

export function buildJunctions(walls: FpWall[]) {
  const wallJunctions = new Map<string, Set<JunctionEntry>>();
  const junctionIdVectorMap = new Map<string, Vec2>();

  const getJunctions = (id: string) => {
    if (!wallJunctions.has(id)) wallJunctions.set(id, new Set());
    return wallJunctions.get(id)!;
  };

  for (const wall of walls) {
    if (wall.isDraft) continue;
    const [v1, v2] = wall.calcVectors();
    if (v1.distance(v2) < 2) continue;
    for (const [node, vec] of [
      [1, v1],
      [2, v2],
    ] as [1 | 2, Vec2][]) {
      const id = vec.id;
      junctionIdVectorMap.set(id, vec);
      getJunctions(id).add({ wall, node });
    }
  }

  return { wallJunctions, junctionIdVectorMap };
}

function getPathInfo(previous: Vec2, current: Vec2, next: Vec2) {
  // v4 formula (see canvas/mixins/floorplan.ts getPathInfo).
  const a = new Vec2(current.x - previous.x, current.y - previous.y);
  const d = new Vec2(next.x - current.x, next.y - current.y);
  const len = Math.hypot(d.x, d.y) || 1;
  const b = new Vec2(
    (d.x / len) * 40 + (current.x - previous.x),
    (d.y / len) * 40 + (current.y - previous.y),
  );
  return {
    cross: a.x * b.y - a.y * b.x,
    angle: getVectorsAngle(previous, next, current),
  };
}

function getRoomHash(room: Vec2[]) {
  return room
    .map((v) => v.uuid)
    .slice()
    .sort()
    .join(';');
}

export function buildRooms(walls: FpWall[]): FpRoom[] {
  const { wallJunctions, junctionIdVectorMap } = buildJunctions(walls);

  // Only junctions where at least two walls meet are usable as room vertices
  // (v4: if (set.size === 1) return []).
  const junctions = [...wallJunctions.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([id, set]) => [
      junctionIdVectorMap.get(id)!,
      [...set].map((j) => {
        const w = j.wall;
        // canonical vector from the junction map (consistent uuid across walls)
        const key = w.vectors[j.node === 1 ? 1 : 0].id;
        return junctionIdVectorMap.get(key) ?? w.vectors[j.node === 1 ? 1 : 0];
      }),
    ]) as [Vec2, Vec2[]][];

  const junctionSize = (id: string) => wallJunctions.get(id)?.size ?? 0;

  const rooms: Vec2[][] = [];
  const unseenIds = new Set(junctions.map((j) => j[0].id));

  const checkPath = (room: Vec2[], start: Vec2, node: Vec2) => {
    room.push(start, node);
    let previous = start;
    let current = node;

    unseenIds.delete(start.id);
    unseenIds.delete(node.id);

    let escape = 300;
    while (current && current.id !== start.id && escape > 0) {
      escape--;
      const entry = junctions.find(([v]) => v.id === current.id);
      const nextNodes = (entry?.[1] ?? []).filter((n) => n.id !== previous.id);

      if (!nextNodes.length) break;

      let next: Vec2 | undefined;
      if (nextNodes.length > 1) {
        const sorted = [...nextNodes].sort((a, b) => {
          if (junctionSize(a.id) === 1) return 1;
          if (junctionSize(b.id) === 1) return -1;
          const aInfo = getPathInfo(previous, current, a);
          const bInfo = getPathInfo(previous, current, b);
          if (aInfo.cross < 0) {
            if (bInfo.cross >= 0) return 1;
            return bInfo.angle - aInfo.angle;
          }
          if (bInfo.cross < 0) return -1;
          return aInfo.angle - bInfo.angle;
        });
        next = sorted[0];
      } else {
        next = nextNodes[0];
      }

      if (!next) break;
      if (junctionSize(next.id) === 1) break;

      unseenIds.delete(next.id);

      previous = current;
      current = next;

      if (current.id === start.id) {
        rooms.push(room.slice());
        break;
      } else {
        const alreadySeenIdx = room.findIndex((v) => v.id === next!.id);
        if (alreadySeenIdx === -1) {
          room.push(next);
        } else {
          rooms.push(room.slice(alreadySeenIdx));
          break;
        }
      }
    }
  };

  const complexJunctions = junctions.filter((j) => j[1].length > 2);

  for (const [startV, nodes] of complexJunctions) {
    for (const node of nodes) {
      const room: Vec2[] = [];
      checkPath(room, startV, node);
    }
  }

  while (unseenIds.size) {
    const id = unseenIds.values().next().value as string;
    unseenIds.delete(id);
    const junction = junctions.find(([n]) => n.id === id);
    if (!junction) continue;
    const [startV, nodes] = junction;
    for (const node2 of nodes) {
      const room: Vec2[] = [];
      checkPath(room, startV, node2);
    }
  }

  // dedup by hash (uuid-based, now consistent thanks to canonical vectors)
  const roomHashMap = new Map<string, Vec2[]>();
  for (const room of rooms) {
    const id = getRoomHash(room);
    if (!roomHashMap.has(id)) roomHashMap.set(id, room);
  }
  const uniqueRooms = [...roomHashMap.values()];

  // remove rooms containing other rooms
  let maxCentroids = 0;
  while (true) {
    maxCentroids = 1;
    const centroids = uniqueRooms.map((r) => getPolyCentroid(r));
    const toRemove: Vec2[][] = [];
    for (const room of uniqueRooms) {
      const wrapped = centroids.filter((c) => isPointInPolySimple(c, room)).length;
      if (wrapped > maxCentroids) {
        maxCentroids = wrapped;
        toRemove.length = 0;
      }
      if (wrapped === maxCentroids && maxCentroids > 1) toRemove.push(room);
    }
    if (maxCentroids === 1 || toRemove.length === 0) break;
    for (const room of toRemove) {
      const idx = uniqueRooms.indexOf(room);
      if (idx >= 0) uniqueRooms.splice(idx, 1);
    }
  }

  return uniqueRooms.map((vs) => new FpRoom(vs.map((v) => ({ x: v.x, y: v.y }))));
}

function isPointInPolySimple(p: { x: number; y: number }, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
