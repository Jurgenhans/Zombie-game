import * as THREE from 'three';
import { clamp } from './core.js';
import { HALF, boxes } from './mapdata.js';


/* Kollision & Boden */
export function resolveCircle(pos, r, feetY, stepH) {
  for (const b of boxes) {
    if (b.top <= feetY + stepH) continue;
    if (b.y0 && feetY + 1.8 <= b.y0) continue;
    const cx = clamp(pos.x, b.x0, b.x1), cz = clamp(pos.z, b.z0, b.z1);
    let dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
    else { // Mittelpunkt im Kasten: auf kürzestem Weg hinaus
      const l = pos.x - b.x0, rgt = b.x1 - pos.x, f = pos.z - b.z0, bk = b.z1 - pos.z, m = Math.min(l, rgt, f, bk);
      if (m === l) pos.x = b.x0 - r; else if (m === rgt) pos.x = b.x1 + r; else if (m === f) pos.z = b.z0 - r; else pos.z = b.z1 + r;
    }
  }
  pos.x = clamp(pos.x, -HALF + r, HALF - r); pos.z = clamp(pos.z, -HALF + r, HALF - r);
}
export function supportY(x, z, feetY, r, stepH) {
  let y = 0;
  for (const b of boxes) {
    if (b.y0 || b.top > feetY + stepH || b.top <= y) continue;
    if (x > b.x0 - r * 0.6 && x < b.x1 + r * 0.6 && z > b.z0 - r * 0.6 && z < b.z1 + r * 0.6) y = b.top;
  }
  return y;
}
export const _o = new THREE.Vector3();
export function rayBox(o, d, b, maxT) { // -> {t, nx, nz} | null
  let t0 = 0, t1 = maxT, nx = 0, nz = 0, ny = 0;
  const axes = [[o.x, d.x, b.x0, b.x1, 0], [o.y, d.y, b.y0 || 0, b.top, 1], [o.z, d.z, b.z0, b.z1, 2]];
  for (const [oo, dd, lo, hi, ax] of axes) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return null; continue; }
    let ta = (lo - oo) / dd, tb = (hi - oo) / dd, sgn = -1;
    if (ta > tb) { const s = ta; ta = tb; tb = s; sgn = 1; }
    if (ta > t0) { t0 = ta; nx = ax === 0 ? sgn : 0; ny = ax === 1 ? sgn : 0; nz = ax === 2 ? sgn : 0; }
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return { t: t0, nx, ny, nz };
}
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc; if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc); return t >= 0 ? t : (-b + Math.sqrt(disc) >= 0 ? 0 : Infinity);
}

