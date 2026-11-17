import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Deterministic procedural texture lab.
 *  Everything in the room is generated at runtime: no external assets.
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/* tileable value noise field -------------------------------------------------- */
function valueField(size, cells, rand) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const out = new Float32Array(size * size);
  const s = cells / size;
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = y * s;
    const y0 = Math.floor(fy) % cells;
    const y1 = (y0 + 1) % cells;
    const ty = smooth(fy - Math.floor(fy));
    for (let x = 0; x < size; x++) {
      const fx = x * s;
      const x0 = Math.floor(fx) % cells;
      const x1 = (x0 + 1) % cells;
      const tx = smooth(fx - Math.floor(fx));
      const a = g[y0 * cells + x0], b = g[y0 * cells + x1];
      const c = g[y1 * cells + x0], d = g[y1 * cells + x1];
      const top = a + (b - a) * tx;
      const bot = c + (d - c) * tx;
      out[y * size + x] = top + (bot - top) * ty;
    }
  }
  return out;
}

export function fbm(size, baseCells, octaves, rand, gain = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = valueField(size, baseCells << o, rand);
    for (let i = 0; i < out.length; i++) out[i] += f[i] * amp;
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function normalizeField(field) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < field.length; i++) {
    if (field[i] < lo) lo = field[i];
    if (field[i] > hi) hi = field[i];
  }
  const d = hi - lo || 1;
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - lo) / d;
  return field;
}

/* height field -> tangent space normal map ------------------------------------ */
function normalFromHeight(size, height, strength, outCanvas) {
  const c = outCanvas || makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const H = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const nx = -dx, ny = dy, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      d[i] = (nx * inv * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(size, field, lo = 0, hi = 1, gamma = 1) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    let v = field ? field[i] : 0;
    v = lo + (hi - lo) * Math.pow(Math.max(0, Math.min(1, v)), gamma);
    const p = Math.round(v * 255);
    d[i * 4] = p; d[i * 4 + 1] = p; d[i * 4 + 2] = p; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(canvas, repeatX = 1, repeatY = 1, srgb = false, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ *
 *  Seating velvet
 * ------------------------------------------------------------------ */
export function seatFabric() {
  const S = 512;
  const rand = mulberry32(1177);
  const nap = fbm(S, 32, 4, rand, 0.55);
  const broad = fbm(S, 4, 3, rand, 0.5);
  const fiber = fbm(S, 256, 2, rand, 0.6);
  normalizeField(nap); normalizeField(broad); normalizeField(fiber);

  const albedo = makeCanvas(S, S);
  const actx = albedo.getContext('2d');
  const aimg = actx.createImageData(S, S);
  const ad = aimg.data;

  const height = new Float32Array(S * S);
  const rough = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const weave = Math.sin(x * 0.9) * Math.sin(y * 0.9) * 0.5 + 0.5;
      const micro = Math.sin((x + y) * 2.2) * 0.5 + 0.5;
      // tiny perforations round the velvet cushion
      const px = (x % 32) - 16, py = (y % 32) - 16;
      const perf = Math.max(0, 1 - Math.hypot(px, py) / 2.6);
      const tone = 0.78 + broad[i] * 0.26 + (fiber[i] - 0.5) * 0.1 + weave * 0.045 - perf * 0.24;
      const r = 140 * tone;
      const g = 17 * tone + broad[i] * 6;
      const b = 17 * tone + broad[i] * 4;
      ad[i * 4] = Math.min(255, r);
      ad[i * 4 + 1] = Math.min(255, g);
      ad[i * 4 + 2] = Math.min(255, b);
      ad[i * 4 + 3] = 255;

      height[i] = nap[i] * 0.5 + fiber[i] * 0.5 - perf * 0.9 + micro * 0.06;
      rough[i] = 0.68 + broad[i] * 0.22 + (fiber[i] - 0.5) * 0.12;
    }
  }
  actx.putImageData(aimg, 0, 0);

  const normal = normalFromHeight(S, height, 1.35);
  return {
    map: tex(albedo, 1, 1, true),
    normalMap: tex(normal, 1, 1, false),
    roughnessMap: tex(grayCanvas(S, rough, 0, 1), 1, 1, false),
  };
}

/* ------------------------------------------------------------------ *
 *  Auditorium carpet
 * ------------------------------------------------------------------ */
export function carpet() {
  const S = 512;
  const rand = mulberry32(91);
  const speck = new Float32Array(S * S);
  for (let i = 0; i < speck.length; i++) speck[i] = rand();
  const weave = fbm(S, 128, 2, rand);
  const broad = fbm(S, 3, 3, rand);
  normalizeField(weave); normalizeField(broad);

  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const v = 0.075 + speck[i] * 0.055 + weave[i] * 0.03 + broad[i] * 0.03;
      d[i * 4] = 255 * (v * 0.85);
      d[i * 4 + 1] = 255 * (v * 0.86);
      d[i * 4 + 2] = 255 * (v * 0.95);
      d[i * 4 + 3] = 255;
      h[i] = speck[i] * 0.6 + weave[i] * 0.4;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: tex(c, 16, 16, true),
    normalMap: tex(normalFromHeight(S, h, 0.9), 16, 16, false),
  };
}

