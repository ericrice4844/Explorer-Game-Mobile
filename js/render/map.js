// Canvas map view: wrapped world, fog of war, touch pan/pinch/tap.
import { DEPOSITS, STYLES, isWaterBiome } from '../game/data.js';
import { W, H, idx, wrapX, dxWrap } from '../game/world.js';
import { hash2 } from '../game/rng.js';
import { getCaps, hasAdvance, terrainOf, cityRadius } from '../game/game.js';
import { CIV_SPRITE_AGE } from '../game/civs.js';
import { expeditionPosition } from '../game/expedition.js';
import { biomeColor, drawTerrainDetail, drawSettlement, drawUnit, shade } from './sprites.js';

const BASE_TS = 30;
const FOG = '#d9c9a0';
const FOG_SHADES = ['#dacaa1', '#d8c89e', '#d6c69b', '#dccca4'];

export function unitKindFor(state, terrain, x, y) {
  const caps = getCaps(state);
  const style = STYLES[state.player.style];
  if (caps.air) return 'plane';
  const water = isWaterBiome(terrain.biome[idx(wrapX(x), y)]);
  if (water) {
    if (hasAdvance(state, 'steamships')) return 'steamer';
    if (caps.seaLevel >= 4) return 'ship';
    if (caps.seaLevel >= 2) return style.boat === 'dhow' ? 'dhow' : style.boat;
    if (state.player.style === 'sea_raiders' || state.player.style === 'island_voyagers') return style.boat;
    return 'raft';
  }
  if (hasAdvance(state, 'railroads')) return 'train';
  if (hasAdvance(state, 'horses')) return 'rider';
  return 'walkers';
}

export class MapView {
  constructor(canvas, getState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getState = getState;
    this.ts = BASE_TS;
    this.camX = 0; // world-pixel coordinate of the screen centre
    this.camY = 0;
    this.dirty = true;
    this.selected = null;
    this.preview = null; // { path, ok }
    this.onTap = () => {};
    this.pointers = new Map();
    this.anim = 0;
    this.bindInput();
    this.resize();
    const loop = (t) => {
      const st = this.getState();
      const animated = st && st.expeditions.length > 0;
      if (animated && t - this.anim > 120) {
        this.anim = t;
        this.dirty = true;
      }
      if (this.dirty) {
        this.dirty = false;
        this.render(t);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clamp();
    this.dirty = true;
  }

  minTs() {
    return Math.max(2, this.w / W, this.h / H);
  }

  clamp() {
    this.ts = Math.max(this.minTs(), Math.min(80, this.ts));
    const worldW = W * this.ts;
    this.camX = ((this.camX % worldW) + worldW) % worldW;
    const halfH = this.h / 2;
    const worldH = H * this.ts;
    this.camY = worldH <= this.h ? worldH / 2 : Math.max(halfH, Math.min(worldH - halfH, this.camY));
  }

  centerOn(x, y, ts) {
    if (ts) this.ts = ts;
    this.camX = (x + 0.5) * this.ts;
    this.camY = (y + 0.5) * this.ts;
    this.clamp();
    this.dirty = true;
  }

  zoomAt(factor, sx, sy) {
    const before = this.screenToWorldF(sx, sy);
    this.ts *= factor;
    this.clamp();
    // Keep the point under the finger fixed.
    this.camX = before.fx * this.ts - (sx - this.w / 2);
    this.camY = before.fy * this.ts - (sy - this.h / 2);
    this.clamp();
    this.dirty = true;
  }

  screenToWorldF(sx, sy) {
    return { fx: (this.camX + sx - this.w / 2) / this.ts, fy: (this.camY + sy - this.h / 2) / this.ts };
  }

  screenToTile(sx, sy) {
    const { fx, fy } = this.screenToWorldF(sx, sy);
    return { x: wrapX(Math.floor(fx)), y: Math.floor(fy) };
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        this.camX -= dx;
        this.camY -= dy;
        this.clamp();
        this.dirty = true;
      } else if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = c.getBoundingClientRect();
        if (this.pinch.d > 0) this.zoomAt(d / this.pinch.d, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        this.pinch.d = d;
      }
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (moved < 10 && performance.now() - p.t < 500 && this.pointers.size === 0 && e.type === 'pointerup') {
        const rect = c.getBoundingClientRect();
        const t = this.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
        if (t.y >= 0 && t.y < H) this.onTap(t.x, t.y);
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      this.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
  }

  // Iterate visible tiles, yielding world tile coords and screen positions.
  forVisible(fn) {
    const ts = this.ts;
    const left = this.camX - this.w / 2;
    const top = this.camY - this.h / 2;
    const c0 = Math.floor(left / ts);
    const c1 = Math.floor((left + this.w) / ts);
    const r0 = Math.max(0, Math.floor(top / ts));
    const r1 = Math.min(H - 1, Math.floor((top + this.h) / ts));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        fn(wrapX(col), row, col * ts - left, row * ts - top);
      }
    }
  }

