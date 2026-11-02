// Other peoples of the world: generation, diplomacy and their own turns.
import { B, REGION_SYLLABLES, styleFor, isWaterBiome } from './data.js';
import { W, H, idx, chebyshev, distance, isCoastalLand, regionOf } from './world.js';
import { findPath } from './path.js';
import {
  addLog, canAfford, civName, cityStrength, getCaps, makeName, newId, pay, gain, rngOf, terrainOf,
  totalStrength, reveal, scaleCost,
} from './game.js';

const CIV_COLORS = ['#8e44ad', '#16a085', '#d35400', '#2c3e50', '#27ae60', '#c0392b', '#2980b9', '#f39c12', '#7f8c8d', '#e84393', '#6c5ce7', '#00b894'];
const POP_BY_LEVEL = [[3, 6], [6, 10], [10, 16], [16, 26], [26, 40], [40, 60]];
// Sprite age shown for a civ's level.
export const CIV_SPRITE_AGE = [0, 0, 1, 2, 3, 5];

function specialtyFor(b) {
  if (b === B.JUNGLE || b === B.SAVANNA) return 'luxuries';
  if (b === B.MOUNTAINS || b === B.HILLS) return 'iron';
  if (b === B.DESERT) return 'gold';
  if (b === B.FOREST || b === B.TAIGA || b === B.TUNDRA) return 'clothing';
  return 'food';
}

function baseRelation(temperament) {
  return temperament === 'peaceful' ? 20 : temperament === 'mercantile' ? 10 : -15;
}

export function generateCivs(state, terrain, rng, start, count = 34) {
  const civs = [];
  const okBiome = (b) => !isWaterBiome(b) && b !== B.ICE;
  const tryPlace = (minD, maxD) => {
    for (let t = 0; t < 4000; t++) {
      const x = rng.int(0, W - 1);
      const y = rng.int(6, H - 12);
      const b = terrain.biome[idx(x, y)];
      if (!okBiome(b)) continue;
      if (b === B.TUNDRA && rng.chance(0.7)) continue;
      const d = chebyshev(x, y, start.x, start.y);
      if (d < minD || d > maxD) continue;
      if (civs.some((c) => chebyshev(c.x, c.y, x, y) < 7)) continue;
      return { x, y, b };
    }
    return null;
  };
  for (let n = 0; n < count; n++) {
    // The first two neighbours are placed within reach of an early expedition.
    const spot = n < 2 ? tryPlace(5, 9) || tryPlace(5, 14) : tryPlace(10, 999);
    if (!spot) continue;
    const { x, y, b } = spot;
    const coastal = isCoastalLand(terrain, x, y);
    const temperament = rng.pick(['peaceful', 'peaceful', 'mercantile', 'warlike', 'warlike']);
    let lifestyle = 'settled';
    if ([B.STEPPE, B.DESERT, B.SAVANNA, B.TUNDRA].includes(b) && rng.chance(0.65)) lifestyle = 'nomadic';
    else if (coastal && rng.chance(0.45)) lifestyle = 'seafaring';
    const roll = rng.next();
    const level = roll < 0.45 ? 0 : roll < 0.8 ? 1 : roll < 0.95 ? 2 : 3;
    const [pmin, pmax] = POP_BY_LEVEL[level];
    const region = regionOf(x, y);
    let relation = baseRelation(temperament);
    if (state.player.temperament === 'peaceful') relation += 15;
    if (state.player.temperament === 'warlike') relation -= 10;
    civs.push({
      id: newId(state, 'n'),
      name: makeName(rng, REGION_SYLLABLES[region]),
      region,
      x, y,
      level,
      growth: rng.int(0, 60),
      pop: rng.int(pmin, pmax),
      wealth: rng.int(0, 10) + level * 10,
      temperament,
      lifestyle,
      style: styleFor(lifestyle, temperament),
      specialty: specialtyFor(b),
      color: rng.pick(CIV_COLORS),
      relation,
      met: false,
      conquered: false,
      cooldowns: {},
    });
  }
  return civs;
}

export function civStrength(civ) {
  const mult = civ.temperament === 'warlike' ? 1.3 : 1;
  const fort = civ.level >= 3 ? 1.2 : 1;
  return Math.round(civ.pop * (1 + 0.25 * civ.level) * mult * fort * 10) / 10;
}

export function relationLabel(r) {
  if (r >= 60) return 'Allied';
  if (r >= 25) return 'Friendly';
  if (r >= -10) return 'Neutral';
  if (r >= -40) return 'Wary';
  return 'Hostile';
}

function clampRel(civ) {
  civ.relation = Math.max(-100, Math.min(100, Math.round(civ.relation)));
}

function onCooldown(state, civ, key) {
  return (civ.cooldowns[key] || 0) > state.turn;
}

