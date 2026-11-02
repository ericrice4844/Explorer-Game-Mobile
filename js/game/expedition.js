// Expeditions: spend supplies and people to travel, map the world, and
// bring back (hopefully) more valuable resources.
import { BIOMES, DEPOSITS, PARTY_SIZES, RESOURCES, isWaterBiome } from './data.js';
import { idx, wrapX, H, isCoastalLand } from './world.js';
import { findPath } from './path.js';
import {
  addLog, canAfford, gain, getCaps, newId, pay, reveal, rngOf, terrainOf,
} from './game.js';

export function partySizes(state) {
  return PARTY_SIZES.filter((p) => p.minAge <= state.age);
}

function tileHazard(terrain, i, caps) {
  const b = terrain.biome[i];
  const def = BIOMES[b];
  let h = def.hazard;
  if (caps.air) return 0.004;
  if (def.risk === 'cold') h *= 1 - caps.coldResist;
  if (def.risk === 'heat') h *= 1 - caps.heatResist;
  if (def.risk === 'jungle') h *= 1 - caps.jungleResist;
  if (def.risk === 'sea') h *= 1 - caps.seaResist;
  return h * caps.hazardMult;
}

export function travelMode(state, terrain, x, y) {
  const caps = getCaps(state);
  if (caps.air) return 'air';
  return isWaterBiome(terrain.biome[idx(wrapX(x), y)]) ? 'sea' : 'land';
}

/** Work out route, cost, risk and capacity for a proposed expedition. */
export function planExpedition(state, cityId, tx, ty, partyId = 'band') {
  const terrain = terrainOf(state);
  const caps = getCaps(state);
  const city = state.cities.find((c) => c.id === cityId);
  const party = PARTY_SIZES.find((p) => p.id === partyId) || PARTY_SIZES[1];
  const plan = { ok: false, city, party, size: party.size, caps };
  if (!city) return { ...plan, reason: 'Choose a settlement to depart from.' };
  tx = wrapX(tx);
  if (ty < 0 || ty >= H) return { ...plan, reason: 'Off the edge of the world.' };
  if (tx === city.x && ty === city.y) return { ...plan, reason: 'Pick a destination away from the settlement.' };
  const route = findPath(terrain, city.x, city.y, tx, ty, caps, caps.endurance);
  if (!route) {
    const far = findPath(terrain, city.x, city.y, tx, ty, caps, caps.endurance * 4);
    const reason = far
      ? `Too far: your people can travel ${caps.endurance} turns out. Advance endurance or speed.`
      : isWaterBiome(terrain.biome[idx(tx, ty)]) || !caps.seaLevel
        ? 'No route: your people cannot cross these waters yet.'
        : 'No route found within reach.';
    return { ...plan, reason };
  }
  const path = route.path;
  // Cumulative turn cost along the path, for animation and reveal pacing.
  const cum = [0];
  let seaTiles = 0;
  let coldTiles = 0;
  let hazard = 0;
  for (let k = 1; k < path.length; k++) {
    const [x, y] = path[k];
    const i = idx(x, y);
    const b = terrain.biome[i];
    const step = caps.air ? 1 / caps.airSpeed : isWaterBiome(b) ? 1 / caps.seaSpeed : BIOMES[b].move / caps.landSpeed;
    cum.push(cum[k - 1] + step);
    if (isWaterBiome(b)) seaTiles++;
    if (BIOMES[b].risk === 'cold') coldTiles++;
    hazard += tileHazard(terrain, i, caps);
  }
  const outTurns = Math.max(1, Math.ceil(route.turns));
  const backTurns = Math.max(1, Math.ceil(route.turns / 2));
  const size = party.size;
  const safety = size >= 10 ? 0.75 : size >= 5 ? 0.85 : 1;
  const deathChance = Math.min(0.9, 1 - Math.exp(-hazard * 1.5 * safety));
  const harbor = (city.buildings.includes('harbor') ? 0.7 : 1) * (state.player.lifestyle === 'seafaring' ? 0.5 : 1);
  const cost = {
    food: Math.ceil(size * (outTurns + backTurns) * caps.foodMult),
    clothing: Math.ceil(size * (0.5 + (1.5 * coldTiles) / Math.max(1, path.length - 1))),
  };
  if (seaTiles && !caps.air) cost.wood = Math.ceil(size * 2 * harbor);
  if (caps.air) { cost.gold = size * 2; cost.iron = size; }
  else if (state.age >= 4) cost.gold = size;
  const capacity = Math.round(size * 8 * caps.carry);
  Object.assign(plan, {
    path, cum, turns: route.turns, outTurns, backTurns, cost, deathChance,
    expectedLoss: Math.round(size * deathChance * 10) / 10, capacity, seaTiles, coldTiles,
  });
  const active = state.expeditions.length;
  if (active >= caps.maxExpeditions) return { ...plan, reason: `All ${caps.maxExpeditions} expedition slot(s) are in use.` };
  if (city.pop - size < 1) return { ...plan, reason: `${city.name} has only ${city.pop} people (needs ${size + 1}).` };
  if (!canAfford(state, cost)) return { ...plan, reason: 'Not enough supplies.' };
  if (seaTiles && !caps.air && !isCoastalLand(terrain, city.x, city.y) && !path.some(([x, y]) => !isWaterBiome(terrain.biome[idx(x, y)]))) {
    return { ...plan, reason: 'Cannot launch boats here.' };
  }
  plan.ok = true;
  return plan;
}

