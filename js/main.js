// App controller: screens, HUD, map interaction and all panels.
import {
  AGES, ADVANCES, BIOMES, DEPOSITS, LIFESTYLES, TEMPERAMENTS, STYLES, RESOURCES, RESOURCE_KEYS,
  PARTY_SIZES, CIV_LEVELS, styleFor, MODES,
} from './game/data.js';
import * as G from './game/game.js';
import { latLon, idx, distance, W, H } from './game/world.js';
import { planExpedition, launchExpedition, partySizes } from './game/expedition.js';
import {
  diplomacyOptions, giveGift, openTradeRoute, shareKnowledge, demandTribute, attackCiv, battleOdds,
  civStrength, relationLabel, maxTradeRoutes, domesticRouteOptions, openDomesticRoute, CIV_SPRITE_AGE,
} from './game/civs.js';
import { endTurn, catchUp } from './game/turn.js';
import { MapView } from './render/map.js';
import { drawSettlement, drawUnit, drawTerrainDetail, biomeColor } from './render/sprites.js';
import { drawPortrait, SKIN_TONES, HAIR_COLORS, HAIR_STYLES, BEARDS } from './render/portrait.js';
import { hash2 } from './game/rng.js';

const LEGACY_SAVE_KEY = 'ages-of-exploration-save-v1';
const saveKey = (mode) => `ages-of-exploration-${mode}-v1`;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = null;
let map = null;
let mode = 'normal'; // normal | explore | settle
let originCityId = null;
let partyId = 'band';
let pendingTarget = null;
const modalQueue = [];

const PLAYER_COLORS = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#117a65', '#a04000', '#283747', '#d4ac0d', '#e84393'];
const EMBLEMS = ['☀️', '🐺', '🦅', '🌊', '🌳', '🐎', '⭐', '⛰️', '🐉', '🌙', '🔥', '🦁'];

// ---------------- persistence ----------------
function save() {
  if (!state) return;
  state.lastPlayed = Date.now();
  try { localStorage.setItem(saveKey(state.mode), G.serialize(state)); } catch { /* storage may be full or blocked */ }
}
function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function loadSave(mode) {
  try {
    // Older saves (before game modes existed) become Epic Journey games.
    const raw = readStorage(saveKey(mode)) || (mode === 'epic' ? readStorage(LEGACY_SAVE_KEY) : null);
    return raw ? G.deserialize(raw) : null;
  } catch { return null; }
}
function saveSummary(mode) {
  const s = loadSave(mode);
  if (!s) return null;
  return { turn: s.turn, age: AGES[s.age].short, civ: s.player.civName, done: s.won || s.over };
}

// Track real playing time (for Quick Play results).
setInterval(() => {
  if (state && !document.hidden && !$('#game-screen').classList.contains('hidden') && !state.won && !state.over) {
    state.playMs = (state.playMs || 0) + 1000;
  }
}, 1000);

function fmtDuration(ms) {
  const m = Math.floor((ms || 0) / 60000);
  const sec = Math.floor(((ms || 0) % 60000) / 1000);
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

// ---------------- helpers ----------------
function toast(text, err = false) {
  const el = document.createElement('div');
  el.className = `toast${err ? ' err' : ''}`;
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function costHtml(cost) {
  return `<div class="costs">${Object.entries(cost).map(([k, v]) => {
    const short = state && (state.res[k] || 0) < v;
    return `<span class="cost${short ? ' short' : ''}">${RESOURCES[k].icon} ${v}</span>`;
  }).join('')}</div>`;
}

function fmt(n) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
}

function openSheet(title, html, onBind) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.remove('hidden');
  $('#sheet-body').scrollTop = 0;
  if (onBind) onBind($('#sheet-body'));
}
function closeSheet() {
  $('#sheet').classList.add('hidden');
  sheetRefresh = null;
}
let sheetRefresh = null;

function showModal(ev) {
  modalQueue.push(ev);
  if (modalQueue.length === 1) renderModal();
}
function renderModal() {
  const ev = modalQueue[0];
  if (!ev) { $('#modal').classList.add('hidden'); return; }
  $('#modal-icon').textContent = ev.icon || '📜';
  $('#modal-title').textContent = ev.title;
  $('#modal-text').innerHTML = ev.html || `<p>${esc(ev.text)}</p>`;
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  modalQueue.shift();
  renderModal();
}

// ---------------- title screen ----------------
function drawTitleBg() {
  const c = $('#title-bg');
  const r = c.getBoundingClientRect();
  c.width = r.width;
  c.height = r.height;
  const ctx = c.getContext('2d');
  const ts = 34;
  const biomes = [6, 7, 7, 8, 9, 12, 13, 2, 2, 1, 5, 11];
  for (let y = 0; y < r.height / ts + 1; y++) {
    for (let x = 0; x < r.width / ts + 1; x++) {
      const v = hash2(Math.floor(x / 3), Math.floor(y / 3), 9);
      const b = biomes[Math.floor(v * biomes.length)];
      ctx.fillStyle = biomeColor(b, hash2(x, y, 1));
      ctx.fillRect(x * ts, y * ts, ts + 1, ts + 1);
      drawTerrainDetail(ctx, b, x * ts, y * ts, ts, hash2(x, y, 1), hash2(x, y, 2));
    }
  }
  drawSettlement(ctx, r.width * 0.2, r.height * 0.82, 90, { style: 'steppe_horde', age: 3, pop: 12, color: '#c0392b', capital: true });
  drawSettlement(ctx, r.width * 0.82, r.height * 0.15, 80, { style: 'temple_builders', age: 2, pop: 10, color: '#2471a3', capital: true });
  drawUnit(ctx, 'longship', r.width * 0.75, r.height * 0.88, 60, '#1e8449');
  ctx.fillStyle = 'rgba(30,20,10,0.35)';
  ctx.fillRect(0, 0, r.width, r.height);
}

// ---------------- setup wizard ----------------
let setup = null;
function randomSetup() {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  const lifestyle = r(Object.keys(LIFESTYLES));
  const temperament = r(Object.keys(TEMPERAMENTS));
  const st = STYLES[styleFor(lifestyle, temperament)];
  const syl = st.citySyllables;
  const mk = () => r(syl.filter((s) => /^[A-Z]/.test(s))) + r(syl).toLowerCase();
  return {
    leader: {
      name: r(['Aru', 'Temur', 'Nefer', 'Kaia', 'Bjorn', 'Mahina', 'Sela', 'Odo', 'Inti', 'Zara', 'Kofi', 'Liu', 'Tala', 'Ravi']),
      skin: Math.floor(Math.random() * SKIN_TONES.length),
      hair: Math.floor(Math.random() * 5),
      hairStyle: r(HAIR_STYLES),
      beard: r(BEARDS),
    },
    civName: `The ${mk()}`,
    capitalName: mk(),
    color: r(PLAYER_COLORS),
    emblem: r(EMBLEMS),
    lifestyle,
    temperament,
    mode: setup?.mode || 'quick',
  };
}

