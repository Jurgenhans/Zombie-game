import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ============================================================
   DEAD CITY – 3D Zombie Shooter (Three.js, Android via Capacitor)
   ============================================================ */

const CONFIG = {
  mapSize: 250,
  wavesEnabled: false,      // Zombie-Wellen: kommt später -> auf true setzen, um sie zu aktivieren
  trainingZombies: 6,       // Übungsziele solange keine Wellen aktiv sind (0 = keine)
  playerModelUrl: 'assets/models/player.glb',
  zombieModelUrl: 'assets/models/zombie.glb',
  walkSpeed: 3.8, sprintSpeed: 6.4, jumpSpeed: 7.4, gravity: 22,
  eyeHeight: 1.7, playerRadius: 0.4, playerMaxHp: 100,
  lookSensitivity: 0.0042,
};

const WEAPONS = [
  { name: 'PISTOLE', dmg: 28, pellets: 1, spread: 0.004, rate: 0.28, auto: false, mag: 12, reserve: 72, reload: 1.3, recoil: 0.016, range: 90, color: 0x2a2a2e, len: 0.28, snd: 0 },
  { name: 'MP',      dmg: 17, pellets: 1, spread: 0.014, rate: 0.085, auto: true,  mag: 32, reserve: 160, reload: 1.8, recoil: 0.008, range: 70, color: 0x303036, len: 0.42, snd: 1 },
  { name: 'STURMGEWEHR', dmg: 34, pellets: 1, spread: 0.008, rate: 0.12, auto: true, mag: 30, reserve: 120, reload: 2.2, recoil: 0.012, range: 140, color: 0x3a3d33, len: 0.7, snd: 2 },
  { name: 'SCHROTFLINTE', dmg: 13, pellets: 9, spread: 0.055, rate: 0.9, auto: false, mag: 6, reserve: 30, reload: 2.5, recoil: 0.07, range: 30, color: 0x4a3a2a, len: 0.75, snd: 3 },
];

/* ---------------- Renderer / Scene ---------------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const SKY = 0x6f7a86;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 25, 130);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xb8c4d4, 0x3a3630, 1.25));
const sun = new THREE.DirectionalLight(0xffe2b8, 1.1);
sun.position.set(-60, 90, 40);
scene.add(sun);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------------- Utilities ---------------- */
let seed = 1337;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);
const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 2;
  return t;
}

/* ---------------- World / Map ---------------- */
const HALF = CONFIG.mapSize / 2;
const boxes = []; // Kollision: {x0,x1,z0,z1,top}
function addBox(cx, cz, w, d, top) { boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top }); }

function buildGround() {
  const tex = canvasTex(1024, 1024, (g, w, h) => {
    const px = w / CONFIG.mapSize; // px pro Meter
    g.fillStyle = '#4b4e50'; g.fillRect(0, 0, w, h);            // Asphalt
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},.05)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    const toPx = (m) => (m + HALF) * px;
    // Blöcke (Gehsteig) zwischen den Straßen
    for (let bx = -75; bx <= 75; bx += 50) for (let bz = -75; bz <= 75; bz += 50) {
      g.fillStyle = '#7b7a74'; g.fillRect(toPx(bx - 20), toPx(bz - 20), 40 * px, 40 * px);
      g.fillStyle = '#65645f'; g.fillRect(toPx(bx - 18), toPx(bz - 18), 36 * px, 36 * px);
    }
    // Außenrand: Gras/Erde
    g.fillStyle = '#4a5238';
    g.fillRect(0, 0, w, toPx(-120)); g.fillRect(0, toPx(120), w, h);
    g.fillRect(0, 0, toPx(-120), h); g.fillRect(toPx(120), 0, w, h);
    // Mittellinien
    g.strokeStyle = 'rgba(230,200,80,.7)'; g.lineWidth = 2; g.setLineDash([14, 14]);
    for (let r = -100; r <= 100; r += 50) {
      g.beginPath(); g.moveTo(toPx(r), toPx(-120)); g.lineTo(toPx(r), toPx(120)); g.stroke();
      g.beginPath(); g.moveTo(toPx(-120), toPx(r)); g.lineTo(toPx(120), toPx(r)); g.stroke();
    }
    // Risse / Flecken
    g.setLineDash([]); g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 1;
    for (let i = 0; i < 160; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rr(-14, 14); y += rr(-14, 14); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(70,10,10,.35)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(3, 9), 0, 7); g.fill(); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.mapSize + 40, CONFIG.mapSize + 40), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2;
  m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize);
  scene.add(m);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), lambert(0x3d4430));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; scene.add(outer);
}