// Nearest of the player's cities that can reach this civ.
export function nearestReach(state, civ, maxTurnsMult = 1.5) {
  const terrain = terrainOf(state);
  const caps = getCaps(state);
  let best = null;
  const sorted = [...state.cities].sort((a, b) => distance(a.x, a.y, civ.x, civ.y) - distance(b.x, b.y, civ.x, civ.y));
  for (const city of sorted.slice(0, 4)) {
    const p = findPath(terrain, city.x, city.y, civ.x, civ.y, caps, caps.endurance * maxTurnsMult);
    if (p && (!best || p.turns < best.path.turns)) best = { city, path: p, dist: distance(city.x, city.y, civ.x, civ.y) };
  }
  return best;
}

export const GIFTS = [
  { id: 'food', label: '25 Food', cost: { food: 25 }, rel: 8 },
  { id: 'clothing', label: '15 Clothing', cost: { clothing: 15 }, rel: 10 },
  { id: 'gold', label: '10 Gold', cost: { gold: 10 }, rel: 14 },
  { id: 'luxuries', label: '5 Luxuries', cost: { luxuries: 5 }, rel: 18 },
];

export function tradeRouteCost(state) {
  const mult = state.player.temperament === 'mercantile' ? 0.6 : 1;
  return scaleCost({ wood: 15 + state.age * 10, food: 15 + state.age * 5, ...(state.age >= 2 ? { gold: 5 * state.age } : {}) }, mult);
}

export function maxTradeRoutes(state) {
  return 1 + state.age + state.cities.filter((c) => c.buildings.includes('market')).length;
}

// Everything the diplomacy panel needs to know about a civ.
export function diplomacyOptions(state, civ) {
  const reach = nearestReach(state, civ);
  const caps = getCaps(state);
  const myStr = totalStrength(state);
  const theirStr = civStrength(civ);
  const hasRoute = state.tradeRoutes.some((r) => r.toCiv === civ.id);
  const routeCost = tradeRouteCost(state);
  const opts = {};
  opts.gift = GIFTS.map((g) => ({ ...g, ok: canAfford(state, g.cost) }));
  let tradeReason = null;
  if (hasRoute) tradeReason = 'Trade route already open';
  else if (civ.relation < 0) tradeReason = 'They do not trust you enough (need Neutral)';
  else if (!reach || reach.dist > caps.tradeRange) tradeReason = `Too far for a trade route (range ${caps.tradeRange})`;
  else if (state.tradeRoutes.length >= maxTradeRoutes(state)) tradeReason = 'No free trade route slots (build Markets / advance ages)';
  else if (!canAfford(state, routeCost)) tradeReason = 'Not enough resources';
  opts.trade = { ok: !tradeReason, reason: tradeReason, cost: routeCost, from: reach?.city };
  let shareReason = null;
  if (civ.relation < 30) shareReason = 'Requires Friendly relations';
  else if (onCooldown(state, civ, 'share')) shareReason = `Available on turn ${civ.cooldowns.share}`;
  opts.share = { ok: !shareReason, reason: shareReason, amount: 5 + civ.level * 6 };
  let tribReason = null;
  if (myStr < theirStr * 1.5) tribReason = 'You need 1.5× their strength';
  else if (onCooldown(state, civ, 'tribute')) tribReason = `Available on turn ${civ.cooldowns.tribute}`;
  opts.tribute = { ok: !tribReason, reason: tribReason, amount: 5 + civ.level * 8 };
  let atkReason = null;
  if (!reach) atkReason = 'None of your settlements can reach them';
  else if (reach.city.pop < 3) atkReason = `${reach.city.name} is too small to raise an army`;
  opts.attack = { ok: !atkReason, reason: atkReason, from: reach?.city, maxArmy: reach ? reach.city.pop - 1 : 0, theirStr };
  return opts;
}

export function giveGift(state, civId, giftId) {
  const civ = state.civs.find((c) => c.id === civId);
  const gift = GIFTS.find((g) => g.id === giftId);
  if (!civ || !gift || !canAfford(state, gift.cost)) return { ok: false, reason: 'Cannot afford gift' };
  pay(state, gift.cost);
  const mult = state.player.temperament === 'mercantile' ? 1.5 : 1;
  civ.relation += gift.rel * mult;
  clampRel(civ);
  addLog(state, '🎁', `Sent ${gift.label} to the ${civName(civ)}. Relations: ${relationLabel(civ.relation)}.`);
  return { ok: true };
}

