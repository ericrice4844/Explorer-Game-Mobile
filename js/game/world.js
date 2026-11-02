// World generation: decode the Earth land mask, assign biomes from a simple
// climate model, compute distance-from-shore for water, and scatter deposits.
import { EARTH_W, EARTH_H, EARTH_RLE } from '../data/earth.js';
import { B, BIOMES, CLIMATE_BOXES, MOUNTAIN_RANGES, DEPOSITS, DEPOSIT_KEYS, isWaterBiome } from './data.js';
import { mulberry32, valueNoise } from './rng.js';

export const W = EARTH_W;
export const H = EARTH_H;
export const DEG = 360 / W;

export const idx = (x, y) => y * W + x;
export const xOf = (i) => i % W;
export const yOf = (i) => Math.floor(i / W);
export const wrapX = (x) => ((x % W) + W) % W;

export function latLon(x, y) {
  return { lat: 90 - (y + 0.5) * DEG, lon: -180 + (x + 0.5) * DEG };
}

export function tileOf(lat, lon) {
  return { x: wrapX(Math.floor((lon + 180) / DEG)), y: Math.max(0, Math.min(H - 1, Math.floor((90 - lat) / DEG))) };
}

// Horizontal delta honouring the east-west wrap of the globe.
export function dxWrap(x1, x2) {
  let d = x2 - x1;
  if (d > W / 2) d -= W;
  if (d < -W / 2) d += W;
  return d;
}

export function chebyshev(x1, y1, x2, y2) {
  return Math.max(Math.abs(dxWrap(x1, x2)), Math.abs(y2 - y1));
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(dxWrap(x1, x2), y2 - y1);
}

export function decodeMask() {
  const land = new Uint8Array(W * H);
  EARTH_RLE.forEach((row, y) => {
    let x = 0;
    row.replace(/(\d+)(.)/g, (_, n, c) => {
      for (let k = 0; k < +n; k++) land[idx(x++, y)] = c === '#' ? 1 : 0;
      return '';
    });
  });
  // The polar cap row is missing from the source data; Antarctica covers the pole.
  for (let y = H - 2; y < H; y++) for (let x = 0; x < W; x++) land[idx(x, y)] = 1;
  return land;
}

function inBoxes(boxes, lat, lon, jitter) {
  for (const [a, b, c, d] of boxes) {
    if (lat >= a - jitter && lat <= b + jitter && lon >= c - jitter && lon <= d + jitter) return true;
  }
  return false;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

// Pre-convert mountain polylines into tile-space segments.
const RANGE_SEGMENTS = MOUNTAIN_RANGES.flatMap((r) => {
  const segs = [];
  for (let i = 0; i < r.pts.length - 1; i++) {
    const [la1, lo1] = r.pts[i];
    const [la2, lo2] = r.pts[i + 1];
    segs.push({
      ax: (lo1 + 180) / DEG, ay: (90 - la1) / DEG,
      bx: (lo2 + 180) / DEG, by: (90 - la2) / DEG, w: r.w,
    });
  }
  return segs;
});

function mountainDistance(x, y) {
  let best = Infinity;
  const px = x + 0.5;
  const py = y + 0.5;
  for (const s of RANGE_SEGMENTS) {
    const d = distToSegment(px, py, s.ax, s.ay, s.bx, s.by) - s.w;
    if (d < best) best = d;
  }
  return best;
}

export function landBiome(x, y, salt) {
  const { lat, lon } = latLon(x, y);
  const alat = Math.abs(lat);
  const n = valueNoise(x, y, 4, salt);
  const n2 = valueNoise(x, y, 7, salt + 17);
  const jitter = (n - 0.5) * 4;

  if (lat < -60) return B.ICE;
  // Greenland interior
  if (lat > 62 && lon > -60 && lon < -18) return lat > 64 + n * 6 && lon > -52 && lon < -24 ? B.ICE : B.TUNDRA;
  if (alat > 76) return B.ICE;

  const md = mountainDistance(x, y);
  if (md < 0) return B.MOUNTAINS;
  if (md < 1.1 + n2 * 0.6) return B.HILLS;

  if (alat > 64 + jitter * 0.6) return B.TUNDRA;
  if (alat > 54 + jitter) {
    return B.TAIGA;
  }
  if (lat > 47 + jitter) {
    const continental = (lon > 35 && lon < 140) || (lon > -125 && lon < -65);
    if (continental && n2 > 0.35) return B.TAIGA;
    return n2 > 0.75 ? B.GRASSLAND : B.FOREST;
  }
  if (inBoxes(CLIMATE_BOXES.desert, lat, lon, jitter * 0.8)) return B.DESERT;
  if (inBoxes(CLIMATE_BOXES.steppe, lat, lon, jitter * 0.8)) return B.STEPPE;
  if (inBoxes(CLIMATE_BOXES.jungle, lat, lon, jitter * 0.6)) return B.JUNGLE;
  if (inBoxes(CLIMATE_BOXES.savanna, lat, lon, jitter * 0.6)) return B.SAVANNA;
  if (n2 > 0.82) return B.HILLS;
  if (alat < 12) return n > 0.5 ? B.JUNGLE : B.SAVANNA;
  if (alat < 24) return n > 0.55 ? B.SAVANNA : n > 0.3 ? B.GRASSLAND : B.FOREST;
  return n > 0.5 ? B.FOREST : B.GRASSLAND;
}

export function neighbors8(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= H) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      out.push([wrapX(x + dx), ny]);
    }
  }
  return out;
}

