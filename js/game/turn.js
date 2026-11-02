// End-of-turn processing: production, growth, expeditions, other peoples.
import { AGES } from './data.js';
import {
  addLog, checkVictory, cityReports, getCaps, housing, rngOf, tradeIncome, gain, totalPopulation,
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
    const need = 8 + 3 * city.pop;
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
  state.year += age.yearsPerTurn;
  if (next && state.year >= next.startYear) state.year = next.startYear - 1;

  if (totalPopulation(state) <= 0) {
    state.over = true;
    events.push({ icon: '🪦', title: 'Your people are gone', text: 'No one remains to carry your story.', important: true });
  }
  if (checkVictory(state)) {
    events.push({ icon: '🌍', title: 'The World is Mapped!', text: 'Your explorers have charted half of the Earth. Your name will be remembered across the ages.', important: true, victory: true });
  }
  return events;
}
