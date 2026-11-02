// Core game state: creation, capabilities, economy, settling, building,
// advances, ages and save/load. Pure logic — safe to run under Node.
import {
  AGES, ADVANCES, BUILDINGS, BIOMES, B, DEPOSITS, RESOURCE_KEYS, STYLES, styleFor,
  VICTORY_EXPLORED_FRACTION, isWaterBiome,
} from './data.js';
import { Rng } from './rng.js';
import {
  W, H, idx, wrapX, latLon, chebyshev, distance, generateTerrain, generateDeposits, isCoastalLand,
  neighbors8,
} from './world.js';
import { findPath } from './path.js';
import { generateCivs } from './civs.js';

export const SAVE_VERSION = 1;

export function emptyRes() {
  return Object.fromEntries(RESOURCE_KEYS.map((k) => [k, 0]));
}

export function terrainOf(state) {
  return generateTerrain(state.seed);
}

export function biomeAtState(state, x, y) {
  return terrainOf(state).biome[idx(wrapX(x), y)];
}

export function newId(state, prefix) {
  state.nextId = (state.nextId || 1) + 1;
  return `${prefix}${state.nextId}`;
}

export function rngOf(state) {
  const r = new Rng(state.rng);
  // Persist the advanced RNG state back on the game state after use.
  return {
    next: () => { const v = r.next(); state.rng = r.s; return v; },
    int: (a, b) => { const v = r.int(a, b); state.rng = r.s; return v; },
    pick: (arr) => { const v = r.pick(arr); state.rng = r.s; return v; },
    chance: (p) => { const v = r.chance(p); state.rng = r.s; return v; },
  };
}

export function makeName(rng, syllables) {
  const caps = syllables.filter((s) => s[0] === s[0].toUpperCase() && /[A-ZÀ-Ý]/.test(s[0]));
  const lows = syllables.filter((s) => !caps.includes(s));
  const first = rng.pick(caps.length ? caps : syllables);
  let name = first;
  const parts = rng.chance(0.6) ? 1 : 2;
  for (let i = 0; i < parts; i++) {
    const s = rng.pick(lows.length && rng.chance(0.6) ? lows : syllables).toLowerCase();
    name += s;
  }
  return name.length > 12 ? name.slice(0, 12) : name;
}

function pickStart(terrain, rng, lifestyle) {
  const good = new Set([B.FOREST, B.GRASSLAND, B.STEPPE, B.SAVANNA, B.HILLS, B.JUNGLE]);
  for (let tries = 0; tries < 20000; tries++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, H - 1);
    const b = terrain.biome[idx(x, y)];
    if (!good.has(b)) continue;
    const { lat } = latLon(x, y);
    if (Math.abs(lat) > 60) continue;
    const coastal = isCoastalLand(terrain, x, y);
    if (lifestyle === 'seafaring' && !coastal) continue;
    if (lifestyle === 'nomadic' && ![B.STEPPE, B.GRASSLAND, B.SAVANNA].includes(b) && rng.chance(0.7)) continue;
    const landN = neighbors8(x, y).filter(([nx, ny]) => {
      const nb = terrain.biome[idx(nx, ny)];
      return !isWaterBiome(nb) && nb !== B.ICE;
    }).length;
    if (landN < 4) continue;
    // Make sure the first camp can feed itself.
    const food = neighbors8(x, y).reduce((sum, [nx, ny]) => sum + (BIOMES[terrain.biome[idx(nx, ny)]].yields.food || 0), 0);
    if (food < 13) continue;
    return { x, y };
  }
  return { x: 140, y: 40 };
}

/**
 * Create a new game.
 * @param {object} opts { seed, leader:{name,skin,hair,hairStyle,beard}, civName, capitalName, color, emblem, lifestyle, temperament }
 */