function renderSetup() {
  const s = setup;
  const styleKey = styleFor(s.lifestyle, s.temperament);
  const st = STYLES[styleKey];
  const tb = (k, v) => `<button class="chip${s.leader[k] === v ? ' sel' : ''}" data-set="leader.${k}" data-val="${esc(v)}">${esc(v)}</button>`;
  $('#setup-body').innerHTML = `
    <div class="section">
      <h3>Game Mode</h3>
      <div class="choice-grid" style="grid-template-columns:1fr 1fr">${Object.values(MODES).map((m) => `<button class="choice${s.mode === m.id ? ' sel' : ''}" data-set="mode" data-val="${m.id}"><span class="big">${m.icon}</span><b>${m.name}</b>${m.blurb}</button>`).join('')}</div>
      <p style="font-size:13px;margin:6px 0">${esc(MODES[s.mode].desc)}${readStorage(saveKey(s.mode)) ? ' <b>Starting a new game replaces your saved ' + esc(MODES[s.mode].name) + ' game.</b>' : ''}</p>
    </div>
    <div class="section">
      <h3>Your Leader</h3>
      <div class="row">
        <canvas class="portrait" id="setup-portrait" width="240" height="240"></canvas>
        <div class="grow">
          <label class="field" for="in-leader">Name</label>
          <input type="text" id="in-leader" maxlength="20" value="${esc(s.leader.name)}" />
          <div class="meta" style="margin-top:6px;font-size:13px;color:var(--muted)">Title: <b>${esc(st.titles[0])}</b> → <b>${esc(st.titles[3])}</b> → <b>${esc(st.titles[6])}</b></div>
        </div>
      </div>
      <label class="field">Skin</label>
      <div class="swatches">${SKIN_TONES.map((c, i) => `<button class="swatch${s.leader.skin === i ? ' sel' : ''}" style="background:${c}" data-set="leader.skin" data-val="${i}" aria-label="Skin tone ${i + 1}"></button>`).join('')}</div>
      <label class="field">Hair colour</label>
      <div class="swatches">${HAIR_COLORS.map((c, i) => `<button class="swatch${s.leader.hair === i ? ' sel' : ''}" style="background:${c}" data-set="leader.hair" data-val="${i}" aria-label="Hair colour ${i + 1}"></button>`).join('')}</div>
      <label class="field">Hair</label>
      <div class="chips">${HAIR_STYLES.map((v) => tb('hairStyle', v)).join('')}</div>
      <label class="field">Facial hair</label>
      <div class="chips">${BEARDS.map((v) => tb('beard', v)).join('')}</div>
    </div>
    <div class="section">
      <h3>Your Civilization</h3>
      <label class="field" for="in-civ">Name of your people</label>
      <input type="text" id="in-civ" maxlength="24" value="${esc(s.civName)}" />
      <label class="field" for="in-cap">Name of your first settlement</label>
      <input type="text" id="in-cap" maxlength="18" value="${esc(s.capitalName)}" />
      <label class="field">Banner colour</label>
      <div class="swatches">${PLAYER_COLORS.map((c) => `<button class="swatch${s.color === c ? ' sel' : ''}" style="background:${c}" data-set="color" data-val="${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
      <label class="field">Emblem</label>
      <div class="chips">${EMBLEMS.map((e) => `<button class="chip${s.emblem === e ? ' sel' : ''}" data-set="emblem" data-val="${e}">${e}</button>`).join('')}</div>
    </div>
    <div class="section">
      <h3>Way of Life</h3>
      <div class="choice-grid">${Object.entries(LIFESTYLES).map(([k, v]) => `<button class="choice${s.lifestyle === k ? ' sel' : ''}" data-set="lifestyle" data-val="${k}"><span class="big">${v.icon}</span><b>${v.name}</b></button>`).join('')}</div>
      <p style="font-size:13px;margin:6px 0 12px">${esc(LIFESTYLES[s.lifestyle].desc)}</p>
      <h3>Temperament</h3>
      <div class="choice-grid">${Object.entries(TEMPERAMENTS).map(([k, v]) => `<button class="choice${s.temperament === k ? ' sel' : ''}" data-set="temperament" data-val="${k}"><span class="big">${v.icon}</span><b>${v.name}</b></button>`).join('')}</div>
      <p style="font-size:13px;margin:6px 0">${esc(TEMPERAMENTS[s.temperament].desc)}</p>
      <div class="style-card">
        <h4>${esc(st.name)}</h4>
        <div class="insp">Inspired by ${esc(st.inspiration)}</div>
        <p>Your settlements, explorers, banners and leader will take on this look, evolving from the Stone Age to the Modern Age:</p>
        <canvas class="preview" id="style-preview" width="720" height="240"></canvas>
      </div>
    </div>
    <div class="section" style="font-size:13px;color:var(--muted)">You will begin at a random place on Earth in 10,000 BCE.</div>`;
  const pc = $('#setup-portrait');
  drawPortrait(pc.getContext('2d'), 240, s.leader, styleKey, 2, s.color);
  drawStylePreview($('#style-preview'), styleKey, s.color);
  $('#in-leader').addEventListener('input', (e) => { s.leader.name = e.target.value; });
  $('#in-civ').addEventListener('input', (e) => { s.civName = e.target.value; });
  $('#in-cap').addEventListener('input', (e) => { s.capitalName = e.target.value; });
}

function drawStylePreview(canvas, styleKey, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#8fbf4f';
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 30) for (let y = 0; y < h; y += 30) drawTerrainDetail(ctx, 7, x, y, 30, hash2(x, y, 3), hash2(x, y, 4));
  const ages = [0, 2, 3, 4, 6];
  ages.forEach((age, k) => {
    const cx = (w / ages.length) * (k + 0.5);
    drawSettlement(ctx, cx, h * 0.42, 110, { style: styleKey, age, pop: 12, color, capital: true });
    ctx.font = 'bold 20px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2b1d10';
    ctx.fillText(AGES[age].short, cx, h - 10);
  });
}

function bindSetupClicks(e) {
  const btn = e.target.closest('[data-set]');
  if (!btn) return;
  const path = btn.dataset.set;
  let val = btn.dataset.val;
  if (path === 'leader.skin' || path === 'leader.hair') val = +val;
  if (path.startsWith('leader.')) setup.leader[path.slice(7)] = val;
  else setup[path] = val;
  const y = $('#setup-body').scrollTop;
  renderSetup();
  $('#setup-body').scrollTop = y;
}

function beginGame() {
  const s = setup;
  state = G.newGame({
    leader: { ...s.leader, name: s.leader.name.trim() || 'Aru' },
    civName: s.civName.trim() || 'The Wanderers',
    capitalName: s.capitalName.trim() || 'First Fire',
    color: s.color,
    emblem: s.emblem,
    lifestyle: s.lifestyle,
    temperament: s.temperament,
    mode: s.mode,
  });
  startGameView();
  const cap = state.cities[0];
  const { lat, lon } = latLon(cap.x, cap.y);
  showModal({
    icon: '🔥',
    title: 'The Journey Begins',
    html: `<p><b>${esc(state.player.leader.name)}</b>, ${esc(G.leaderTitle(state))} of <b>${esc(state.player.civName)}</b>, your people have made camp at <b>${esc(cap.name)}</b> (${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'E' : 'W'}).</p>
      <p>The world beyond is unknown. Send <b>🧭 expeditions</b> — they cost food and clothing, but may return with gold, iron and luxuries, and they map the land as they go.</p>
      <p><b>🏕️ Settle</b> new lands, meet <b>🤝 other peoples</b>, learn <b>📜 advances</b> and move through the ages. ${state.mode === 'quick'
    ? `<b>⚡ Quick Play:</b> map ${Math.round(MODES.quick.victory * 100)}% of the world in the Modern Age within ${MODES.quick.turnLimit} turns.`
    : `<b>🌍 Epic Journey:</b> map half the world in the Modern Age. While you are away, a season passes every ${MODES.epic.idleMinutesPerTurn} minutes, so come back to check on your people.`}</p>`,
  });
  save();
}

// ---------------- game view ----------------
function startGameView() {
  showScreen('game-screen');
  if (!map) {
    map = new MapView($('#map'), () => state);
    map.onTap = onMapTap;
  } else {
    map.resize();
  }
  setMode('normal');
  hideTileCard();
  const cap = state.cities[0];
  requestAnimationFrame(() => {
    map.resize();
    map.centerOn(cap.x, cap.y, 34);
  });
  updateHud();
}

function updateHud() {
  if (!state) return;
  const inc = G.incomeSummary(state);
  const caps = G.getCaps(state);
  $('#hud-civ').textContent = `${state.player.leader.name} · ${state.player.civName}`;
  const m = G.modeOf(state);
  const turnTxt = m.turnLimit ? `Turn ${state.turn}/${m.turnLimit}` : `Turn ${state.turn}`;
  $('#hud-age').textContent = `${m.icon} ${AGES[state.age].name} · ${G.formatYear(state.year)} · ${turnTxt} · 🗺️ ${(G.exploredFraction(state) * 100).toFixed(1)}%/${Math.round(m.victory * 100)}%`;
  const chips = RESOURCE_KEYS.map((k) => {
    const d = inc[k] || 0;
    return `<div class="res" title="${RESOURCES[k].name}"><b>${RESOURCES[k].icon} ${fmt(Math.floor(state.res[k]))}</b><span class="d${d < 0 ? ' neg' : ''}">${d > 0 ? '+' : ''}${fmt(d)}</span></div>`;
  });
  const pop = G.totalPopulation(state);
  chips.push(`<div class="res" title="Population"><b>👥 ${pop}</b><span class="d">${state.cities.length} 🏘️</span></div>`);
  chips.push(`<div class="res" title="Population power"><b>⚔️ ${fmt(G.totalStrength(state))}</b><span class="d">power</span></div>`);
  chips.push(`<div class="res" title="Expeditions"><b>🧭 ${state.expeditions.length}/${caps.maxExpeditions}</b><span class="d">out</span></div>`);
  $('#res-bar').innerHTML = chips.join('');
  const mini = $('#leader-mini');
  drawPortrait(mini.getContext('2d'), 88, state.player.leader, state.player.style, state.age, state.player.color);
  if (map) map.dirty = true;
}

function setMode(m) {
  mode = m;
  pendingTarget = null;
  if (map) {
    map.preview = null;
    map.dirty = true;
  }
  for (const b of document.querySelectorAll('#actions [data-action^="mode-"]')) b.classList.toggle('active', b.dataset.action === `mode-${m}`);
  const banner = $('#mode-banner');
  if (m === 'explore') {
    banner.innerHTML = '<span>🧭</span><div class="grow">Tap a destination for your expedition.</div><button data-action="cancel-mode">Cancel</button>';
    banner.classList.remove('hidden');
  } else if (m === 'settle') {
    banner.innerHTML = '<span>🏕️</span><div class="grow">Tap explored land to found a settlement.</div><button data-action="cancel-mode">Cancel</button>';
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function hideTileCard() {
  $('#tile-card').classList.add('hidden');
  if (map) {
    map.selected = null;
    map.dirty = true;
  }
}

function onMapTap(x, y) {
  if (!state) return;
  map.selected = { x, y };
  map.dirty = true;
  if (mode === 'explore') openExpeditionPlanner(x, y);
  else if (mode === 'settle') openSettleCard(x, y);
  else showTileCard(x, y);
  keepVisible(x, y);
}

// Pan so the tapped tile is not hidden behind the info card.
function keepVisible(x, y) {
  const card = $('#tile-card');
  if (card.classList.contains('hidden')) return;
  const { sy } = map.pos(x, y);
  const limit = map.h - card.offsetHeight - map.ts * 1.5;
  if (sy > limit) {
    map.camY += sy - Math.max(map.ts, limit * 0.5);
    map.clamp();
    map.dirty = true;
  }
}

function tileInfo(x, y) {
  const terrain = G.terrainOf(state);
  const i = idx(x, y);
  const explored = state.explored[i];
  const { lat, lon } = latLon(x, y);
  const coords = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  if (!explored) return { title: 'Unknown Lands', sub: `${coords} · Unmapped`, explored };
  const b = BIOMES[terrain.biome[i]];
  const dep = state.deposits[i];
  return { title: b.name, sub: coords, explored, biome: b, dep: dep && DEPOSITS[dep.type], depReady: dep && dep.ready <= state.turn };
}

function showTileCard(x, y) {
  const info = tileInfo(x, y);
  const city = state.cities.find((c) => c.x === x && c.y === y);
  const civ = state.civs.find((c) => c.met && !c.conquered && c.x === x && c.y === y);
  let body = '';
  if (info.biome) {
    const ys = Object.entries(info.biome.yields).map(([k, v]) => `${RESOURCES[k].icon}${v}`).join(' ') || '—';
    body += `<div class="sub">Yields ${ys} · Travel ${info.biome.move}× ${info.biome.risk ? `· Danger: ${info.biome.risk}` : ''}</div>`;
  }
  if (info.dep) body += `<div style="margin-top:4px">${info.dep.icon} <b>${esc(info.dep.name)}</b> ${info.depReady ? '' : '<span class="sub">(recently harvested)</span>'}</div>`;
  const btns = [];
  if (city) btns.push(`<button class="btn btn-small btn-primary" data-action="open-city" data-id="${city.id}">🏛️ ${esc(city.name)}</button>`);
  if (civ) btns.push(`<button class="btn btn-small btn-primary" data-action="open-civ" data-id="${civ.id}">🤝 ${esc(G.civName(civ))}</button>`);
  if (!city) btns.push(`<button class="btn btn-small" data-action="explore-here" data-x="${x}" data-y="${y}">🧭 Send expedition</button>`);
  if (info.explored && !city && !civ && !info.biome?.water) btns.push(`<button class="btn btn-small" data-action="settle-here" data-x="${x}" data-y="${y}">🏕️ Settle here</button>`);
  $('#tile-card').innerHTML = `<button class="close" data-action="close-card" aria-label="Close">✕</button>
    <h3>${city ? `🏛️ ${esc(city.name)}` : civ ? `${esc(G.civName(civ))}` : esc(info.title)}</h3>
    <div class="sub">${esc(info.sub)}${city || civ ? ` · ${esc(info.title)}` : ''}</div>${body}
    <div class="btns">${btns.join('')}</div>`;
  $('#tile-card').classList.remove('hidden');
}

// ---------------- expeditions ----------------
function nearestCities(x, y) {
  return [...state.cities].sort((a, b) => distance(a.x, a.y, x, y) - distance(b.x, b.y, x, y));
}

function openExpeditionPlanner(x, y) {
  pendingTarget = { x, y };
  const near = nearestCities(x, y);
  if (!originCityId || !state.cities.some((c) => c.id === originCityId)) originCityId = near[0].id;
  renderExpeditionCard();
}

function renderExpeditionCard() {
  const { x, y } = pendingTarget;
  const sizes = partySizes(state);
  if (!sizes.some((p) => p.id === partyId)) partyId = 'band';
  let plan = planExpedition(state, originCityId, x, y, partyId);
  // If the chosen origin cannot reach, try another settlement automatically.
  if (!plan.path) {
    for (const c of nearestCities(x, y)) {
      const p = planExpedition(state, c.id, x, y, partyId);
      if (p.path) { originCityId = c.id; plan = p; break; }
    }
  }
  map.preview = plan.path ? { path: plan.path, ok: plan.ok } : null;
  map.dirty = true;
  const info = tileInfo(x, y);
  const near = nearestCities(x, y).slice(0, 6);
  const cityChips = near.map((c) => `<button class="chip${c.id === originCityId ? ' sel' : ''}" data-action="exp-origin" data-id="${c.id}">${esc(c.name)} (${c.pop})</button>`).join('');
  const sizeChips = sizes.map((p) => `<button class="chip${p.id === partyId ? ' sel' : ''}" data-action="exp-size" data-id="${p.id}">${esc(p.name)} · ${p.size}👤</button>`).join('');
  let details = '';
  if (plan.path) {
    const risk = Math.round(plan.deathChance * 100);
    details = `
      <div class="stat-grid">
        <div><span>Journey</span> ${plan.outTurns} out + ${plan.backTurns} back</div>
        <div><span>Distance</span> ${plan.path.length - 1} tiles</div>
        <div><span>Risk / person</span> <b style="color:${risk > 25 ? 'var(--red)' : risk > 10 ? '#a0642a' : 'var(--green)'}">${risk}%</b></div>
        <div><span>Can carry</span> ${plan.capacity} loads</div>
      </div>
      <div class="sub">Supplies needed:</div>${costHtml(plan.cost)}`;
  }
  $('#tile-card').innerHTML = `<button class="close" data-action="cancel-mode" aria-label="Close">✕</button>
    <h3>🧭 Expedition to ${esc(info.title)}</h3>
    <div class="sub">${esc(info.sub)}</div>
    <div class="sub" style="margin-top:6px">Depart from</div><div class="chips">${cityChips}</div>
    <div class="sub" style="margin-top:6px">Party</div><div class="chips">${sizeChips}</div>
    ${details}
    ${plan.ok ? '' : `<div class="reason">${esc(plan.reason)}</div>`}
    <div class="btns"><button class="btn btn-primary" data-action="launch" ${plan.ok ? '' : 'disabled'}>Launch expedition</button></div>`;
  $('#tile-card').classList.remove('hidden');
}

function doLaunch() {
  const { x, y } = pendingTarget;
  const plan = planExpedition(state, originCityId, x, y, partyId);
  const r = launchExpedition(state, plan);
  if (!r.ok) return toast(r.reason, true);
  toast(`🧭 Expedition launched — back in ${plan.outTurns + plan.backTurns} turns.`);
  setMode('normal');
  hideTileCard();
  updateHud();
  save();
}

// ---------------- settling ----------------
function openSettleCard(x, y) {
  const chk = G.checkSettle(state, x, y);
  const info = tileInfo(x, y);
  map.preview = chk.path ? { path: chk.path.path, ok: chk.ok } : null;
  map.dirty = true;
  const cost = chk.cost || G.settleCost(state);
  $('#tile-card').innerHTML = `<button class="close" data-action="cancel-mode" aria-label="Close">✕</button>
    <h3>🏕️ Settle ${esc(info.title)}</h3>
    <div class="sub">${esc(info.sub)}${chk.from ? ` · settlers from ${esc(chk.from.name)}` : ''}</div>
    <div class="sub" style="margin-top:6px">Costs ${G.SETTLE_POP} people and:</div>${costHtml(cost)}
    ${chk.ok ? '<label class="field" for="in-city">Name</label><input type="text" id="in-city" maxlength="18" value="' + esc(G.nextCityName(state)) + '"/>' : `<div class="reason">${esc(chk.reason)}</div>`}
    <div class="btns"><button class="btn btn-primary" data-action="do-settle" data-x="${x}" data-y="${y}" ${chk.ok ? '' : 'disabled'}>Found settlement</button></div>`;
  $('#tile-card').classList.remove('hidden');
}

function doSettle(x, y) {
  const name = $('#in-city')?.value.trim();
  const r = G.settle(state, x, y, name);
  if (!r.ok) return toast(r.reason, true);
  toast(`🏕️ ${r.city.name} founded!`);
  setMode('normal');
  hideTileCard();
  updateHud();
  save();
}

// ---------------- cities ----------------
function citiesSheet() {
  const reports = G.cityReports(state);
  const html = reports.map(({ city, out }) => `
    <button class="card list-item" data-action="open-city" data-id="${city.id}">
      <span class="ico">${city.capital ? '★' : '🏘️'}</span>
      <span class="grow"><h4>${esc(city.name)}</h4>
        <span class="meta">👥 ${city.pop}/${G.housing(state, city)} · 🍖 ${fmt((out.food || 0) - city.pop)} · ${city.buildings.length} buildings</span></span>
      <span>›</span>
    </button>`).join('');
  const routes = state.tradeRoutes.map((r) => {
    const from = state.cities.find((c) => c.id === r.from);
    const to = r.toCiv ? state.civs.find((c) => c.id === r.toCiv) : state.cities.find((c) => c.id === r.toCity);
    const inc = G.tradeIncome(state, r);
    return `<div class="card"><b>${esc(from?.name || '?')} ⇄ ${esc(to ? (r.toCiv ? to.name : to.name) : '?')}</b><div class="costs">${Object.entries(inc).filter(([, v]) => v).map(([k, v]) => `<span>${RESOURCES[k].icon} +${v}</span>`).join('')}</div></div>`;
  }).join('');
  openSheet('Your Settlements', `${html}<h3 style="margin:14px 0 6px">Trade routes (${state.tradeRoutes.length}/${maxTradeRoutes(state)})</h3>${routes || '<div class="meta">No trade routes yet. Open them from a settlement or with another people.</div>'}`);
  sheetRefresh = citiesSheet;
}

function citySheet(cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return closeSheet();
  const rep = G.cityReports(state).find((r) => r.city.id === cityId);
  const need = G.growthNeed(state, city);
  const prod = Object.entries(rep.out).filter(([, v]) => v).map(([k, v]) => `<span>${RESOURCES[k].icon} ${fmt(v)}</span>`).join('');
  const blds = G.buildingOptions(state, city).map(({ def, cost, ok, reason }) => `
    <div class="card${reason === 'Built' ? ' owned' : ''}">
      <div class="list-item"><span class="ico">${def.icon}</span><span class="grow"><h4>${esc(def.name)}</h4><span class="meta">${esc(def.desc)}</span>
      ${reason === 'Built' ? '' : costHtml(cost)}</span>
      ${reason === 'Built' ? '<span>✔</span>' : `<button class="btn btn-small${ok ? ' btn-primary' : ''}" data-action="build" data-city="${city.id}" data-id="${def.id}" ${ok ? '' : 'disabled'}>${ok ? 'Build' : esc(reason)}</button>`}</div>
    </div>`).join('');
  const dom = domesticRouteOptions(state, city.id).filter((o) => o.reason !== 'Too close to be worthwhile');
  const domHtml = dom.length ? dom.map((o) => `<button class="chip" data-action="dom-route" data-from="${city.id}" data-to="${o.city.id}" ${o.ok ? '' : 'disabled'} title="${esc(o.reason || '')}">🛤️ ${esc(o.city.name)} (${o.dist})${o.ok ? '' : ' – ' + esc(o.reason)}</button>`).join('') : '<span class="meta">Found more settlements to link them by trade.</span>';
  openSheet(city.name, `
    <canvas class="big-art" id="city-art" width="640" height="300"></canvas>
    <label class="field" for="in-rename">Settlement name</label>
    <div class="row"><input type="text" id="in-rename" maxlength="18" value="${esc(city.name)}" /><button class="btn btn-small" data-action="rename-city" data-id="${city.id}">Rename</button></div>
    <div class="stat-grid">
      <div><span>People</span> ${city.pop} / ${G.housing(state, city)}</div>
      <div><span>Growth</span> ${Math.floor(city.growth)} / ${need}</div>
      <div><span>Tiles worked</span> ${rep.worked.length}</div>
      <div><span>Power</span> ⚔️ ${fmt(G.cityStrength(state, city))}</div>
    </div>
    <div class="bar"><i style="width:${Math.min(100, (city.growth / need) * 100)}%"></i></div>
    <div class="sub">Produces each turn (people eat 🍖${city.pop}):</div><div class="costs">${prod}</div>
    <h3 style="margin:12px 0 6px">Buildings</h3>${blds}
    <h3 style="margin:12px 0 6px">Trade roads</h3><div class="chips">${domHtml}</div>
    <button class="btn" data-action="goto" data-x="${city.x}" data-y="${city.y}">📍 Show on map</button>`, () => {
    const cv = $('#city-art');
    drawCityArt(cv, city);
  });
  sheetRefresh = () => citySheet(cityId);
}

function drawCityArt(cv, city) {
  const ctx = cv.getContext('2d');
  const terrain = G.terrainOf(state);
  const b = terrain.biome[idx(city.x, city.y)];
  ctx.fillStyle = BIOMES[b].color;
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let x = 0; x < cv.width; x += 40) for (let y = 0; y < cv.height; y += 40) {
    if (Math.abs(x - cv.width / 2) < 160 && Math.abs(y - cv.height / 2) < 110) continue;
    drawTerrainDetail(ctx, b, x, y, 40, hash2(x, y, 5), hash2(x, y, 6));
  }
  drawSettlement(ctx, cv.width / 2, cv.height * 0.45, 230, { style: state.player.style, age: state.age, pop: Math.max(city.pop, 6), color: state.player.color, capital: city.capital || city.pop >= 8, emblem: state.player.emblem });
}

// ---------------- peoples / diplomacy ----------------
function peoplesSheet() {
  const met = state.civs.filter((c) => c.met);
  const html = met.length ? met.map((c) => `
    <button class="card list-item" data-action="open-civ" data-id="${c.id}">
      <span class="ico" style="color:${c.color}">${c.conquered ? '🏳️' : '⛺'}</span>
      <span class="grow"><h4>${esc(G.civName(c))}</h4>
      <span class="meta">${c.conquered ? 'Conquered — now part of your realm' : `${esc(STYLES[c.style].name)} · ${esc(TEMPERAMENTS[c.temperament].name)} · ${relationLabel(c.relation)} (${c.relation})`}</span></span><span>›</span>
    </button>`).join('') : '<p>You have not met any other peoples yet. Send expeditions to find them — the first are said to live within a few days\' walk.</p>';
  openSheet(`Peoples of the World (${met.length}/${state.civs.length})`, html);
  sheetRefresh = peoplesSheet;
}

let armySize = 3;
function civSheet(civId) {
  const civ = state.civs.find((c) => c.id === civId);
  if (!civ) return closeSheet();
  if (civ.conquered) {
    openSheet(civ.name, `<p>The ${esc(civ.name)} have joined your realm. Their former home is now one of your settlements.</p>`);
    return;
  }
  const o = diplomacyOptions(state, civ);
  const st = STYLES[civ.style];
  const relPct = (civ.relation + 100) / 2;
  const maxArmy = Math.max(1, o.attack.maxArmy);
  armySize = Math.max(1, Math.min(maxArmy, armySize));
  const odds = o.attack.from ? battleOdds(state, civ, o.attack.from, armySize) : null;
  const gifts = o.gift.map((g) => `<button class="chip" data-action="gift" data-id="${civ.id}" data-gift="${g.id}" ${g.ok ? '' : 'disabled'}>🎁 ${esc(g.label)}</button>`).join('');
  openSheet(G.civName(civ), `
    <canvas class="big-art" id="civ-art" width="640" height="260"></canvas>
    <div class="stat-grid">
      <div><span>Society</span> ${CIV_LEVELS[civ.level]}</div>
      <div><span>Culture</span> ${esc(st.name)}</div>
      <div><span>Temperament</span> ${TEMPERAMENTS[civ.temperament].icon} ${esc(TEMPERAMENTS[civ.temperament].name)}</div>
      <div><span>People</span> ~${civ.pop}</div>
      <div><span>Their power</span> ⚔️ ${fmt(civStrength(civ))}</div>
      <div><span>Your power</span> ⚔️ ${fmt(G.totalStrength(state))}</div>
      <div><span>They trade in</span> ${RESOURCES[civ.specialty].icon} ${RESOURCES[civ.specialty].name}</div>
      <div><span>Attitude</span> <b>${relationLabel(civ.relation)}</b></div>
    </div>
    <div class="rel-bar"><i style="left:calc(${relPct}% - 2px)"></i></div>

    <div class="card"><h4>🎁 Send a gift</h4><div class="meta">Gifts improve relations.</div><div class="chips" style="margin-top:6px">${gifts}</div></div>

    <div class="card"><h4>🐫 Open a trade route</h4>
      <div class="meta">Steady gold and ${RESOURCES[civ.specialty].name.toLowerCase()} every turn${o.trade.from ? ` via ${esc(o.trade.from.name)}` : ''}. Trading partners grow faster.</div>${costHtml(o.trade.cost)}
      ${o.trade.ok ? '' : `<div class="reason">${esc(o.trade.reason)}</div>`}
      <button class="btn btn-small${o.trade.ok ? ' btn-primary' : ''}" data-action="trade" data-id="${civ.id}" ${o.trade.ok ? '' : 'disabled'}>Open route</button></div>

    <div class="card"><h4>📜 Exchange knowledge</h4><div class="meta">Learn ${o.share.amount} knowledge and copy their maps.</div>
      ${o.share.ok ? '' : `<div class="reason">${esc(o.share.reason)}</div>`}
      <button class="btn btn-small${o.share.ok ? ' btn-primary' : ''}" data-action="share" data-id="${civ.id}" ${o.share.ok ? '' : 'disabled'}>Exchange</button></div>

    <div class="card"><h4>💰 Demand tribute</h4><div class="meta">Take ~${o.tribute.amount} gold by intimidation. They will resent it.</div>
      ${o.tribute.ok ? '' : `<div class="reason">${esc(o.tribute.reason)}</div>`}
      <button class="btn btn-small" data-action="tribute" data-id="${civ.id}" ${o.tribute.ok ? '' : 'disabled'}>Demand</button></div>

    <div class="card"><h4>⚔️ Conquer</h4>
      <div class="meta">Raise warriors from ${o.attack.from ? esc(o.attack.from.name) : 'a nearby settlement'}. Victory makes their home your settlement, but war costs lives (population power) and angers other peoples.</div>
      ${o.attack.ok ? `
        <label class="field">Warriors: <b id="army-n">${armySize}</b> of ${maxArmy} (needs 🍖 <span id="army-food">${armySize * 2}</span>)</label>
        <input type="range" id="army" min="1" max="${maxArmy}" value="${armySize}" />
        <div class="stat-grid"><div><span>Your army</span> ⚔️ <b id="army-a">${fmt(odds.attack)}</b></div><div><span>Their defense</span> ⚔️ ${fmt(odds.defense)}</div></div>
        <div>Chance of victory: <b id="army-p">${Math.round(odds.winChance * 100)}%</b></div>` : `<div class="reason">${esc(o.attack.reason)}</div>`}
      <button class="btn btn-small" style="background:#5e2412;color:#fbe9c0" data-action="attack" data-id="${civ.id}" ${o.attack.ok ? '' : 'disabled'}>Attack</button></div>
    <button class="btn" data-action="goto" data-x="${civ.x}" data-y="${civ.y}">📍 Show on map</button>`, (body) => {
    const cv = $('#civ-art');
    const ctx = cv.getContext('2d');
    const terrain = G.terrainOf(state);
    const b = terrain.biome[idx(civ.x, civ.y)];
    ctx.fillStyle = BIOMES[b].color;
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let x = 0; x < cv.width; x += 40) for (let y = 0; y < cv.height; y += 40) drawTerrainDetail(ctx, b, x, y, 40, hash2(x, y, 7), hash2(x, y, 8));
    drawSettlement(ctx, cv.width / 2, cv.height * 0.42, 200, { style: civ.style, age: CIV_SPRITE_AGE[civ.level], pop: civ.pop, color: civ.color, capital: true });
    const range = body.querySelector('#army');
    if (range) {
      range.addEventListener('input', () => {
        armySize = +range.value;
        const od = battleOdds(state, civ, o.attack.from, armySize);
        body.querySelector('#army-n').textContent = armySize;
        body.querySelector('#army-food').textContent = armySize * 2;
        body.querySelector('#army-a').textContent = fmt(od.attack);
        body.querySelector('#army-p').textContent = `${Math.round(od.winChance * 100)}%`;
      });
    }
  });
  sheetRefresh = () => civSheet(civId);
}

// ---------------- advances & ages ----------------
function advancesSheet() {
  const as = G.ageStatus(state);
  let ageCard;
  if (as.final) {
    ageCard = `<div class="card owned"><h4>🏛️ ${AGES[state.age].name}</h4><div class="meta">You have reached the final age. Map ${Math.round(G.modeOf(state).victory * 100)}% of the world to win (now ${(G.exploredFraction(state) * 100).toFixed(1)}%).</div></div>`;
  } else {
    const reqs = as.reqs.map((r) => `<div class="${r.met ? 'ok-note' : 'reason'}">${r.met ? '✔' : '✗'} ${esc(r.label)} (${r.have})</div>`).join('');
    ageCard = `<div class="card"><h4>🏛️ Advance to the ${esc(as.next.name)}</h4>
      <div class="meta">New buildings, advances, bigger expeditions, and your people's look will change.</div>
      ${reqs}${costHtml(as.cost)}
      <button class="btn${as.ok ? ' btn-primary' : ''}" data-action="advance-age" ${as.ok ? '' : 'disabled'}>Enter the ${esc(as.next.name)}</button></div>`;
  }
  const caps = G.getCaps(state);
  const capsHtml = `<div class="card"><h4>🧭 Exploration abilities</h4><div class="stat-grid">
    <div><span>Land speed</span> ${caps.landSpeed}/turn</div><div><span>Sea</span> ${caps.air ? 'Air travel' : caps.seaLevel ? `${['', 'Coast', 'Near seas', 'Far seas', 'Open ocean'][caps.seaLevel]} · ${caps.seaSpeed}/turn` : 'None'}</div>
    <div><span>Endurance</span> ${caps.endurance} turns out</div><div><span>Mapping radius</span> ${caps.reveal}</div>
    <div><span>Settle range</span> ${caps.settleRange}</div><div><span>Trade range</span> ${caps.tradeRange}</div>
    <div><span>Expeditions</span> ${caps.maxExpeditions} at once</div><div><span>Carry</span> ×${caps.carry.toFixed(2)}</div></div></div>`;
  const byAge = AGES.map((age) => {
    const list = ADVANCES.filter((a) => a.age === age.id);
    if (!list.length) return '';
    return `<h3 style="margin:14px 0 6px">${esc(age.name)} ${age.id > state.age ? '🔒' : ''}</h3>` + list.map((a) => {
      const s = G.advanceStatus(state, a);
      return `<div class="card${s.owned ? ' owned' : age.id > state.age ? ' locked' : ''}"><div class="list-item"><span class="ico">${a.icon}</span>
        <span class="grow"><h4>${esc(a.name)}</h4><span class="meta">${esc(a.desc)}</span>${s.owned ? '' : costHtml(G.modeCost(state, a.cost))}${!s.ok && !s.owned && s.reason !== 'Too costly' ? `<div class="reason">${esc(s.reason)}</div>` : ''}</span>
        ${s.owned ? '<span>✔</span>' : `<button class="btn btn-small${s.ok ? ' btn-primary' : ''}" data-action="learn" data-id="${a.id}" ${s.ok ? '' : 'disabled'}>Learn</button>`}</div></div>`;
    }).join('');
  }).join('');
  openSheet('Advancement', ageCard + capsHtml + byAge);
  sheetRefresh = advancesSheet;
}

// ---------------- empire / customization ----------------
function empireSheet() {
  const p = state.player;
  const st = STYLES[p.style];
  const tb = (k, v) => `<button class="chip${p.leader[k] === v ? ' sel' : ''}" data-action="cust" data-k="leader.${k}" data-v="${esc(v)}">${esc(v)}</button>`;
  openSheet('Your Empire', `
    <div class="row">
      <canvas class="portrait" id="emp-portrait" width="240" height="240"></canvas>
      <div class="grow">
        <h3 style="margin:0">${esc(G.leaderTitle(state))} ${esc(p.leader.name)}</h3>
        <div class="meta">${esc(p.civName)} · ${esc(st.name)}</div>
        <div class="meta">${LIFESTYLES[p.lifestyle].icon} ${LIFESTYLES[p.lifestyle].name} · ${TEMPERAMENTS[p.temperament].icon} ${TEMPERAMENTS[p.temperament].name}</div>
        <div class="meta">Score: <b>${G.score(state)}</b></div>
      </div>
    </div>
    <div class="stat-grid">
      <div><span>Age</span> ${AGES[state.age].name}</div><div><span>Year</span> ${G.formatYear(state.year)}</div>
      <div><span>Map</span> ${state.exploredCount} tiles (${(G.exploredFraction(state) * 100).toFixed(1)}%)</div><div><span>Peoples met</span> ${state.civs.filter((c) => c.met).length}</div>
      <div><span>Expeditions</span> ${state.stats.expeditions}</div><div><span>Explorers lost</span> ${state.stats.lost}</div>
      <div><span>Discoveries</span> ${state.stats.discoveries}</div><div><span>Conquests</span> ${state.stats.conquests}</div>
    </div>
    <h3 style="margin:14px 0 6px">Customize</h3>
    <label class="field" for="c-leader">Leader name</label><input type="text" id="c-leader" maxlength="20" value="${esc(p.leader.name)}" />
    <label class="field" for="c-civ">Civilization name</label><input type="text" id="c-civ" maxlength="24" value="${esc(p.civName)}" />
    <button class="btn btn-small" data-action="save-names">Save names</button>
    <label class="field">Skin</label><div class="swatches">${SKIN_TONES.map((c, i) => `<button class="swatch${p.leader.skin === i ? ' sel' : ''}" style="background:${c}" data-action="cust" data-k="leader.skin" data-v="${i}"></button>`).join('')}</div>
    <label class="field">Hair colour</label><div class="swatches">${HAIR_COLORS.map((c, i) => `<button class="swatch${p.leader.hair === i ? ' sel' : ''}" style="background:${c}" data-action="cust" data-k="leader.hair" data-v="${i}"></button>`).join('')}</div>
    <label class="field">Hair</label><div class="chips">${HAIR_STYLES.map((v) => tb('hairStyle', v)).join('')}</div>
    <label class="field">Facial hair</label><div class="chips">${BEARDS.map((v) => tb('beard', v)).join('')}</div>
    <label class="field">Banner colour</label><div class="swatches">${PLAYER_COLORS.map((c) => `<button class="swatch${p.color === c ? ' sel' : ''}" style="background:${c}" data-action="cust" data-k="color" data-v="${c}"></button>`).join('')}</div>
    <label class="field">Emblem</label><div class="chips">${EMBLEMS.map((e) => `<button class="chip${p.emblem === e ? ' sel' : ''}" data-action="cust" data-k="emblem" data-v="${e}">${e}</button>`).join('')}</div>
    <h3 style="margin:14px 0 6px">Game</h3>
    <button class="btn" data-action="how-to">How to Play</button>
    <button class="btn" data-action="quit">Save &amp; return to title</button>`, () => {
    drawPortrait($('#emp-portrait').getContext('2d'), 240, p.leader, p.style, state.age, p.color);
  });
  sheetRefresh = empireSheet;
}

function chronicleSheet() {
  const html = [...state.log].reverse().map((l) => `<div class="log-entry"><span>${l.icon}</span><span class="grow">${esc(l.text)}</span><span class="t">${G.formatYear(l.year)}</span></div>`).join('');
  openSheet('Chronicle', html || '<p>Nothing has happened yet.</p>');
  sheetRefresh = chronicleSheet;
}

function howToSheet() {
  openSheet('How to Play', `
    <div class="card"><h4>🎯 Goal</h4>Guide your people from the Stone Age to the Modern Age and map the Earth.<br>⚡ <b>Quick Play</b> (10–15 min): map ${Math.round(MODES.quick.victory * 100)}% of the world in the Modern Age within ${MODES.quick.turnLimit} turns. Everything is cheaper and faster.<br>🌍 <b>Epic Journey</b>: map half the world. The world keeps turning while you are away (a season every ${MODES.epic.idleMinutesPerTurn} min, up to ${MODES.epic.idleMaxTurns}). Each mode has its own save.</div>
    <div class="card"><h4>🧭 Expeditions</h4>Tap <b>Explore</b>, then tap anywhere on the map. Expeditions spend people, 🍖 food and 🧥 clothing (and 🪵 wood for boats). They map the land as they travel and bring back loot from resource sites they pass — 🪙 gold, ⛏️ iron, 💎 luxuries. Dangerous lands (ice, desert, jungle, mountains, open sea) can cost lives. Bigger parties are safer and carry more.</div>
    <div class="card"><h4>🏕️ Settlements</h4>Found new settlements on explored land. Each works nearby tiles — including discovered resource sites — and grows when it has spare food. Build granaries, harbors, libraries and more.</div>
    <div class="card"><h4>🤝 Other peoples</h4>Peoples from bands to empires live across the world. Gift, trade, share knowledge, demand tribute or conquer them. Conquest costs population power; hostile warlike peoples may raid you.</div>
    <div class="card"><h4>📜 Advances & Ages</h4>Learn advances like rafts, horse riding, galleys, compasses, caravels, railroads and aviation to reach farther. Advance through seven ages — your cities, explorers and leader change their look as you do, shaped by your way of life and temperament.</div>
    <div class="card"><h4>👆 Controls</h4>Drag to pan, pinch (or scroll) to zoom. Tap a tile for details. The map wraps around the globe east–west.</div>`);
}

// ---------------- turn ----------------
function finalHtml() {
  const m = G.modeOf(state);
  const time = state.mode === 'quick' ? `<div><span>Time played</span> ${fmtDuration(state.playMs)}</div>` : '';
  return `<div class="stat-grid">
      <div><span>Result</span> ${state.won ? '🏆 Victory' : '⌛ Ended'}</div><div><span>Turns</span> ${state.wonTurn || state.turn}${m.turnLimit ? '/' + m.turnLimit : ''}</div>
      <div><span>Age</span> ${AGES[state.age].name}</div><div><span>Mapped</span> ${(G.exploredFraction(state) * 100).toFixed(1)}%</div>
      <div><span>Settlements</span> ${state.cities.length}</div><div><span>Peoples met</span> ${state.civs.filter((c) => c.met).length}</div>
      ${time}<div><span>Score</span> <b>${G.score(state)}</b></div></div>
    <button class="btn btn-primary" data-action="new-game">New game</button>`;
}

function showEventModals(events) {
  for (const ev of events) {
    if (ev.important) {
      if (ev.expedition) {
        const exp = ev.expedition;
        const found = exp.found.deposits.length ? `<p>🔎 Mapped ${exp.found.tiles} tiles and found: ${[...new Set(exp.found.deposits.map((d) => DEPOSITS[d.type].icon + ' ' + DEPOSITS[d.type].name))].join(', ')}.</p>` : `<p>🔎 Mapped ${exp.found.tiles} new tiles.</p>`;
        const civs = exp.found.civs.length ? `<p>🤝 Met: ${exp.found.civs.map((id) => esc(G.civName(state.civs.find((c) => c.id === id)))).join(', ')}.</p>` : '';
        const notes = exp.notes ? `<p>📝 ${esc(exp.notes)}</p>` : '';
        const gathered = exp.gathered?.length ? `<p>⛏️ Gathered from: ${esc([...new Set(exp.gathered)].join(', '))}.</p>` : '';
        const loot = Object.entries(ev.loot).map(([k, v]) => `${RESOURCES[k].icon} <b>${v}</b> ${RESOURCES[k].name}`).join('<br>');
        showModal({ icon: ev.icon, title: ev.title, html: `<p>${esc(ev.text.split(' with ')[0])}.</p>${loot ? `<div class="card">${loot}</div>` : ''}${found}${civs}${gathered}${notes}${exp.deaths ? `<p>☠️ ${exp.deaths} did not survive the journey.</p>` : ''}` });
      } else {
        showModal(ev);
      }
    } else {
      toast(`${ev.icon} ${ev.text}`);
    }
  }
}

function doEndTurn() {
  if (state.over) {
    showModal({ icon: state.won ? '🏆' : '⌛', title: 'Your journey has ended', html: finalHtml() });
    return;
  }
  const events = endTurn(state);
  for (const ev of events) {
    if (ev.victory || ev.final) ev.html = `<p>${esc(ev.text)}</p>${finalHtml()}${ev.victory && state.mode === 'epic' ? '<p class="meta">You can keep playing this world after closing this.</p>' : ''}`;
  }
  showEventModals(events);
  updateHud();
  if (sheetRefresh && !$('#sheet').classList.contains('hidden')) sheetRefresh();
  save();
}

// ---------------- action dispatch ----------------
function handleAction(el) {
  const a = el.dataset.action;
  const d = el.dataset;
  switch (a) {
    case 'new-game':
      closeModal();
      closeSheet();
      setup = randomSetup();
      showScreen('setup-screen');
      renderSetup();
      break;
    case 'continue': {
      const s = loadSave(d.mode);
      if (s) { state = s; startGameView(); resumeWorld(); } else toast('No saved game found.', true);
      break;
    }
    case 'how-to': howToSheet(); break;
    case 'back-title': showScreen('title-screen'); refreshTitle(); break;
    case 'randomize': setup = randomSetup(); renderSetup(); break;
    case 'begin': beginGame(); break;
    case 'close-sheet': closeSheet(); break;
    case 'close-modal': closeModal(); break;
    case 'close-card': hideTileCard(); break;
    case 'zoom-in': map.zoomAt(1.4, map.w / 2, map.h / 2); break;
    case 'zoom-out': map.zoomAt(1 / 1.4, map.w / 2, map.h / 2); break;
    case 'home': { const c = state.cities.find((x) => x.capital) || state.cities[0]; map.centerOn(c.x, c.y); break; }
    case 'mode-explore': hideTileCard(); setMode(mode === 'explore' ? 'normal' : 'explore'); break;
    case 'mode-settle': hideTileCard(); setMode(mode === 'settle' ? 'normal' : 'settle'); break;
    case 'cancel-mode': setMode('normal'); hideTileCard(); break;
    case 'explore-here': setMode('explore'); map.selected = { x: +d.x, y: +d.y }; openExpeditionPlanner(+d.x, +d.y); break;
    case 'settle-here': setMode('settle'); map.selected = { x: +d.x, y: +d.y }; openSettleCard(+d.x, +d.y); break;
    case 'exp-origin': originCityId = d.id; renderExpeditionCard(); break;
    case 'exp-size': partyId = d.id; renderExpeditionCard(); break;
    case 'launch': doLaunch(); break;
    case 'do-settle': doSettle(+d.x, +d.y); break;
    case 'cities': citiesSheet(); break;
    case 'open-city': citySheet(d.id); break;
    case 'peoples': peoplesSheet(); break;
    case 'open-civ': civSheet(d.id); break;
    case 'advances': advancesSheet(); break;
    case 'empire': empireSheet(); break;
    case 'chronicle': chronicleSheet(); break;
    case 'end-turn': doEndTurn(); break;
    case 'goto': closeSheet(); map.centerOn(+d.x, +d.y, Math.max(map.ts, 30)); showTileCard(+d.x, +d.y); map.selected = { x: +d.x, y: +d.y }; break;
    case 'build': act(G.build(state, d.city, d.id)); break;
    case 'rename-city': {
      const c = state.cities.find((x) => x.id === d.id);
      const n = $('#in-rename').value.trim();
      if (c && n) { c.name = n; toast('Renamed.'); save(); sheetRefresh?.(); map.dirty = true; }
      break;
    }
    case 'dom-route': act(openDomesticRoute(state, d.from, d.to)); break;
    case 'learn': act(G.learnAdvance(state, d.id)); break;
    case 'advance-age': {
      const r = G.advanceAge(state);
      act(r);
      if (r.ok) {
        const st = STYLES[state.player.style];
        showModal({ icon: '🏛️', title: `The ${AGES[state.age].name}`, html: `<canvas class="big-art" id="age-art" width="640" height="260"></canvas><p>${esc(state.player.civName)} enters a new age. Your ${esc(st.name)} settlements take on a new look, and your leader is now hailed as <b>${esc(st.titles[state.age])}</b>.</p>` });
        const cv = $('#age-art');
        if (cv) {
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#8fbf4f';
          ctx.fillRect(0, 0, cv.width, cv.height);
          drawSettlement(ctx, cv.width / 2, cv.height * 0.45, 200, { style: state.player.style, age: state.age, pop: 12, color: state.player.color, capital: true, emblem: state.player.emblem });
        }
      }
      break;
    }
    case 'gift': act(giveGift(state, d.id, d.gift)); break;
    case 'trade': act(openTradeRoute(state, d.id)); break;
    case 'share': act(shareKnowledge(state, d.id)); break;
    case 'tribute': act(demandTribute(state, d.id)); break;
    case 'attack': {
      const r = attackCiv(state, d.id, armySize);
      if (!r.ok) { toast(r.reason, true); break; }
      const civ = state.civs.find((c) => c.id === d.id);
      showModal(r.won
        ? { icon: '⚔️', title: 'Victory!', html: `<p>The ${esc(civ.name)} have been conquered and their home becomes your settlement.</p><p>☠️ ${r.casualties} warriors fell.</p><p>Spoils: ${Object.entries(r.loot).map(([k, v]) => `${RESOURCES[k].icon} ${Math.floor(v)}`).join(' ')}</p>` }
        : { icon: '💀', title: 'Defeat', html: `<p>Your warriors were driven back by the ${esc(civ.name)}.</p><p>☠️ ${r.casualties} were lost. They will not forget this.</p>` });
      updateHud();
      save();
      if (r.won) civSheet(d.id); else sheetRefresh?.();
      break;
    }
    case 'cust': {
      const p = state.player;
      let v = d.v;
      if (d.k === 'leader.skin' || d.k === 'leader.hair') v = +v;
      if (d.k.startsWith('leader.')) p.leader[d.k.slice(7)] = v;
      else p[d.k] = v;
      const y = $('#sheet-body').scrollTop;
      updateHud();
      empireSheet();
      $('#sheet-body').scrollTop = y;
      save();
      break;
    }
    case 'save-names': {
      const ln = $('#c-leader').value.trim();
      const cn = $('#c-civ').value.trim();
      if (ln) state.player.leader.name = ln;
      if (cn) state.player.civName = cn;
      updateHud();
      empireSheet();
      save();
      toast('Saved.');
      break;
    }
    case 'quit': save(); closeSheet(); state = null; showScreen('title-screen'); refreshTitle(); break;
    default:
  }
}

function act(r) {
  if (!r.ok) { toast(r.reason || 'Not possible', true); return; }
  updateHud();
  save();
  if (sheetRefresh) {
    const y = $('#sheet-body').scrollTop;
    sheetRefresh();
    $('#sheet-body').scrollTop = y;
  }
}

// Epic Journey: apply the seasons that passed while the player was away.
function resumeWorld() {
  if (!state) return;
  const before = { turn: state.turn, explored: state.exploredCount, pop: G.totalPopulation(state) };
  const { turns, events } = catchUp(state);
  if (!turns) return;
  const important = events.filter((e) => e.important || e.icon === '📈');
  const list = important.slice(0, 12).map((e) => `<div class="log-entry"><span>${e.icon}</span><span class="grow">${esc(e.text)}</span></div>`).join('');
  showModal({
    icon: '🌙',
    title: 'While you were away',
    html: `<p>${turns} season${turns > 1 ? 's' : ''} passed (${G.formatYear(state.year)} now).</p>
      <div class="stat-grid"><div><span>Population</span> ${before.pop} → ${G.totalPopulation(state)}</div><div><span>Mapped</span> +${state.exploredCount - before.explored} tiles</div></div>
      ${list || '<p>All was quiet in your lands.</p>'}`,
  });
  updateHud();
  save();
}

function refreshTitle() {
  const box = $('#continue-box');
  box.innerHTML = Object.values(MODES).map((m) => {
    const sum = saveSummary(m.id);
    if (!sum) return '';
    return `<button class="btn" data-action="continue" data-mode="${m.id}">${m.icon} Continue ${esc(m.name)}<br><small style="font-weight:400">${esc(sum.civ)} · ${esc(sum.age)} · Turn ${sum.turn}${sum.done ? ' · finished' : ''}</small></button>`;
  }).join('');
  requestAnimationFrame(drawTitleBg);
}

// ---------------- boot ----------------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled) handleAction(el);
});
$('#setup-body').addEventListener('click', bindSetupClicks);
window.addEventListener('resize', () => { if (!$('#title-screen').classList.contains('hidden')) drawTitleBg(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else if (state && !$('#game-screen').classList.contains('hidden')) resumeWorld();
});

refreshTitle();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Expose for debugging and automated smoke tests.
window.__game = { get state() { return state; }, G, W, H, PARTY_SIZES };