export function launchExpedition(state, plan) {
  if (!plan.ok) return { ok: false, reason: plan.reason };
  pay(state, plan.cost);
  plan.city.pop -= plan.size;
  const exp = {
    id: newId(state, 'e'),
    cityId: plan.city.id,
    party: plan.party.id,
    size: plan.size,
    members: plan.size,
    path: plan.path,
    cum: plan.cum,
    turns: plan.turns,
    outTurns: plan.outTurns,
    backTurns: plan.backTurns,
    elapsed: 0,
    pos: 0,
    phase: 'out',
    deathChance: plan.deathChance,
    reveal: plan.caps.reveal,
    carry: plan.caps.carry,
    forage: plan.caps.forage,
    loot: {},
    found: { deposits: [], civs: [], tiles: 0 },
    deaths: 0,
    launched: state.turn,
  };
  state.expeditions.push(exp);
  state.stats.expeditions++;
  const [dx, dy] = plan.path[plan.path.length - 1];
  addLog(state, '🧭', `${plan.party.name} of ${plan.size} left ${plan.city.name}, heading ${direction(plan.city.x, plan.city.y, dx, dy)}.`);
  return { ok: true, expedition: exp };
}

export function direction(x1, y1, x2, y2) {
  let dx = x2 - x1;
  if (dx > 120) dx -= 240;
  if (dx < -120) dx += 240;
  const dy = y1 - y2;
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return dirs[(Math.round(a / 45) + 8) % 8];
}

function addLoot(exp, res, amt) {
  if (amt > 0) exp.loot[res] = (exp.loot[res] || 0) + amt;
}

function mergeFound(exp, found) {
  exp.found.tiles += found.tiles;
  exp.found.deposits.push(...found.deposits);
  exp.found.civs.push(...found.civs.map((c) => c.id));
}

function binomial(rng, n, p) {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng.next() < p) k++;
  return k;
}

// Collect loot from known deposits near the route, once per cooldown.
function gatherDeposits(state, exp, rng) {
  const seen = new Set();
  const [ex, ey] = exp.path[exp.path.length - 1];
  const visit = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const i = idx(wrapX(cx + dx), y);
        if (seen.has(i)) continue;
        seen.add(i);
        const dep = state.deposits[i];
        if (!dep || dep.ready > state.turn) continue;
        const def = DEPOSITS[dep.type];
        if (!rng.chance(def.once ? 1 : 0.75)) continue;
        for (const [res, [lo, hi]] of Object.entries(def.loot)) addLoot(exp, res, rng.int(lo, hi));
        exp.gathered = exp.gathered || [];
        exp.gathered.push(def.name);
        if (def.once) delete state.deposits[i];
        else dep.ready = state.turn + 15;
      }
    }
  };
  for (const [x, y] of exp.path) visit(x, y, 1);
  visit(ex, ey, 2);
}

// Apply the weight limit: keep the most valuable goods.
export function capLoot(loot, capacity) {
  const order = ['gold', 'luxuries', 'iron', 'clothing', 'stone', 'wood', 'food'];
  const out = {};
  let room = capacity;
  if (loot.knowledge) out.knowledge = loot.knowledge;
  for (const k of order) {
    if (!loot[k]) continue;
    const w = RESOURCES[k].weight;
    const take = Math.min(loot[k], Math.floor(room / w));
    if (take > 0) {
      out[k] = take;
      room -= take * w;
    }
  }
  return out;
}

