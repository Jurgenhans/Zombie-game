// Kleine, seed-basierte Rausch-Funktionen (ohne Abhängigkeiten).
// Optional "periodisch", damit Texturen nahtlos kacheln.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (a, n) => ((a % n) + n) % n;

// Value Noise 0..1. period > 0 => Muster wiederholt sich alle `period` Gitterzellen.
export function valueNoise(x, y, seed = 0, period = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  let ix = x0, iy = y0, jx = x0 + 1, jy = y0 + 1;
  if (period > 0) { ix = wrap(ix, period); jx = wrap(jx, period); iy = wrap(iy, period); jy = wrap(jy, period); }
  const a = hash(ix, iy, seed), b = hash(jx, iy, seed);
  const c = hash(ix, jy, seed), d = hash(jx, jy, seed);
  const u = fade(fx), v = fade(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal Brownian Motion 0..1
export function fbm(x, y, seed = 0, octaves = 4, period = 0) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 131, period ? period * f : 0);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;
