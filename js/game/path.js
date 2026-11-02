// A* pathfinding over the wrapped world grid. Costs are measured in turns.
import { BIOMES, isWaterBiome } from './data.js';
import { W, H, idx, xOf, yOf, wrapX, dxWrap } from './world.js';

// Max distance from shore a ship may venture, by sea level.
export const SEA_REACH = [0, 2, 4, 7, 255];

class Heap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(node, pri) {
    const a = this.items;
    a.push([pri, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

export function canEnter(terrain, i, caps) {
  if (caps.air) return true;
  const b = terrain.biome[i];
  if (!isWaterBiome(b)) return true;
  return caps.seaLevel > 0 && terrain.waterDist[i] <= SEA_REACH[caps.seaLevel];
}

export function stepCost(terrain, i, caps) {
  if (caps.air) return 1 / caps.airSpeed;
  const b = terrain.biome[i];
  if (isWaterBiome(b)) return 1 / caps.seaSpeed;
  return BIOMES[b].move / caps.landSpeed;
}

/**
 * Find the cheapest route from (sx,sy) to (tx,ty).
 * @returns {{path:number[][], turns:number}|null}
 */
export function findPath(terrain, sx, sy, tx, ty, caps, maxTurns = Infinity) {
  const start = idx(sx, sy);
  const goal = idx(wrapX(tx), ty);
  if (start === goal) return { path: [[sx, sy]], turns: 0 };
  if (!canEnter(terrain, goal, caps)) return null;
  const minStep = caps.air ? 1 / caps.airSpeed : Math.min(1 / caps.landSpeed, caps.seaLevel ? 1 / caps.seaSpeed : Infinity);
  const h = (i) => {
    const dx = Math.abs(dxWrap(xOf(i), tx));
    const dy = Math.abs(yOf(i) - ty);
    return (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)) * minStep;
  };
  const g = new Map([[start, 0]]);
  const came = new Map();
  const open = new Heap();
  open.push(start, h(start));
  let expanded = 0;
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) break;
    if (++expanded > 40000) return null;
    const gc = g.get(cur);
    const cx = xOf(cur);
    const cy = yOf(cur);
    const curWater = isWaterBiome(terrain.biome[cur]);
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= H) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const n = idx(wrapX(cx + dx), ny);
        if (!canEnter(terrain, n, caps)) continue;
        let c = stepCost(terrain, n, caps) * (dx && dy ? 1.414 : 1);
        // Small penalty for embarking/landing so routes don't zig-zag across shores.
        if (!caps.air && curWater !== isWaterBiome(terrain.biome[n])) c += 0.25;
        const ng = gc + c;
        if (ng > maxTurns) continue;
        if (ng < (g.has(n) ? g.get(n) : Infinity)) {
          g.set(n, ng);
          came.set(n, cur);
          open.push(n, ng + h(n));
        }
      }
    }
  }
  if (!g.has(goal)) return null;
  const path = [];
  for (let c = goal; c !== undefined; c = came.get(c)) {
    path.push([xOf(c), yOf(c)]);
    if (c === start) break;
  }
  path.reverse();
  return { path, turns: g.get(goal) };
}

export { W, H };
