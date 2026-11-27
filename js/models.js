import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildZombie, disposeZombie } from '../zombiegen.js';
import { rr } from './core.js';
import { LOD_DIST, LOD_RATIO, simplify } from './lod.js';
import { player } from './state.js';
import { zombies } from './zombies.js';

/* ---------------- Humanoid (Spieler & Zombies) ---------------- */
// Prozedurales Fallback-Modell – aufgebaut nach den Spezifikationen aus den GLB-Dateien (Hautfarbe, Kleidung …).
export function buildHumanoid(spec) {
  const g = new THREE.Group(); const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const skin = mat(spec.skin), top = mat(spec.top), bot = mat(spec.bot), shoe = mat(spec.shoe || 0x222222);
  const part = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (parent || g).add(b); return b; };
  const parts = {};
  parts.torso = new THREE.Group(); parts.torso.position.set(0, 0.85, 0); g.add(parts.torso);
  part(0.46, 0.62, 0.26, top, 0, 0.32, 0, parts.torso);
  part(0.2, 0.08, 0.2, skin, 0, 0.66, 0, parts.torso);
  parts.head = new THREE.Group(); parts.head.position.set(0, 0.72, 0); parts.torso.add(parts.head);
  part(0.24, 0.26, 0.24, skin, 0, 0.14, 0, parts.head);
  if (spec.hair) part(0.26, 0.1, 0.27, mat(spec.hair), 0, 0.28, -0.01, parts.head);
  if (spec.eyes) { const e = new THREE.MeshBasicMaterial({ color: spec.eyes }); part(0.05, 0.03, 0.02, e, -0.06, 0.17, 0.125, parts.head); part(0.05, 0.03, 0.02, e, 0.06, 0.17, 0.125, parts.head); }
  const arm = (sx) => { const a = new THREE.Group(); a.position.set(sx * 0.3, 0.58, 0); parts.torso.add(a); part(0.14, 0.34, 0.14, top, 0, -0.17, 0, a); const fa = new THREE.Group(); fa.position.set(0, -0.34, 0); a.add(fa); part(0.12, 0.3, 0.12, spec.sleeveLong ? top : skin, 0, -0.15, 0, fa); part(0.12, 0.1, 0.12, skin, 0, -0.34, 0, fa); a.fore = fa; return a; };
  parts.armL = arm(-1); parts.armR = arm(1);
  const leg = (sx) => { const l = new THREE.Group(); l.position.set(sx * 0.12, 0.85, 0); g.add(l); part(0.18, 0.44, 0.2, bot, 0, -0.22, 0, l); part(0.16, 0.38, 0.18, bot, 0, -0.62, 0, l); part(0.18, 0.08, 0.3, shoe, 0, -0.81, 0.05, l); return l; };
  parts.legL = leg(-1); parts.legR = leg(1);
  if (spec.blood) { const bm = new THREE.MeshBasicMaterial({ color: 0x6a0c0c }); for (let i = 0; i < spec.blood; i++) part(rr(0.08, 0.18), rr(0.08, 0.2), 0.02, bm, rr(-0.2, 0.2), rr(0.1, 0.5), 0.14, parts.torso); }
  g.parts = parts; return g;
}
export const ZOMBIE_SPEC = { skin: 0xa39588, top: 0x3d4a3a, bot: 0x2a2a30, shoe: 0x1a1a1a, hair: 0x2b2620, eyes: 0xff3322, blood: 5, sleeveLong: false };
export const PLAYER_SPEC = { skin: 0xe0ac82, top: 0x3366aa, bot: 0x222222, shoe: 0xeeeeee, hair: 0x1a1410, sleeveLong: true };

