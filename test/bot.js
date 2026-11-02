// A simple automated player used by tests to check the game can be played
// through the ages without errors and with sensible pacing.
import { ADVANCES, BUILDINGS, PARTY_SIZES } from '../js/game/data.js';
import * as G from '../js/game/game.js';
import { W, H, wrapX } from '../js/game/world.js';
import { planExpedition, launchExpedition } from '../js/game/expedition.js';
import { diplomacyOptions, openTradeRoute, shareKnowledge, giveGift } from '../js/game/civs.js';
import { endTurn } from '../js/game/turn.js';
import { mulberry32 } from '../js/game/rng.js';

export function playBot(state, turns, seed = 1) {
  const rand = mulberry32(seed);
  const timeline = [];
  const allEvents = [];
  for (let t = 0; t < turns && !state.over; t++) {
    const before = state.age;
    G.advanceAge(state);
    if (state.age !== before) timeline.push({ age: state.age, turn: state.turn });
    for (const adv of ADVANCES) G.learnAdvance(state, adv.id);
    for (const city of state.cities) {
      for (const b of BUILDINGS) {
        // Keep some reserves for expeditions.
        if (state.res.food > 60) G.build(state, city.id, b.id);
      }
    }
    // Settle near existing cities.
    if (G.canAfford(state, G.settleCost(state)) && state.res.food > 80) {
      const caps = G.getCaps(state);
      for (let k = 0; k < 40; k++) {
        const c = state.cities[Math.floor(rand() * state.cities.length)];
        const r = Math.max(3, Math.floor(caps.settleRange * 0.8));
        const x = wrapX(c.x + Math.floor((rand() * 2 - 1) * r));
        const y = Math.max(0, Math.min(H - 1, c.y + Math.floor((rand() * 2 - 1) * r)));
        if (G.checkSettle(state, x, y).ok) {
          G.settle(state, x, y);
          break;
        }
      }
    }
    // Diplomacy.
    for (const civ of state.civs.filter((c) => c.met && !c.conquered)) {
      const o = diplomacyOptions(state, civ);
      if (o.trade.ok) openTradeRoute(state, civ.id);
      if (o.share.ok) shareKnowledge(state, civ.id);
      if (civ.relation < 0 && state.res.food > 150) giveGift(state, civ.id, 'food');
    }
    // Expeditions toward unexplored land.
    const caps = G.getCaps(state);
    for (let k = 0; k < 30 && state.expeditions.length < caps.maxExpeditions; k++) {
      const c = state.cities[Math.floor(rand() * state.cities.length)];
      const reach = caps.endurance * (caps.air ? caps.airSpeed : Math.max(caps.landSpeed, caps.seaLevel ? caps.seaSpeed : 0)) * 0.7;
      const ang = rand() * Math.PI * 2;
      const d = 2 + rand() * reach;
      const x = wrapX(Math.round(c.x + Math.cos(ang) * d));
      const y = Math.round(c.y + Math.sin(ang) * d);
      if (y < 0 || y >= H) continue;
      if (G.isExplored(state, x, y) && rand() < 0.8) continue;
      const parties = PARTY_SIZES.filter((p) => p.minAge <= state.age).reverse();
      for (const p of parties) {
        const plan = planExpedition(state, c.id, x, y, p.id);
        // Keep a food reserve for growth and settling.
        if (plan.ok && state.res.food - plan.cost.food >= 40) {
          launchExpedition(state, plan);
          break;
        }
      }
    }
    allEvents.push(...endTurn(state));
  }
  return { timeline, events: allEvents };
}

export { W };