/* ------------------------------------------------------------------ *
 *  Dark lacquered timber (walls / proscenium towers)
 * ------------------------------------------------------------------ */
export function darkWood() {
  const S = 512;
  const rand = mulberry32(4021);
  const grain = fbm(S, 3, 5, rand, 0.62);
  const fine = fbm(S, 210, 2, rand, 0.5);
  normalizeField(grain); normalizeField(fine);

  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const vertical = Math.sin(y * 0.05 + grain[y * S] * 9) * 0.5 + 0.5;
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const streak = Math.sin(x * 0.16 + grain[i] * 24 + fine[i] * 6) * 0.5 + 0.5;
      const v = 0.035 + grain[i] * 0.028 + streak * 0.012 + vertical * 0.008;
      d[i * 4] = 255 * v * 1.22;
      d[i * 4 + 1] = 255 * v * 0.98;
      d[i * 4 + 2] = 255 * v * 0.86;
      d[i * 4 + 3] = 255;
      h[i] = fine[i] * 0.35 + streak * 0.3;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: tex(c, 1, 1, true),
    normalMap: tex(normalFromHeight(S, h, 0.5), 1, 1, false),
  };
}

/* ------------------------------------------------------------------ *
 *  Stage floor — sealed grey concrete
 * ------------------------------------------------------------------ */
export function concrete() {
  const S = 512;
  const rand = mulberry32(77);
  const blot = fbm(S, 4, 5, rand, 0.55);
  const spec = fbm(S, 180, 2, rand, 0.5);
  normalizeField(blot); normalizeField(spec);

  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const v = 0.29 + blot[i] * 0.15 + spec[i] * 0.06;
      d[i * 4] = 255 * v * 0.99;
      d[i * 4 + 1] = 255 * v;
      d[i * 4 + 2] = 255 * v * 0.96;
      d[i * 4 + 3] = 255;
      h[i] = spec[i] * 0.7 + blot[i] * 0.3;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: tex(c, 2, 4, true),
    normalMap: tex(normalFromHeight(S, h, 0.7), 2, 4, false),
    roughnessMap: tex(grayCanvas(S, blot, 0.42, 0.78), 2, 4, false),
  };
}

/* ------------------------------------------------------------------ *
 *  Painted plaster (ceiling soffit)
 * ------------------------------------------------------------------ */
export function plaster(tint = 0.82) {
  const S = 256;
  const rand = mulberry32(12309);
  const n = fbm(S, 8, 4, rand, 0.5);
  normalizeField(n);
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let i = 0; i < S * S; i++) {
    const v = tint - 0.06 + n[i] * 0.08;
    d[i * 4] = 255 * v; d[i * 4 + 1] = 255 * v * 0.985; d[i * 4 + 2] = 255 * v * 0.955; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, 3, 3, true) };
}


/* Suspended acoustic ceiling: 600mm mineral-fibre tiles with a fine fissure
   grain and a dark T-bar grid. Reads as a real soffit at grazing angles. */
export function ceilingTile() {
  const S = 512, N = 4;              // 4 x 4 tiles across the texture
  const cell = S / N;
  const rand = mulberry32(5150);
  const n = fbm(S, 96, 3, rand, 0.55);
  const f = fbm(S, 24, 2, rand, 0.5);
  normalizeField(n); normalizeField(f);
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const gx = Math.min(x % cell, cell - 1 - (x % cell));
      const gy = Math.min(y % cell, cell - 1 - (y % cell));
      const bar = Math.min(gx, gy);
      // dark T-bar in the last few pixels of every tile
      const grid = bar < 2.5 ? 0.32 + bar * 0.06 : 1;
      const base = 0.62 + n[i] * 0.14 + f[i] * 0.09;
      const v = base * grid;
      d[i * 4] = 255 * Math.min(1, v * 1.0);
      d[i * 4 + 1] = 255 * Math.min(1, v * 0.985);
      d[i * 4 + 2] = 255 * Math.min(1, v * 0.95);
      d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, 5, 5, true, 8);
}

/* ------------------------------------------------------------------ *
 *  Black drapery micro-texture (bump only)
 * ------------------------------------------------------------------ */
export function drapeTexture() {
  const S = 256;
  const rand = mulberry32(881);
  const n = fbm(S, 40, 3, rand, 0.55);
  const f = fbm(S, 128, 2, rand, 0.6);
  normalizeField(n); normalizeField(f);
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = n[i] * 0.55 + f[i] * 0.45;
  return {
    normalMap: tex(normalFromHeight(S, h, 0.55), 3, 3, false),
    roughnessMap: tex(grayCanvas(S, n, 0.7, 1), 3, 3, false),
  };
}

