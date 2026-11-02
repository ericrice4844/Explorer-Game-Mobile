// Procedural "Age of Empires"-style sprites drawn on canvas: terrain details,
// buildings whose look depends on culture style and age, units and banners.
import { B, BIOMES, STYLES, GENERIC_HOUSES } from '../game/data.js';

const OUT = 'rgba(40,25,10,0.85)';

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function poly(ctx, pts, fill, stroke = OUT, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function rect(ctx, x, y, w, h, fill, stroke = OUT, lw = 1) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.strokeRect(x, y, w, h);
  }
}

function ellipse(ctx, x, y, rx, ry, fill, stroke = OUT, lw = 1, start = 0, end = Math.PI * 2) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, start, end);
  if (end - start < Math.PI * 2) ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// ---------------- terrain ----------------

export function drawTerrainDetail(ctx, biome, px, py, ts, h1, h2) {
  const s = ts;
  switch (biome) {
    case B.FOREST:
    case B.TAIGA:
    case B.JUNGLE: {
      const n = biome === B.JUNGLE ? 3 : 2 + (h1 > 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const tx = px + s * (0.22 + ((h1 * 7 + k * 0.37) % 1) * 0.56);
        const ty = py + s * (0.35 + ((h2 * 5 + k * 0.29) % 1) * 0.45);
        const r = s * (biome === B.JUNGLE ? 0.2 : 0.17);
        ctx.fillStyle = '#5a3b1e';
        ctx.fillRect(tx - s * 0.03, ty, s * 0.06, s * 0.14);
        if (biome === B.TAIGA) {
          poly(ctx, [tx, ty - r * 1.8, tx - r, ty + r * 0.3, tx + r, ty + r * 0.3], '#2f4f34', null);
        } else if (biome === B.JUNGLE) {
          ellipse(ctx, tx, ty - r * 0.3, r * 1.1, r * 0.8, '#1f6b2a', null);
          ellipse(ctx, tx - r * 0.3, ty - r * 0.5, r * 0.5, r * 0.4, '#3d8f3a', null);
        } else {
          ellipse(ctx, tx, ty - r * 0.4, r, r, '#3a7a2c', null);
          ellipse(ctx, tx - r * 0.3, ty - r * 0.7, r * 0.45, r * 0.4, '#5d9d3f', null);
        }
      }
      break;
    }
    case B.MOUNTAINS: {
      const mx = px + s * (0.5 + (h1 - 0.5) * 0.15);
      const my = py + s * 0.85;
      poly(ctx, [mx - s * 0.45, my, mx, py + s * 0.12, mx + s * 0.45, my], '#7b746c', 'rgba(50,40,30,0.6)');
      poly(ctx, [mx, py + s * 0.12, mx + s * 0.45, my, mx + s * 0.08, my], '#5e5852', null);
      poly(ctx, [mx - s * 0.12, py + s * 0.33, mx, py + s * 0.12, mx + s * 0.12, py + s * 0.33, mx, py + s * 0.28], '#f4f4f4', null);
      break;
    }
    case B.HILLS: {
      ellipse(ctx, px + s * 0.35, py + s * 0.7, s * 0.28, s * 0.2, shade('#9c9a5c', -0.15), null, 1, Math.PI, Math.PI * 2);
      ellipse(ctx, px + s * 0.68, py + s * 0.78, s * 0.22, s * 0.15, shade('#9c9a5c', -0.25), null, 1, Math.PI, Math.PI * 2);
      break;
    }
    case B.DESERT: {
      ctx.strokeStyle = 'rgba(160,120,60,0.55)';
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.arc(px + s * (0.3 + h1 * 0.3), py + s * 0.75, s * 0.25, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      if (h2 > 0.7) {
        ctx.fillStyle = '#4c7a3a';
        ctx.fillRect(px + s * 0.7, py + s * 0.35, s * 0.06, s * 0.25);
      }
      break;
    }
    case B.GRASSLAND:
    case B.STEPPE:
    case B.SAVANNA: {
      ctx.strokeStyle = biome === B.GRASSLAND ? '#6e9f3a' : '#9a8f3e';
      ctx.lineWidth = Math.max(1, s * 0.04);
      for (let k = 0; k < 2; k++) {
        const gx = px + s * (0.2 + ((h1 * 3 + k * 0.5) % 1) * 0.6);
        const gy = py + s * (0.4 + ((h2 * 3 + k * 0.3) % 1) * 0.45);
        ctx.beginPath();
        ctx.moveTo(gx - s * 0.06, gy - s * 0.1);
        ctx.lineTo(gx, gy);
        ctx.lineTo(gx + s * 0.06, gy - s * 0.1);
        ctx.stroke();
      }
      if (biome === B.SAVANNA && h1 > 0.65) {
        ctx.fillStyle = '#5a3b1e';
        ctx.fillRect(px + s * 0.6, py + s * 0.45, s * 0.05, s * 0.2);
        ellipse(ctx, px + s * 0.62, py + s * 0.43, s * 0.2, s * 0.07, '#5f7a2a', null);
      }
      break;
    }
    case B.TUNDRA: {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(px + s * h1 * 0.6, py + s * (0.3 + h2 * 0.4), s * 0.3, s * 0.08);
      break;
    }
    case B.ICE: {
      ctx.strokeStyle = 'rgba(150,180,200,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.2, py + s * (0.3 + h1 * 0.4));
      ctx.lineTo(px + s * 0.8, py + s * (0.3 + h2 * 0.4));
      ctx.stroke();
      break;
    }
    case B.OCEAN:
    case B.SEA:
    case B.COAST: {
      if (h1 > 0.55) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, s * 0.05);
        const wx = px + s * (0.2 + h2 * 0.4);
        const wy = py + s * (0.3 + h1 * 0.4);
        ctx.beginPath();
        ctx.arc(wx, wy, s * 0.12, Math.PI * 1.1, Math.PI * 1.9);
        ctx.arc(wx + s * 0.22, wy, s * 0.12, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      break;
    }
    default:
  }
}

export function biomeColor(b, h) {
  const base = BIOMES[b].color;
  return shade(base, (h - 0.5) * 0.12);
}

// ---------------- buildings ----------------
// Each primitive is drawn with (x,y) at bottom-centre and nominal size s.

const BUILDERS = {
  leanto(ctx, x, y, s, p) {
    poly(ctx, [x - s * 0.4, y, x + s * 0.2, y - s * 0.45, x + s * 0.4, y], p.roof);
  },
  hidetent(ctx, x, y, s, p) {
    poly(ctx, [x - s * 0.35, y, x, y - s * 0.7, x + s * 0.35, y], p.wall);
    poly(ctx, [x, y - s * 0.7, x + s * 0.35, y, x + s * 0.05, y], shade(p.wall, -0.2), null);
    poly(ctx, [x - s * 0.06, y, x, y - s * 0.25, x + s * 0.06, y], '#3a2614', null);
    ctx.strokeStyle = '#5a3b1e';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.08, y - s * 0.82);
    ctx.lineTo(x + s * 0.08, y - s * 0.6);
    ctx.moveTo(x + s * 0.08, y - s * 0.82);
    ctx.lineTo(x - s * 0.08, y - s * 0.6);
    ctx.stroke();
  },
  tent(ctx, x, y, s, p) {
    poly(ctx, [x - s * 0.45, y, x - s * 0.3, y - s * 0.4, x + s * 0.3, y - s * 0.4, x + s * 0.45, y], p.roof);
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y - s * 0.25);
    ctx.lineTo(x + s * 0.35, y - s * 0.25);
    ctx.stroke();
    rect(ctx, x - s * 0.07, y - s * 0.2, s * 0.14, s * 0.2, '#3a2614', null);
  },
  yurt(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.38, y - s * 0.25, s * 0.76, s * 0.25, p.wall);
    ellipse(ctx, x, y - s * 0.25, s * 0.4, s * 0.28, p.roof, OUT, 1, Math.PI, Math.PI * 2);
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.38, y - s * 0.12);
    ctx.lineTo(x + s * 0.38, y - s * 0.12);
    ctx.stroke();
    rect(ctx, x - s * 0.07, y - s * 0.2, s * 0.14, s * 0.2, p.trim, null);
    ellipse(ctx, x, y - s * 0.52, s * 0.08, s * 0.04, shade(p.roof, -0.3), null);
  },
  bigyurt(ctx, x, y, s, p, color) {
    BUILDERS.yurt(ctx, x, y, s * 1.35, p);
    drawBanner(ctx, x, y - s * 0.75, s * 0.8, 'horsetail', color);
  },
  hut(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.3, shade(p.wall, -0.1));
    poly(ctx, [x - s * 0.42, y - s * 0.26, x, y - s * 0.72, x + s * 0.42, y - s * 0.26], '#b8954a');
    rect(ctx, x - s * 0.06, y - s * 0.2, s * 0.12, s * 0.2, '#3a2614', null);
  },
  mudhouse(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.35, y - s * 0.45, s * 0.7, s * 0.45, p.wall);
    rect(ctx, x + s * 0.1, y - s * 0.45, s * 0.25, s * 0.45, shade(p.wall, -0.15), null);
    rect(ctx, x - s * 0.38, y - s * 0.5, s * 0.76, s * 0.06, shade(p.wall, -0.3), null);
    rect(ctx, x - s * 0.2, y - s * 0.22, s * 0.12, s * 0.22, '#3a2614', null);
    rect(ctx, x + s * 0.1, y - s * 0.35, s * 0.08, s * 0.08, '#3a2614', null);
  },
  house(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.32, y - s * 0.4, s * 0.64, s * 0.4, p.wall);
    poly(ctx, [x - s * 0.4, y - s * 0.38, x, y - s * 0.75, x + s * 0.4, y - s * 0.38], p.roof);
    poly(ctx, [x, y - s * 0.75, x + s * 0.4, y - s * 0.38, x + s * 0.05, y - s * 0.38], shade(p.roof, -0.2), null);
    rect(ctx, x - s * 0.06, y - s * 0.22, s * 0.12, s * 0.22, '#4a3018', null);
    rect(ctx, x + s * 0.13, y - s * 0.3, s * 0.1, s * 0.1, '#f2d27a', null);
  },
  longhouse(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.5, y - s * 0.3, s, s * 0.3, p.wall);
    poly(ctx, [x - s * 0.58, y - s * 0.28, x - s * 0.4, y - s * 0.62, x + s * 0.4, y - s * 0.62, x + s * 0.58, y - s * 0.28], p.roof);
    ctx.strokeStyle = OUT;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.62);
    ctx.lineTo(x - s * 0.48, y - s * 0.75);
    ctx.moveTo(x + s * 0.4, y - s * 0.62);
    ctx.lineTo(x + s * 0.48, y - s * 0.75);
    ctx.stroke();
    rect(ctx, x - s * 0.06, y - s * 0.2, s * 0.12, s * 0.2, '#3a2614', null);
  },
  hall(ctx, x, y, s, p, color) {
    BUILDERS.longhouse(ctx, x, y, s * 1.35, p);
    drawBanner(ctx, x + s * 0.5, y - s * 0.8, s * 0.7, 'raven', color);
  },
  fale(ctx, x, y, s, p) {
    for (const dx of [-0.32, -0.1, 0.12, 0.32]) rect(ctx, x + s * dx - s * 0.03, y - s * 0.3, s * 0.06, s * 0.3, '#5a3b1e', null);
    ellipse(ctx, x, y - s * 0.3, s * 0.48, s * 0.38, p.roof, OUT, 1, Math.PI, Math.PI * 2);
    ellipse(ctx, x, y - s * 0.3, s * 0.48, s * 0.06, shade(p.roof, -0.25), null);
  },
  marae(ctx, x, y, s, p, color) {
    rect(ctx, x - s * 0.6, y - s * 0.12, s * 1.2, s * 0.12, '#9a8d78');
    BUILDERS.fale(ctx, x, y - s * 0.12, s * 1.2, p);
    ctx.fillStyle = p.trim;
    ctx.fillRect(x - s * 0.6, y - s * 0.95, s * 0.06, s * 0.8);
    drawBanner(ctx, x - s * 0.57, y - s * 0.95, s * 0.6, 'wave', color);
  },
  standingstones(ctx, x, y, s) {
    for (const [dx, h] of [[-0.4, 0.5], [-0.15, 0.62], [0.12, 0.62], [0.38, 0.5]]) rect(ctx, x + s * dx - s * 0.07, y - s * h, s * 0.14, s * h, '#8d8a85');
    rect(ctx, x - s * 0.24, y - s * 0.7, s * 0.48, s * 0.09, '#a3a09a');
  },
  ziggurat(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.55, y - s * 0.22, s * 1.1, s * 0.22, p.wall);
    rect(ctx, x - s * 0.4, y - s * 0.42, s * 0.8, s * 0.2, shade(p.wall, -0.05));
    rect(ctx, x - s * 0.25, y - s * 0.62, s * 0.5, s * 0.2, shade(p.wall, -0.1));
    rect(ctx, x - s * 0.1, y - s * 0.78, s * 0.2, s * 0.16, p.trim);
    rect(ctx, x - s * 0.05, y - s * 0.62, s * 0.1, s * 0.62, shade(p.wall, -0.25), null);
  },
  pyramid(ctx, x, y, s, p) {
    poly(ctx, [x - s * 0.65, y, x, y - s * 0.9, x + s * 0.65, y], shade(p.roof, 0.2));
    poly(ctx, [x, y - s * 0.9, x + s * 0.65, y, x + s * 0.1, y], shade(p.roof, -0.1), null);
    poly(ctx, [x - s * 0.1, y - s * 0.76, x, y - s * 0.9, x + s * 0.1, y - s * 0.76], '#f6e27a', null);
  },
  temple(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.55, y - s * 0.1, s * 1.1, s * 0.1, shade(p.wall, -0.1));
    for (let k = 0; k < 5; k++) rect(ctx, x - s * 0.45 + k * s * 0.22, y - s * 0.55, s * 0.08, s * 0.45, p.wall);
    rect(ctx, x - s * 0.52, y - s * 0.62, s * 1.04, s * 0.08, p.wall);
    poly(ctx, [x - s * 0.55, y - s * 0.62, x, y - s * 0.88, x + s * 0.55, y - s * 0.62], p.roof);
  },
  fort(ctx, x, y, s, p, color) {
    rect(ctx, x - s * 0.5, y - s * 0.35, s, s * 0.35, '#a08a66');
    for (let k = 0; k < 5; k++) rect(ctx, x - s * 0.5 + k * s * 0.22, y - s * 0.43, s * 0.12, s * 0.08, '#a08a66', null);
    rect(ctx, x - s * 0.08, y - s * 0.22, s * 0.16, s * 0.22, '#3a2614', null);
    drawBanner(ctx, x, y - s * 0.45, s * 0.7, 'eagle', color);
  },
  castle(ctx, x, y, s, p, color) {
    rect(ctx, x - s * 0.55, y - s * 0.45, s * 1.1, s * 0.45, '#b9ad98');
    rect(ctx, x - s * 0.65, y - s * 0.7, s * 0.25, s * 0.7, '#a89c88');
    rect(ctx, x + s * 0.4, y - s * 0.7, s * 0.25, s * 0.7, '#a89c88');
    for (const tx of [-0.65, 0.4]) {
      for (let k = 0; k < 3; k++) rect(ctx, x + s * tx + k * s * 0.09, y - s * 0.77, s * 0.06, s * 0.07, '#a89c88', null);
    }
    rect(ctx, x - s * 0.18, y - s * 0.9, s * 0.36, s * 0.45, '#c8bca6');
    poly(ctx, [x - s * 0.22, y - s * 0.88, x, y - s * 1.12, x + s * 0.22, y - s * 0.88], p.roof);
    ellipse(ctx, x, y - s * 0.12, s * 0.1, s * 0.14, '#3a2614', null, 1, Math.PI, Math.PI * 2);
    rect(ctx, x - s * 0.1, y - s * 0.12, s * 0.2, s * 0.12, '#3a2614', null);
    drawBanner(ctx, x, y - s * 1.12, s * 0.6, 'square', color);
  },
  citadel(ctx, x, y, s, p, color) {
    BUILDERS.castle(ctx, x, y, s, { ...p, roof: p.trim }, color);
    BUILDERS.yurt(ctx, x - s * 0.85, y, s * 0.6, p);
  },
  caravanserai(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.6, y - s * 0.4, s * 1.2, s * 0.4, p.wall);
    ellipse(ctx, x, y - s * 0.12, s * 0.14, s * 0.2, '#3a2614', null, 1, Math.PI, Math.PI * 2);
    rect(ctx, x - s * 0.14, y - s * 0.12, s * 0.28, s * 0.12, '#3a2614', null);
    rect(ctx, x - s * 0.65, y - s * 0.6, s * 0.16, s * 0.6, shade(p.wall, -0.1));
    rect(ctx, x + s * 0.49, y - s * 0.6, s * 0.16, s * 0.6, shade(p.wall, -0.1));
    ellipse(ctx, x, y - s * 0.4, s * 0.25, s * 0.22, p.roof, OUT, 1, Math.PI, Math.PI * 2);
  },
  market(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.5, y - s * 0.3, s, s * 0.3, p.wall);
    for (let k = 0; k < 4; k++) {
      poly(ctx, [x - s * 0.55 + k * s * 0.28, y - s * 0.3, x - s * 0.55 + k * s * 0.28 + s * 0.14, y - s * 0.5, x - s * 0.55 + k * s * 0.28 + s * 0.28, y - s * 0.3], k % 2 ? '#f4efe6' : p.trim);
    }
  },
  dome(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.45, y - s * 0.45, s * 0.9, s * 0.45, p.wall);
    rect(ctx, x - s * 0.62, y - s * 0.85, s * 0.1, s * 0.85, shade(p.wall, -0.08));
    poly(ctx, [x - s * 0.63, y - s * 0.85, x - s * 0.57, y - s * 1.0, x - s * 0.51, y - s * 0.85], p.roof);
    ellipse(ctx, x, y - s * 0.45, s * 0.36, s * 0.4, p.roof, OUT, 1, Math.PI, Math.PI * 2);
    ellipse(ctx, x - s * 0.1, y - s * 0.6, s * 0.08, s * 0.12, shade(p.roof, 0.3), null);
    rect(ctx, x - s * 0.02, y - s * 0.95, s * 0.04, s * 0.1, '#e8c547', null);
    for (let k = -1; k <= 1; k++) ellipse(ctx, x + k * s * 0.22, y - s * 0.15, s * 0.06, s * 0.1, '#3a2614', null, 1, Math.PI, Math.PI * 2);
  },
  harbor(ctx, x, y, s, p, color) {
    rect(ctx, x - s * 0.6, y - s * 0.08, s * 1.2, s * 0.08, '#6b4a2a');
    BUILDERS.house(ctx, x - s * 0.25, y - s * 0.08, s * 0.8, p);
    drawUnit(ctx, 'dhow', x + s * 0.45, y + s * 0.02, s * 0.7, color);
  },
  lighthouse(ctx, x, y, s, p) {
    poly(ctx, [x - s * 0.2, y, x - s * 0.12, y - s * 1.0, x + s * 0.12, y - s * 1.0, x + s * 0.2, y], p.wall);
    for (let k = 1; k < 4; k++) rect(ctx, x - s * 0.18 + k * s * 0.01, y - s * 0.25 * k, s * 0.34 - k * s * 0.02, s * 0.06, p.trim, null);
    rect(ctx, x - s * 0.14, y - s * 1.15, s * 0.28, s * 0.15, '#f6d55c');
    poly(ctx, [x - s * 0.16, y - s * 1.15, x, y - s * 1.3, x + s * 0.16, y - s * 1.15], p.roof);
  },
  tower(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.22, y - s * 0.95, s * 0.44, s * 0.95, '#b9b2a6');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) rect(ctx, x - s * 0.15 + c * s * 0.18, y - s * 0.85 + r * s * 0.2, s * 0.1, s * 0.1, '#f2d27a', null);
  },
  tenement(ctx, x, y, s, p) {
    rect(ctx, x - s * 0.35, y - s * 0.8, s * 0.7, s * 0.8, '#a4553a');
    rect(ctx, x - s * 0.38, y - s * 0.86, s * 0.76, s * 0.06, '#5a5a5a', null);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rect(ctx, x - s * 0.28 + c * s * 0.2, y - s * 0.72 + r * s * 0.22, s * 0.12, s * 0.12, '#f2e3b0', null);
  },
  factory(ctx, x, y, s) {
    rect(ctx, x - s * 0.55, y - s * 0.4, s * 1.1, s * 0.4, '#8a5a45');
    for (let k = 0; k < 3; k++) poly(ctx, [x - s * 0.55 + k * s * 0.37, y - s * 0.4, x - s * 0.55 + k * s * 0.37, y - s * 0.62, x - s * 0.18 + k * s * 0.37, y - s * 0.4], '#6a6a6a');
    rect(ctx, x + s * 0.3, y - s * 1.05, s * 0.14, s * 0.65, '#7a4a35');
    ellipse(ctx, x + s * 0.42, y - s * 1.15, s * 0.12, s * 0.08, 'rgba(120,120,120,0.7)', null);
    ellipse(ctx, x + s * 0.58, y - s * 1.25, s * 0.16, s * 0.1, 'rgba(150,150,150,0.5)', null);
  },
  skyscraper(ctx, x, y, s) {
    rect(ctx, x - s * 0.2, y - s * 1.4, s * 0.4, s * 1.4, '#7f9bb3');
    rect(ctx, x + s * 0.05, y - s * 1.4, s * 0.15, s * 1.4, '#5f7b93', null);
    rect(ctx, x - s * 0.02, y - s * 1.6, s * 0.04, s * 0.2, '#555', null);
    for (let r = 0; r < 7; r++) rect(ctx, x - s * 0.16, y - s * 1.3 + r * s * 0.18, s * 0.32, s * 0.05, '#cfe3f3', null);
  },
};