export function openTradeRoute(state, civId) {
  const civ = state.civs.find((c) => c.id === civId);
  const o = civ && diplomacyOptions(state, civ).trade;
  if (!o || !o.ok) return { ok: false, reason: o?.reason || 'Unavailable' };
  pay(state, o.cost);
  state.tradeRoutes.push({ id: newId(state, 't'), from: o.from.id, toCiv: civ.id, opened: state.turn });
  civ.relation += 10;
  clampRel(civ);
  addLog(state, '🐫', `A trade route now links ${o.from.name} with the ${civName(civ)}.`);
  return { ok: true };
}

export function shareKnowledge(state, civId) {
  const civ = state.civs.find((c) => c.id === civId);
  const o = civ && diplomacyOptions(state, civ).share;
  if (!o || !o.ok) return { ok: false, reason: o?.reason || 'Unavailable' };
  gain(state, { knowledge: o.amount });
  civ.cooldowns.share = state.turn + 8;
  civ.relation += 3;
  clampRel(civ);
  // Their scholars also tell you about lands around them.
  reveal(state, civ.x, civ.y, 4 + civ.level);
  addLog(state, '📜', `Scholars of the ${civName(civ)} shared ${o.amount} knowledge and their maps.`);
  return { ok: true, amount: o.amount };
}

export function demandTribute(state, civId) {
  const civ = state.civs.find((c) => c.id === civId);
  const o = civ && diplomacyOptions(state, civ).tribute;
  if (!o || !o.ok) return { ok: false, reason: o?.reason || 'Unavailable' };
  const gold = Math.min(o.amount, Math.max(3, civ.wealth));
  civ.wealth = Math.max(0, civ.wealth - gold);
  gain(state, { gold, [civ.specialty]: 5 + civ.level * 3 });
  civ.relation -= 30;
  civ.cooldowns.tribute = state.turn + 10;
  clampRel(civ);
  addLog(state, '💰', `The ${civName(civ)} paid ${gold} gold in tribute, resentfully.`);
  return { ok: true, gold };
}

export function armyStrength(state, city, size) {
  return Math.round(cityStrength(state, city, size) * 10) / 10;
}

export function battleOdds(state, civ, city, size) {
  const a = armyStrength(state, city, size);
  const d = civStrength(civ);
  return { attack: a, defense: d, winChance: (a * a) / (a * a + d * d) };
}

export function attackCiv(state, civId, size) {
  const civ = state.civs.find((c) => c.id === civId);
  const o = civ && diplomacyOptions(state, civ).attack;
  if (!o || !o.ok) return { ok: false, reason: o?.reason || 'Unavailable' };
  size = Math.max(1, Math.min(o.maxArmy, Math.floor(size)));
  const foodCost = size * 2;
  if (state.res.food < foodCost) return { ok: false, reason: `The army needs ${foodCost} food` };
  state.res.food -= foodCost;
  const rng = rngOf(state);
  const city = o.from;
  const odds = battleOdds(state, civ, city, size);
  const won = rng.next() < odds.winChance;
  const warMult = state.player.temperament === 'warlike' ? 0.7 : 1;
  let casualties;
  if (won) casualties = Math.max(1, Math.round(size * (odds.defense / (odds.attack + odds.defense)) * 0.6 * warMult));
  else casualties = Math.max(1, Math.round(size * (0.45 + rng.next() * 0.3) * warMult));
  casualties = Math.min(size, casualties);
  city.pop -= casualties;
  if (city.pop < 1) city.pop = 1;
  const result = { ok: true, won, casualties, odds };
  if (won) {
    civ.conquered = true;
    state.stats.conquests++;
    state.tradeRoutes = state.tradeRoutes.filter((r) => r.toCiv !== civ.id);
    const loot = { gold: civ.wealth, [civ.specialty]: 10 + civ.level * 8 };
    gain(state, loot);
    result.loot = loot;
    const newPop = Math.max(2, Math.floor(civ.pop * 0.4));
    state.cities.push({
      id: newId(state, 'c'), name: civ.name, x: civ.x, y: civ.y, pop: newPop, growth: 0,
      buildings: civ.level >= 2 ? ['granary'] : [], capital: false, founded: state.turn, conquered: true,
    });
    reveal(state, civ.x, civ.y, 2);
    for (const other of state.civs) {
      if (other.met && !other.conquered && other !== civ) {
        other.relation -= other.temperament === 'warlike' ? 4 : 10;
        clampRel(other);
      }
    }
    addLog(state, '⚔️', `${city.name}'s warriors conquered the ${civName(civ)}! ${casualties} fell. ${civ.name} joins your realm.`);
  } else {
    civ.relation -= 40;
    civ.pop = Math.max(2, civ.pop - Math.round(size * 0.3));
    clampRel(civ);
    addLog(state, '💀', `The attack on the ${civName(civ)} failed. ${casualties} of your people were lost.`);
  }
  return result;
}