export const models = { player: null, zombies: [], genOk: false };
// Generator-Varianten mit Cache (LRU) – nicht mehr benutzte Zombies werden freigegeben, damit der Speicher nicht wächst
export const variantCache = new Map();
export function getVariant(idx) {
  let g = variantCache.get(idx);
  if (g) { variantCache.delete(idx); variantCache.set(idx, g); return g; }
  g = buildZombie(idx); g.userData.refs = 0; variantCache.set(idx, g);
  for (const [k, v] of variantCache) { if (variantCache.size <= 40) break; if (v.userData.refs === 0 && k !== idx) { disposeZombie(v); (lodMap.get(v) || []).forEach((gs) => gs && gs.forEach((g) => g.dispose())); lodMap.delete(v); variantCache.delete(k); } }
  return g;
}
// LOD: vereinfachte Geometrien je Variante (gleiche Mesh-Reihenfolge wie das Original), nur bei Bedarf berechnet
const lodMap = new WeakMap();
export const meshList = (o) => { const a = []; o.traverse((m) => { if (m.isMesh) a.push(m); }); return a; };
export function getLodGeos(gen, lod) {
  let e = lodMap.get(gen); if (!e) lodMap.set(gen, (e = []));
  return e[lod] || (e[lod] = meshList(gen).map((m) => simplify(m.geometry, LOD_RATIO[lod])));
}
export function applyLod(z, lod) {
  if (!z.gen || z.lod === lod) return;
  const geos = lod ? getLodGeos(z.gen, lod) : z.geos0;
  for (let i = 0; i < z.meshes.length; i++) z.meshes[i].geometry = geos[i];
  z.lod = lod;
}
export function updateLod(z, dist) { // mit Hysterese (2 m), damit nichts flackert
  let l = z.lod || 0;
  while (l < 2 && dist > LOD_DIST[l]) l++;
  while (l > 0 && dist < LOD_DIST[l - 1] - 2) l--;
  applyLod(z, l);
}
export const releaseZombie = (z) => { if (z.gen && !z.released) { z.gen.userData.refs--; z.released = true; } };
// Gelenk-Wrapper: Animationswerte werden zur Grundpose des Generator-Zombies addiert
export function limb(node, kind) {
  if (!node) return { rotation: { x: 0, y: 0, z: 0 } }; // Teil fehlt (z.B. Armstumpf) -> Platzhalter, damit die Animation nichts prüfen muss
  const b = node.rotation.clone(), o = { rotation: {} };
  for (const ax of ['x', 'y', 'z']) Object.defineProperty(o.rotation, ax, { get: () => 0, set: (v) => { node.rotation[ax] = b[ax] + (kind === 'arm' && ax === 'x' ? v + 1.35 : kind === 'torso' && ax === 'x' ? v - 0.2 : v); } });
  return o;
}
// Gelenke des Zombie-GLB (Knoten-Indizes aus der Datei) -> Pivot-Gruppen, damit sie per Code animiert werden können
// Knoten 9/18 = Hüfte/Beine (y≈0.95), 34/46 = Schultern/Arme (im Oberkörper-Knoten 74), 33/45 = Unterarme, 73 = Kopf
export const ZOMBIE_RIG = { head: 73, armL: 34, armR: 46, foreL: 33, foreR: 45, legL: 9, legR: 18 };
export async function rigZombie(gltf, wrap) {
  for (const [name, idx] of Object.entries(ZOMBIE_RIG)) {
    const n = await gltf.parser.getDependency('node', idx);
    if (!n || !n.parent) continue;
    const parent = n.parent, pv = new THREE.Group(); pv.name = 'pv_' + name;
    pv.position.copy(n.position); n.position.set(0, 0, 0);
    parent.add(pv); pv.add(n);
  }
  gltf.scene.updateMatrixWorld(true);
  const hp = gltf.scene.getObjectByName('pv_head'); if (hp) { const v = new THREE.Vector3(); hp.getWorldPosition(v); wrap.userData.headY = v.y + 0.12; }
}
export async function tryLoadModel(url, rig) {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = gltf.scene;
    root.traverse((o) => { // PBR -> Lambert (schneller auf Tablets, passt zu Beleuchtung & Shader-Optionen)
      if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { const m = o.material; o.material = new THREE.MeshLambertMaterial({ color: m.color, map: m.map, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors }); }
    });
    const wrap = new THREE.Group();
    if (rig) await rig(gltf, wrap);
    const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size);
    if (!isFinite(size.y) || size.y < 0.01) return null;
    const k = 1.8 / size.y; root.scale.multiplyScalar(k);
    const b2 = new THREE.Box3().setFromObject(root); root.position.y -= b2.min.y; wrap.add(root);
    if (wrap.userData.headY !== undefined) wrap.userData.headY = wrap.userData.headY * k + root.position.y; // nach Skalierung/Verschiebung
    return wrap;
  } catch (e) { console.warn('Modell nicht geladen (Fallback aktiv):', url, e && e.message); return null; }
}

