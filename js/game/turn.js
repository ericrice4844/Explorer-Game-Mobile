// End-of-turn processing: production, growth, expeditions, other peoples.
import { AGES } from './data.js';
import {
  addLog, checkVictory, growthNeed, modeOf, cityReports, getCaps, housing, rngOf, tradeIncome, gain, totalPopulation,
} from './game.js';
import { expeditionsTurn } from './expedition.js';
import { civsTurn } from './civs.js';

export function endTurn(state) {
  const events = [];
  const caps = getCaps(state);
  const rng = rngOf(state);

  // Production and growth.
  const reports = cityReports(state);
  for (const rep of reports) {
    const { city, out } = rep;
    const produced = { ...out };
    produced.knowledge = (produced.knowledge || 0) * caps.knowledgeMult;
    gain(state, produced);
    state.res.food -= city.pop;
    const surplus = (out.food || 0) - city.pop;
    if (surplus > 0) city.growth += surplus * (state.player.lifestyle === 'settled' ? 1.25 : 1);
    const need = growthNeed(state, city);
    if (city.growth >= need) {
      if (city.pop < housing(state, city)) {
        city.pop++;
        city.growth = 0;
      } else {
        city.growth = need;
      }
    }
  }
  for (const route of state.tradeRoutes) gain(state, tradeIncome(state, route));
  // Round stockpiles to one decimal to avoid float drift.
  for (const k of Object.keys(state.res)) state.res[k] = Math.round(state.res[k] * 10) / 10;

  // Starvation.
  if (state.res.food < 0) {
    state.res.food = 0;
    const victims = state.cities.filter((c) => c.pop > 1);
    if (victims.length) {
      const c = victims[rng.int(0, victims.length - 1)];
      c.pop--;
      const text = `Famine in ${c.name}! The granaries are empty and a villager starved.`;
      addLog(state, '🥀', text);
      events.push({ icon: '🥀', title: 'Famine', text, important: true });
    }
  }

  expeditionsTurn(state, events);
  civsTurn(state, events);

  // Time passes.
  state.turn++;
  const age = AGES[state.age];
  const next = AGES[state.age + 1];
  state.year += age.yearsPerTurn * modeOf(state).yearsPerTurnMult;
  if (next && state.year >= next.startYear) state.year = next.startYear - 1;

  if (totalPopulation(state) <= 0) {
    state.over = true;
    events.push({ icon: '🪦', title: 'Your people are gone', text: 'No one remains to carry your story.', important: true });
  }
  if (checkVictory(state)) {
    const pct = Math.round(modeOf(state).victory * 100);
    events.push({ icon: '🌍', title: 'The World is Mapped!', text: `Your explorers have charted ${pct}% of the Earth in the Modern Age. Your name will be remembered across the ages.`, important: true, victory: true });
  }
  const limit = modeOf(state).turnLimit;
  if (limit && !state.won && !state.over && state.turn > limit) {
    state.over = true;
    events.push({ icon: '⌛', title: 'Time is up', text: `${limit} turns have passed. Your people reached the ${AGES[state.age].name} and mapped ${(state.exploredCount / (state.explored.length) * 100).toFixed(1)}% of the world.`, important: true, final: true });
  }
  return events;
}

/**
 * Persistent worlds (Epic mode): advance the turns that passed while the
 * player was away. Returns { turns, events }.
 */
export function catchUp(state, now = Date.now()) {
  const m = modeOf(state);
  const result = { turns: 0, events: [] };
  if (!m.idleMinutesPerTurn || state.over || !state.lastPlayed) return result;
  const due = Math.floor((now - state.lastPlayed) / 60000 / m.idleMinutesPerTurn);
  const turns = Math.min(m.idleMaxTurns, Math.max(0, due));
  for (let i = 0; i < turns && !state.over; i++) {
    result.events.push(...endTurn(state));
    result.turns++;
  }
  // Keep any partial interval so time is not lost.
  if (due > 0) state.lastPlayed = due > turns ? now : state.lastPlayed + turns * m.idleMinutesPerTurn * 60000;
  return result;
}
