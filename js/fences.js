import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lambert } from './core.js';
import { addBox, groundH, mapRoot } from './mapdata.js';

/* ---------------- Festival-/Absperrgitter vor Eingängen ----------------
   Ein Modul = 2,2 m breit, 1,1 m hoch (Rahmen, Stäbe, Standfüße). Alle Module einer Karte = ein InstancedMesh. */
const W = 2.2, H = 1.1;
let geo = null, mat = null;
const list = [];
function moduleGeo() {
  if (geo) return geo;
  const parts = [], box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  box(W, 0.035, 0.035, 0, H - 0.04, 0); box(W, 0.035, 0.035, 0, 0.14, 0);                         // obere/untere Querstrebe
  for (const sx of [-1, 1]) { box(0.04, H, 0.04, sx * (W / 2 - 0.02), H / 2, 0); box(0.05, 0.04, 0.6, sx * (W / 2 - 0.02), 0.02, 0); } // Pfosten + Standfüße
  const n = 11; for (let i = 1; i < n; i++) box(0.012, H - 0.2, 0.012, -W / 2 + 0.04 + i * (W - 0.08) / n, 0.6, 0);  // Stäbe
  geo = mergeGeometries(parts, false); mat = lambert(0x9ea4aa); return geo;
}
export function resetFences() { list.length = 0; }
// Reihe aus 3 Modulen vor einer Tür: (px,pz) = Türmitte an der Wand, (ax,az) = Richtung nach außen
export function addFenceLine(px, pz, ax, az, rng) {
  const d = 3.0, tx = -az, tz = ax;
  for (let k = -1; k <= 1; k++) {
    const x = px + ax * d + tx * k * (W - 0.05), z = pz + az * d + tz * k * (W - 0.05);
    list.push({ x, z, ry: (ax !== 0 ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.06 });
    addBox(x, z, ax !== 0 ? 0.3 : W, ax !== 0 ? W : 0.3, H);
  }
}
export function finalizeFences() {
  if (!list.length) return;
  const g = moduleGeo(), im = new THREE.InstancedMesh(g, mat, list.length), o = new THREE.Object3D();
  list.forEach((f, i) => { o.position.set(f.x, groundH(f.x, f.z), f.z); o.rotation.set(0, f.ry, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.frustumCulled = false; mapRoot.add(im); list.length = 0;
}