function facadeTexture(base, lit) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .08})`; g.fillRect(rnd() * w, rnd() * h, rr(2, 10), rr(2, 10)); }
    for (let y = 8; y < h; y += 32) for (let x = 8; x < w; x += 32) {
      const r = rnd();
      g.fillStyle = r < .12 ? lit : r < .25 ? '#0b0d10' : '#1a2229';
      g.fillRect(x, y, 18, 22);
      if (r > .6) { g.strokeStyle = '#000'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y + 22); g.moveTo(x + 18, y); g.lineTo(x + 6, y + 14); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 2, y + 22, 22, 3);
    }
    if (rnd() < .7) { g.fillStyle = 'rgba(30,22,16,.3)'; g.fillRect(0, h * rr(.5, .9), w, h); }
  }, true);
}

function buildCity() {
  const bases = ['#8c8479', '#7a6d62', '#6c7378', '#8a6b5a', '#5f625b'];
  const lits = ['#ffd98a', '#cfe8ff'];
  const roofMat = lambert(0x3b3a38);
  const addBuilding = (cx, cz, w, d, h) => {
    const tex = facadeTexture(bases[(rnd() * bases.length) | 0], lits[(rnd() * 2) | 0]);
    const side = tex.clone(); side.needsUpdate = true;
    tex.repeat.set(w / 4, h / 4); side.repeat.set(d / 4, h / 4);
    const mats = [side, side, null, null, tex, tex].map((t) => (t ? new THREE.MeshLambertMaterial({ map: t }) : roofMat));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(cx, h / 2, cz); scene.add(m);
    addBox(cx, cz, w, d, h);
    if (rnd() < 0.5) { // Dachaufbau
      const a = new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2, d * .3), roofMat);
      a.position.set(cx + rr(-w / 4, w / 4), h + 1, cz + rr(-d / 4, d / 4)); scene.add(a);
    }
  };
  const crate = new THREE.BoxGeometry(1, 1, 1);
  const addCrate = (x, z, s, c) => { const m = new THREE.Mesh(crate, lambert(c)); m.scale.set(s, s, s); m.position.set(x, s / 2, z); m.rotation.y = 0; scene.add(m); addBox(x, z, s, s, s); };

  for (let bx = -75; bx <= 75; bx += 50) for (let bz = -75; bz <= 75; bz += 50) {
    for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 2; iz++) {
      const cx = bx + (ix ? 10 : -10), cz = bz + (iz ? 10 : -10);
      if (Math.abs(cx) < 15 && Math.abs(cz) < 15) { // Park in der Mitte
        for (let k = 0; k < 5; k++) addTree(cx + rr(-6, 6), cz + rr(-6, 6));
        continue;
      }
      if (rnd() < 0.78) addBuilding(cx, cz, rr(12, 17), rr(12, 17), rr(8, 26));
      else { // Freifläche: Trümmer, Kisten
        for (let k = 0; k < 4; k++) addCrate(cx + rr(-6, 6), cz + rr(-6, 6), rr(0.8, 1.8), [0x6b5a3c, 0x4d5a3c, 0x555a60][k % 3]);
        addTree(cx + rr(-6, 6), cz + rr(-6, 6));
      }
    }
  }
  // Außenrand: ein paar Ruinen & Bäume
  for (let i = 0; i < 18; i++) {
    const side = i % 4, t = rr(-110, 110), o = rr(110, 120);
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? -o : o;
    const z = side === 0 ? -o : side === 1 ? o : t;
    if (i % 3 === 0) addBuilding(x, z, rr(8, 12), rr(8, 12), rr(5, 10)); else addTree(x, z);
  }
  // Begrenzungsmauer (unsichtbar + sichtbare Absperrung)
  const wallMat = lambert(0x55585a);
  [[0, -HALF - 1, CONFIG.mapSize + 4, 2], [0, HALF + 1, CONFIG.mapSize + 4, 2], [-HALF - 1, 0, 2, CONFIG.mapSize + 4], [HALF + 1, 0, 2, CONFIG.mapSize + 4]].forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), wallMat); m.position.set(x, 2.5, z); scene.add(m); addBox(x, z, w, d, 50);
  });
  buildStreetProps();
}

function addTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 4, 6), lambert(0x3a2e24)); trunk.position.y = 2; g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 1.8, 4), lambert(0x3a2e24));
    b.position.set(0.5 * Math.cos(i * 1.6), 3.2 + i * 0.2, 0.5 * Math.sin(i * 1.6)); b.rotation.set(Math.sin(i * 1.6) * .9, 0, -Math.cos(i * 1.6) * .9); g.add(b);
  }
  g.position.set(x, 0, z); scene.add(g); addBox(x, z, 0.5, 0.5, 5);
}

function buildStreetProps() {
  const carColors = [0x6a2a22, 0x2c3e55, 0x4a4f4a, 0x7a6a3a, 0x303030, 0x5a5a60];
  const bodyG = new THREE.BoxGeometry(1.9, 0.8, 4.4), cabG = new THREE.BoxGeometry(1.7, 0.65, 2.2);
  const glass = lambert(0x1a2024), tire = lambert(0x111111);
  const wheelG = new THREE.BoxGeometry(0.25, 0.7, 0.7);
  for (let i = 0; i < 46; i++) {
    const vertical = rnd() < 0.5, road = (((rnd() * 5) | 0) - 2) * 50;
    const along = rr(-115, 115);
    let x = vertical ? road + rr(-3.6, 3.6) : along, z = vertical ? along : road + rr(-3.6, 3.6);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue; // Spawn freihalten
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyG, lambert(carColors[(rnd() * carColors.length) | 0])); body.position.y = 0.7; g.add(body);
    const cab = new THREE.Mesh(cabG, glass); cab.position.set(0, 1.4, -0.2); g.add(cab);
    for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) { const w = new THREE.Mesh(wheelG, tire); w.position.set(sx * 0.95, 0.35, sz); g.add(w); }
    g.position.set(x, 0, z);
    if (!vertical) g.rotation.y = Math.PI / 2;
    g.rotation.z = rnd() < 0.15 ? 0.08 : 0;
    scene.add(g);
    vertical ? addBox(x, z, 1.9, 4.4, 1.5) : addBox(x, z, 4.4, 1.9, 1.5);
  }
  // Betonbarrieren & Straßenlaternen
  const barG = new THREE.BoxGeometry(2.4, 0.9, 0.6), barM = lambert(0x8b8b86);
  for (let i = 0; i < 26; i++) {
    const vertical = rnd() < 0.5, road = (((rnd() * 5) | 0) - 2) * 50, along = rr(-115, 115);
    const x = vertical ? road + rr(-4, 4) : along, z = vertical ? along : road + rr(-4, 4);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    const m = new THREE.Mesh(barG, barM); m.position.set(x, 0.45, z); scene.add(m);
    if (rnd() < 0.5) { m.rotation.y = Math.PI / 2; addBox(x, z, 0.6, 2.4, 0.9); } else addBox(x, z, 2.4, 0.6, 0.9);
  }
  const poleG = new THREE.CylinderGeometry(0.08, 0.1, 6, 6), poleM = lambert(0x2d2f30);
  for (let r1 = -100; r1 <= 100; r1 += 50) for (let r2 = -100; r2 <= 100; r2 += 25) {
    for (const [x, z] of [[r1 + 5.5, r2], [r2, r1 + 5.5]]) {
      if (Math.abs(x) > 120 || Math.abs(z) > 120 || Math.abs(x % 50) < 6 && Math.abs(z % 50) < 6) continue;
      const m = new THREE.Mesh(poleG, poleM); m.position.set(x, 3, z); m.rotation.z = rnd() < 0.2 ? 0.15 : 0; scene.add(m); addBox(x, z, 0.3, 0.3, 6);
    }
  }
  // Fässer
  const barrelG = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8);
  for (let i = 0; i < 24; i++) {
    const x = rr(-115, 115), z = rr(-115, 115);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    if (boxes.some((b) => x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5)) continue;
    const m = new THREE.Mesh(barrelG, lambert([0x7a2f20, 0x3a5a3a, 0x2f4a6a][i % 3])); m.position.set(x, 0.45, z); scene.add(m); addBox(x, z, 0.6, 0.6, 0.9);
  }
}

/* Kollision & Boden */
function resolveCircle(pos, r, feetY, stepH) {
  for (const b of boxes) {
    if (b.top <= feetY + stepH) continue;
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
function supportY(x, z, feetY, r, stepH) {
  let y = 0;
  for (const b of boxes) {
    if (b.top > feetY + stepH || b.top <= y) continue;
    if (x > b.x0 - r * 0.6 && x < b.x1 + r * 0.6 && z > b.z0 - r * 0.6 && z < b.z1 + r * 0.6) y = b.top;
  }
  return y;
}
const _o = new THREE.Vector3();
function rayBox(o, d, b, maxT) { // -> {t, nx, nz} | null
  let t0 = 0, t1 = maxT, nx = 0, nz = 0, ny = 0;
  const axes = [[o.x, d.x, b.x0, b.x1, 0], [o.y, d.y, 0, b.top, 1], [o.z, d.z, b.z0, b.z1, 2]];
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
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc; if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc); return t >= 0 ? t : (-b + Math.sqrt(disc) >= 0 ? 0 : Infinity);
}

/* ---------------- Audio (synthetisiert) ---------------- */
let actx = null;
function initAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } }
function noiseBuf(dur) { const b = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function sfxNoise(dur, freq, vol, type = 'lowpass', q = 0.7) {
  if (!actx) return; const s = actx.createBufferSource(); s.buffer = noiseBuf(dur);
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(actx.destination); s.start();
}
function sfxTone(freq, dur, vol, type = 'sine', slide = 0) {
  if (!actx) return; const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, actx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), actx.currentTime + dur);
  g.gain.setValueAtTime(vol, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
}
const SFX = {
  shot(k) { const big = k === 3 ? 1 : k === 2 ? 0.8 : 0.6; sfxNoise(0.25 + big * 0.15, k === 3 ? 1400 : 3000, 0.9 * big, 'lowpass'); sfxTone(k === 3 ? 90 : 140, 0.18, 0.6 * big, 'sine', -80); },
  empty() { sfxTone(900, 0.05, 0.25, 'square'); },
  reload(phase) { if (phase === 0) { sfxNoise(0.08, 2500, 0.4, 'bandpass', 3); sfxTone(300, 0.08, 0.2, 'square'); } else { sfxNoise(0.1, 1800, 0.5, 'bandpass', 3); sfxTone(520, 0.06, 0.25, 'square'); } },
  hit() { sfxNoise(0.1, 600, 0.5); },
  zhurt() { sfxTone(160, 0.25, 0.25, 'sawtooth', -60); },
  groan(vol) { sfxTone(rr(70, 110), 0.7, 0.18 * vol, 'sawtooth', -25); },
  pain() { sfxNoise(0.18, 400, 0.7); sfxTone(110, 0.2, 0.4, 'sine', -50); },
  pickup() { sfxTone(660, 0.1, 0.25, 'triangle'); setTimeout(() => sfxTone(990, 0.12, 0.25, 'triangle'), 90); },
  death() { sfxTone(200, 0.9, 0.4, 'sawtooth', -150); },
};

/* ---------------- Effekte ---------------- */
const particles = [];
const pGeo = new THREE.BoxGeometry(1, 1, 1);
const pMats = { blood: new THREE.MeshBasicMaterial({ color: 0x8a0f0f }), spark: new THREE.MeshBasicMaterial({ color: 0xffd070 }), dust: new THREE.MeshBasicMaterial({ color: 0x9a968c, transparent: true, opacity: 0.7 }) };
for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(pGeo, pMats.blood); m.visible = false; scene.add(m); particles.push({ m, v: new THREE.Vector3(), life: 0, g: 0 }); }
let pIdx = 0;
function emit(pos, n, kind, speed, size, grav, dir) {
  for (let i = 0; i < n; i++) {
    const p = particles[pIdx++ % particles.length];
    p.m.material = pMats[kind]; p.m.visible = true; p.m.position.copy(pos); p.m.scale.setScalar(size * rr(0.6, 1.3));
    p.v.set(rr(-1, 1), rr(-0.2, 1), rr(-1, 1)).multiplyScalar(speed);
    if (dir) p.v.addScaledVector(dir, speed * 0.8);
    p.life = rr(0.3, 0.8); p.g = grav;
  }
}
const decals = []; let dIdx = 0;
const decalGeo = new THREE.CircleGeometry(0.07, 8), decalMat = new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(decalGeo, decalMat); m.visible = false; scene.add(m); decals.push(m); }
function addDecal(pos, n) { const m = decals[dIdx++ % decals.length]; m.visible = true; m.position.copy(pos).addScaledVector(n, 0.012); m.lookAt(pos.x + n.x, pos.y + n.y, pos.z + n.z); }
const tracers = [];
for (let i = 0; i < 12; i++) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.8 })); l.frustumCulled = false; l.visible = false; scene.add(l); tracers.push({ l, life: 0 });
}
let tIdx = 0;
function addTracer(a, b) { const t = tracers[tIdx++ % tracers.length], p = t.l.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; t.l.visible = true; t.life = 0.06; }
function updateEffects(dt) {
  for (const p of particles) { if (!p.m.visible) continue; p.life -= dt; if (p.life <= 0) { p.m.visible = false; continue; } p.v.y -= p.g * dt; p.m.position.addScaledVector(p.v, dt); if (p.m.position.y < 0.02) { p.m.position.y = 0.02; p.v.set(0, 0, 0); } }
  for (const t of tracers) if (t.l.visible && (t.life -= dt) <= 0) t.l.visible = false;
}

/* ---------------- Humanoid (Spieler & Zombies) ---------------- */
// Prozedurales Fallback-Modell – aufgebaut nach den Spezifikationen aus den GLB-Dateien (Hautfarbe, Kleidung …).
function buildHumanoid(spec) {
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
const ZOMBIE_SPEC = { skin: 0xa39588, top: 0x3d4a3a, bot: 0x2a2a30, shoe: 0x1a1a1a, hair: 0x2b2620, eyes: 0xff3322, blood: 5, sleeveLong: false };
const PLAYER_SPEC = { skin: 0xe0ac82, top: 0x3366aa, bot: 0x222222, shoe: 0xeeeeee, hair: 0x1a1410, sleeveLong: true };

const models = { player: null, zombie: null };
async function tryLoadModel(url) {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = gltf.scene; const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size);
    if (!isFinite(size.y) || size.y < 0.01) return null;
    const wrap = new THREE.Group(); const k = 1.8 / size.y; root.scale.multiplyScalar(k);
    const b2 = new THREE.Box3().setFromObject(root); root.position.y -= b2.min.y; wrap.add(root); return wrap;
  } catch (e) { console.warn('Modell nicht geladen (Fallback aktiv):', url, e && e.message); return null; }
}

/* ---------------- Spieler ---------------- */
const player = {
  pos: new THREE.Vector3(0, 0, 8), vel: new THREE.Vector3(), yaw: 0, pitch: 0, vy: 0, onGround: true,
  hp: CONFIG.playerMaxHp, kills: 0, dead: false, weapon: 0, fireCd: 0, reloadT: 0, reloading: false, recoilKick: 0, bob: 0,
  ammo: WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve })), shake: 0,
};
let bodyModel = null; // Spielermodell (in der Ego-Perspektive unsichtbar)

/* Viewmodel */
const view = new THREE.Group(); camera.add(view);
const viewGuns = [];
const handSkin = lambert(PLAYER_SPEC.skin), sleeve = lambert(PLAYER_SPEC.top);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), flashMat); flash.visible = false;
const flashLight = new THREE.PointLight(0xffc070, 0, 12); flashLight.visible = true; camera.add(flashLight); flashLight.position.set(0.2, -0.1, -0.8);
function buildViewGuns() {
  WEAPONS.forEach((w, i) => {
    const g = new THREE.Group(); const mm = lambert(w.color), dark = lambert(0x151515);
    const bx = (sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || mm); b.position.set(x, y, z); g.add(b); return b; };
    bx(0.06, 0.1, w.len, 0, 0, -w.len / 2);                    // Körper
    bx(0.04, 0.04, w.len * 0.6, 0, 0.035, -w.len - w.len * 0.2, dark); // Lauf
    bx(0.05, 0.14, 0.06, 0, -0.11, -0.05, dark);               // Griff
    if (i === 2) { bx(0.05, 0.14, 0.06, 0, -0.1, -0.35, dark); bx(0.03, 0.04, 0.2, 0, 0.08, -0.3, dark); }
    if (i === 1) bx(0.04, 0.16, 0.05, 0, -0.12, -0.22, dark);
    if (i === 3) bx(0.07, 0.07, 0.25, 0, -0.04, -0.45, lambert(0x5a432c));
    // Arme/Hände
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.45), sleeve); arm.position.set(0.09, -0.12, 0.2); arm.rotation.set(0.1, -0.15, 0); g.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.12), handSkin); hand.position.set(0.04, -0.1, -0.04); g.add(hand);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), sleeve); arm2.position.set(-0.15, -0.14, -0.1); arm2.rotation.set(0.12, 0.35, 0); g.add(arm2);
    const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.1), handSkin); hand2.position.set(-0.04, -0.075, -w.len * 0.55); g.add(hand2);
    g.visible = false; g.muzzle = new THREE.Vector3(0, 0.02, -w.len * 1.45); view.add(g); viewGuns.push(g);
  });
  view.position.set(0.2, -0.22, -0.4); view.add(flash);
}
buildViewGuns();
function selectWeapon(i) {
  if (i === player.weapon && viewGuns[i].visible) return;
  player.weapon = i; player.reloading = false; player.reloadT = 0; player.swapT = 0.25;
  viewGuns.forEach((g, k) => (g.visible = k === i));
  flash.position.copy(viewGuns[i].muzzle); flash.visible = false;
  updateHUD();
}
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3();

function startReload() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  if (player.reloading || a.mag >= w.mag || a.reserve <= 0 || player.dead) return;
  player.reloading = true; player.reloadT = w.reload; SFX.reload(0); setTimeout(() => SFX.reload(1), w.reload * 650);
}
function finishReload() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon], n = Math.min(w.mag - a.mag, a.reserve);
  a.mag += n; a.reserve -= n; player.reloading = false; updateHUD();
}

function shoot() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  if (player.reloading || player.fireCd > 0 || player.dead || (player.swapT || 0) > 0) return;
  if (a.mag <= 0) { SFX.empty(); player.fireCd = 0.25; startReload(); return; }
  a.mag--; player.fireCd = w.rate; SFX.shot(w.snd);
  camera.getWorldDirection(_f); _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1);
  _w.copy(viewGuns[player.weapon].muzzle); viewGuns[player.weapon].localToWorld(_w);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  let hitAny = false, killAny = false;
  for (let p = 0; p < w.pellets; p++) {
    _d.copy(_f).addScaledVector(_r, rr(-1, 1) * w.spread).addScaledVector(_u, rr(-1, 1) * w.spread).normalize();
    // Welt
    let tWorld = w.range, wn = null;
    for (const b of boxes) { const h = rayBox(origin, _d, b, tWorld); if (h && h.t < tWorld) { tWorld = h.t; wn = h; } }
    if (_d.y < 0) { const tg = -origin.y / _d.y; if (tg > 0 && tg < tWorld) { tWorld = tg; wn = { nx: 0, ny: 1, nz: 0 }; } }
    // Zombies
    let best = null, tBest = tWorld, head = false;
    for (const z of zombies) {
      if (z.state === 'dead' || z.state === 'dying') continue;
      const hc = _o.set(z.pos.x, z.pos.y + z.headY, z.pos.z); const th = raySphere(origin, _d, hc, 0.25);
      if (th < tBest) { tBest = th; best = z; head = true; }
      for (const yy of [0.35, 0.8, 1.25]) { const tb = raySphere(origin, _d, _o.set(z.pos.x, z.pos.y + yy, z.pos.z), 0.38); if (tb < tBest) { tBest = tb; best = z; head = false; } }
    }
    const end = new THREE.Vector3().copy(origin).addScaledVector(_d, tBest);
    if (p < 3) addTracer(_w, end);
    if (best) {
      hitAny = true; const dmg = w.dmg * (head ? 2.5 : 1) * (1 - Math.min(0.5, tBest / (w.range * 2)));
      if (damageZombie(best, dmg, head, _d, end)) killAny = true;
    } else if (wn) {
      const n = new THREE.Vector3(wn.nx || 0, wn.ny || 0, wn.nz || 0);
      addDecal(end, n); emit(end, 3, 'spark', 2.5, 0.03, 9, n); emit(end, 2, 'dust', 1.2, 0.08, 1, n);
    }
  }
  noise(player.pos, 60);
  if (hitAny) { const hm = $('hitmark'); hm.className = 'on' + (killAny ? ' kill' : ''); clearTimeout(hm._t); hm._t = setTimeout(() => (hm.className = ''), 90); }
  // Rückstoß & Mündungsfeuer
  player.recoilKick += w.recoil * 30; player.pitch += w.recoil * (0.4 + rnd() * 0.5); player.yaw += rr(-1, 1) * w.recoil * 0.3; player.shake = Math.min(1, player.shake + w.recoil * 6);
  flash.visible = true; flash.rotation.z = rnd() * 6; flash.scale.setScalar(w.pellets > 1 ? 1.8 : 1 + rnd() * 0.5); flashLight.intensity = 3; player.flashT = 0.05;
  if (a.mag === 0 && a.reserve > 0) setTimeout(startReload, 250);
  updateHUD();
}

/* ---------------- Zombies ---------------- */
const zombies = [];
let killsTotal = 0;
function spawnZombie(x, z, opts = {}) {
  let root, parts = null;
  if (models.zombie) root = models.zombie.clone(true);
  else { root = buildHumanoid(ZOMBIE_SPEC); parts = root.parts; }
  const sc = rr(0.95, 1.08); root.scale.setScalar(sc);
  const runner = opts.runner ?? rnd() < 0.2;
  const hp = (opts.hp || 100) * (runner ? 0.7 : 1);
  const zb = {
    root, parts, pos: new THREE.Vector3(x, 0, z), yaw: rr(0, 6.28), hp, maxHp: hp, state: 'wander', t: rnd() * 5,
    speed: (runner ? rr(3.2, 4.2) : rr(1.1, 2.0)) * (opts.speedMul || 1), dmg: opts.dmg || 12, atkCd: 0, stun: 0, headY: 1.62 * sc,
    wander: new THREE.Vector3(x, 0, z), phase: rnd() * 6, stuckT: 0, lastP: new THREE.Vector3(x, 0, z), side: 0, dieT: 0, fall: rnd() < 0.5 ? -1 : 1, groanT: rr(3, 9),
    target: null, runner,
  };
  root.position.copy(zb.pos); scene.add(root); zombies.push(zb); return zb;
}
function damageZombie(z, dmg, head, dir, at) {
  z.hp -= dmg; z.stun = 0.2; SFX.hit();
  if (z.state === 'wander') { z.state = 'chase'; }
  emit(at, head ? 14 : 7, 'blood', head ? 3.5 : 2.5, 0.05, 9, dir);
  if (z.hp <= 0) { killZombie(z, head); return true; }
  SFX.zhurt(); return false;
}
function killZombie(z, head) {
  z.state = 'dying'; z.dieT = 0; player.kills++; killsTotal++; SFX.death();
  emit(new THREE.Vector3(z.pos.x, z.pos.y + 1, z.pos.z), head ? 25 : 14, 'blood', 3, 0.06, 9);
  updateHUD();
}
function noise(pos, radius) { for (const z of zombies) if (z.state === 'wander' && z.pos.distanceTo(pos) < radius) { z.state = 'chase'; } }

function updateZombie(z, dt) {
  const pp = player.pos; const dx = pp.x - z.pos.x, dz = pp.z - z.pos.z; const dist = Math.hypot(dx, dz);
  z.t += dt; z.phase += dt * (z.state === 'chase' ? z.speed * 2.2 : 3);
  if (z.state === 'dying') {
    z.dieT += dt; const k = Math.min(1, z.dieT / 0.9), e = 1 - (1 - k) * (1 - k);
    z.root.rotation.x = -z.fall * e * Math.PI / 2; z.root.position.y = 0.05 * e;
    if (z.parts) { z.parts.armL.rotation.x = -2 * e; z.parts.armR.rotation.x = -2.2 * e; z.parts.legL.rotation.x = 0.4 * e; z.parts.legR.rotation.x = -0.3 * e; z.parts.head.rotation.x = -z.fall * 0.5 * e; }
    if (k >= 1) { z.state = 'dead'; z.deadT = 0; }
    return;
  }
  if (z.state === 'dead') { z.deadT += dt; if (z.deadT > 12) { z.root.position.y -= dt * 0.15; if (z.deadT > 18) { scene.remove(z.root); z.gone = true; } } return; }
  if (player.dead) z.state = 'wander';
  if (z.stun > 0) { z.stun -= dt; return; }
  z.atkCd -= dt; z.groanT -= dt;
  if (z.groanT <= 0) { z.groanT = rr(5, 12); if (dist < 40) SFX.groan(1 - dist / 40); }
  if (z.state === 'wander') {
    if (dist < 18 || (dist < 30 && Math.abs(Math.atan2(dx, dz) - z.yaw) < 1)) z.state = 'chase';
    if (z.pos.distanceTo(z.wander) < 1 || z.t > 8) { z.wander.set(z.pos.x + rr(-12, 12), 0, z.pos.z + rr(-12, 12)); z.t = 0; }
  }
  let tx, tz, spd;
  if (z.state === 'chase' || z.state === 'attack') {
    tx = pp.x; tz = pp.z; spd = z.speed;
    z.state = dist > 80 ? 'wander' : dist < 1.5 && Math.abs(pp.y - z.pos.y) < 1.8 ? 'attack' : 'chase';
  } else { tx = z.wander.x; tz = z.wander.z; spd = z.speed * 0.4; }
  let ang = Math.atan2(tx - z.pos.x, tz - z.pos.z);
  if (z.side) { ang += z.side; z.sideT -= dt; if (z.sideT <= 0) z.side = 0; }
  // Drehung glätten
  let da = ang - z.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); z.yaw += clamp(da, -4 * dt, 4 * dt);
  if (z.state !== 'attack') {
    z.pos.x += Math.sin(z.yaw) * spd * dt; z.pos.z += Math.cos(z.yaw) * spd * dt;
  } else if (z.atkCd <= 0) {
    z.atkCd = 1.1; z.atkAnim = 0.45;
    setTimeout(() => { if (z.state === 'attack' && !player.dead && z.hp > 0 && Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z) < 2) hurtPlayer(z.dmg); }, 300);
  }
  for (const o of zombies) { if (o === z || o.state === 'dead' || o.state === 'dying') continue; const ox = z.pos.x - o.pos.x, oz = z.pos.z - o.pos.z, d2 = ox * ox + oz * oz; if (d2 < 0.55 && d2 > 1e-6) { const d = Math.sqrt(d2); z.pos.x += ox / d * 0.5 * dt * 2; z.pos.z += oz / d * 0.5 * dt * 2; } }
  resolveCircle(z.pos, 0.38, 0, 0.3);
  // Hängen geblieben? -> seitlich ausweichen
  z.stuckT += dt; if (z.stuckT > 0.5) { if (z.state === 'chase' && z.pos.distanceTo(z.lastP) < spd * 0.5 * 0.3) { z.side = (rnd() < 0.5 ? 1 : -1) * rr(1.0, 1.7); z.sideT = rr(0.8, 1.6); } z.lastP.copy(z.pos); z.stuckT = 0; }
  z.root.position.set(z.pos.x, z.pos.y, z.pos.z); z.root.rotation.set(0, z.yaw, 0);
  // Animation
  const sw = Math.sin(z.phase), amp = z.state === 'attack' ? 0.1 : (z.runner ? 0.9 : 0.55);
  if (z.parts) {
    z.parts.legL.rotation.x = sw * amp; z.parts.legR.rotation.x = -sw * amp;
    let arm = -1.35 + Math.sin(z.phase * 0.5) * 0.1;
    if (z.atkAnim > 0) { z.atkAnim -= dt; arm = -1.35 + Math.sin(Math.min(1, z.atkAnim / 0.45) * Math.PI) * -0.9; }
    z.parts.armL.rotation.x = arm; z.parts.armR.rotation.x = arm + 0.1; z.parts.armL.rotation.z = 0.08; z.parts.armR.rotation.z = -0.08;
    z.parts.torso.rotation.x = 0.2 + Math.abs(sw) * 0.05; z.parts.torso.rotation.z = sw * 0.06; z.parts.head.rotation.z = Math.sin(z.phase * 0.7) * 0.12;
  } else { z.root.rotation.x = 0.12; z.root.position.y += Math.abs(sw) * 0.06; z.root.rotation.z = sw * 0.05; }
}

/* Wellen (vollständig implementiert, aber standardmäßig AUS – CONFIG.wavesEnabled) */
const waves = {
  n: 0, toSpawn: 0, spawnT: 0, pause: 3, active: false,
  start() { this.n++; this.toSpawn = 6 + this.n * 4; this.active = true; toast('WELLE ' + this.n); updateHUD(); },
  update(dt) {
    if (!CONFIG.wavesEnabled || player.dead) return;
    if (!this.active) { this.pause -= dt; if (this.pause <= 0) this.start(); return; }
    if (this.toSpawn > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && alive() < 25) { this.spawnT = Math.max(0.4, 2.2 - this.n * 0.15); this.toSpawn--; const p = randomSpawn(35, 90); spawnZombie(p.x, p.z, { hp: 100 + this.n * 12, speedMul: 1 + this.n * 0.04, dmg: 10 + this.n }); updateHUD(); }
    } else if (alive() === 0) { this.active = false; this.pause = 8; toast('WELLE ' + this.n + ' GESCHAFFT'); }
  },
};
const alive = () => zombies.reduce((n, z) => n + (z.state === 'dead' || z.state === 'dying' ? 0 : 1), 0);
function randomSpawn(minD, maxD) {
  for (let i = 0; i < 60; i++) {
    const a = rnd() * 6.28, d = rr(minD, maxD), x = clamp(player.pos.x + Math.sin(a) * d, -HALF + 2, HALF - 2), z = clamp(player.pos.z + Math.cos(a) * d, -HALF + 2, HALF - 2);
    if (!boxes.some((b) => x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6)) return { x, z };
  }
  return { x: 0, z: -30 };
}

/* ---------------- Pickups ---------------- */
const pickups = [];
function spawnPickups() {
  pickups.forEach((p) => scene.remove(p.m)); pickups.length = 0;
  const ammoM = lambert(0xc9a227), medM = lambert(0xdddddd), red = lambert(0xcc2222);
  for (let i = 0; i < 16; i++) {
    const p = randomSpawn(8, 110); const ammo = i % 3 !== 0;
    const m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.28), ammo ? ammoM : medM); m.add(b);
    if (!ammo) { const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.3), red), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.3), red); m.add(c1, c2); }
    m.position.set(p.x, 0.6, p.z); scene.add(m); pickups.push({ m, ammo, t: 0, x: p.x, z: p.z });
  }
}
function updatePickups(dt) {
  for (const p of pickups) {
    if (p.t > 0) { p.t -= dt; if (p.t <= 0) p.m.visible = true; continue; }
    p.m.rotation.y += dt * 2; p.m.position.y = 0.6 + Math.sin(performance.now() / 300 + p.x) * 0.08;
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 1.5) {
      if (p.ammo) { player.ammo.forEach((a, i) => (a.reserve += Math.ceil(WEAPONS[i].mag * 1.5))); toast('MUNITION'); }
      else if (player.hp < CONFIG.playerMaxHp) { player.hp = Math.min(CONFIG.playerMaxHp, player.hp + 35); toast('+35 LEBEN'); } else continue;
      p.m.visible = false; p.t = 60; SFX.pickup(); updateHUD();
    }
  }
}

/* ---------------- Input ---------------- */
const input = { mx: 0, mz: 0, fire: false, fireQueued: false, sprint: false, jump: false, keys: {} };
const joy = { id: null, cx: 0, cy: 0 }; const look = { id: null, x: 0, y: 0 };
const joyBase = $('joyBase'), joyKnob = $('joyKnob');
function lookDelta(dx, dy) { player.yaw -= dx * CONFIG.lookSensitivity; player.pitch = clamp(player.pitch - dy * CONFIG.lookSensitivity, -1.45, 1.45); }
function joyUpdate(x, y) {
  let dx = x - joy.cx, dy = y - joy.cy; const R = 60, d = Math.hypot(dx, dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  input.mx = dx / R; input.mz = dy / R; // mz>0 = rückwärts
  if (d > R * 1.1) input.sprintAuto = true; else input.sprintAuto = false;
}
function joyReset() { joy.id = null; input.mx = input.mz = 0; input.sprintAuto = false; joyKnob.style.transform = 'translate(0,0)'; }
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('.btn')) return;
  if (!gameRunning() || e.pointerType === 'mouse') return;
  if (e.clientX < window.innerWidth * 0.4 && joy.id === null) {
    joy.id = e.pointerId; const r = joyBase.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyUpdate(e.clientX, e.clientY);
  } else if (e.clientX >= window.innerWidth * 0.4 && look.id === null && e.pointerType !== 'mouse') {
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
  }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) joyUpdate(e.clientX, e.clientY);
  else if (e.pointerId === look.id) { lookDelta(e.clientX - look.x, e.clientY - look.y); look.x = e.clientX; look.y = e.clientY; }
  else if (e.pointerId === fireBtnPointer) { lookDelta(e.clientX - fbx, e.clientY - fby); fbx = e.clientX; fby = e.clientY; }
});
const up = (e) => { if (e.pointerId === joy.id) joyReset(); if (e.pointerId === look.id) look.id = null; };
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
let fireBtnPointer = null, fbx = 0, fby = 0;
function bindBtn(id, down, upfn) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down'); down(e); });
  const end = (e) => { b.classList.remove('down'); if (upfn) upfn(e); };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
}
bindBtn('btnFire', (e) => { input.fire = true; input.fireQueued = true; fireBtnPointer = e.pointerId; fbx = e.clientX; fby = e.clientY; }, () => { input.fire = false; fireBtnPointer = null; });
bindBtn('btnJump', () => { input.jump = true; }, () => { input.jump = false; });
bindBtn('btnReload', () => startReload());
bindBtn('btnSwap', () => selectWeapon((player.weapon + 1) % WEAPONS.length));
bindBtn('btnSprint', () => { input.sprint = !input.sprint; $('btnSprint').classList.toggle('on', input.sprint); });
// Desktop
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyR') startReload(); if (e.code === 'KeyQ') selectWeapon((player.weapon + 1) % WEAPONS.length);
  if (e.code >= 'Digit1' && e.code <= 'Digit4') selectWeapon(+e.code.slice(5) - 1);
});
window.addEventListener('keyup', (e) => (input.keys[e.code] = false));
canvas.addEventListener('mousedown', (e) => { if (!gameRunning()) return; if (document.pointerLockElement !== canvas) { canvas.requestPointerLock && canvas.requestPointerLock(); return; } input.fire = true; input.fireQueued = true; });
window.addEventListener('mouseup', () => { if (!fireBtnPointer) input.fire = false; });
window.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) lookDelta(e.movementX, e.movementY); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------------- HUD ---------------- */
function updateHUD() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  $('hpfill').style.width = Math.max(0, player.hp / CONFIG.playerMaxHp * 100) + '%'; $('hptext').textContent = Math.max(0, Math.ceil(player.hp));
  $('wave').textContent = CONFIG.wavesEnabled ? (waves.n || 1) : '–';
  $('remaining').textContent = alive() + (CONFIG.wavesEnabled ? waves.toSpawn : 0);
  $('kills').textContent = player.kills;
  $('wname').textContent = w.name; $('mag').textContent = a.mag; $('reserve').textContent = a.reserve;
  $('ammo').classList.toggle('low', a.mag <= Math.ceil(w.mag * 0.25));
  $('slots').innerHTML = WEAPONS.map((_, i) => `<i class="${i === player.weapon ? 'on' : ''}"></i>`).join('');
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => (el.style.opacity = 0), 1400); }
function hurtPlayer(d) {
  if (player.dead) return;
  player.hp -= d; SFX.pain(); player.shake = 1;
  const el = $('damage'); el.style.opacity = 1; setTimeout(() => (el.style.opacity = 0), 150);
  if (player.hp <= 0) { player.hp = 0; player.dead = true; setTimeout(() => { $('goKills').textContent = player.kills; $('goWave').textContent = CONFIG.wavesEnabled ? waves.n : '–'; $('gameOver').classList.remove('hidden'); }, 1200); }
  updateHUD();
}

/* ---------------- Spielablauf ---------------- */
let running = false;
const gameRunning = () => running && !player.dead;
function resetGame() {
  zombies.forEach((z) => scene.remove(z.root)); zombies.length = 0;
  Object.assign(player, { hp: CONFIG.playerMaxHp, kills: 0, dead: false, vy: 0, reloading: false, fireCd: 0, yaw: 0, pitch: 0, recoilKick: 0, swapT: 0 });
  player.pos.set(0, 0, 8); player.ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
  waves.n = 0; waves.active = false; waves.pause = 3; waves.toSpawn = 0;
  for (let i = 0; i < CONFIG.trainingZombies && !CONFIG.wavesEnabled; i++) { const p = randomSpawn(18, 60); spawnZombie(p.x, p.z); }
  spawnPickups(); selectWeapon(0); viewGuns.forEach((g, k) => (g.visible = k === 0)); updateHUD();
}
function startGame() {
  initAudio(); $('startScreen').classList.add('hidden'); $('gameOver').classList.add('hidden'); $('hud').classList.remove('hidden');
  resetGame(); running = true;
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignorieren */ }
}
$('btnStart').addEventListener('click', startGame);
$('btnRestart').addEventListener('click', startGame);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (running) update(dt);
  updateEffects(dt);
  renderer.render(scene, camera);
}
function update(dt) {
  const k = input.keys;
  // Bewegung
  let mx = input.mx + ((k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)), mz = input.mz + ((k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0));
  const len = Math.hypot(mx, mz), mag = Math.min(1, len); if (len > 1) { mx /= len; mz /= len; }
  const sprint = (input.sprint || k.ShiftLeft || input.sprintAuto) && mz < 0.2 && mag > 0.3;
  const speed = (sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed) * (player.reloading ? 0.85 : 1) * mag;
  if (!player.dead) {
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const wx = (mx * cy + mz * sy), wz = (-mx * sy + mz * cy);
    const tvx = wx * speed, tvz = wz * speed, acc = player.onGround ? 14 : 4;
    player.vel.x += (tvx - player.vel.x) * Math.min(1, acc * dt); player.vel.z += (tvz - player.vel.z) * Math.min(1, acc * dt);
    player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt;
    resolveCircle(player.pos, CONFIG.playerRadius, player.pos.y, 0.35);
    if ((input.jump || k.Space) && player.onGround) { player.vy = CONFIG.jumpSpeed; player.onGround = false; }
    player.vy -= CONFIG.gravity * dt; player.pos.y += player.vy * dt;
    const ground = supportY(player.pos.x, player.pos.z, player.pos.y, CONFIG.playerRadius, 0.35);
    if (player.pos.y <= ground) { player.pos.y = ground; player.vy = 0; player.onGround = true; } else if (player.pos.y > ground + 0.05) player.onGround = false;
    const moving = Math.hypot(player.vel.x, player.vel.z); player.bob += moving * dt * (sprint ? 1.9 : 1.6) * (player.onGround ? 1 : 0);
    // Waffen
    player.fireCd -= dt; if (player.swapT > 0) player.swapT -= dt;
    const w = WEAPONS[player.weapon];
    if (player.reloading) { player.reloadT -= dt; if (player.reloadT <= 0) finishReload(); }
    if (input.fireQueued) { shoot(); input.fireQueued = false; }
    else if (input.fire && w.auto) shoot();
  } else { player.pos.y = Math.max(0, player.pos.y - dt); }
  // Kamera
  const ey = player.dead ? 0.4 : CONFIG.eyeHeight + Math.sin(player.bob * 2) * 0.035;
  camera.position.set(player.pos.x, player.pos.y + ey, player.pos.z);
  player.shake = Math.max(0, player.shake - dt * 4);
  camera.rotation.set(player.pitch + (Math.random() - 0.5) * player.shake * 0.02, player.yaw + (Math.random() - 0.5) * player.shake * 0.02, player.dead ? 0.8 : 0);
  if (bodyModel) bodyModel.position.set(player.pos.x, player.pos.y, player.pos.z);
  // Viewmodel
  player.recoilKick *= Math.max(0, 1 - dt * 14);
  const rl = player.reloading ? Math.sin(Math.min(1, 1 - player.reloadT / WEAPONS[player.weapon].reload) * Math.PI) : 0;
  const sw = player.swapT > 0 ? player.swapT / 0.25 : 0;
  view.position.set(0.2 + Math.sin(player.bob) * 0.012, -0.22 + Math.abs(Math.cos(player.bob)) * 0.01 - rl * 0.25 - sw * 0.3, -0.4 + player.recoilKick * 0.05);
  view.rotation.set(player.recoilKick * 0.05 + rl * 0.6, 0, rl * -0.2);
  if (player.flashT > 0) { player.flashT -= dt; if (player.flashT <= 0) { flash.visible = false; flashLight.intensity = 0; } }
  // Zombies
  for (const z of zombies) updateZombie(z, dt);
  for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].gone) zombies.splice(i, 1);
  waves.update(dt); updatePickups(dt);
  $('remaining').textContent = alive() + (CONFIG.wavesEnabled ? waves.toSpawn : 0);
}

/* ---------------- Start ---------------- */
async function init() {
  buildGround(); buildCity();
  $('loadText').textContent = 'Lade Modelle …';
  const [pm, zm] = await Promise.all([tryLoadModel(CONFIG.playerModelUrl), tryLoadModel(CONFIG.zombieModelUrl)]);
  models.zombie = zm;
  bodyModel = pm || buildHumanoid(PLAYER_SPEC); bodyModel.visible = false; scene.add(bodyModel); // Spielerkörper (Ego-Perspektive: ausgeblendet)
  $('loading').classList.add('hidden');
  selectWeapon(0);
  // Menü-Hintergrund
  camera.position.set(0, 1.7, 8);
  requestAnimationFrame(frame);
}
init().catch((e) => { $('loadText').textContent = 'Fehler: ' + e.message; console.error(e); });
window.__game = { CONFIG, player, zombies, spawnZombie, waves };
