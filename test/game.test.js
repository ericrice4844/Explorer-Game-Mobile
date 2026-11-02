import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BIOMES, STYLES, styleFor, ADVANCES, AGES } from '../js/game/data.js';
import { W, H, decodeMask, generateTerrain, tileOf, idx, chebyshev } from '../js/game/world.js';
import { findPath } from '../js/game/path.js';
import * as G from '../js/game/game.js';
import { planExpedition, launchExpedition, capLoot } from '../js/game/expedition.js';
import {
  diplomacyOptions, giveGift, attackCiv, openTradeRoute, civStrength,
} from '../js/game/civs.js';
import { endTurn } from '../js/game/turn.js';
import { playBot } from './bot.js';

const biomeAt = (t, lat, lon) => {
  const { x, y } = tileOf(lat, lon);
  return t.biome[idx(x, y)];
};

test('earth mask has realistic land coverage', () => {
  const land = decodeMask();
  assert.equal(land.length, W * H);
  const frac = land.reduce((a, b) => a + b, 0) / land.length;
  assert.ok(frac > 0.25 && frac < 0.4, `land fraction ${frac}`);
});

test('terrain puts familiar places in plausible biomes', () => {
  const t = generateTerrain(1);
  assert.equal(BIOMES[biomeAt(t, 0, -150)].water, true, 'mid Pacific is water');
  assert.equal(BIOMES[biomeAt(t, 30, -40)].water, true, 'mid Atlantic is water');
  assert.equal(biomeAt(t, 23, 10), B.DESERT, 'Sahara is desert');
  assert.ok([B.MOUNTAINS, B.HILLS].includes(biomeAt(t, 29, 84)), 'Himalaya is mountainous');
  assert.equal(biomeAt(t, -3, -62), B.JUNGLE, 'Amazon is jungle');
  assert.equal(biomeAt(t, -85, 0), B.ICE, 'Antarctica is ice');
  assert.ok(!BIOMES[biomeAt(t, 52, 0)].water, 'south-east England is land');
});

test('pathfinding respects sea travel abilities', () => {
  const t = generateTerrain(1);
  const lisbon = tileOf(38.7, -8);
  const ny = tileOf(40.7, -73);
  const landCaps = { seaLevel: 0, landSpeed: 2, seaSpeed: 2, air: 0, airSpeed: 25 };
  assert.equal(findPath(t, lisbon.x, lisbon.y, ny.x, ny.y, landCaps), null, 'cannot walk across the Atlantic');
  const coastal = { ...landCaps, seaLevel: 2 };
  const dakar = tileOf(14.7, -17.2);
  const recife = tileOf(-8, -35);
  const galleyRoute = findPath(t, dakar.x, dakar.y, recife.x, recife.y, coastal);
  const caravelRoute = findPath(t, dakar.x, dakar.y, recife.x, recife.y, { ...landCaps, seaLevel: 4, seaSpeed: 2 });
  assert.ok(!galleyRoute || galleyRoute.path.length > caravelRoute.path.length * 3, 'galleys cannot cross the open South Atlantic directly');
  const norse = findPath(t, lisbon.x, lisbon.y, ny.x, ny.y, coastal);
  assert.ok(norse && norse.path.some(([, y]) => y < 30), 'galleys can only island-hop the far North Atlantic, like the Norse');
  const ocean = { ...landCaps, seaLevel: 4, seaSpeed: 7 };
  const p = findPath(t, lisbon.x, lisbon.y, ny.x, ny.y, ocean);
  assert.ok(p, 'caravels cross the Atlantic');
  assert.ok(p.turns > 3 && p.turns < 20);
  // East-west wrap: Alaska to Siberia over the Bering Strait by raft.
  const alaska = tileOf(65, -165);
  const chukotka = tileOf(66, 172);
  const raft = { ...landCaps, seaLevel: 1 };
  const bering = findPath(t, alaska.x, alaska.y, chukotka.x, chukotka.y, raft);
  assert.ok(bering, 'can cross the Bering strait around the date line');
  assert.ok(bering.path.length < 30, 'wrap-around route is short');
});