/* ------------------------------------------------------------------ *
 *  Projection screen surface
 * ------------------------------------------------------------------ */
export function screenSurface() {
  // power-of-two source: avoids the moiré the segmented plane used to show
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');

  // base vertical falloff — bright, near-white, warm only at the hem
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, '#ffffff');
  g.addColorStop(0.18, '#fdfbf6');
  g.addColorStop(0.35, '#e9e3d5');
  g.addColorStop(0.52, '#c4bdad');
  g.addColorStop(0.70, '#9e9787');
  g.addColorStop(0.85, '#847d6f');
  g.addColorStop(1.0, '#7a736a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // soft pools from the ceiling wash
  const pool = (x, y, rx, ry, a) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    rg.addColorStop(0, `rgba(255,253,246,${a})`);
    rg.addColorStop(0.45, `rgba(255,251,242,${a * 0.4})`);
    rg.addColorStop(1, 'rgba(255,251,242,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  pool(W * 0.27, H * 0.06, W * 0.28, H * 0.22, 1.0);
  pool(W * 0.73, H * 0.07, W * 0.26, H * 0.2, 0.9);
  pool(W * 0.5, H * 0.0, W * 0.55, H * 0.18, 0.7);

  // corner + edge vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.52, W * 0.2, W / 2, H * 0.52, W * 0.86);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(24,22,18,0.36)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  // very fine, low-amplitude weave (per pixel, no grid to alias)
  const rand = mulberry32(5150);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 3.2;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // a couple of faint vertical tension creases
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#5d584e';
  ctx.lineWidth = 2;
  for (const x of [W * 0.235, W * 0.66]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 3, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return tex(c, 1, 1, true, 8);
}

/* ------------------------------------------------------------------ *
 *  Exit sign face
 * ------------------------------------------------------------------ */
export function exitSign() {
  const W = 256, H = 128;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#03130a';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(120,255,185,0.16)');
  g.addColorStop(1, 'rgba(30,190,120,0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = '#c8ffe2';
  ctx.font = '600 76px "Inter", Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(120,255,190,0.95)';
  ctx.shadowBlur = 26;
  ctx.fillText('EXIT', W / 2, H / 2 + 4);
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(240,255,246,0.95)';
  ctx.fillText('EXIT', W / 2, H / 2 + 4);
  return tex(c, 1, 1, true, 4);
}


/* Baked wash for the stage apron. The deck sits right under the screen:
   it is grazed at the far end and fully lit at the front, so this is the
   inverse gradient the real lights need, with the sides falling away. */
export function apronWash() {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    // v = 1 sits at the screen end of the deck
    const v = y / (H - 1);
    let a = Math.min(1, Math.max(0, (v - 0.08) / 0.62));
    a = a * a * (3 - 2 * a);
    a *= 1 - 0.55 * Math.pow(Math.max(0, v - 0.72) / 0.28, 2);
    for (let x = 0; x < W; x++) {
      const u = Math.abs(x / (W - 1) - 0.5) * 2;
      const side = 1 - 0.34 * u * u;
      const i = (y * W + x) * 4;
      d[i] = 255;
      d[i + 1] = 246;
      d[i + 2] = 228;
      d[i + 3] = 255 * Math.max(0, a * side);
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, 1, 1, false, 2);
}

/* ------------------------------------------------------------------ *
 *  Glow sprite / dust
 * ------------------------------------------------------------------ */
export function glowSprite(inner = 'rgba(255,245,230,1)', outer = 'rgba(255,236,210,0)') {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, inner);
  g.addColorStop(0.5, 'rgba(255,238,214,0.16)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return tex(c, 1, 1, true, 1);
}

export function softDisc() {
  const S = 128;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return tex(c, 1, 1, false, 1);
}

/* ------------------------------------------------------------------ *
 *  Brushed metal (trim, handrails)
 * ------------------------------------------------------------------ */
export function brushedMetal() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const rand = mulberry32(333);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const v = 0.5 + (rand() - 0.5) * 0.05 + Math.sin(y * 1.7 + rand()) * 0.02;
      const p = v * 255;
      ctx.fillStyle = `rgb(${p},${p},${p})`;
      ctx.fillRect(x, y, 1, 1);
      h[i] = rand() * 0.4 + (Math.sin(x * 3.1) * 0.5 + 0.5) * 0.6;
    }
  }
  return {
    map: tex(c, 2, 2, true),
    normalMap: tex(normalFromHeight(S, h, 0.35), 2, 2, false),
  };
}

/* ------------------------------------------------------------------ *
 *  Seat upholstery weave for the front-of-house carpet runner
 * ------------------------------------------------------------------ */
export function aisleRunner() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0c0e';
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#6b5a4a';
  for (let i = 0; i < S; i += 16) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return { map: tex(c, 8, 8, true) };
}