export function newGame(opts = {}) {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const lifestyle = opts.lifestyle || 'settled';
  const temperament = opts.temperament || 'peaceful';
  const style = styleFor(lifestyle, temperament);
  const terrain = generateTerrain(seed);
  const state = {
    version: SAVE_VERSION,
    seed,
    rng: (seed * 2654435761) >>> 0,
    turn: 1,
    year: AGES[0].startYear,
    age: 0,
    player: {
      civName: opts.civName || 'The Wanderers',
      color: opts.color || '#c0392b',
      emblem: opts.emblem || '☀️',
      lifestyle,
      temperament,
      style,
      leader: {
        name: opts.leader?.name || 'Aru',
        skin: opts.leader?.skin ?? 2,
        hair: opts.leader?.hair ?? 0,
        hairStyle: opts.leader?.hairStyle ?? 'short',
        beard: opts.leader?.beard ?? 'none',
      },
    },
    res: emptyRes(),
    cities: [],
    explored: new Uint8Array(W * H),
    exploredCount: 0,
    deposits: generateDeposits(terrain, seed),
    advances: [],
    expeditions: [],
    civs: [],
    tradeRoutes: [],
    log: [],
    stats: { expeditions: 0, lost: 0, discoveries: 0, conquests: 0, contacts: 0 },
    nextId: 1,
    won: false,
    over: false,
  };
  const rng = rngOf(state);
  Object.assign(state.res, { food: 60, wood: 30, stone: 10, clothing: 15 });
  const start = pickStart(terrain, rng, lifestyle);
  state.cities.push({
    id: newId(state, 'c'),
    name: opts.capitalName || 'First Fire',
    x: start.x,
    y: start.y,
    pop: 6,
    growth: 0,
    buildings: [],
    capital: true,
    founded: state.turn,
  });
  if (lifestyle === 'seafaring') state.advances.push('rafts');
  state.civs = generateCivs(state, terrain, rng, start);
  reveal(state, start.x, start.y, 4);
  addLog(state, '🔥', `${state.player.leader.name} gathers the people of ${state.player.civName} at ${state.cities[0].name}.`);
  return state;
}

export function addLog(state, icon, text) {
  state.log.push({ turn: state.turn, year: state.year, icon, text });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

export function styleOf(state) {
  return STYLES[state.player.style];
}

export function leaderTitle(state) {
  return styleOf(state).titles[state.age];
}

export function hasAdvance(state, id) {
  return state.advances.includes(id);
}

export function getCaps(state) {
  const c = {
    seaLevel: 0, landSpeed: 2, seaSpeed: 2, air: 0, airSpeed: 25,
    endurance: 4 + Math.floor(state.age / 2), reveal: 2,
    coldResist: 0, heatResist: 0, jungleResist: 0, seaResist: 0, hazardMult: 1,
    carry: 1, forage: 1, settleRange: 8, tradeRange: 8, maxExpeditions: 1 + Math.ceil(state.age / 2),
    foodMult: 1, knowledgeMult: 1, strengthMult: 1,
  };
  const p = state.player;
  if (p.lifestyle === 'nomadic') { c.landSpeed += 1; c.foodMult -= 0.25; }
  if (p.lifestyle === 'seafaring') { c.seaSpeed += 1; }
  if (p.temperament === 'peaceful') { c.hazardMult -= 0.2; c.knowledgeMult += 0.25; }
  if (p.temperament === 'warlike') { c.strengthMult += 0.5; }
  for (const id of state.advances) {
    const adv = ADVANCES.find((a) => a.id === id);
    if (!adv) continue;
    for (const [k, v] of Object.entries(adv.effects)) {
      if (k === 'seaLevel') c.seaLevel = Math.max(c.seaLevel, v);
      else c[k] = (c[k] || 0) + v;
    }
  }
  for (const k of ['coldResist', 'heatResist', 'jungleResist', 'seaResist']) c[k] = Math.min(0.9, c[k]);
  c.hazardMult = Math.max(0.2, c.hazardMult);
  c.foodMult = Math.max(0.3, c.foodMult);
  c.settleRange += state.age * 2;
  c.tradeRange += state.age * 3;
  return c;
}

export function isExplored(state, x, y) {
  return state.explored[idx(wrapX(x), y)] === 1;
}

export function civAt(state, x, y, radius = 0) {
  return state.civs.find((c) => !c.conquered && chebyshev(c.x, c.y, x, y) <= radius);
}

export function cityAt(state, x, y, radius = 0) {
  return state.cities.find((c) => chebyshev(c.x, c.y, x, y) <= radius);
}

// Mark tiles within radius as explored. Returns discoveries made.
export function reveal(state, cx, cy, r) {
  const found = { tiles: 0, deposits: [], civs: [] };
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= H) continue;
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const x = wrapX(cx + dx);
      const i = idx(x, y);
      if (state.explored[i]) continue;
      state.explored[i] = 1;
      state.exploredCount++;
      found.tiles++;
      if (state.deposits[i]) {
        found.deposits.push({ i, x, y, type: state.deposits[i].type });
        state.stats.discoveries++;
      }
      for (const civ of state.civs) {
        if (!civ.met && civ.x === x && civ.y === y) {
          civ.met = true;
          civ.metTurn = state.turn;
          state.stats.contacts++;
          found.civs.push(civ);
          addLog(state, '🤝', `First contact with the ${civName(civ)}!`);
        }
      }
    }
  }
  return found;
}