test('every lifestyle/temperament maps to a culture style', () => {
  for (const l of ['nomadic', 'settled', 'seafaring']) {
    for (const tmp of ['warlike', 'peaceful', 'mercantile']) {
      const k = styleFor(l, tmp);
      assert.ok(STYLES[k], `${l}/${tmp}`);
      assert.equal(STYLES[k].lifestyle, l);
      assert.equal(STYLES[k].temperament, tmp);
      for (const arr of ['houses', 'landmarks', 'headgear', 'titles']) assert.equal(STYLES[k][arr].length, AGES.length);
    }
  }
  assert.equal(styleFor('nomadic', 'warlike'), 'steppe_horde');
});

test('new game starts on habitable land with neighbours nearby', () => {
  for (const lifestyle of ['nomadic', 'settled', 'seafaring']) {
    const s = G.newGame({ seed: 11, lifestyle, temperament: 'peaceful' });
    const c = s.cities[0];
    const t = G.terrainOf(s);
    const b = t.biome[idx(c.x, c.y)];
    assert.ok(!BIOMES[b].water && b !== B.ICE);
    assert.ok(s.civs.length >= 25);
    assert.ok(s.civs.filter((v) => chebyshev(v.x, v.y, c.x, c.y) <= 14).length >= 1, 'a neighbour within reach');
    assert.ok(s.exploredCount > 0);
    assert.ok(G.incomeSummary(s).food > 0, `${lifestyle} start can feed itself`);
    if (lifestyle === 'seafaring') assert.ok(G.hasAdvance(s, 'rafts'));
  }
});

test('save and load round-trips the game', () => {
  const s = G.newGame({ seed: 5 });
  endTurn(s);
  const s2 = G.deserialize(G.serialize(s));
  assert.equal(s2.turn, s.turn);
  assert.equal(s2.exploredCount, s.exploredCount);
  assert.deepEqual(Array.from(s2.explored), Array.from(s.explored));
  assert.deepEqual(s2.cities, s.cities);
  assert.equal(s2.civs.length, s.civs.length);
});

test('expeditions cost supplies, map land, and come home', () => {
  const s = G.newGame({ seed: 3, lifestyle: 'settled', temperament: 'peaceful' });
  const c = s.cities[0];
  let plan = null;
  for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, -3]]) {
    plan = planExpedition(s, c.id, c.x + dx, c.y + dy, 'scouts');
    if (plan.ok) break;
  }
  assert.ok(plan.ok, plan.reason);
  assert.ok(plan.cost.food > 0 && plan.cost.clothing > 0);
  const food = s.res.food;
  const popBefore = c.pop;
  const explored = s.exploredCount;
  launchExpedition(s, plan);
  assert.equal(s.res.food, food - plan.cost.food);
  assert.equal(c.pop, popBefore - plan.size);
  assert.equal(G.totalPopulation(s), popBefore, 'members still count as population');
  let returned = null;
  for (let i = 0; i < plan.outTurns + plan.backTurns; i++) {
    const ev = endTurn(s);
    returned = ev.find((e) => e.expedition) || returned;
  }
  assert.equal(s.expeditions.length, 0);
  assert.ok(returned, 'return event fired');
  assert.ok(s.exploredCount > explored, 'expedition mapped new tiles');
});

test('expeditions cannot exceed endurance or cross water without boats', () => {
  const s = G.newGame({ seed: 3, lifestyle: 'settled', temperament: 'peaceful' });
  const c = s.cities[0];
  const far = planExpedition(s, c.id, c.x + 100, c.y, 'scouts');
  assert.equal(far.ok, false);
  assert.ok(far.reason);
});

test('loot is capped by carrying capacity, keeping valuables', () => {
  const out = capLoot({ food: 50, gold: 10, stone: 30, knowledge: 7 }, 50);
  assert.equal(out.gold, 10);
  assert.equal(out.knowledge, 7);
  assert.equal(out.stone, 10);
  assert.equal(out.food, undefined);
});