function arrive(state, exp, rng, terrain, events) {
  const [dx, dy] = exp.path[exp.path.length - 1];
  mergeFound(exp, reveal(state, dx, dy, exp.reveal + 1));
  gatherDeposits(state, exp, rng);
  // Random happenings at the far end.
  const roll = rng.next();
  const b = terrain.biome[idx(dx, dy)];
  if (roll < 0.1) {
    const cause = BIOMES[b].risk === 'cold' ? 'a blizzard' : BIOMES[b].risk === 'sea' ? 'a storm' : 'a fever';
    const lost = Math.min(exp.members, 1 + binomial(rng, exp.members, 0.1));
    exp.members -= lost;
    exp.deaths += lost;
    exp.notes = `${cause[0].toUpperCase()}${cause.slice(1)} struck the party.`;
  } else if (roll < 0.2) {
    addLoot(exp, 'food', rng.int(5, 15));
    exp.notes = 'Friendly locals shared food and stories.';
    addLoot(exp, 'knowledge', rng.int(2, 6));
  } else if (roll < 0.26) {
    addLoot(exp, 'knowledge', rng.int(5, 12));
    exp.notes = 'The party charted the stars from a high place.';
  }
  const lost = binomial(rng, exp.members, exp.deathChance * 0.67);
  exp.members -= lost;
  exp.deaths += lost;
  exp.phase = 'back';
  const city = state.cities.find((c) => c.id === exp.cityId);
  addLog(state, '📍', `Expedition from ${city ? city.name : 'home'} reached its destination${exp.found.deposits.length ? ` and found ${exp.found.deposits.length} new resource site(s)` : ''}.`);
  void events;
}

function returnHome(state, exp, rng, events) {
  const lost = binomial(rng, exp.members, exp.deathChance * 0.33);
  exp.members -= lost;
  exp.deaths += lost;
  const city = state.cities.find((c) => c.id === exp.cityId) || state.cities[0];
  state.stats.lost += exp.deaths;
  if (exp.members <= 0) {
    const text = `The ${PARTY_SIZES.find((p) => p.id === exp.party)?.name || 'expedition'} from ${city.name} never returned. Their maps were found later, but no goods.`;
    addLog(state, '☠️', text);
    events.push({ icon: '☠️', title: 'Expedition lost', text, important: true, expedition: exp, loot: {} });
    return;
  }
  const loot = capLoot(exp.loot, Math.round(exp.members * 8 * exp.carry));
  gain(state, loot);
  city.pop += exp.members;
  const lootText = Object.entries(loot).map(([k, v]) => `${RESOURCES[k].icon} ${v}`).join('  ') || 'nothing of value';
  const text = `${exp.members} of ${exp.size} returned to ${city.name} with ${lootText}.`;
  addLog(state, '🎒', text);
  events.push({ icon: '🎒', title: 'Expedition returns', text, important: true, expedition: exp, loot });
}

/** Move every expedition forward one turn. */
export function expeditionsTurn(state, events) {
  const terrain = terrainOf(state);
  const rng = rngOf(state);
  const done = [];
  for (const exp of state.expeditions) {
    exp.elapsed++;
    if (exp.phase === 'out') {
      const target = Math.min(1, exp.elapsed / exp.outTurns) * exp.turns;
      let k = exp.pos;
      while (k + 1 < exp.path.length && exp.cum[k + 1] <= target + 1e-9) {
        k++;
        const [x, y] = exp.path[k];
        mergeFound(exp, reveal(state, x, y, exp.reveal));
        const b = terrain.biome[idx(x, y)];
        if (!isWaterBiome(b) && rng.chance(0.2 * exp.forage)) {
          const ys = Object.entries(BIOMES[b].yields);
          if (ys.length) {
            const [res, v] = ys[rng.int(0, ys.length - 1)];
            addLoot(exp, res, v * 2);
          }
        }
      }
      exp.pos = k;
      if (exp.elapsed >= exp.outTurns) {
        exp.pos = exp.path.length - 1;
        arrive(state, exp, rng, terrain, events);
      }
    } else {
      const frac = Math.min(1, (exp.elapsed - exp.outTurns) / exp.backTurns);
      exp.pos = Math.round((exp.path.length - 1) * (1 - frac));
      if (exp.elapsed >= exp.outTurns + exp.backTurns) {
        returnHome(state, exp, rng, events);
        done.push(exp.id);
      }
    }
  }
  state.expeditions = state.expeditions.filter((e) => !done.includes(e.id));
}

export function expeditionPosition(exp) {
  return exp.path[Math.max(0, Math.min(exp.path.length - 1, exp.pos))];
}