// Breadth-first distance (in tiles) from each water tile to the nearest land.
function computeWaterDistance(land) {
  const dist = new Uint8Array(W * H).fill(255);
  const queue = [];
  for (let i = 0; i < W * H; i++) {
    if (land[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const d = dist[i];
    if (d >= 254) continue;
    for (const [nx, ny] of neighbors8(xOf(i), yOf(i))) {
      const j = idx(nx, ny);
      if (dist[j] > d + 1) {
        dist[j] = d + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}

let cachedTerrain = null;

// Terrain depends only on the salt, so it can be regenerated from a save.
export function generateTerrain(seed) {
  const salt = (seed % 9973) + 1;
  if (cachedTerrain && cachedTerrain.salt === salt) return cachedTerrain;
  const land = decodeMask();
  const waterDist = computeWaterDistance(land);
  const biome = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (land[i]) biome[i] = landBiome(x, y, salt);
      else {
        const d = waterDist[i];
        biome[i] = d <= 1 ? B.COAST : d <= 3 ? B.SEA : B.OCEAN;
      }
    }
  }
  cachedTerrain = { salt, biome, waterDist, land };
  return cachedTerrain;
}

export function generateDeposits(terrain, seed) {
  const rand = mulberry32(seed ^ 0x5eed);
  const deposits = {};
  for (let i = 0; i < W * H; i++) {
    const b = terrain.biome[i];
    if (b === B.ICE || b === B.OCEAN || b === B.SEA) continue;
    // Shuffle-ish start so that rarer types are not starved.
    const start = Math.floor(rand() * DEPOSIT_KEYS.length);
    for (let k = 0; k < DEPOSIT_KEYS.length; k++) {
      const key = DEPOSIT_KEYS[(start + k) % DEPOSIT_KEYS.length];
      const def = DEPOSITS[key];
      if (def.biomes.includes(b) && rand() < def.rarity) {
        deposits[i] = { type: key, ready: 0 };
        break;
      }
    }
  }
  return deposits;
}

export function biomeAt(terrain, x, y) {
  return terrain.biome[idx(wrapX(x), y)];
}

export function isWater(terrain, x, y) {
  return isWaterBiome(biomeAt(terrain, x, y));
}

export function isCoastalLand(terrain, x, y) {
  if (isWater(terrain, x, y)) return false;
  return neighbors8(x, y).some(([nx, ny]) => isWater(terrain, nx, ny));
}

export function regionOf(x, y) {
  const { lat, lon } = latLon(x, y);
  if (lon < -30) {
    if (lat > 24) return 'northamerica';
    if (lat > 7) return 'mesoamerica';
    return 'southamerica';
  }
  if (lon > 110 && lat < 0) return 'oceania';
  if (lon > 140 && lat < 25) return 'oceania';
  if (lat > 56 && lon > 50) return 'siberia';
  if (lat < 30 && lon < 52 && lon > -20) return lat > 15 && lon > 32 ? 'mideast' : 'africa';
  if (lon < 40 && lat >= 35) return 'europe';
  if (lon < 65) return 'mideast';
  if (lon < 92 && lat < 36) return 'southasia';
  return 'eastasia';
}

export function biomeName(b) {
  return BIOMES[b].name;
}