test('settling requires explored land, people and supplies', () => {
  const s = G.newGame({ seed: 8, lifestyle: 'settled', temperament: 'peaceful' });
  const c = s.cities[0];
  assert.equal(G.checkSettle(s, c.x + 1, c.y).ok, false, 'too close');
  s.res.food = s.res.wood = s.res.clothing = 500;
  let done = false;
  for (let dx = -4; dx <= 4 && !done; dx++) {
    for (let dy = -4; dy <= 4 && !done; dy++) {
      if (G.checkSettle(s, c.x + dx, c.y + dy).ok) {
        const r = G.settle(s, c.x + dx, c.y + dy, 'Testville');
        assert.ok(r.ok);
        done = true;
      }
    }
  }
  assert.ok(done, 'found a spot to settle');
  assert.equal(s.cities.length, 2);
  assert.equal(s.cities[1].name, 'Testville');
});

test('advances and ages unlock in order', () => {
  const s = G.newGame({ seed: 4 });
  const caravels = ADVANCES.find((a) => a.id === 'caravels');
  assert.equal(G.advanceStatus(s, caravels).ok, false);
  Object.assign(s.res, { food: 999, wood: 999, stone: 999, clothing: 999, iron: 999, gold: 999, luxuries: 999, knowledge: 9999 });
  assert.ok(G.learnAdvance(s, 'rafts').ok);
  assert.equal(G.getCaps(s).seaLevel, 1);
  assert.equal(G.advanceAge(s).ok, false, 'needs 2 settlements');
  s.cities.push({ ...s.cities[0], id: 'cX', capital: false, x: (s.cities[0].x + 5) % W });
  assert.ok(G.advanceAge(s).ok);
  assert.equal(s.age, 1);
  assert.ok(s.year >= AGES[1].startYear);
});

test('diplomacy: gifts, trade and conquest', () => {
  const s = G.newGame({ seed: 21, lifestyle: 'settled', temperament: 'warlike' });
  Object.assign(s.res, { food: 999, wood: 999, gold: 999, clothing: 999, luxuries: 99 });
  const civ = s.civs[0];
  civ.met = true;
  const rel = civ.relation;
  assert.ok(giveGift(s, civ.id, 'gold').ok);
  assert.ok(civ.relation > rel);
  civ.relation = 10;
  const o = diplomacyOptions(s, civ);
  if (o.trade.ok) {
    assert.ok(openTradeRoute(s, civ.id).ok);
    assert.ok(G.incomeSummary(s).gold > 0);
  }
  // Conquest uses population power and can capture the settlement.
  s.cities[0].pop = 30;
  civ.pop = 2;
  civ.level = 0;
  assert.ok(civStrength(civ) < 5);
  const before = s.cities[0].pop;
  const r = attackCiv(s, civ.id, 20);
  if (diplomacyOptions(s, civ).attack.reason === undefined || r.ok) {
    assert.ok(r.ok, r.reason);
    assert.ok(r.casualties >= 1, 'war always costs lives');
    assert.ok(s.cities[0].pop < before);
    if (r.won) {
      assert.ok(civ.conquered);
      assert.ok(s.cities.some((c) => c.name === civ.name));
    }
  }
});

test('a bot can play through the ages without errors', () => {
  for (const [lifestyle, temperament, seed] of [['settled', 'peaceful', 1], ['nomadic', 'warlike', 2], ['seafaring', 'mercantile', 3]]) {
    const s = G.newGame({ seed, lifestyle, temperament });
    const { timeline } = playBot(s, 260, seed);
    assert.ok(!s.over, `${lifestyle} survived`);
    assert.ok(s.age >= 3, `${lifestyle} reached the Medieval Age (got ${s.age}, timeline ${JSON.stringify(timeline)})`);
    for (const k of Object.keys(s.res)) assert.ok(Number.isFinite(s.res[k]) && s.res[k] >= 0, `${k} is valid`);
    assert.ok(G.deserialize(G.serialize(s)).turn === s.turn);
  }
});