export function civName(civ) {
  const lvl = ['Band', 'Tribe', 'Chiefdom', 'Kingdom', 'Empire', 'Nation'][civ.level];
  if (civ.level <= 1) return `${civ.name} ${lvl}`;
  if (civ.level === 4) return `${civ.name} Empire`;
  if (civ.level === 5) return `${civ.name} Nation`;
  return `${lvl} of ${civ.name}`;
}

export function exploredFraction(state) {
  return state.exploredCount / (W * H);
}

// ---------- costs ----------
export function canAfford(state, cost) {
  return Object.entries(cost).every(([k, v]) => (state.res[k] || 0) >= v);
}

export function pay(state, cost) {
  for (const [k, v] of Object.entries(cost)) state.res[k] -= v;
}

export function gain(state, amounts) {
  for (const [k, v] of Object.entries(amounts)) state.res[k] = (state.res[k] || 0) + v;
}

export function scaleCost(cost, mult) {
  return Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, Math.max(1, Math.round(v * mult))]));
}

// ---------- cities & economy ----------
export function cityRadius(state) {
  return state.age < 2 ? 1 : 2;
}

export function housing(state, city) {
  let h = 8 + 3 * state.age;
  for (const b of city.buildings) h += BUILDINGS.find((d) => d.id === b)?.housing || 0;
  return h;
}

