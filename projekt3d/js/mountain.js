// Der Berg auf Feld 36 (östlich vom Dorf). Die Welt ist sonst flach, deshalb gibt es
// hier eine reine Höhenfunktion, die Spieler, Zombies, Schüsse und Kamera abfragen,
// und ein Gitter-Mesh (2 m Raster) mit Farben Gras -> Fels -> Schnee.

import * as THREE from 'three';
import { FIELD_SIZE, GRID } from './config.js';

export const MOUNTAIN_FIELD = 36;
const idx = MOUNTAIN_FIELD - 1;
const X0 = (idx % GRID) * FIELD_SIZE;
const Z0 = Math.floor(idx / GRID) * FIELD_SIZE;
export const MOUNTAIN = { x0: X0, z0: Z0, cx: X0 + FIELD_SIZE / 2, cz: Z0 + FIELD_SIZE / 2, half: FIELD_SIZE / 2, peak: 45 };

// Höhe in Metern; 0 (mit Steigung 0) am Feldrand, damit es keine Kante zur flachen Welt gibt
export function mountainHeight(x, z) {
  const m = MOUNTAIN;
  const dx = (x - m.cx) / m.half, dz = (z - m.cz) / m.half;
  if (Math.abs(dx) >= 1 || Math.abs(dz) >= 1) return 0;
  const r2 = dx * dx + dz * dz;
  if (r2 >= 1) return 0;
  const t = 1 - r2;
  // Grundform + sanfte Unebenheiten (zum Rand hin ausgeblendet)
  const bump = 1 + 0.08 * Math.sin(dx * 7.3 + 1.1) * Math.cos(dz * 6.1) + 0.03 * Math.sin(dx * 15 - dz * 12);
  return m.peak * t * t * bump;
}

export function createMountain() {
  const m = MOUNTAIN, seg = FIELD_SIZE / 2;                  // 2-m-Raster
  const geo = new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE, seg, seg).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x5b8a3c), rock = new THREE.Color(0x7d786f), snow = new THREE.Color(0xf2f6fa), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + m.cx, z = pos.getZ(i) + m.cz, h = mountainHeight(x, z);
    pos.setXYZ(i, pos.getX(i), h, pos.getZ(i));
    const k = h / m.peak, n = Math.sin(x * 0.9) * Math.cos(z * 0.8) * 0.04;
    if (k < 0.3) c.copy(grass).lerp(rock, Math.max(0, (k + n) / 0.3));
    else c.copy(rock).lerp(snow, Math.min(1, Math.max(0, (k + n - 0.55) / 0.15)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  mesh.position.set(m.cx, 0, m.cz);
  mesh.frustumCulled = false;
  return mesh;
}
