// Map-Erzeugung: welches der 100 Felder ist Gras / Fels / Schnee,
// plus eine "Splat-Map" (Mischgewichte), mit der der Boden gezeichnet wird.
// Reines JavaScript, kein Three.js nötig -> auch in Node testbar.

import { GRID, FIELD_SIZE, FIELD_COUNT, MAP_SIZE, MAP_SEED, BIOME, BIOME_SHARE } from './config.js';
import { fbm, mulberry32 } from './noise.js';

// Nummer (1..100) <-> Zeile/Spalte. Nummer 1 = oben links (Nordwesten), zeilenweise nach rechts.
export const fieldIndex = (row, col) => row * GRID + col;           // 0..99
export const fieldNumber = (index) => index + 1;                    // 1..100
export const fieldRowCol = (index) => ({ row: Math.floor(index / GRID), col: index % GRID });
export const fieldCenter = (index) => {
  const { row, col } = fieldRowCol(index);
  return { x: (col + 0.5) * FIELD_SIZE, z: (row + 0.5) * FIELD_SIZE };
};
export function fieldAtWorld(x, z) {
  const col = Math.min(GRID - 1, Math.max(0, Math.floor(x / FIELD_SIZE)));
  const row = Math.min(GRID - 1, Math.max(0, Math.floor(z / FIELD_SIZE)));
  return fieldIndex(row, col);
}

// Genau 70 Gras-, 20 Fels- und 10 Schneefelder. Die Felder werden nach einem
// weichen Rauschwert sortiert: höchste Werte = Schnee, danach Fels, Rest Gras.
// So entstehen zusammenhängende Gebiete statt Streusel.
export function generateFieldBiomes(seed = MAP_SEED) {
  const rng = mulberry32(seed);
  const scored = [];
  for (let i = 0; i < FIELD_COUNT; i++) {
    const { row, col } = fieldRowCol(i);
    const s = fbm(col * 0.3 + 3.1, row * 0.3 + 7.7, seed, 3) + rng() * 0.002;
    scored.push({ i, s });
  }
  scored.sort((a, b) => b.s - a.s);
  const nSnow = Math.round(FIELD_COUNT * BIOME_SHARE.snow / 100);
  const nRock = Math.round(FIELD_COUNT * BIOME_SHARE.rock / 100);
  const biomes = new Array(FIELD_COUNT).fill(BIOME.GRASS);
  scored.forEach((e, rank) => {
    if (rank < nSnow) biomes[e.i] = BIOME.SNOW;
    else if (rank < nSnow + nRock) biomes[e.i] = BIOME.ROCK;
  });
  return biomes;
}

export function countBiomes(biomes) {
  const c = [0, 0, 0];
  biomes.forEach((b) => c[b]++);
  return c;
}

// Splat-Map: size x size Pixel, RGBA8. R = Gras, G = Fels, B = Schnee.
// Die Feldgrenzen werden mit Rauschen verbogen und weich verblendet,
// damit die Übergänge natürlich aussehen. Die Felder bleiben im Kern exakt gleich.
export function buildSplat(biomes, seed = MAP_SEED, size = 512) {
  const w = [new Float32Array(size * size), new Float32Array(size * size), new Float32Array(size * size)];
  const warpAmp = 38; // Meter
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = ((px + 0.5) / size) * MAP_SIZE;
      const wz = ((py + 0.5) / size) * MAP_SIZE;
      const dx = (fbm(wx / 95, wz / 95, seed + 11, 3) - 0.5) * 2 * warpAmp;
      const dz = (fbm(wx / 95 + 50, wz / 95 + 50, seed + 23, 3) - 0.5) * 2 * warpAmp;
      const col = Math.min(GRID - 1, Math.max(0, Math.floor((wx + dx) / FIELD_SIZE)));
      const row = Math.min(GRID - 1, Math.max(0, Math.floor((wz + dz) / FIELD_SIZE)));
      w[biomes[fieldIndex(row, col)]][py * size + px] = 1;
    }
  }
  const radius = 3;
  const blurred = w.map((ch) => boxBlur(boxBlur(ch, size, radius, true), size, radius, false));
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const r = blurred[0][i], g = blurred[1][i], b = blurred[2][i];
    const sum = r + g + b || 1;
    out[i * 4] = Math.round((r / sum) * 255);
    out[i * 4 + 1] = Math.round((g / sum) * 255);
    out[i * 4 + 2] = Math.round((b / sum) * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

function boxBlur(src, size, radius, horizontal) {
  const dst = new Float32Array(src.length);
  const n = radius * 2 + 1;
  for (let a = 0; a < size; a++) {
    let acc = 0;
    const get = (b) => {
      const bb = Math.min(size - 1, Math.max(0, b));
      return horizontal ? src[a * size + bb] : src[bb * size + a];
    };
    for (let b = -radius; b <= radius; b++) acc += get(b);
    for (let b = 0; b < size; b++) {
      if (horizontal) dst[a * size + b] = acc / n; else dst[b * size + a] = acc / n;
      acc += get(b + radius + 1) - get(b - radius);
    }
  }
  return dst;
}

// Das Gras-Feld, das der Kartenmitte am nächsten liegt: Startpunkt des Spielers.
export function findSpawnField(biomes) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (biomes[i] !== BIOME.GRASS) continue;
    const c = fieldCenter(i);
    const d = (c.x - MAP_SIZE / 2) ** 2 + (c.z - MAP_SIZE / 2) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