function tileYield(state, i) {
  const b = terrainOf(state).biome[i];
  const out = { ...BIOMES[b].yields };
  const dep = state.deposits[i];
  if (dep && state.explored[i] && !DEPOSITS[dep.type].once) {
    for (const [k, v] of Object.entries(DEPOSITS[dep.type].yields)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

function yieldScore(y) {
  return (y.food || 0) * 1.3 + (y.wood || 0) + (y.stone || 0) + (y.clothing || 0) + (y.iron || 0) * 1.5 + (y.gold || 0) * 2 + (y.luxuries || 0) * 2;
}

// Compute what each city produces this turn, and which tiles it works.
export function cityReports(state) {
  const terrain = terrainOf(state);
  const used = new Set();
  const r = cityRadius(state);
  const reports = [];
  const nomadMult = state.player.lifestyle === 'nomadic' ? 0.85 : 1;
  for (const city of state.cities) {
    const candidates = [];
    for (let dy = -r; dy <= r; dy++) {
      const y = city.y + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (!dx && !dy) continue;
        const x = wrapX(city.x + dx);
        const i = idx(x, y);
        if (used.has(i)) continue;
        const b = terrain.biome[i];
        if (b === B.OCEAN || b === B.SEA || b === B.ICE) continue;
        if (civAt(state, x, y, 0)) continue;
        candidates.push({ i, x, y, y2: tileYield(state, i) });
      }
    }
    // Greedy tile choice: favour food until the settlement can feed itself.
    const worked = [];
    let food = 3;
    const pool = candidates.slice();
    while (worked.length < city.pop && pool.length) {
      const hungry = food < city.pop + 2;
      let best = 0;
      let bestScore = -Infinity;
      for (let k = 0; k < pool.length; k++) {
        const y2 = pool[k].y2;
        const sc = yieldScore(y2) + (hungry ? (y2.food || 0) * 2 : 0);
        if (sc > bestScore) { bestScore = sc; best = k; }
      }
      const [t] = pool.splice(best, 1);
      worked.push(t);
      food += (t.y2.food || 0) * nomadMult;
    }
    const out = { food: 3, wood: 1 };
    if (city.capital) out.knowledge = 1;
    if (state.player.lifestyle === 'settled') out.food += 1;
    if (state.player.lifestyle === 'nomadic') out.food += 1; // herds follow the camp
    used.add(idx(city.x, city.y));
    for (const t of worked) {
      used.add(t.i);
      for (const [k, v] of Object.entries(t.y2)) out[k] = (out[k] || 0) + v * nomadMult;
    }
    for (const bid of city.buildings) {
      const def = BUILDINGS.find((d) => d.id === bid);
      for (const [k, v] of Object.entries(def?.yields || {})) out[k] = (out[k] || 0) + v;
    }
    out.knowledge = (out.knowledge || 0) + city.pop * 0.25;
    for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 10) / 10;
    reports.push({ city, worked, out, upkeep: city.pop });
  }
  return reports;
}

export function tradeIncome(state, route) {
  const from = state.cities.find((c) => c.id === route.from);
  if (!from) return {};
  const merc = state.player.temperament === 'mercantile' ? 1.5 : 1;
  const out = {};
  if (route.toCiv) {
    const civ = state.civs.find((c) => c.id === route.toCiv);
    if (!civ || civ.conquered) return {};
    const d = distance(from.x, from.y, civ.x, civ.y);
    out.gold = Math.round((1 + d / 6 + civ.level) * merc);
    out[civ.specialty] = (out[civ.specialty] || 0) + Math.round((1 + civ.level / 2) * merc);
    out.knowledge = 0.5;
  } else {
    const to = state.cities.find((c) => c.id === route.toCity);
    if (!to) return {};
    const d = distance(from.x, from.y, to.x, to.y);
    out.gold = Math.round((1 + d / 8) * merc);
  }
  return out;
}

export function incomeSummary(state) {
  const caps = getCaps(state);
  const total = emptyRes();
  for (const rep of cityReports(state)) {
    for (const [k, v] of Object.entries(rep.out)) total[k] += v;
    total.food -= rep.upkeep;
  }
  for (const route of state.tradeRoutes) {
    for (const [k, v] of Object.entries(tradeIncome(state, route))) total[k] += v;
  }
  total.knowledge *= caps.knowledgeMult;
  for (const k of Object.keys(total)) total[k] = Math.round(total[k] * 10) / 10;
  return total;
}

export function totalPopulation(state) {
  return state.cities.reduce((s, c) => s + c.pop, 0) + state.expeditions.reduce((s, e) => s + e.members, 0);
}

export function cityStrength(state, city, people = city.pop) {
  const caps = getCaps(state);
  const barracks = city.buildings.includes('barracks') ? 1.2 : 1;
  return people * (1 + 0.25 * state.age) * caps.strengthMult * barracks;
}

export function totalStrength(state) {
  return Math.round(state.cities.reduce((s, c) => s + cityStrength(state, c), 0) * 10) / 10;
}

// ---------- settling ----------
export function settleCost(state) {
  const mult = state.player.lifestyle === 'settled' ? 0.7 : 1;
  // Each new settlement is harder to supply than the last.
  const n = state.cities.length;
  const base = { food: 30 + n * 12 + n * n, wood: 20 + n * 8 + n * n, clothing: 5 + n * 2 };
  if (n >= 6) base.gold = (n - 5) * 6;
  return scaleCost(base, mult);
}

export const SETTLE_POP = 3;

export function checkSettle(state, x, y) {
  const terrain = terrainOf(state);
  x = wrapX(x);
  if (y < 0 || y >= H) return { ok: false, reason: 'Off the map.' };
  if (!isExplored(state, x, y)) return { ok: false, reason: 'You must explore this land first.' };
  const b = terrain.biome[idx(x, y)];
  if (isWaterBiome(b)) return { ok: false, reason: 'You cannot settle on water.' };
  if (b === B.ICE) return { ok: false, reason: 'Nothing can grow on the ice sheet.' };
  if (cityAt(state, x, y, 2)) return { ok: false, reason: 'Too close to one of your settlements.' };
  if (civAt(state, x, y, 2)) return { ok: false, reason: 'Too close to another people.' };
  const caps = getCaps(state);
  let best = null;
  for (const city of state.cities) {
    if (city.pop < SETTLE_POP + 1) continue;
    if (distance(city.x, city.y, x, y) > caps.settleRange) continue;
    const p = findPath(terrain, city.x, city.y, x, y, caps, caps.endurance);
    if (p && (!best || p.turns < best.path.turns)) best = { city, path: p };
  }
  if (!best) {
    const anyBig = state.cities.some((c) => c.pop >= SETTLE_POP + 1);
    return { ok: false, reason: anyBig ? `No settlement can reach this spot (range ${caps.settleRange} tiles).` : `A settlement needs ${SETTLE_POP + 1}+ people to send settlers.` };
  }
  const cost = settleCost(state);
  if (!canAfford(state, cost)) return { ok: false, reason: 'Not enough resources.', cost, from: best.city };
  return { ok: true, cost, from: best.city, path: best.path };
}

export function nextCityName(state) {
  const rng = rngOf(state);
  const syl = styleOf(state).citySyllables;
  for (let i = 0; i < 20; i++) {
    const n = makeName(rng, syl);
    if (!state.cities.some((c) => c.name === n)) return n;
  }
  return `Settlement ${state.cities.length + 1}`;
}

export function settle(state, x, y, name) {
  const chk = checkSettle(state, x, y);
  if (!chk.ok) return chk;
  pay(state, chk.cost);
  chk.from.pop -= SETTLE_POP;
  const city = {
    id: newId(state, 'c'), name: name || nextCityName(state), x: wrapX(x), y,
    pop: SETTLE_POP, growth: 0, buildings: [], capital: false, founded: state.turn,
  };
  state.cities.push(city);
  reveal(state, city.x, city.y, 2);
  addLog(state, '🏕️', `Settlers from ${chk.from.name} founded ${city.name}.`);
  return { ok: true, city };
}

// ---------- buildings ----------
export function buildingOptions(state, city) {
  const terrain = terrainOf(state);
  return BUILDINGS.filter((b) => b.age <= state.age).map((b) => {
    let reason = null;
    if (city.buildings.includes(b.id)) reason = 'Built';
    else if (b.coastal && !isCoastalLand(terrain, city.x, city.y)) reason = 'Needs coast';
    else if (!canAfford(state, b.cost)) reason = 'Too costly';
    return { def: b, ok: !reason, reason };
  });
}

export function build(state, cityId, buildingId) {
  const city = state.cities.find((c) => c.id === cityId);
  const opt = city && buildingOptions(state, city).find((o) => o.def.id === buildingId);
  if (!opt || !opt.ok) return { ok: false, reason: opt?.reason || 'Unavailable' };
  pay(state, opt.def.cost);
  city.buildings.push(buildingId);
  addLog(state, opt.def.icon, `${city.name} built a ${opt.def.name}.`);
  return { ok: true };
}

// ---------- advances ----------
export function depositKnown(state, type) {
  for (const [i, d] of Object.entries(state.deposits)) if (d.type === type && state.explored[i]) return true;
  return false;
}

export function advanceStatus(state, adv) {
  if (hasAdvance(state, adv.id)) return { ok: false, owned: true, reason: 'Learned' };
  if (adv.age > state.age) return { ok: false, reason: `Requires ${AGES[adv.age].name}` };
  if (adv.needs && !hasAdvance(state, adv.needs)) return { ok: false, reason: `Requires ${ADVANCES.find((a) => a.id === adv.needs).name}` };
  if (adv.needsDeposit && state.player.lifestyle !== 'nomadic' && !depositKnown(state, adv.needsDeposit)) {
    return { ok: false, reason: `Discover ${DEPOSITS[adv.needsDeposit].name} first` };
  }
  if (!canAfford(state, adv.cost)) return { ok: false, reason: 'Too costly' };
  return { ok: true };
}

export function learnAdvance(state, id) {
  const adv = ADVANCES.find((a) => a.id === id);
  const st = adv && advanceStatus(state, adv);
  if (!st || !st.ok) return { ok: false, reason: st?.reason || 'Unknown' };
  pay(state, adv.cost);
  state.advances.push(id);
  addLog(state, adv.icon, `Your people learned ${adv.name}.`);
  return { ok: true };
}

// ---------- ages ----------
export function ageStatus(state) {
  const next = AGES[state.age + 1];
  if (!next) return { ok: false, final: true, reason: 'You have reached the final age.' };
  const reqs = [];
  if (next.req.cities) reqs.push({ label: `${next.req.cities} settlements`, met: state.cities.length >= next.req.cities, have: state.cities.length });
  if (next.req.explored) reqs.push({ label: `${next.req.explored} tiles mapped`, met: state.exploredCount >= next.req.explored, have: state.exploredCount });
  if (next.req.contacts) {
    const met = state.civs.filter((c) => c.met).length;
    reqs.push({ label: `Contact ${next.req.contacts} peoples`, met: met >= next.req.contacts, have: met });
  }
  const affordable = canAfford(state, next.cost);
  return { ok: affordable && reqs.every((r) => r.met), next, reqs, affordable };
}

export function advanceAge(state) {
  const st = ageStatus(state);
  if (!st.ok) return { ok: false, reason: st.reason || 'Requirements not met' };
  pay(state, st.next.cost);
  state.age = st.next.id;
  state.year = Math.max(state.year, st.next.startYear);
  addLog(state, '🏛️', `${state.player.civName} enters the ${st.next.name}!`);
  return { ok: true };
}

export function checkVictory(state) {
  if (!state.won && state.age === AGES.length - 1 && exploredFraction(state) >= VICTORY_EXPLORED_FRACTION) {
    state.won = true;
    addLog(state, '🌍', 'The world is mapped! Your explorers have charted half the globe.');
    return true;
  }
  return false;
}

export function score(state) {
  return Math.round(
    state.exploredCount + totalPopulation(state) * 10 + state.cities.length * 50 + state.age * 250
      + state.civs.filter((c) => c.met).length * 30 + state.stats.conquests * 40,
  );
}

export function formatYear(y) {
  return y < 0 ? `${Math.abs(Math.round(y))} BCE` : `${Math.round(y)} CE`;
}

// ---------- save / load ----------
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}

function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function serialize(state) {
  // Pack explored flags into bits.
  const bits = new Uint8Array(Math.ceil((W * H) / 8));
  for (let i = 0; i < W * H; i++) if (state.explored[i]) bits[i >> 3] |= 1 << (i & 7);
  return JSON.stringify({ ...state, explored: bytesToB64(bits) });
}

export function deserialize(json) {
  const data = JSON.parse(json);
  if (data.version !== SAVE_VERSION) throw new Error('Incompatible save version');
  const bits = b64ToBytes(data.explored);
  const explored = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) explored[i] = (bits[i >> 3] >> (i & 7)) & 1;
  data.explored = explored;
  return data;
}