export function drawBuilding(ctx, type, x, y, s, palette, color) {
  (BUILDERS[type] || BUILDERS.hut)(ctx, x, y, s, palette, color);
}

export const BUILDING_TYPES = Object.keys(BUILDERS);

// ---------------- banners ----------------
export function drawBanner(ctx, x, y, s, type, color, emblem) {
  ctx.strokeStyle = '#3a2614';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - s);
  ctx.stroke();
  const top = y - s;
  switch (type) {
    case 'horsetail': // tug: a pole with flowing horse-hair tassels
      ellipse(ctx, x, top + s * 0.08, s * 0.08, s * 0.08, '#e8c547', null);
      for (let k = -2; k <= 2; k++) {
        ctx.strokeStyle = k % 2 ? color : shade(color, -0.3);
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(x, top + s * 0.15);
        ctx.quadraticCurveTo(x + k * s * 0.06, top + s * 0.35, x + k * s * 0.09, top + s * 0.55);
        ctx.stroke();
      }
      break;
    case 'eagle':
      rect(ctx, x - s * 0.22, top + s * 0.18, s * 0.44, s * 0.3, color);
      poly(ctx, [x - s * 0.18, top + s * 0.12, x, top, x + s * 0.18, top + s * 0.12, x, top + s * 0.08], '#e8c547', null);
      break;
    case 'raven':
    case 'pennant':
      poly(ctx, [x, top, x + s * 0.5, top + s * 0.12, x, top + s * 0.25], color);
      break;
    case 'wave':
      poly(ctx, [x, top, x + s * 0.4, top + s * 0.05, x + s * 0.35, top + s * 0.18, x + s * 0.42, top + s * 0.3, x, top + s * 0.3], color);
      break;
    case 'sun':
      rect(ctx, x, top, s * 0.4, s * 0.3, color);
      ellipse(ctx, x + s * 0.2, top + s * 0.15, s * 0.08, s * 0.08, '#f6d55c', null);
      break;
    default:
      rect(ctx, x, top, s * 0.42, s * 0.3, color);
  }
  if (emblem && s > 18) {
    ctx.font = `${Math.round(s * 0.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emblem, x + s * 0.2, top + s * 0.15);
  }
}

// ---------------- cities ----------------

// Draws a settlement cluster for a culture style and age. (cx, cy) is the tile centre.
export function drawSettlement(ctx, cx, cy, ts, { style, age, pop, color, capital, emblem }) {
  const st = STYLES[style] || STYLES.temple_builders;
  const p = st.palette;
  const house = st.houses[age] || GENERIC_HOUSES[age];
  const landmark = st.landmarks[age];
  const n = Math.min(5, 1 + Math.floor(pop / 3));
  const s = ts * 0.42;
  // Ground patch in player colour.
  ellipse(ctx, cx, cy + ts * 0.25, ts * 0.55, ts * 0.22, 'rgba(120,90,50,0.35)', null);
  const spots = [[-0.28, 0.12], [0.3, 0.14], [-0.05, 0.3], [0.22, 0.34], [-0.33, 0.36]];
  for (let k = 0; k < n; k++) {
    const [dx, dy] = spots[k];
    drawBuilding(ctx, house, cx + dx * ts, cy + dy * ts, s * (0.75 + (k % 2) * 0.1), p, color);
  }
  // Industrial and modern cities keep a heritage landmark from their classical past.
  if (age >= 5 && (capital || pop >= 8)) drawBuilding(ctx, st.landmarks[3], cx - ts * 0.3, cy + ts * 0.32, s * 0.7, p, color);
  if (capital || pop >= 8) drawBuilding(ctx, landmark, cx + (age >= 5 ? ts * 0.08 : 0), cy + ts * 0.1, s * 1.15, p, color);
  if (capital) drawBanner(ctx, cx + ts * 0.42, cy + ts * 0.15, ts * 0.65, st.banner, color, ts > 40 ? emblem : null);
}

// ---------------- units ----------------
export function drawUnit(ctx, kind, x, y, s, color, flip = false) {
  ctx.save();
  if (flip) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  switch (kind) {
    case 'walkers': {
      for (const [dx, sc] of [[-0.25, 0.9], [0.1, 1], [0.38, 0.85]]) {
        const fx = x + dx * s;
        const h = s * 0.7 * sc;
        ctx.strokeStyle = '#3a2614';
        ctx.lineWidth = Math.max(1, s * 0.07);
        ctx.beginPath();
        ctx.moveTo(fx - s * 0.06, y);
        ctx.lineTo(fx, y - h * 0.4);
        ctx.lineTo(fx + s * 0.06, y);
        ctx.stroke();
        rect(ctx, fx - s * 0.07, y - h * 0.75, s * 0.14, h * 0.38, color, null);
        ellipse(ctx, fx, y - h * 0.88, s * 0.07, s * 0.07, '#c58d5d', null);
        ctx.beginPath();
        ctx.moveTo(fx + s * 0.1, y - h * 1.05);
        ctx.lineTo(fx + s * 0.1, y - h * 0.2);
        ctx.stroke();
      }
      break;
    }
    case 'rider': {
      ellipse(ctx, x, y - s * 0.38, s * 0.32, s * 0.15, '#7a4a2a');
      for (const dx of [-0.2, -0.1, 0.12, 0.22]) {
        ctx.strokeStyle = '#4a2a14';
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(x + dx * s, y - s * 0.3);
        ctx.lineTo(x + dx * s, y);
        ctx.stroke();
      }
      poly(ctx, [x + s * 0.25, y - s * 0.45, x + s * 0.45, y - s * 0.68, x + s * 0.52, y - s * 0.6, x + s * 0.32, y - s * 0.36], '#7a4a2a');
      rect(ctx, x - s * 0.08, y - s * 0.78, s * 0.16, s * 0.3, color);
      ellipse(ctx, x, y - s * 0.86, s * 0.08, s * 0.08, '#c58d5d', null);
      poly(ctx, [x - s * 0.1, y - s * 0.9, x, y - s * 1.02, x + s * 0.1, y - s * 0.9], shade(color, -0.4), null);
      break;
    }
    case 'train': {
      rect(ctx, x - s * 0.5, y - s * 0.4, s * 0.55, s * 0.32, '#333');
      rect(ctx, x + s * 0.05, y - s * 0.55, s * 0.3, s * 0.47, color);
      rect(ctx, x - s * 0.4, y - s * 0.6, s * 0.1, s * 0.2, '#333', null);
      for (const dx of [-0.35, -0.1, 0.2]) ellipse(ctx, x + dx * s, y - s * 0.06, s * 0.08, s * 0.08, '#111', null);
      break;
    }
    case 'plane': {
      poly(ctx, [x - s * 0.5, y - s * 0.4, x + s * 0.45, y - s * 0.45, x + s * 0.5, y - s * 0.38, x - s * 0.45, y - s * 0.33], '#dcdcdc');
      poly(ctx, [x - s * 0.05, y - s * 0.42, x + s * 0.12, y - s * 0.72, x + s * 0.2, y - s * 0.72, x + s * 0.12, y - s * 0.42], color);
      poly(ctx, [x - s * 0.05, y - s * 0.38, x + s * 0.12, y - s * 0.1, x + s * 0.2, y - s * 0.1, x + s * 0.12, y - s * 0.38], shade(color, -0.2));
      break;
    }
    case 'raft': {
      // Bundled reed/log raft with a paddler.
      for (let k = 0; k < 4; k++) ellipse(ctx, x, y - s * 0.04 - k * s * 0.045, s * 0.42, s * 0.04, k % 2 ? '#b8954a' : '#a8844a');
      rect(ctx, x - s * 0.06, y - s * 0.45, s * 0.12, s * 0.25, color, null);
      ellipse(ctx, x, y - s * 0.52, s * 0.07, s * 0.07, '#c58d5d', null);
      ctx.strokeStyle = '#5a3b1e';
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.25, y - s * 0.55);
      ctx.lineTo(x + s * 0.05, y + s * 0.02);
      ctx.stroke();
      break;
    }
    case 'longship':
    case 'galley':
    case 'outrigger':
    case 'dhow':
    case 'ship':
    case 'steamer': {
      const hull = kind === 'steamer' ? '#3a3a3a' : '#6b4a2a';
      poly(ctx, [x - s * 0.5, y - s * 0.2, x + s * 0.5, y - s * 0.2, x + s * 0.35, y, x - s * 0.35, y], hull);
      if (kind === 'longship') {
        ctx.strokeStyle = hull;
        ctx.lineWidth = Math.max(1, s * 0.07);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.48, y - s * 0.2);
        ctx.quadraticCurveTo(x + s * 0.62, y - s * 0.4, x + s * 0.5, y - s * 0.48);
        ctx.stroke();
        for (let k = 0; k < 4; k++) ellipse(ctx, x - s * 0.3 + k * s * 0.2, y - s * 0.2, s * 0.06, s * 0.06, k % 2 ? color : '#e8c547', null);
      }
      if (kind === 'outrigger') {
        ctx.strokeStyle = '#5a3b1e';
        ctx.beginPath();
        ctx.moveTo(x - s * 0.15, y - s * 0.1);
        ctx.lineTo(x - s * 0.15, y + s * 0.12);
        ctx.moveTo(x + s * 0.15, y - s * 0.1);
        ctx.lineTo(x + s * 0.15, y + s * 0.12);
        ctx.stroke();
        rect(ctx, x - s * 0.35, y + s * 0.1, s * 0.7, s * 0.05, '#8a6a3a', null);
        poly(ctx, [x, y - s * 0.2, x - s * 0.05, y - s * 0.8, x + s * 0.35, y - s * 0.3], color);
        break;
      }
      if (kind === 'steamer') {
        rect(ctx, x - s * 0.25, y - s * 0.38, s * 0.45, s * 0.18, '#eee');
        rect(ctx, x - s * 0.05, y - s * 0.65, s * 0.12, s * 0.27, color);
        ellipse(ctx, x + s * 0.05, y - s * 0.75, s * 0.12, s * 0.07, 'rgba(120,120,120,0.6)', null);
        break;
      }
      rect(ctx, x - s * 0.03, y - s * 0.85, s * 0.06, s * 0.65, '#5a3b1e', null);
      if (kind === 'dhow') {
        poly(ctx, [x + s * 0.03, y - s * 0.85, x + s * 0.4, y - s * 0.28, x - s * 0.25, y - s * 0.28], color);
      } else if (kind === 'ship') {
        rect(ctx, x - s * 0.25, y - s * 0.78, s * 0.5, s * 0.22, '#f4efe6');
        rect(ctx, x - s * 0.22, y - s * 0.52, s * 0.44, s * 0.22, '#f4efe6');
        ellipse(ctx, x, y - s * 0.67, s * 0.07, s * 0.07, color, null);
        rect(ctx, x - s * 0.02, y - s * 1.0, s * 0.04, s * 0.15, '#5a3b1e', null);
        poly(ctx, [x, y - s * 1.0, x + s * 0.15, y - s * 0.95, x, y - s * 0.9], color, null);
      } else {
        rect(ctx, x - s * 0.25, y - s * 0.75, s * 0.5, s * 0.4, kind === 'longship' ? '#f4efe6' : color);
        if (kind === 'longship') for (let k = 0; k < 3; k++) rect(ctx, x - s * 0.25 + k * s * 0.17, y - s * 0.75, s * 0.08, s * 0.4, color, null);
        if (kind === 'galley') {
          ctx.strokeStyle = '#5a3b1e';
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.moveTo(x - s * 0.3 + k * s * 0.18, y - s * 0.1);
            ctx.lineTo(x - s * 0.38 + k * s * 0.18, y + s * 0.12);
            ctx.stroke();
          }
        }
      }
      break;
    }
    default:
      ellipse(ctx, x, y - s * 0.3, s * 0.2, s * 0.2, color);
  }
  ctx.restore();
}