// Other peoples grow, change their attitude, and sometimes raid.
export function civsTurn(state, events) {
  const rng = rngOf(state);
  for (const civ of state.civs) {
    if (civ.conquered) continue;
    const rate = civ.temperament === 'mercantile' ? 1.6 : 1.3;
    // Peoples who trade with you advance faster.
    const trading = state.tradeRoutes.some((r) => r.toCiv === civ.id);
    civ.growth += rng.next() * rate * (trading ? 1.5 : 1) + (state.age > civ.level ? 0.4 : 0);
    if (civ.growth >= 100 && civ.level < 5) {
      civ.growth = 0;
      civ.level++;
      const [pmin] = POP_BY_LEVEL[civ.level];
      civ.pop = Math.max(civ.pop, pmin);
      if (civ.met) {
        addLog(state, '📈', `The ${civ.name} have grown into the ${civName(civ)}.`);
        events.push({ icon: '📈', title: 'A people rises', text: `The ${civ.name} have grown into the ${civName(civ)}.` });
      }
    }
    const [, pmax] = POP_BY_LEVEL[civ.level];
    if (civ.pop < pmax && rng.chance(0.15)) civ.pop++;
    civ.wealth += civ.level * 0.5 + 0.2;
    if (!civ.met) continue;
    const base = baseRelation(civ.temperament);
    if (trading) civ.relation += 0.5;
    else if (civ.relation > base) civ.relation -= 0.5;
    else if (civ.relation < base) civ.relation += 0.5;
    civ.relation = Math.max(-100, Math.min(100, civ.relation));
    // Raids by hostile warlike peoples.
    if (civ.temperament === 'warlike' && civ.relation < -20 && rng.chance(0.05)) {
      const target = [...state.cities].sort((a, b) => distance(a.x, a.y, civ.x, civ.y) - distance(b.x, b.y, civ.x, civ.y))[0];
      if (target && distance(target.x, target.y, civ.x, civ.y) <= 12) {
        const raid = civStrength(civ) * 0.6;
        const walls = target.buildings.includes('walls') ? 2 : 1;
        const defense = cityStrength(state, target) * walls;
        if (raid > defense * (0.6 + rng.next() * 0.8)) {
          const lost = {};
          for (const k of ['food', 'wood', 'gold']) {
            lost[k] = Math.floor(state.res[k] * 0.15);
            state.res[k] -= lost[k];
          }
          if (target.pop > 1) target.pop--;
          const text = `Raiders of the ${civName(civ)} struck ${target.name}, carrying off ${lost.food} food, ${lost.wood} wood and ${lost.gold} gold. One villager was lost.`;
          addLog(state, '🔥', text);
          events.push({ icon: '🔥', title: 'Raid!', text, important: true });
        } else {
          civ.relation += 5;
          const text = `${target.name} drove off raiders from the ${civName(civ)}.`;
          addLog(state, '🛡️', text);
          events.push({ icon: '🛡️', title: 'Raid repelled', text });
        }
      }
    }
  }
}

// Trade routes between two of the player's own settlements.
export function domesticRouteOptions(state, fromId) {
  const from = state.cities.find((c) => c.id === fromId);
  if (!from) return [];
  const caps = getCaps(state);
  const terrain = terrainOf(state);
  const cost = tradeRouteCost(state);
  const full = state.tradeRoutes.length >= maxTradeRoutes(state);
  return state.cities.filter((c) => c.id !== fromId).map((to) => {
    const d = distance(from.x, from.y, to.x, to.y);
    let reason = null;
    const exists = state.tradeRoutes.some((r) => (r.from === from.id && r.toCity === to.id) || (r.from === to.id && r.toCity === from.id));
    if (exists) reason = 'Route exists';
    else if (d < 3) reason = 'Too close to be worthwhile';
    else if (d > caps.tradeRange) reason = `Beyond trade range (${caps.tradeRange})`;
    else if (full) reason = 'No free route slots';
    else if (!canAfford(state, cost)) reason = 'Not enough resources';
    else if (!findPath(terrain, from.x, from.y, to.x, to.y, caps, caps.endurance * 2)) reason = 'No route between them';
    return { city: to, dist: Math.round(d), ok: !reason, reason, cost };
  });
}

export function openDomesticRoute(state, fromId, toId) {
  const opt = domesticRouteOptions(state, fromId).find((o) => o.city.id === toId);
  if (!opt || !opt.ok) return { ok: false, reason: opt?.reason || 'Unavailable' };
  pay(state, opt.cost);
  state.tradeRoutes.push({ id: newId(state, 't'), from: fromId, toCity: toId, opened: state.turn });
  const from = state.cities.find((c) => c.id === fromId);
  addLog(state, '🛤️', `A trade road now links ${from.name} and ${opt.city.name}.`);
  return { ok: true };
}
