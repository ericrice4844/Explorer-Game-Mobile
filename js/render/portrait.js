// Leader portraits: customizable face + culture/age-specific dress and headgear.
import { STYLES } from '../game/data.js';
import { shade } from './sprites.js';

export const SKIN_TONES = ['#f3d2b3', '#e2b48c', '#c68c5c', '#a86b42', '#7d4a2b', '#4f2f1c'];
export const HAIR_COLORS = ['#1d1410', '#4a2c17', '#8a5a2b', '#c49a5a', '#a33a1a', '#9a9a9a'];
export const HAIR_STYLES = ['short', 'long', 'braids', 'topknot', 'bald'];
export const BEARDS = ['none', 'beard', 'mustache', 'long'];

function el(ctx, x, y, rx, ry, fill, stroke) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function poly(ctx, pts, fill, stroke = 'rgba(40,25,10,0.7)') {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function headgearFor(styleKey, age) {
  return (STYLES[styleKey] || STYLES.temple_builders).headgear[age] || 'none';
}

/**
 * Draw a leader portrait filling a square of size S at (0,0).
 */
export function drawPortrait(ctx, S, leader, styleKey, age, color) {
  const st = STYLES[styleKey] || STYLES.temple_builders;
  const skin = SKIN_TONES[leader.skin] || SKIN_TONES[2];
  const hair = HAIR_COLORS[leader.hair] || HAIR_COLORS[0];
  const hat = headgearFor(styleKey, age);
  const cx = S / 2;
  const u = S / 100;

  ctx.save();
  ctx.clearRect(0, 0, S, S);
  // Background medallion.
  const g = ctx.createRadialGradient(cx, S * 0.4, S * 0.1, cx, S * 0.5, S * 0.6);
  g.addColorStop(0, '#f6e7c1');
  g.addColorStop(1, '#c9a86a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, S / 2, S / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, S / 2, S / 2 - 1, 0, Math.PI * 2);
  ctx.clip();

  // Long hair behind the head.
  if (leader.hairStyle === 'long' || leader.hairStyle === 'braids') {
    poly(ctx, [cx - 24 * u, 36 * u, cx + 24 * u, 36 * u, cx + 26 * u, 78 * u, cx - 26 * u, 78 * u], hair, null);
  }

  // Shoulders / garment, dressed by age.
  const robe = age === 0 ? '#8a6a44' : age >= 5 ? '#2d3440' : color;
  poly(ctx, [cx - 46 * u, 100 * u, cx - 40 * u, 78 * u, cx - 16 * u, 68 * u, cx + 16 * u, 68 * u, cx + 40 * u, 78 * u, cx + 46 * u, 100 * u], robe);
  if (age === 0) {
    // Fur mantle and bone necklace.
    for (let k = -3; k <= 3; k++) el(ctx, cx + k * 9 * u, 74 * u, 7 * u, 5 * u, '#b8956a');
    for (let k = -2; k <= 2; k++) el(ctx, cx + k * 5 * u, 81 * u, 1.6 * u, 3 * u, '#f2ead6');
  } else if (age >= 5) {
    poly(ctx, [cx - 10 * u, 68 * u, cx, 90 * u, cx + 10 * u, 68 * u], '#f2f2f2', null);
    poly(ctx, [cx - 3 * u, 72 * u, cx, 92 * u, cx + 3 * u, 72 * u], color, null);
  } else {
    ctx.strokeStyle = st.palette.trim;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(cx - 16 * u, 68 * u);
    ctx.lineTo(cx, 86 * u);
    ctx.lineTo(cx + 16 * u, 68 * u);
    ctx.stroke();
    if (st.temperament === 'warlike') {
      // Armour shoulder plates.
      el(ctx, cx - 34 * u, 80 * u, 12 * u, 7 * u, '#9a9a9a', 'rgba(40,25,10,0.7)');
      el(ctx, cx + 34 * u, 80 * u, 12 * u, 7 * u, '#9a9a9a', 'rgba(40,25,10,0.7)');
    }
    if (st.lifestyle === 'nomadic') {
      // Fur collar of the steppe and caravan peoples.
      for (let k = -2; k <= 2; k++) el(ctx, cx + k * 7 * u, 70 * u, 6 * u, 4 * u, '#d9c39a');
    }
  }

  // Neck and head.
  poly(ctx, [cx - 8 * u, 56 * u, cx + 8 * u, 56 * u, cx + 9 * u, 70 * u, cx - 9 * u, 70 * u], shade(skin, -0.12), null);
  el(ctx, cx, 44 * u, 19 * u, 23 * u, skin, 'rgba(40,25,10,0.6)');
  el(ctx, cx - 19 * u, 46 * u, 3.5 * u, 5 * u, skin);
  el(ctx, cx + 19 * u, 46 * u, 3.5 * u, 5 * u, skin);

  // Hair on top (unless covered by large headgear).
  const coversHair = ['khanhat', 'nemes', 'helm', 'turban', 'furhood', 'hood', 'dogecap', 'tophat'].includes(hat);
  if (!coversHair && leader.hairStyle !== 'bald') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(cx, 34 * u, 20 * u, 14 * u, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    poly(ctx, [cx - 20 * u, 34 * u, cx + 20 * u, 34 * u, cx + 18 * u, 40 * u, cx - 18 * u, 40 * u], hair, null);
    if (leader.hairStyle === 'topknot') el(ctx, cx, 20 * u, 7 * u, 6 * u, hair);
    if (leader.hairStyle === 'braids') {
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) el(ctx, cx + s * 21 * u, (52 + k * 7) * u, 3.5 * u, 4 * u, shade(hair, 0.1));
    }
  }

  // Face.
  ctx.fillStyle = '#2a1a10';
  el(ctx, cx - 7 * u, 44 * u, 2.4 * u, 2 * u, '#2a1a10');
  el(ctx, cx + 7 * u, 44 * u, 2.4 * u, 2 * u, '#2a1a10');
  ctx.strokeStyle = shade(hair, 0.1);
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(cx - 11 * u, 39 * u);
  ctx.lineTo(cx - 4 * u, 38.5 * u);
  ctx.moveTo(cx + 4 * u, 38.5 * u);
  ctx.lineTo(cx + 11 * u, 39 * u);
  ctx.stroke();
  ctx.strokeStyle = shade(skin, -0.3);
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.moveTo(cx, 45 * u);
  ctx.lineTo(cx - 2 * u, 52 * u);
  ctx.lineTo(cx + 1.5 * u, 52.5 * u);
  ctx.stroke();
  ctx.strokeStyle = '#7a3a2a';
  ctx.beginPath();
  ctx.moveTo(cx - 5 * u, 58 * u);
  ctx.quadraticCurveTo(cx, 60 * u, cx + 5 * u, 58 * u);
  ctx.stroke();

  // Facial hair.
  if (leader.beard === 'beard' || leader.beard === 'long') {
    const len = leader.beard === 'long' ? 80 : 68;
    poly(ctx, [cx - 17 * u, 50 * u, cx - 12 * u, 62 * u, cx, len * u, cx + 12 * u, 62 * u, cx + 17 * u, 50 * u, cx + 8 * u, 58 * u, cx - 8 * u, 58 * u], hair, null);
  }
  if (leader.beard !== 'none') {
    poly(ctx, [cx - 9 * u, 55 * u, cx, 53 * u, cx + 9 * u, 55 * u, cx + 11 * u, 60 * u, cx, 56 * u, cx - 11 * u, 60 * u], hair, null);
  }

  drawHeadgear(ctx, hat, cx, u, color, st, hair);
  ctx.restore();

  // Rim.
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.arc(cx, S / 2, S / 2 - 2 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHeadgear(ctx, hat, cx, u, color, st, hair) {
  const gold = '#e3b93c';
  switch (hat) {
    case 'furhood':
      poly(ctx, [cx - 24 * u, 50 * u, cx - 22 * u, 22 * u, cx, 14 * u, cx + 22 * u, 22 * u, cx + 24 * u, 50 * u, cx + 18 * u, 40 * u, cx + 16 * u, 30 * u, cx - 16 * u, 30 * u, cx - 18 * u, 40 * u], '#8a6a44');
      for (let k = -3; k <= 3; k++) el(ctx, cx + k * 6 * u, 30 * u, 4 * u, 3 * u, '#b8956a');
      break;
    case 'khanhat':
      // Conical felt hat with a thick fur brim, like the steppe khans.
      poly(ctx, [cx - 16 * u, 30 * u, cx, 4 * u, cx + 16 * u, 30 * u], color);
      el(ctx, cx, 4 * u, 3 * u, 3 * u, gold);
      for (let k = -4; k <= 4; k++) el(ctx, cx + k * 5 * u, 31 * u, 4.5 * u, 4.5 * u, '#6b4a2a');
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 12 * u, 22 * u);
      ctx.lineTo(cx + 12 * u, 22 * u);
      ctx.stroke();
      break;
    case 'hood':
      poly(ctx, [cx - 24 * u, 60 * u, cx - 22 * u, 24 * u, cx, 14 * u, cx + 22 * u, 24 * u, cx + 24 * u, 60 * u, cx + 18 * u, 44 * u, cx + 17 * u, 30 * u, cx - 17 * u, 30 * u, cx - 18 * u, 44 * u], st.palette.trim);
      break;
    case 'turban':
      el(ctx, cx, 24 * u, 22 * u, 12 * u, '#f2ead6', 'rgba(40,25,10,0.6)');
      ctx.strokeStyle = '#d8ccb0';
      ctx.lineWidth = 2 * u;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(cx, (20 + k * 5) * u, 20 * u, 4 * u, -0.15, 0, Math.PI);
        ctx.stroke();
      }
      el(ctx, cx, 27 * u, 3.5 * u, 3.5 * u, color);
      break;
    case 'circlet':
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.ellipse(cx, 30 * u, 19 * u, 5 * u, 0, 0, Math.PI);
      ctx.stroke();
      break;
    case 'laurel':
      ctx.fillStyle = '#5d8a3a';
      for (let k = -4; k <= 4; k++) {
        if (!k) continue;
        el(ctx, cx + k * 4.6 * u, 29 * u - Math.abs(k) * 0.3 * u, 3 * u, 1.8 * u, k % 2 ? '#6e9f3a' : '#4f7a2c');
      }
      break;
    case 'crown':
      poly(ctx, [cx - 16 * u, 30 * u, cx - 16 * u, 16 * u, cx - 9 * u, 24 * u, cx, 12 * u, cx + 9 * u, 24 * u, cx + 16 * u, 16 * u, cx + 16 * u, 30 * u], gold);
      el(ctx, cx, 24 * u, 2.5 * u, 2.5 * u, color);
      break;
    case 'nemes':
      // Striped royal headcloth.
      poly(ctx, [cx - 20 * u, 30 * u, cx, 14 * u, cx + 20 * u, 30 * u, cx + 26 * u, 66 * u, cx + 16 * u, 66 * u, cx + 17 * u, 34 * u, cx - 17 * u, 34 * u, cx - 16 * u, 66 * u, cx - 26 * u, 66 * u], gold);
      ctx.strokeStyle = st.palette.trim;
      ctx.lineWidth = 2 * u;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(cx - 20 * u - k * 1.5 * u, (36 + k * 8) * u);
        ctx.lineTo(cx - 17 * u, (36 + k * 8) * u);
        ctx.moveTo(cx + 17 * u, (36 + k * 8) * u);
        ctx.lineTo(cx + 20 * u + k * 1.5 * u, (36 + k * 8) * u);
        ctx.stroke();
      }
      break;
    case 'helm':
      ctx.fillStyle = '#9a9a9a';
      ctx.beginPath();
      ctx.ellipse(cx, 32 * u, 20 * u, 18 * u, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,25,10,0.7)';
      ctx.stroke();
      poly(ctx, [cx - 2 * u, 30 * u, cx + 2 * u, 30 * u, cx + 2 * u, 48 * u, cx - 2 * u, 48 * u], '#8a8a8a');
      poly(ctx, [cx - 20 * u, 32 * u, cx + 20 * u, 32 * u, cx + 20 * u, 36 * u, cx - 20 * u, 36 * u], '#7a7a7a');
      break;
    case 'flowers':
      for (let k = -3; k <= 3; k++) el(ctx, cx + k * 6 * u, 27 * u - (3 - Math.abs(k)) * u, 3.5 * u, 3.5 * u, k % 2 ? '#f26d8a' : '#f6e27a');
      break;
    case 'feathers':
      for (let k = -4; k <= 4; k++) {
        const ang = k * 0.22;
        ctx.save();
        ctx.translate(cx + k * 4 * u, 28 * u);
        ctx.rotate(ang);
        el(ctx, 0, -10 * u, 3.5 * u, 11 * u, k % 2 ? color : '#e8c547');
        ctx.restore();
      }
      poly(ctx, [cx - 19 * u, 26 * u, cx + 19 * u, 26 * u, cx + 19 * u, 31 * u, cx - 19 * u, 31 * u], '#c0392b');
      break;
    case 'cap':
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, 30 * u, 19 * u, 12 * u, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 'dogecap':
      poly(ctx, [cx - 18 * u, 32 * u, cx - 14 * u, 14 * u, cx + 4 * u, 8 * u, cx + 14 * u, 16 * u, cx + 18 * u, 32 * u], color);
      poly(ctx, [cx - 19 * u, 30 * u, cx + 19 * u, 30 * u, cx + 19 * u, 34 * u, cx - 19 * u, 34 * u], gold);
      break;
    case 'tophat':
      poly(ctx, [cx - 13 * u, 26 * u, cx - 13 * u, 4 * u, cx + 13 * u, 4 * u, cx + 13 * u, 26 * u], '#1d1d1d');
      poly(ctx, [cx - 22 * u, 26 * u, cx + 22 * u, 26 * u, cx + 22 * u, 30 * u, cx - 22 * u, 30 * u], '#1d1d1d');
      poly(ctx, [cx - 13 * u, 22 * u, cx + 13 * u, 22 * u, cx + 13 * u, 25 * u, cx - 13 * u, 25 * u], color, null);
      break;
    default:
      void hair;
  }
}
