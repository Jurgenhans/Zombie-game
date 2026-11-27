import * as THREE from 'three';

/* ---------------- Zombie-LOD: weniger Dreiecke bei Entfernung ----------------
   Vertex-Clustering: Eckpunkte in einem Raster zusammenfassen, entartete Dreiecke entfernen.
   Gleiche Mesh-Reihenfolge wie das Original -> pro Zombie wird nur mesh.geometry getauscht. */
export const LOD_RATIO = [1, 0.5, 0.2];
export const LOD_DIST = [20, 30]; // ab 20 m 50 %, ab 30 m 20 %

function cluster(g, cell) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, ix = g.index.array, b = g.boundingBox;
  const map = new Map(), remap = new Int32Array(pos.count); let n = 0; const sp = [], sn = [], su = [], sc = [];
  for (let i = 0; i < pos.count; i++) {
    const key = ((Math.floor((pos.getX(i) - b.min.x) / cell) * 4096 + Math.floor((pos.getY(i) - b.min.y) / cell)) * 4096) + Math.floor((pos.getZ(i) - b.min.z) / cell);
    let c = map.get(key); if (c === undefined) { c = n++; map.set(key, c); sp.push(0, 0, 0); sn.push(0, 0, 0); su.push(0, 0); sc.push(0); }
    remap[i] = c; sc[c]++; sp[c * 3] += pos.getX(i); sp[c * 3 + 1] += pos.getY(i); sp[c * 3 + 2] += pos.getZ(i);
    if (nor) { sn[c * 3] += nor.getX(i); sn[c * 3 + 1] += nor.getY(i); sn[c * 3 + 2] += nor.getZ(i); }
    if (uv) { su[c * 2] += uv.getX(i); su[c * 2 + 1] += uv.getY(i); }
  }
  const index = [];
  for (let i = 0; i < ix.length; i += 3) { const a = remap[ix[i]], b2 = remap[ix[i + 1]], c = remap[ix[i + 2]]; if (a !== b2 && b2 !== c && a !== c) index.push(a, b2, c); }
  return { n, sp, sn, su, sc, index };
}
export function simplify(g, ratio) {
  if (!g.index || !g.attributes.position || g.attributes.position.count < 80) return g;
  g.computeBoundingBox(); const b = g.boundingBox, dim = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) || 1;
  const target = g.index.count / 3 * ratio; let k = Math.sqrt(g.attributes.position.count * ratio) * 0.9, r = null;
  for (let it = 0; it < 4; it++) {
    r = cluster(g, dim / k); const t = r.index.length / 3; if (Math.abs(t - target) < target * 0.2) break;
    k *= Math.sqrt(target / Math.max(1, t)) ** 1; k = Math.max(2, k);
  }
  if (r.index.length < 6) return g;
  const P = new Float32Array(r.n * 3), N = new Float32Array(r.n * 3), U = new Float32Array(r.n * 2), out = new THREE.BufferGeometry();
  for (let c = 0; c < r.n; c++) {
    const k2 = 1 / r.sc[c]; P[c * 3] = r.sp[c * 3] * k2; P[c * 3 + 1] = r.sp[c * 3 + 1] * k2; P[c * 3 + 2] = r.sp[c * 3 + 2] * k2;
    const l = Math.hypot(r.sn[c * 3], r.sn[c * 3 + 1], r.sn[c * 3 + 2]) || 1; N[c * 3] = r.sn[c * 3] / l; N[c * 3 + 1] = r.sn[c * 3 + 1] / l; N[c * 3 + 2] = r.sn[c * 3 + 2] / l;
    U[c * 2] = r.su[c * 2] * k2; U[c * 2 + 1] = r.su[c * 2 + 1] * k2;
  }
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setIndex(r.index); return out;
}
