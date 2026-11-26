import * as THREE from 'three';
import { scene } from './core.js';
import { groundH } from './mapdata.js';
import { applyShaderTo } from './shader.js';

/* ---------------- Abgetrennte Körperteile, Blut, Blutlachen ----------------
   severPart(): baut Stumpf + Wundfläche (Generator: gen.cut / gen.cap), löst das Teil vom Zombie und lässt es
   per einfacher Physik fliegen/rollen. Blut = Instanced-Tropfen (Pool), Lachen = Instanced-Kreise (Ringpuffer). */
const UP = new THREE.Vector3(0, 1, 0), T1 = new THREE.Vector3(), T2 = new THREE.Vector3();
const D1 = new THREE.Object3D(), D2 = new THREE.Object3D(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const rn = () => Math.random() - 0.5;

const MAXB = 320, MAXS = 220, MAXFLY = 28, MAXBLEED = 20;
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshBasicMaterial({ color: 0x8c0b0b }), MAXB);
const splats = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ color: 0x5e0606, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }), MAXS);
drops.frustumCulled = splats.frustumCulled = false;
for (let i = 0; i < MAXB; i++) drops.setMatrixAt(i, ZERO);
for (let i = 0; i < MAXS; i++) splats.setMatrixAt(i, ZERO);
scene.add(drops, splats);
const bp = Array.from({ length: MAXB }, () => ({ on: false, pos: new THREE.Vector3(), v: new THREE.Vector3(), s: 1 }));
let bi = 0, si = 0, active = 0;
const fly = [], bleed = [];

export function blood(pos, v, n = 1, sz = 1, sp = 1) {
  for (let i = 0; i < n; i++) {
    const o = bp[bi++ % MAXB]; if (!o.on) active++;
    o.on = true; o.pos.copy(pos); o.s = (0.5 + Math.random() * 1.2) * sz;
    o.v.copy(v); o.v.x += rn() * sp; o.v.y += (Math.random() - 0.3) * sp; o.v.z += rn() * sp;
  }
}
function splat(x, z, gh, sz) {
  D2.position.set(x, gh + 0.006, z); D2.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28); D2.scale.set(sz * (0.6 + Math.random()), sz * (0.6 + Math.random()), 1); D2.updateMatrix();
  splats.setMatrixAt(si++ % MAXS, D2.matrix); splats.instanceMatrix.needsUpdate = true;
}

export function severPart(z, pg, pt, dir) {
  const gen = z.gen, an = gen.cut(pg), hn = gen.cap(pg);
  applyShaderTo(an.parent); applyShaderTo(pg);
  z.root.updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(pg).getCenter(new THREE.Vector3()), h = new THREE.Group();
  h.position.copy(c); scene.add(h); h.updateMatrixWorld(true); h.attach(pg); h.updateMatrixWorld(true);
  let tot = 0; pg.traverse((o) => { if (o.isMesh) tot += o.geometry.attributes.position.count; });
  const stp = Math.max(1, Math.floor(tot / 500)), pts = [];
  pg.traverse((o) => { if (o.isMesh) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += stp) pts.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).sub(h.position)); } });
  const v = dir.clone().multiplyScalar(3 + Math.random() * 2.5); v.y += 1.5 + Math.random() * 2; v.x += rn() * 1.5; v.z += rn() * 1.5;
  fly.push({ h, v, w: new THREE.Vector3(rn() * 14, rn() * 14, rn() * 14), pts, rest: 0 });
  if (fly.length > MAXFLY) scene.remove(fly.shift().h);
  bleed.push({ node: hn, owner: h, t: 0, acc: 0, dur: 8, rate: 30 }, { node: an, owner: z.root, t: 0, acc: 0, dur: 10, rate: 34 });
  while (bleed.length > MAXBLEED) bleed.shift();
  blood(pt, T1.copy(dir).multiplyScalar(2), 26, 1, 3);
}

export function updateGore(dt) {
  if (active > 0) {
    let n = 0;
    for (let i = 0; i < MAXB; i++) {
      const o = bp[i]; if (!o.on) continue;
      o.v.y -= 9.8 * dt; o.pos.addScaledVector(o.v, dt);
      const gh = groundH(o.pos.x, o.pos.z);
      if (o.pos.y <= gh + 0.004) { splat(o.pos.x, o.pos.z, gh, 0.012 + o.s * 0.018); o.on = false; active--; drops.setMatrixAt(i, ZERO); n++; continue; }
      const sp = o.v.length(); D1.position.copy(o.pos); if (sp > 0.01) D1.quaternion.setFromUnitVectors(UP, T1.copy(o.v).divideScalar(sp));
      D1.scale.set(o.s, o.s * Math.min(3, 1 + sp * 0.25), o.s); D1.updateMatrix(); drops.setMatrixAt(i, D1.matrix); n++;
    }
    if (n) drops.instanceMatrix.needsUpdate = true;
  }
  for (const f of fly) {
    if (f.rest) continue;
    f.v.y -= 9.8 * dt; f.h.position.addScaledVector(f.v, dt); f.h.rotation.x += f.w.x * dt; f.h.rotation.y += f.w.y * dt; f.h.rotation.z += f.w.z * dt;
    let mn = 1e9; for (const p of f.pts) { T1.copy(p).applyQuaternion(f.h.quaternion); if (T1.y < mn) mn = T1.y; }
    const gh = groundH(f.h.position.x, f.h.position.z), lo = f.h.position.y + mn - gh;
    if (lo < 0) {
      f.h.position.y -= lo;
      if (f.v.y < -0.8) { f.v.y *= -0.3; f.v.x *= 0.65; f.v.z *= 0.65; f.w.multiplyScalar(0.5); blood(T2.set(f.h.position.x, gh + 0.02, f.h.position.z), T1.set(0, 0, 0), 6, 0.8, 1.6); splat(f.h.position.x, f.h.position.z, gh, 0.09); }
      else { f.v.y = 0; f.v.x *= 0.82; f.v.z *= 0.82; f.w.multiplyScalar(0.75); }
      if (f.v.length() < 0.3 && f.w.length() < 0.7) f.rest = 1;
    }
  }
  for (let i = bleed.length - 1; i >= 0; i--) {
    const b = bleed[i]; b.t += dt;
    if (b.t > b.dur || !b.owner.parent) { bleed.splice(i, 1); continue; }
    b.acc += dt * b.rate * (1 - b.t / b.dur);
    while (b.acc > 1) { b.acc--; b.node.updateWorldMatrix(true, false); b.node.getWorldPosition(T2); const sp = b.t < 0.9; blood(T2, sp ? T1.set(0, 1.6, 0) : T1.set(0, 0, 0), 1, sp ? 1.1 : 0.8, sp ? 2.2 : 0.3); }
  }
}
export function clearGore() {
  for (const f of fly) scene.remove(f.h); fly.length = 0; bleed.length = 0;
  for (let i = 0; i < MAXB; i++) { bp[i].on = false; drops.setMatrixAt(i, ZERO); } active = 0; drops.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < MAXS; i++) splats.setMatrixAt(i, ZERO); splats.instanceMatrix.needsUpdate = true;
}