  // Screen coordinates of a tile's top-left (nearest wrapped copy to the view centre).
  pos(x, y) {
    const ts = this.ts;
    const left = this.camX - this.w / 2;
    const top = this.camY - this.h / 2;
    const centerCol = this.camX / ts;
    const col = centerCol + dxWrap(Math.floor(centerCol), x) - (centerCol - Math.floor(centerCol));
    return { sx: col * ts - left, sy: y * ts - top };
  }

  render(t = 0) {
    const state = this.getState();
    const ctx = this.ctx;
    ctx.fillStyle = FOG;
    ctx.fillRect(0, 0, this.w, this.h);
    if (!state) return;
    const terrain = terrainOf(state);
    const ts = this.ts;
    const detail = ts >= 12;
    const pad = ts < 6 ? 0.5 : 0;

    // Terrain + fog.
    this.forVisible((x, y, sx, sy) => {
      const i = idx(x, y);
      const h1 = hash2(x, y, 1);
      if (!state.explored[i]) {
        ctx.fillStyle = FOG_SHADES[Math.floor(hash2(x >> 1, y >> 1, 3) * FOG_SHADES.length)];
        ctx.fillRect(sx, sy, ts + pad, ts + pad);
        return;
      }
      const b = terrain.biome[i];
      ctx.fillStyle = biomeColor(b, h1);
      ctx.fillRect(sx, sy, ts + pad, ts + pad);
      if (detail) drawTerrainDetail(ctx, b, sx, sy, ts, h1, hash2(x, y, 2));
    });

    // Fog edge: soft dark border on explored tiles touching the unknown.
    if (ts >= 8) {
      ctx.fillStyle = 'rgba(90,70,40,0.25)';
      this.forVisible((x, y, sx, sy) => {
        if (!state.explored[idx(x, y)]) return;
        const e = Math.max(1, ts * 0.08);
        if (y > 0 && !state.explored[idx(x, y - 1)]) ctx.fillRect(sx, sy, ts, e);
        if (y < H - 1 && !state.explored[idx(x, y + 1)]) ctx.fillRect(sx, sy + ts - e, ts, e);
        if (!state.explored[idx(wrapX(x - 1), y)]) ctx.fillRect(sx, sy, e, ts);
        if (!state.explored[idx(wrapX(x + 1), y)]) ctx.fillRect(sx + ts - e, sy, e, ts);
      });
    }

    // Deposits.
    if (ts >= 16) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(ts * 0.42)}px sans-serif`;
      this.forVisible((x, y, sx, sy) => {
        const i = idx(x, y);
        const d = state.deposits[i];
        if (!d || !state.explored[i]) return;
        ctx.fillStyle = 'rgba(255,248,225,0.75)';
        ctx.beginPath();
        ctx.arc(sx + ts * 0.78, sy + ts * 0.24, ts * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillText(DEPOSITS[d.type].icon, sx + ts * 0.78, sy + ts * 0.26);
      });
    }

    // Player territory (worked radius) outlines.
    const color = state.player.color;
    const r = cityRadius(state);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, ts * 0.06);
    ctx.setLineDash([ts * 0.25, ts * 0.15]);
    for (const city of state.cities) {
      const { sx, sy } = this.pos(city.x - r, city.y - r);
      ctx.strokeRect(sx, sy, ts * (2 * r + 1), ts * (2 * r + 1));
    }
    ctx.setLineDash([]);

    // Trade routes.
    ctx.lineWidth = Math.max(1.5, ts * 0.08);
    for (const route of state.tradeRoutes) {
      const from = state.cities.find((c) => c.id === route.from);
      const to = route.toCiv ? state.civs.find((c) => c.id === route.toCiv) : state.cities.find((c) => c.id === route.toCity);
      if (!from || !to) continue;
      const a = this.pos(from.x, from.y);
      const dx = dxWrap(from.x, to.x);
      ctx.strokeStyle = '#e3b93c';
      ctx.setLineDash([ts * 0.3, ts * 0.2]);
      ctx.lineDashOffset = -t / 60;
      ctx.beginPath();
      ctx.moveTo(a.sx + ts / 2, a.sy + ts / 2);
      ctx.lineTo(a.sx + ts / 2 + dx * ts, a.sy + ts / 2 + (to.y - from.y) * ts);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Planned route preview.
    if (this.preview?.path) this.drawPath(this.preview.path, this.preview.ok ? '#ffffff' : '#ff6b6b', 0);

    // Expedition routes and units.
    for (const exp of state.expeditions) {
      this.drawPath(exp.path, shade(color, 0.3), exp.pos);
    }

    // Other peoples.
    const big = ts >= 10;
    for (const civ of state.civs) {
      if (!civ.met || civ.conquered) continue;
      const { sx, sy } = this.pos(civ.x, civ.y);
      if (sx < -ts * 2 || sx > this.w + ts * 2 || sy < -ts * 2 || sy > this.h + ts * 2) continue;
      if (big) {
        drawSettlement(ctx, sx + ts / 2, sy + ts / 2, ts, { style: civ.style, age: CIV_SPRITE_AGE[civ.level], pop: civ.pop, color: civ.color, capital: civ.level >= 2 });
      } else {
        ctx.fillStyle = civ.color;
        ctx.fillRect(sx - 1, sy - 1, ts + 2, ts + 2);
      }
      if (ts >= 18) this.label(civ.name, sx + ts / 2, sy + ts * 1.05, civ.color);
    }

    // Player cities.
    for (const city of state.cities) {
      const { sx, sy } = this.pos(city.x, city.y);
      if (sx < -ts * 2 || sx > this.w + ts * 2 || sy < -ts * 2 || sy > this.h + ts * 2) continue;
      if (big) {
        drawSettlement(ctx, sx + ts / 2, sy + ts / 2, ts, { style: state.player.style, age: state.age, pop: city.pop, color, capital: city.capital, emblem: state.player.emblem });
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(sx - 1.5, sy - 1.5, ts + 3, ts + 3);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 1.5, sy - 1.5, ts + 3, ts + 3);
      }
      if (ts >= 16) this.label(`${city.capital ? '★ ' : ''}${city.name} (${city.pop})`, sx + ts / 2, sy + ts * 1.05, color);
    }

    // Expedition units on top.
    for (const exp of state.expeditions) {
      const [x, y] = expeditionPosition(exp);
      const { sx, sy } = this.pos(x, y);
      const kind = unitKindFor(state, terrain, x, y);
      const bob = Math.sin(t / 250 + exp.elapsed) * ts * 0.04;
      const s = Math.max(10, ts * 0.9);
      const back = exp.phase === 'back';
      const next = exp.path[Math.min(exp.path.length - 1, exp.pos + 1)];
      const flip = back ? true : next && dxWrap(x, next[0]) < 0;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(sx + ts / 2, sy + ts * 0.85, s * 0.35, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      drawUnit(ctx, kind, sx + ts / 2, sy + ts * 0.85 + bob, s, color, flip);
      if (ts >= 14) {
        ctx.font = `bold ${Math.max(9, Math.round(ts * 0.3))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const txt = `${exp.members}${back ? ' ↩' : ''}`;
        ctx.strokeText(txt, sx + ts / 2, sy - ts * 0.1);
        ctx.fillText(txt, sx + ts / 2, sy - ts * 0.1);
      }
    }

    // Selection.
    if (this.selected) {
      const { sx, sy } = this.pos(this.selected.x, this.selected.y);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 0.5, sy - 0.5, ts + 1, ts + 1);
    }
  }

  drawPath(path, stroke, fromIndex) {
    const ctx = this.ctx;
    const ts = this.ts;
    if (path.length < 2) return;
    const [x0, y0] = path[Math.min(fromIndex, path.length - 1)];
    const a = this.pos(x0, y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(2, ts * 0.14);
    ctx.setLineDash([ts * 0.2, ts * 0.18]);
    const trace = () => {
      ctx.beginPath();
      let cx = a.sx + ts / 2;
      let cy = a.sy + ts / 2;
      ctx.moveTo(cx, cy);
      for (let k = fromIndex + 1; k < path.length; k++) {
        cx += dxWrap(path[k - 1][0], path[k][0]) * ts;
        cy += (path[k][1] - path[k - 1][1]) * ts;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      return [cx, cy];
    };
    trace();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, ts * 0.07);
    const [ex, ey] = trace();
    ctx.setLineDash([]);
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(ex, ey, Math.max(3, ts * 0.15), 0, Math.PI * 2);
    ctx.fill();
  }

  label(text, x, y, color) {
    const ctx = this.ctx;
    const fs = Math.max(10, Math.min(15, Math.round(this.ts * 0.32)));
    ctx.font = `600 ${fs}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(40,28,14,0.75)';
    ctx.fillRect(x - w / 2, y, w, fs + 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, 3, fs + 4);
    ctx.fillStyle = '#f6ecd2';
    ctx.fillText(text, x + 1, y + 2);
  }
}
