import * as THREE from 'three';
import { settings } from './config.js';
import { canvasTex, hashXZ, lambert } from './core.js';
import { mapRoot } from './mapdata.js';
import { alive } from './zombies.js';


/* ============================================================
   Straßenlaternen: Lampenkopf + Nachtbeleuchtung
   - Lichtpfützen (Boden) und Glow = je 1 Draw-Call für ALLE Laternen
   - echte Lichter nur an den nächsten Laternen (LAMP.lightCount), das spart Leistung
   - einige Laternen sind kaputt (aus) oder flackern (ohne rnd() -> Map bleibt gleich)
   ============================================================ */
export const LAMP = { list: [], alive: [], ready: false, lightCount: 3, lights: [], bulbOn: null, pools: null, halos: null, haloCol: null, poolCol: null, flick: [] };
export function mergeBoxes(parts) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  for (const [sx, sy, sz, x, y, z] of parts) {
    const b = new THREE.BoxGeometry(sx, sy, sz); b.translate(x, y, z);
    pos.push(...b.attributes.position.array); nor.push(...b.attributes.normal.array); uv.push(...b.attributes.uv.array);
    for (const i of b.index.array) idx.push(i + off);
    off += b.attributes.position.count; b.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); return geo;
}
export let _lampA = null;
export function lampAssets() { // Koordinaten relativ zur Mitte des Mastes (Mast: y -3 … +3), Arm zeigt nach -X
  return _lampA || (_lampA = {
    head: mergeBoxes([[1.5, 0.07, 0.07, -0.75, 2.92, 0], [0.12, 0.2, 0.12, -0.04, 2.9, 0], [0.52, 0.1, 0.3, -1.45, 2.86, 0], [0.58, 0.035, 0.35, -1.45, 2.94, 0]]),
    lens: new THREE.BoxGeometry(0.42, 0.02, 0.2).translate(-1.45, 2.795, 0),
    metal: lambert(0x3a3d3f), bulbDead: new THREE.MeshBasicMaterial({ color: 0x2a2c2d }),
  });
}
export function addLampHead(pole, x, z, typeA) {
  const A = lampAssets(), h = hashXZ(x, z), dead = h % 7 === 0, flick = !dead && h % 11 === 0;
  if (!LAMP.bulbOn) LAMP.bulbOn = new THREE.MeshBasicMaterial({ color: 0xa8aaa6 });
  const ry = typeA ? 0 : -Math.PI / 2;
  const arm = new THREE.Mesh(A.head, A.metal); arm.rotation.y = ry; pole.add(arm);
  const bulb = new THREE.Mesh(A.lens, dead ? A.bulbDead : LAMP.bulbOn); bulb.rotation.y = ry; pole.add(bulb);
  LAMP.list.push({ x: typeA ? x - 1.45 : x, z: typeA ? z : z - 1.45, dead, flick, ph: (h % 100) / 10 });
}
export function radialTex(S, stops) {
  return canvasTex(S, S, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false);
}
export function finalizeLamps() {
  const L = LAMP.alive = LAMP.list.filter((l) => !l.dead), N = L.length;
  if (!N) return;
  // Lichtpfützen auf dem Boden (1 InstancedMesh)
  const poolTex = radialTex(128, [[0, 'rgba(255,214,150,.6)'], [0.4, 'rgba(255,190,110,.28)'], [1, 'rgba(255,170,90,0)']]);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N);
  const d = new THREE.Object3D(), white = new THREE.Color(1, 1, 1);
  L.forEach((l, i) => { d.position.set(l.x, 0.05, l.z); d.scale.setScalar(13); d.updateMatrix(); pools.setMatrixAt(i, d.matrix); pools.setColorAt(i, white); l.i = i; if (l.flick) LAMP.flick.push(l); });
  pools.frustumCulled = false; pools.visible = false; mapRoot.add(pools); LAMP.pools = pools;
  // Glow um die Lampen (1 Points-Objekt)
  const hp = new Float32Array(N * 3), hc = new Float32Array(N * 3).fill(1);
  L.forEach((l, i) => hp.set([l.x, 5.78, l.z], i * 3));
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hg.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  const haloTex = radialTex(64, [[0, 'rgba(255,240,200,1)'], [0.18, 'rgba(255,215,150,.65)'], [0.5, 'rgba(255,180,100,.18)'], [1, 'rgba(255,160,80,0)']]);
  const halos = new THREE.Points(hg, new THREE.PointsMaterial({ map: haloTex, size: 2.4, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halos.frustumCulled = false; halos.visible = false; mapRoot.add(halos); LAMP.halos = halos; LAMP.haloCol = hg.attributes.color;
  // Echte Lichter (werden nachts zu den nächsten Laternen bewegt)
  for (let i = 0; i < LAMP.lightCount; i++) { const pl = new THREE.PointLight(0xffc878, 0, 20, 2); pl.visible = false; mapRoot.add(pl); LAMP.lights.push(pl); }
  LAMP.ready = true;
  applyLampNight(settings.night);
}
export function applyLampNight(n) {
  if (!LAMP.ready) return;
  LAMP.bulbOn.color.setHex(n ? 0xffe9b8 : 0xa8aaa6);
  LAMP.pools.visible = LAMP.halos.visible = n;
  LAMP.lights.forEach((l) => { l.visible = n; });
}
export const lampLevel = (l, t) => (l.flick ? (Math.sin(t * 31 + l.ph) * Math.sin(t * 5.3 + l.ph * 2.1) > 0.55 ? 0.08 : 1) : 1);
export function updateLamps(t, p) {
  if (!LAMP.ready || !settings.night) return;
  // Flackernde Laternen
  if (LAMP.flick.length) {
    const c = new THREE.Color();
    for (const l of LAMP.flick) { const v = lampLevel(l, t); LAMP.haloCol.setXYZ(l.i, v, v, v); LAMP.pools.setColorAt(l.i, c.setRGB(v, v, v)); }
    LAMP.haloCol.needsUpdate = true; LAMP.pools.instanceColor.needsUpdate = true;
  }
  // Die nächsten Laternen bekommen ein echtes Licht
  const K = LAMP.lights.length, best = [];
  for (const l of LAMP.alive) {
    const d2 = (l.x - p.x) * (l.x - p.x) + (l.z - p.z) * (l.z - p.z);
    if (best.length < K || d2 < best[best.length - 1].d2) { best.push({ l, d2 }); best.sort((a, b) => a.d2 - b.d2); if (best.length > K) best.pop(); }
  }
  LAMP.lights.forEach((pl, i) => { const b = best[i]; if (!b) { pl.intensity = 0; return; } pl.position.set(b.l.x, 5.6, b.l.z); pl.intensity = 55 * lampLevel(b.l, t); });
}

