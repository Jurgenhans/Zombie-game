// Prozedurale, nahtlos kachelnde Bodentexturen (Gras, Fels, Schnee).
// Werden beim Start per Canvas erzeugt, es sind keine Bilddateien nötig.

import * as THREE from 'three';
import { fbm, valueNoise, smoothstep, mix } from './noise.js';

const SIZE = 512;

function paint(fn) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = fn(x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const scale3 = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

function grass(u, v) {
  const low = fbm(u * 4, v * 4, 1, 4, 4);
  const fine = fbm(u * 64, v * 64, 2, 2, 64);
  const blades = fbm(u * 128, v * 48, 3, 2, 128);          // feine Halme
  const patch = smoothstep(0.6, 0.8, fbm(u * 3, v * 3, 5, 3, 3));
  let c = lerp3([48, 108, 38], [108, 164, 60], low);
  c = lerp3(c, [150, 156, 66], patch * 0.28);
  return scale3(c, 0.78 + fine * 0.3 + (blades - 0.5) * 0.18);
}

function rock(u, v) {
  const n = fbm(u * 6, v * 6, 11, 5, 6);
  const ridge = 1 - Math.abs(2 * fbm(u * 5, v * 5, 13, 4, 5) - 1);
  const crack = smoothstep(0.955, 0.99, ridge);
  const speck = fbm(u * 96, v * 96, 17, 2, 96);
  let c = lerp3([92, 88, 84], [170, 162, 152], n);
  c = lerp3(c, [120, 104, 92], smoothstep(0.55, 0.8, fbm(u * 3, v * 3, 19, 3, 3)) * 0.3); // leicht bräunlich
  return scale3(c, (1 - crack * 0.32) * (0.86 + speck * 0.28));
}

function snow(u, v) {
  const n = fbm(u * 3, v * 3, 23, 4, 3);
  const drift = fbm(u * 8, v * 8, 31, 3, 8);
  const speck = fbm(u * 128, v * 128, 29, 2, 128);
  let c = lerp3([212, 226, 242], [252, 253, 255], n);
  c = lerp3(c, [236, 242, 250], drift * 0.5);
  return scale3(c, 0.96 + (speck - 0.5) * 0.05);
}

function toTexture(canvas, maxAniso) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

export function createGroundTextures(maxAniso = 8) {
  return {
    grass: toTexture(paint(grass), maxAniso),
    rock: toTexture(paint(rock), maxAniso),
    snow: toTexture(paint(snow), maxAniso),
  };
}
