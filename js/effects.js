import * as THREE from 'three';
import { rr, scene } from './core.js';

/* ---------------- Effekte ---------------- */
export const particles = [];
export const pGeo = new THREE.BoxGeometry(1, 1, 1);
export const pMats = { blood: new THREE.MeshBasicMaterial({ color: 0x8a0f0f }), spark: new THREE.MeshBasicMaterial({ color: 0xffd070 }), dust: new THREE.MeshBasicMaterial({ color: 0x9a968c, transparent: true, opacity: 0.7 }) };
for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(pGeo, pMats.blood); m.visible = false; scene.add(m); particles.push({ m, v: new THREE.Vector3(), life: 0, g: 0 }); }
export let pIdx = 0;
export function emit(pos, n, kind, speed, size, grav, dir) {
  for (let i = 0; i < n; i++) {
    const p = particles[pIdx++ % particles.length];
    p.m.material = pMats[kind]; p.m.visible = true; p.m.position.copy(pos); p.m.scale.setScalar(size * rr(0.6, 1.3));
    p.v.set(rr(-1, 1), rr(-0.2, 1), rr(-1, 1)).multiplyScalar(speed);
    if (dir) p.v.addScaledVector(dir, speed * 0.8);
    p.life = rr(0.3, 0.8); p.g = grav;
  }
}
export const decals = [];
export let dIdx = 0;
export const decalGeo = new THREE.CircleGeometry(0.07, 8), decalMat = new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(decalGeo, decalMat); m.visible = false; scene.add(m); decals.push(m); }
export function addDecal(pos, n) { const m = decals[dIdx++ % decals.length]; m.visible = true; m.position.copy(pos).addScaledVector(n, 0.012); m.lookAt(pos.x + n.x, pos.y + n.y, pos.z + n.z); }
export const tracers = [];
for (let i = 0; i < 12; i++) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.8 })); l.frustumCulled = false; l.visible = false; scene.add(l); tracers.push({ l, life: 0 });
}
export let tIdx = 0;
export function addTracer(a, b) { const t = tracers[tIdx++ % tracers.length], p = t.l.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; t.l.visible = true; t.life = 0.06; }
export function updateEffects(dt) {
  for (const p of particles) { if (!p.m.visible) continue; p.life -= dt; if (p.life <= 0) { p.m.visible = false; continue; } p.v.y -= p.g * dt; p.m.position.addScaledVector(p.v, dt); if (p.m.position.y < 0.02) { p.m.position.y = 0.02; p.v.set(0, 0, 0); } }
  for (const t of tracers) if (t.l.visible && (t.life -= dt) <= 0) t.l.visible = false;
}

