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
  zombieModelUrls: ['assets/models/zombie.glb'], // später: weitere Zombie-Modelle hier eintragen (zufällige Auswahl)
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
const hemi = new THREE.HemisphereLight(0xb8c4d4, 0x3a3630, 1.25);
scene.add(hemi);
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
  const SIZE = Math.min(3072, renderer.capabilities.maxTextureSize || 2048);
  const aniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  const tex = canvasTex(SIZE, SIZE, (g, w, h) => {
    const px = w / CONFIG.mapSize;                 // Pixel pro Meter
    const X = (m) => (m + HALF) * px;
    const R = (x, z, ww, hh) => g.fillRect(X(x), X(z), ww * px, hh * px);
    // --- Asphalt mit Flecken
    g.fillStyle = '#3e4144'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const l = rnd() < .5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr(.02, .07)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(.3, 2.6) * px, 0, 7); g.fill(); }
    // --- Blöcke: Gehsteig-Ring + Betonplatten
    for (let bx = -75; bx <= 75; bx += 50) for (let bz = -75; bz <= 75; bz += 50) {
      g.fillStyle = '#85847d'; R(bx - 20, bz - 20, 40, 40);
      for (let a = 0; a < 40; a += 0.6) for (let b = 0; b < 2; b += 0.6) { // Pflaster im Ring (alle 4 Seiten)
        const t = 118 + rnd() * 26; g.fillStyle = `rgb(${t},${t - 1},${t - 6})`;
        R(bx - 20 + a, bz - 20 + b, 0.56, 0.56); R(bx - 20 + a, bz + 18 + b, 0.56, 0.56);
        R(bx - 20 + b, bz - 20 + a, 0.56, 0.56); R(bx + 18 + b, bz - 20 + a, 0.56, 0.56);
      }
      g.fillStyle = '#5f5e59'; R(bx - 18, bz - 18, 36, 36); // Grundstück
      for (let a = 0; a < 36; a += 3) for (let b = 0; b < 36; b += 3) { const t = 84 + rnd() * 22; g.fillStyle = `rgb(${t},${t},${t - 4})`; R(bx - 18 + a + .04, bz - 18 + b + .04, 2.92, 2.92); }
      g.strokeStyle = '#b9b7ae'; g.lineWidth = Math.max(1.5, .18 * px); g.strokeRect(X(bx - 20), X(bz - 20), 40 * px, 40 * px); // Bordstein
      g.strokeStyle = 'rgba(15,15,15,.55)'; g.lineWidth = Math.max(1, .06 * px); g.strokeRect(X(bx - 20) - g.lineWidth, X(bz - 20) - g.lineWidth, 40 * px + 2 * g.lineWidth, 40 * px + 2 * g.lineWidth);
    }
    // --- Gras am Rand
    g.fillStyle = '#48512f';
    g.fillRect(0, 0, w, X(-120)); g.fillRect(0, X(120), w, h); g.fillRect(0, 0, X(-120), h); g.fillRect(X(120), 0, w, h);
    for (let i = 0; i < 26000; i++) { const x = rnd() * w, y = rnd() * h; if (x > X(-120) && x < X(120) && y > X(-120) && y < X(120)) continue; g.strokeStyle = `rgba(${(40 + rnd() * 50) | 0},${(60 + rnd() * 60) | 0},${(20 + rnd() * 20) | 0},.8)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-3, 3), y - rr(2, 7)); g.stroke(); }
    // --- Straßenmarkierungen
    const inter = [-100, -50, 0, 50, 100];
    const segs = []; let a0 = -120; for (const c of inter) { segs.push([a0, c - 5]); a0 = c + 5; } segs.push([a0, 120]);
    for (const r of inter) for (const vert of [true, false]) {
      const rect = (a, b, la, lb) => (vert ? R(r + a, b, la, lb) : R(b, r + a, lb, la)); // a: quer zur Straße, b: längs
      for (const [s0, s1] of segs) {
        g.fillStyle = '#d6b53a'; rect(-0.22, s0, 0.1, s1 - s0); rect(0.12, s0, 0.1, s1 - s0);      // Doppel-Mittellinie
        g.fillStyle = 'rgba(225,225,215,.8)'; rect(-4.55, s0, 0.12, s1 - s0); rect(4.43, s0, 0.12, s1 - s0); // Randlinien
        for (let t = s0 + 1; t < s1 - 3; t += 6) { rect(-2.55, t, 0.1, 3); rect(2.45, t, 0.1, 3); }        // Leitlinien gestrichelt
      }
      for (const c of inter) for (const sg of [-1, 1]) { // Zebrastreifen
        const b0 = sg < 0 ? c - 9 : c + 6; g.fillStyle = 'rgba(230,230,220,.78)';
        for (let q = -4.2; q < 4.2; q += 1.1) rect(q, b0, 0.55, 2.4);
      }
    }
    // --- Details: Flecken, Risse, Gullys, Müll
    g.setLineDash([]);
    const onRoad = (x, z) => inter.some((r) => Math.abs(x - r) < 4.5 || Math.abs(z - r) < 4.5);
    const rp = () => { for (let k = 0; k < 40; k++) { const x = rr(-118, 118), z = rr(-118, 118); if (onRoad(x, z)) return [x, z]; } return [0, 20]; };
    for (let i = 0; i < 260; i++) { const [x, z] = rp(); g.fillStyle = `rgba(8,8,8,${rr(.15, .4)})`; g.beginPath(); g.ellipse(X(x), X(z), rr(.3, 1.2) * px, rr(.2, .8) * px, rnd() * 3, 0, 7); g.fill(); } // Ölflecken
    for (let i = 0; i < 40; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(60,70,85,.35)'; g.beginPath(); g.ellipse(X(x), X(z), rr(.6, 1.6) * px, rr(.4, 1) * px, rnd() * 3, 0, 7); g.fill(); } // Pfützen
    for (let i = 0; i < 18; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(5,5,5,.8)'; g.beginPath(); g.ellipse(X(x), X(z), rr(.25, .5) * px, rr(.2, .4) * px, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,120,120,.5)'; g.lineWidth = 1; g.stroke(); } // Schlaglöcher
    for (let i = 0; i < 40; i++) { const [x, z] = rp(); g.fillStyle = '#2a2c2e'; g.beginPath(); g.arc(X(x), X(z), .45 * px, 0, 7); g.fill(); g.strokeStyle = '#6b6e70'; g.lineWidth = Math.max(1, .05 * px); g.stroke(); g.beginPath(); g.moveTo(X(x) - .3 * px, X(z)); g.lineTo(X(x) + .3 * px, X(z)); g.moveTo(X(x), X(z) - .3 * px); g.lineTo(X(x), X(z) + .3 * px); g.stroke(); } // Kanaldeckel
    for (let i = 0; i < 30; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(18,18,18,.6)'; g.fillRect(X(x), X(z), rr(.5, 1.5) * px, rr(.4, 1) * px); g.fillStyle = 'rgba(70,72,74,.35)'; g.fillRect(X(x) + 4, X(z) + 4, rr(.4, 1.2) * px, rr(.3, .8) * px); } // Flickstellen
    for (let i = 0; i < 40; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(15,15,15,.35)'; g.fillRect(X(x), X(z), rr(4, 12) * px, .22 * px); } // Reifenspuren
    g.lineCap = 'round';
    for (let i = 0; i < 700; i++) { // Risse mit Verzweigung
      let x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(10,10,10,${rr(.45, .85)})`; g.lineWidth = Math.max(1, rr(.02, .05) * px);
      g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += rr(-.5, .5) * px; y += rr(-.5, .5) * px; g.lineTo(x, y); if (rnd() < .25) { g.moveTo(x, y); g.lineTo(x + rr(-.6, .6) * px, y + rr(-.6, .6) * px); g.moveTo(x, y); } } g.stroke();
    }
    for (let i = 0; i < 90; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(80,6,6,.4)'; g.beginPath(); g.arc(X(x), X(z), rr(.1, .5) * px, 0, 7); g.fill(); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(X(x) + rr(-1, 1) * px, X(z) + rr(-1, 1) * px, rr(.03, .1) * px, 0, 7); g.fill(); } } // Blut
    for (let i = 0; i < 2600; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = rnd() < .5 ? `rgba(${(150 + rnd() * 90) | 0},${(140 + rnd() * 90) | 0},${(120 + rnd() * 80) | 0},.55)` : 'rgba(95,70,40,.55)'; g.fillRect(x, y, rr(1, 3.5), rr(1, 3.5)); } // Papier, Laub, Splitt
    // --- Feines Korn (pixelgenau)
    const id = g.getImageData(0, 0, w, h), d = id.data; let s = 987654321;
    for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 16) & 31) - 15; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
  }, false);
  tex.anisotropy = aniso;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2; scene.add(m);
  // Detail-Textur (gekachelt) für Schärfe im Nahbereich
  const det = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) { const l = rnd() < .5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr(.08, .35)})`; g.fillRect(rnd() * w, rnd() * h, rr(1, 2.5), rr(1, 2.5)); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${rr(.15, .3)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(1.5, 3.5), 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(rnd() * w - 1, rnd() * h - 1, rr(.8, 1.8), 0, 7); g.fill(); }
  }, true);
  det.repeat.set(CONFIG.mapSize / 1.6, CONFIG.mapSize / 1.6); det.anisotropy = aniso;
  const ov = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize), new THREE.MeshLambertMaterial({ map: det, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  ov.rotation.x = -Math.PI / 2; ov.position.y = 0.004; scene.add(ov);
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

/* ---- Begehbare Gebäude: Erdgeschoss mit 4 Eingängen, Fluren, Räumen und Möbeln ---- */
const interiorSpots = [];
let _interiorMats = null;
function interiorMats() {
  if (_interiorMats) return _interiorMats;
  const plaster = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b3aa98'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},.05)`; g.fillRect(rnd() * w, rnd() * h, rr(2, 18), rr(2, 18)); }
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(60,45,30,.13)'; g.fillRect(rnd() * w, 0, rr(4, 14), h * rr(.2, .9)); }
    g.fillStyle = '#6d6659'; g.fillRect(0, h - 22, w, 22); // Sockelleiste/Verschmutzung
  }, false);
  const floor = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 64) { const o = (y / 32) % 2 ? 32 : 0, t = 60 + rnd() * 30; g.fillStyle = `rgb(${t + 14},${t},${t - 18})`; g.fillRect(x + o - 64 + 1, y + 1, 62, 30); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(rnd() * w, rnd() * h, rr(6, 30), rr(4, 14)); }
  }, true);
  floor.repeat.set(5, 5);
  _interiorMats = {
    plaster: new THREE.MeshLambertMaterial({ map: plaster }), floor: new THREE.MeshLambertMaterial({ map: floor }),
    ceil: lambert(0x8d8a82), wood: lambert(0x6b4a2f), woodDark: lambert(0x3e2b1c), metal: lambert(0x56605e), paper: lambert(0xcfc8b0),
    fab: [lambert(0x5a3a3a), lambert(0x3a4a5a), lambert(0x4a5a3a)],
  };
  return _interiorMats;
}

function buildEnterable(cx, cz, w, d, h, tex) {
  const M = interiorMats(), roofMat = lambert(0x3b3a38);
  const H = 3.4, T = 0.4, CW = 2.6, DOORW = 2.2, DOORH = 2.6, IT = 0.2, RD = 1.3;
  const segMat = (len, ht) => { const t = tex.clone(); t.repeat.set(Math.max(0.5, len / 4), ht / 4); t.needsUpdate = true; return new THREE.MeshLambertMaterial({ map: t }); };
  const solid = (x0, x1, z0, z1, y0, y1, mat, collide = true) => {
    if (x1 - x0 < 0.001 || z1 - z0 < 0.001) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat === 'facade' ? segMat(Math.max(x1 - x0, z1 - z0), y1 - y0) : mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); scene.add(m);
    if (collide) boxes.push({ x0, x1, z0, z1, top: y1, y0 });
  };
  // Wand entlang X (fester z-Bereich) bzw. Z mit optionaler Türöffnung (gc = Mitte, gw = Breite)
  const wallX = (xa, xb, za, zb, gc, gw, mat) => {
    if (gc === null) return solid(xa, xb, za, zb, 0, H, mat);
    solid(xa, gc - gw / 2, za, zb, 0, H, mat); solid(gc + gw / 2, xb, za, zb, 0, H, mat); solid(gc - gw / 2, gc + gw / 2, za, zb, DOORH, H, mat);
  };
  const wallZ = (xa, xb, za, zb, gc, gw, mat) => {
    if (gc === null) return solid(xa, xb, za, zb, 0, H, mat);
    solid(xa, xb, za, gc - gw / 2, 0, H, mat); solid(xa, xb, gc + gw / 2, zb, 0, H, mat); solid(xa, xb, gc - gw / 2, gc + gw / 2, DOORH, H, mat);
  };
  const hw = w / 2, hd = d / 2;
  // Außenwände – je Seite ein Eingang (4 Eingänge)
  wallX(cx - hw, cx + hw, cz - hd, cz - hd + T, cx, DOORW, 'facade');
  wallX(cx - hw, cx + hw, cz + hd - T, cz + hd, cx, DOORW, 'facade');
  wallZ(cx - hw, cx - hw + T, cz - hd + T, cz + hd - T, cz, DOORW, 'facade');
  wallZ(cx + hw - T, cx + hw, cz - hd + T, cz + hd - T, cz, DOORW, 'facade');
  // Obergeschosse (massiv) + Decke
  const hu = h - H, t1 = tex.clone(), t2 = tex.clone(); t1.repeat.set(w / 4, hu / 4); t2.repeat.set(d / 4, hu / 4); t1.needsUpdate = t2.needsUpdate = true;
  const mA = new THREE.MeshLambertMaterial({ map: t1 }), mB = new THREE.MeshLambertMaterial({ map: t2 });
  const up = new THREE.Mesh(new THREE.BoxGeometry(w, hu, d), [mB, mB, roofMat, M.ceil, mA, mA]); up.position.set(cx, H + hu / 2, cz); scene.add(up);
  boxes.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, top: h, y0: H });
  const fl = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * T, 0.04, d - 2 * T), M.floor); fl.position.set(cx, 0.02, cz); scene.add(fl);
  M.floor.map.repeat.set(5, 5);
  // Innenräume: Kreuzflur, vier Räume
  const ihw = hw - T, ihd = hd - T;
  const mat = M.plaster;
  const furn = (sx, sy, sz, m, x, y, z, collide, topH, y0 = 0) => { // Möbelteil
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); scene.add(b);
    if (collide) boxes.push({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2, top: topH, y0 });
  };
  const table = (x, z, alongX) => {
    const [a, b] = alongX ? [1.6, 0.9] : [0.9, 1.6];
    furn(a, 0.06, b, M.wood, x, 0.76, z, true, 0.79, 0.7);
    for (const lx of [-1, 1]) for (const lz of [-1, 1]) furn(0.06, 0.73, 0.06, M.woodDark, x + lx * (a / 2 - 0.06), 0.365, z + lz * (b / 2 - 0.06), true, 0.73);
  };
  const chair = (x, z, tip) => {
    const m = M.fab[(rnd() * 3) | 0];
    if (tip) { furn(0.45, 0.06, 0.45, m, x, 0.18, z, false); furn(0.06, 0.45, 0.45, m, x + 0.22, 0.25, z, false); furn(0.45, 0.4, 0.45, m, x, 0.2, z, true, 0.4); }
    else { furn(0.45, 0.06, 0.45, m, x, 0.46, z, false); furn(0.45, 0.5, 0.06, m, x, 0.72, z - 0.2, false); furn(0.4, 0.46, 0.4, M.woodDark, x, 0.23, z, true, 0.5); }
  };
  const cabinet = (x, z, sx, sz, hgt, m) => {
    furn(sx, hgt, sz, m, x, hgt / 2, z, true, hgt);
    if (hgt > 1.4) { const dk = sx > sz; furn(dk ? 0.02 : sx + 0.02, hgt - 0.2, dk ? sz + 0.02 : 0.02, M.woodDark, x, hgt / 2, z, false); }
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // Raumwände (Tür zum Flur; zweite Tür zufällig)
    const xa = sx > 0 ? cx + RD : cx - ihw, xb = sx > 0 ? cx + ihw : cx - RD;
    const za = sz > 0 ? cz + RD : cz - ihd, zb = sz > 0 ? cz + ihd : cz - RD;
    const wz = sz > 0 ? [cz + RD, cz + RD + IT] : [cz - RD - IT, cz - RD];   // Wand zum E-W-Flur
    const wx = sx > 0 ? [cx + RD, cx + RD + IT] : [cx - RD - IT, cx - RD];   // Wand zum N-S-Flur
    wallX(xa, xb, wz[0], wz[1], (xa + xb) / 2 + sx * 0.4, 1.3, mat);
    wallZ(wx[0], wx[1], za, zb, rnd() < 0.5 ? (za + zb) / 2 - sz * 0.4 : null, 1.3, mat);
    // Raumgrenzen (innen)
    const rx0 = Math.min(xa, xb) + (sx > 0 ? IT + 0.1 : 0.1), rx1 = Math.max(xa, xb) - (sx > 0 ? 0.1 : IT + 0.1);
    const rz0 = Math.min(za, zb) + (sz > 0 ? IT + 0.1 : 0.1), rz1 = Math.max(za, zb) - (sz > 0 ? 0.1 : IT + 0.1);
    const fx = sx > 0 ? rx1 : rx0, fz = sz > 0 ? rz1 : rz0;               // ferne Wände (außen)
    const midx = (rx0 + rx1) / 2, midz = (rz0 + rz1) / 2;
    const kind = (rnd() * 3) | 0;
    // Schränke an den Außenwänden
    cabinet(fx - sx * 0.3, midz + rr(-1, 1), 0.5, 1.1, rr(1.7, 2.1), M.wood);
    if (kind !== 1) cabinet(midx + rr(-1.2, 1.2), fz - sz * 0.3, 1.1, 0.5, rr(1.2, 2), M.metal);
    // Tisch + Stühle
    if (kind !== 2) {
      const tx = midx + sx * 0.5, tz = midz + sz * 0.5, ax = rnd() < 0.5;
      table(tx, tz, ax);
      const off = ax ? [[0, -0.75], [0, 0.75], [-1.05, 0], [1.05, 0]] : [[-0.75, 0], [0.75, 0], [0, -1.05], [0, 1.05]];
      for (let i = 0; i < 3 + (rnd() < 0.5 ? 1 : 0); i++) chair(tx + off[i][0] + rr(-0.15, 0.15), tz + off[i][1] + rr(-0.15, 0.15), rnd() < 0.3);
    } else { // Lagerraum: Kisten + Regal
      cabinet(midx, midz, 1.0, 1.0, 1.0, lambert(0x6b5a3c)); cabinet(midx + sx * 1.3, midz - sz * 0.8, 0.8, 0.8, 0.8, lambert(0x555a40));
      cabinet(midx - sx * 0.6, fz - sz * 0.3, 2.2, 0.45, 1.9, M.metal);
    }
    // Papiere am Boden
    for (let i = 0; i < 3; i++) furn(rr(0.2, 0.4), 0.01, rr(0.15, 0.3), M.paper, midx + rr(-2, 2), 0.045, midz + rr(-2, 2), false);
  }
  // Flurobjekte
  if (rnd() < 0.7) chair(cx + rr(-0.4, 0.4), cz - hd + T + 1.6, true);
  if (rnd() < 0.6) cabinet(cx + RD - 0.3, cz + hd - T - 0.4, 0.5, 0.6, 1.0, lambert(0x6b5a3c));
  interiorSpots.push({ x: cx, z: cz });
  if (rnd() < 0.5) interiorSpots.push({ x: cx + (rnd() < 0.5 ? -1 : 1) * 3.2, z: cz + 0.0 });
  if (rnd() < 0.5) { const a = new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2, d * .3), roofMat); a.position.set(cx + rr(-w / 4, w / 4), h + 1, cz + rr(-d / 4, d / 4)); scene.add(a); }
}

function buildCity() {
  const bases = ['#8c8479', '#7a6d62', '#6c7378', '#8a6b5a', '#5f625b'];
  const lits = ['#ffd98a', '#cfe8ff'];
  const roofMat = lambert(0x3b3a38);
  let houseCount = 0;
  const addBuilding = (cx, cz, w, d, h, canEnter) => {
    const tex = facadeTexture(bases[(rnd() * bases.length) | 0], lits[(rnd() * 2) | 0]);
    if (canEnter && w >= 12 && d >= 12 && ++houseCount % 3 === 0) { buildEnterable(cx, cz, w, d, Math.max(h, 8), tex); return; }
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
      if (rnd() < 0.78) addBuilding(cx, cz, rr(12, 17), rr(12, 17), rr(8, 26), true);
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
  // ---- Autos (Profil-Extrusion, Räder, Lichter, Rost/Schmutz, Schäden)
  const carColors = [0x7a2a22, 0x2c3e55, 0x4a5a4a, 0x8a7a3a, 0x252525, 0x6a6a70, 0xb8b8b0, 0x30506a];
  const prof = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; };
  const ext = (pts, depth, bev) => { const g = new THREE.ExtrudeGeometry(prof(pts), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, steps: 1 }); g.translate(0, 0, -depth / 2); return g; };
  const carBodyG = ext([[-2.15, 0.32], [-2.15, 0.82], [-1.7, 0.94], [-0.9, 0.98], [1.0, 0.98], [1.7, 0.86], [2.15, 0.7], [2.15, 0.32]], 1.7, 0.05);
  const carCabG = ext([[-1.15, 0.97], [-0.8, 1.48], [0.5, 1.48], [1.0, 0.97]], 1.55, 0.03);
  const roofG = new THREE.BoxGeometry(1.4, 0.07, 1.62), wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14), hubG = new THREE.CylinderGeometry(0.17, 0.17, 0.28, 8);
  wheelG.rotateX(Math.PI / 2); hubG.rotateX(Math.PI / 2);
  const dirt = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const l = (150 + rnd() * 105) | 0; g.fillStyle = `rgba(${l},${l},${l},.35)`; g.fillRect(rnd() * w, rnd() * h, rr(1, 6), rr(1, 6)); }
    for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(${(120 + rnd() * 40) | 0},${(60 + rnd() * 30) | 0},30,${rr(.35, .7)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(2, 8), 0, 7); g.fill(); }
    for (let i = 0; i < 20; i++) { g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = rr(1, 2); const x = rnd() * w; g.beginPath(); g.moveTo(x, rnd() * h * .4); g.lineTo(x + rr(-3, 3), h); g.stroke(); }
  }, true);
  const glassM = new THREE.MeshLambertMaterial({ color: 0x151b20 }), glassBroken = new THREE.MeshLambertMaterial({ color: 0x3a4650 });
  const tireM = lambert(0x111111), hubM = lambert(0x8a8d90), blackM = lambert(0x1a1a1a), chromeM = lambert(0x9a9da0);
  const headM = new THREE.MeshBasicMaterial({ color: 0xf1e7b0 }), tailM = new THREE.MeshBasicMaterial({ color: 0x8a1212 }), plateM = lambert(0xc9c4a0);
  const burntM = lambert(0x161412), burntRoof = lambert(0x24211e);
  function makeCar() {
    const burned = rnd() < 0.15, g = new THREE.Group();
    const body = burned ? burntM : new THREE.MeshLambertMaterial({ color: carColors[(rnd() * carColors.length) | 0], map: dirt });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(carBodyG, body, 0, 0, 0);
    add(carCabG, burned ? burntRoof : (rnd() < 0.4 ? glassBroken : glassM), 0, 0, 0);
    add(roofG, burned ? burntRoof : body, -0.15, 1.51, 0);
    const bx = (sx, sy, sz, m, x, y, z) => add(new THREE.BoxGeometry(sx, sy, sz), m, x, y, z);
    bx(0.14, 0.2, 1.8, blackM, 2.2, 0.42, 0); bx(0.14, 0.2, 1.8, blackM, -2.2, 0.42, 0);       // Stoßfänger
    bx(0.05, 0.18, 0.9, blackM, 2.2, 0.68, 0);                                              // Kühlergrill
    for (const sz of [-0.65, 0.65]) { bx(0.06, 0.13, 0.3, burned ? blackM : headM, 2.18, 0.7, sz); bx(0.06, 0.12, 0.3, burned ? blackM : tailM, -2.16, 0.78, sz); }
    bx(0.04, 0.12, 0.45, plateM, -2.24, 0.5, 0);
    for (const sz of [-1, 1]) {
      bx(0.08, 0.1, 0.12, blackM, 0.95, 1.05, sz * 0.9);                                       // Spiegel
      bx(0.012, 0.5, 0.012, blackM, -0.15, 0.7, sz * 0.88); bx(0.012, 0.5, 0.012, blackM, 0.85, 0.7, sz * 0.88);        // Türfugen
      bx(0.14, 0.03, 0.03, chromeM, 0.1, 0.9, sz * 0.88);                                    // Türgriff
    }
    const flat = rnd() < 0.3 ? (rnd() * 4) | 0 : -1;
    [[1.38, .87], [1.38, -.87], [-1.32, .87], [-1.32, -.87]].forEach(([x, z], i) => {
      const w = add(wheelG, tireM, x, i === flat ? 0.26 : 0.34, z); add(hubG, hubM, x, i === flat ? 0.26 : 0.34, z + (z > 0 ? 0.01 : -0.01)); if (i === flat) w.scale.y = 0.8;
    });
    if (flat >= 0) g.rotation.z = (flat < 2 ? 1 : -1) * 0.025 * (flat % 2 ? 1 : -1);
    return g;
  };
  for (let i = 0; i < 46; i++) {
    const vertical = rnd() < 0.5, road = (((rnd() * 5) | 0) - 2) * 50;
    const along = rr(-115, 115);
    let x = vertical ? road + rr(-3.6, 3.6) : along, z = vertical ? along : road + rr(-3.6, 3.6);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue; // Spawn freihalten
    const g = makeCar();
    g.position.set(x, 0, z);
    g.rotation.y = (vertical ? Math.PI / 2 : 0) + (rnd() < 0.5 ? Math.PI : 0) + rr(-0.06, 0.06);
    scene.add(g);
    vertical ? addBox(x, z, 1.9, 4.5, 1.5) : addBox(x, z, 4.5, 1.9, 1.5);
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
function supportY(x, z, feetY, r, stepH) {
  let y = 0;
  for (const b of boxes) {
    if (b.y0 || b.top > feetY + stepH || b.top <= y) continue;
    if (x > b.x0 - r * 0.6 && x < b.x1 + r * 0.6 && z > b.z0 - r * 0.6 && z < b.z1 + r * 0.6) y = b.top;
  }
  return y;
}
const _o = new THREE.Vector3();
function rayBox(o, d, b, maxT) { // -> {t, nx, nz} | null
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

const models = { player: null, zombies: [] };
// Gelenke des Zombie-GLB (Knoten-Indizes aus der Datei) -> Pivot-Gruppen, damit sie per Code animiert werden können
// Knoten 9/18 = Hüfte/Beine (y≈0.95), 34/46 = Schultern/Arme (im Oberkörper-Knoten 74), 33/45 = Unterarme, 73 = Kopf
const ZOMBIE_RIG = { head: 73, armL: 34, armR: 46, foreL: 33, foreR: 45, legL: 9, legR: 18 };
async function rigZombie(gltf, wrap) {
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
async function tryLoadModel(url, rig) {
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
  flash.visible = true; flash.rotation.z = rnd() * 6; flash.scale.setScalar(w.pellets > 1 ? 1.8 : 1 + rnd() * 0.5); flashLight.intensity = 22; player.flashT = 0.05;
  if (a.mag === 0 && a.reserve > 0) setTimeout(startReload, 250);
  updateHUD();
}

/* ---------------- Zombies ---------------- */
const zombies = [];
let killsTotal = 0;
function spawnZombie(x, z, opts = {}) {
  let root, parts = null;
  const src = models.zombies.length ? models.zombies[(rnd() * models.zombies.length) | 0] : null;
  if (src) {
    root = src.clone(true); const pv = (n) => root.getObjectByName('pv_' + n);
    parts = { head: pv('head'), armL: pv('armL'), armR: pv('armR'), foreL: pv('foreL'), foreR: pv('foreR'), legL: pv('legL'), legR: pv('legR'), torso: { rotation: { x: 0, y: 0, z: 0 } } };
    if (!parts.head || !parts.armL || !parts.legL) parts = null; // Rig unvollständig -> nur Ganzkörper-Animation
  } else { root = buildHumanoid(ZOMBIE_SPEC); parts = root.parts; }
  const sc = rr(0.95, 1.08); root.scale.setScalar(sc);
  const runner = opts.runner ?? rnd() < 0.2;
  const hp = (opts.hp || 100) * (runner ? 0.7 : 1);
  const zb = {
    root, parts, pos: new THREE.Vector3(x, 0, z), yaw: rr(0, 6.28), hp, maxHp: hp, state: 'wander', t: rnd() * 5,
    speed: (runner ? rr(3.2, 4.2) : rr(1.1, 2.0)) * (opts.speedMul || 1), dmg: opts.dmg || 12, atkCd: 0, stun: 0, headY: ((src && src.userData.headY) || 1.62) * sc,
    wander: new THREE.Vector3(x, 0, z), phase: rnd() * 6, stuckT: 0, lastP: new THREE.Vector3(x, 0, z), side: 0, dieT: 0, fall: rnd() < 0.5 ? -1 : 1, groanT: rr(3, 9),
    target: null, runner,
  };
  root.position.copy(zb.pos); scene.add(root); applyShaderTo(root); zombies.push(zb); return zb;
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
    z.parts.armL.rotation.x = arm; z.parts.armR.rotation.x = arm + 0.1;
    if (z.parts.foreL) { z.parts.foreL.rotation.x = -0.7; z.parts.foreR.rotation.x = -0.7; } z.parts.armL.rotation.z = 0.08; z.parts.armR.rotation.z = -0.08;
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
    const sp = i < 6 && interiorSpots.length ? interiorSpots[(i * 7 + (rnd() * 3 | 0)) % interiorSpots.length] : null;
    const p = sp ? { x: sp.x + rr(-0.6, 0.6), z: sp.z + rr(-0.6, 0.6) } : randomSpawn(8, 110); const ammo = i % 3 !== 0;
    const m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.28), ammo ? ammoM : medM); m.add(b);
    if (!ammo) { const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.3), red), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.3), red); m.add(c1, c2); }
    m.position.set(p.x, 0.6, p.z); scene.add(m); applyShaderTo(m); pickups.push({ m, ammo, t: 0, x: p.x, z: p.z });
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
function lookDelta(dx, dy) { const k = CONFIG.lookSensitivity * settings.sens / 100; player.yaw -= dx * k; player.pitch = clamp(player.pitch - dy * k, -1.45, 1.45); }
function joyUpdate(x, y) {
  let dx = x - joy.cx, dy = y - joy.cy; const R = 60, d = Math.hypot(dx, dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  input.mx = dx / R; input.mz = dy / R; // mz>0 = rückwärts
  if (d > R * 1.1) input.sprintAuto = true; else input.sprintAuto = false;
}
function joyReset() { joy.id = null; input.mx = input.mz = 0; input.sprintAuto = false; joyKnob.style.transform = 'translate(0,0)'; joyBase.classList.add('idle'); joyBase.style.left = joyBase.style.top = joyBase.style.bottom = ''; }
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('.btn')) return;
  if (!gameRunning() || e.pointerType === 'mouse') return;
  if (e.clientX < window.innerWidth * 0.4 && joy.id === null) {
    joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joyBase.classList.remove('idle'); joyBase.style.left = (joy.cx - 75) + 'px'; joyBase.style.top = (joy.cy - 75) + 'px'; joyBase.style.bottom = 'auto'; joyUpdate(e.clientX, e.clientY);
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
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (editMode) return; b.classList.add('down'); down(e); });
  const end = (e) => { b.classList.remove('down'); if (upfn && !editMode) upfn(e); };
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
const gameRunning = () => running && !player.dead && !paused;
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

let last = performance.now(), lastRender = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const minDt = 1000 / settings.fps, el = now - lastRender;
  if (el < minDt - 1) return;
  lastRender = now - (el % minDt);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (running && !paused) update(dt);
  sky.position.copy(camera.position); stars.position.copy(camera.position); stars.rotation.y += dt * 0.003;
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
    else if (autoFire && aimingAtZombie(w.range)) shoot();
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
  updateArrow();
}
// Auto-Feuer: schießt automatisch, sobald das Fadenkreuz auf einen (nicht verdeckten) Zombie zeigt
let autoFire = false;
function aimingAtZombie(range) {
  const cp = Math.cos(player.pitch), d = _d.set(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp);
  const o = new THREE.Vector3(player.pos.x, player.pos.y + CONFIG.eyeHeight, player.pos.z);
  let tz = Infinity;
  for (const z of zombies) {
    if (z.state === 'dead' || z.state === 'dying') continue;
    tz = Math.min(tz, raySphere(o, d, _o.set(z.pos.x, z.pos.y + z.headY, z.pos.z), 0.25));
    for (const yy of [0.35, 0.8, 1.25]) tz = Math.min(tz, raySphere(o, d, _o.set(z.pos.x, z.pos.y + yy, z.pos.z), 0.38));
  }
  if (tz > range) return false;
  for (const b of boxes) { const h = rayBox(o, d, b, tz); if (h && h.t < tz) return false; }
  return true;
}
$('btnAuto').addEventListener('click', () => { autoFire = !autoFire; $('btnAuto').classList.toggle('on', autoFire); toast(autoFire ? 'AUTO-FEUER AN' : 'AUTO-FEUER AUS'); });
// Richtungspfeil zum nächsten Zombie (nur bei weniger als 10 lebenden Zombies)
function updateArrow() {
  const el = $('zArrow'); let best = null, bd = Infinity, n = 0;
  for (const z of zombies) { if (z.state === 'dead' || z.state === 'dying') continue; n++; const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z); if (d < bd) { bd = d; best = z; } }
  if (!best || n >= 10 || player.dead) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const dx = best.pos.x - player.pos.x, dz = best.pos.z - player.pos.z, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const right = dx * cy - dz * sy, fwd = -dx * sy - dz * cy; // Kamera blickt nach (-sin yaw, -cos yaw)
  $('zArrowIcon').style.transform = `rotate(${Math.atan2(right, fwd) * 180 / Math.PI}deg)`;
  $('zDist').textContent = Math.round(bd) + ' m';
}

/* ---------------- Optionen: Steuerung, Grafik, Shader ---------------- */
const SETTINGS_KEY = 'deadcity_settings_v1';
const settings = { night: false, fps: 60, res: 1, shader: 'off', gloss: 100, sens: 100, btnScale: 100, layout: {} };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* ignorieren */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignorieren */ } };
let paused = false, editMode = false;

/* Himmel: Farbverlauf-Kuppel, Sterne, Mond/Sonne */
const skyGeo = new THREE.SphereGeometry(200, 24, 14);
skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -2; sky.frustumCulled = false; scene.add(sky);
const starGeo = new THREE.BufferGeometry(), SN = 1500, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
for (let i = 0; i < SN; i++) {
  const u = rnd() * 6.2832, v = Math.pow(rnd(), 0.8) * 0.98 + 0.02, r = Math.sqrt(1 - v * v), b = 0.45 + rnd() * 0.55, tint = rnd();
  sp.set([Math.cos(u) * r * 190, v * 190, Math.sin(u) * r * 190], i * 3);
  sc.set([b * (tint < 0.2 ? 1 : 0.85), b * (tint < 0.2 ? 0.85 : 0.92), b * (tint > 0.8 ? 1 : 0.9) ], i * 3);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false }));
stars.renderOrder = -1; stars.frustumCulled = false; scene.add(stars);
const orb = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide, depthWrite: false }));
const orbGlow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
orb.renderOrder = orbGlow.renderOrder = -1; orb.frustumCulled = orbGlow.frustumCulled = false; sky.add(orb); sky.add(orbGlow);
const torch = new THREE.SpotLight(0xfff0d0, 0, 55, 0.5, 0.5, 1.4); // Taschenlampe (nachts)
torch.position.set(0.15, -0.15, 0); torch.target.position.set(0, 0, -6); camera.add(torch); camera.add(torch.target);

function paintSky(horizon, zenith) {
  const pos = skyGeo.attributes.position, col = skyGeo.attributes.color, h = new THREE.Color(horizon), z = new THREE.Color(zenith), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const t = Math.pow(Math.max(0, pos.getY(i) / 200), 0.6); c.copy(h).lerp(z, t); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true;
}
function applyTime() {
  const n = settings.night;
  if (n) {
    scene.fog.color.setHex(0x070b14); scene.fog.near = 4; scene.fog.far = 85; scene.background.setHex(0x070b14);
    hemi.color.setHex(0x34487a); hemi.groundColor.setHex(0x0c0c14); hemi.intensity = 0.85;
    sun.color.setHex(0x8aa4ff); sun.intensity = 0.5; paintSky(0x0a1224, 0x01020a);
    orb.material.color.setHex(0xe6edff); orb.scale.setScalar(9); orb.position.set(-50, 95, -150); orbGlow.material.color.setHex(0x8aa4ff); orbGlow.scale.setScalar(9); orbGlow.position.copy(orb.position);
    torch.intensity = 70;
  } else {
    scene.fog.color.setHex(0x7d8893); scene.fog.near = 25; scene.fog.far = 130; scene.background.setHex(0x7d8893);
    hemi.color.setHex(0xb8c4d4); hemi.groundColor.setHex(0x3a3630); hemi.intensity = 1.25;
    sun.color.setHex(0xffe2b8); sun.intensity = 1.1; paintSky(0x8d98a3, 0x4f7096);
    orb.material.color.setHex(0xfff2c8); orb.scale.setScalar(13); orb.position.set(60, 100, -150); orbGlow.material.color.setHex(0xffe0a0); orbGlow.scale.setScalar(13); orbGlow.position.copy(orb.position);
    torch.intensity = 0;
  }
  stars.visible = n;
}

/* Shader: Glanz-Materialien + Farbfilter */
const SHADERS = {
  off:    { phong: false, shin: 0,   spec: 0,        filter: '' },
  gloss:  { phong: true,  shin: 70,  spec: 0x666666, filter: 'contrast(1.05) saturate(1.1)' },
  wet:    { phong: true,  shin: 140, spec: 0xaabbcc, filter: 'contrast(1.1) saturate(1.05) brightness(.97)' },
  cinema: { phong: true,  shin: 45,  spec: 0x3a3a3a, filter: 'contrast(1.2) saturate(1.35) sepia(.15)' },
  horror: { phong: false, shin: 0,   spec: 0,        filter: 'grayscale(.6) contrast(1.3) brightness(.9)' },
};
const phongCache = new Map();
function phongOf(m) {
  let p = phongCache.get(m);
  if (!p) { p = new THREE.MeshPhongMaterial({ color: m.color, map: m.map, side: m.side, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits }); p.userData.orig = m; phongCache.set(m, p); }
  return p;
}
function applyShaderTo(root) {
  const cfg = SHADERS[settings.shader] || SHADERS.off;
  const swap = (m) => {
    if (m.isMeshPhongMaterial && m.userData.orig) { if (!cfg.phong) return m.userData.orig; m.shininess = cfg.shin; m.specular.setHex(cfg.spec).multiplyScalar(settings.gloss / 100); return m; }
    if (m.isMeshLambertMaterial && cfg.phong) { const p = phongOf(m); p.shininess = cfg.shin; p.specular.setHex(cfg.spec).multiplyScalar(settings.gloss / 100); return p; }
    return m;
  };
  root.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material); });
}
function applyShader() { applyShaderTo(scene); canvas.style.filter = (SHADERS[settings.shader] || SHADERS.off).filter; }

function applyRes() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.res)); renderer.setSize(window.innerWidth, window.innerHeight); }

/* Tasten-Layout */
const BTN_IDS = ['btnFire', 'btnJump', 'btnReload', 'btnSwap', 'btnSprint'];
function applyLayout() {
  $('hud').style.setProperty('--bs', settings.btnScale / 100);
  for (const id of BTN_IDS) {
    const f = settings.layout[id], el = $(id); if (!f) continue;
    el.style.left = clamp(f.x * window.innerWidth, 0, window.innerWidth - 40) + 'px'; el.style.top = clamp(f.y * window.innerHeight, 0, window.innerHeight - 40) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
  }
}
window.addEventListener('resize', applyLayout);
let drag = null;
for (const id of BTN_IDS) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { if (!editMode) return; drag = { id, pid: e.pointerId, dx: e.clientX - b.getBoundingClientRect().left, dy: e.clientY - b.getBoundingClientRect().top }; });
  b.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== id || drag.pid !== e.pointerId) return;
    const r = b.getBoundingClientRect(), x = clamp(e.clientX - drag.dx, 0, window.innerWidth - r.width), y = clamp(e.clientY - drag.dy, 0, window.innerHeight - r.height);
    b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto'; settings.layout[id] = { x: x / window.innerWidth, y: y / window.innerHeight };
  });
  const endDrag = () => { if (drag && drag.id === id) { drag = null; saveSettings(); } };
  b.addEventListener('pointerup', endDrag); b.addEventListener('pointercancel', endDrag);
}
function resetLayout() {
  settings.layout = {}; settings.btnScale = 100; $('optBtnScale').value = 100;
  for (const id of BTN_IDS) { const el = $(id); el.style.left = el.style.top = el.style.right = el.style.bottom = ''; }
  applyLayout(); saveSettings();
}

/* Menü */
function setPaused(p) { paused = p; if (p) { input.fire = false; input.jump = false; input.fireQueued = false; joyReset(); look.id = null; } }
function openOptions() { setPaused(true); $('options').classList.remove('hidden'); }
function closeOptions() { $('options').classList.add('hidden'); if (!editMode) setPaused(false); }
function setEdit(on) {
  editMode = on; $('hud').classList.toggle('editing', on); $('editBar').classList.toggle('hidden', !on);
  if (on) { $('options').classList.add('hidden'); setPaused(true); } else setPaused(false);
}
$('btnOptions').addEventListener('click', openOptions);
$('btnCloseOptions').addEventListener('click', closeOptions);
$('btnEditLayout').addEventListener('click', () => setEdit(true));
$('btnEditDone').addEventListener('click', () => setEdit(false));
$('btnEditReset').addEventListener('click', resetLayout);
$('btnResetLayout').addEventListener('click', resetLayout);
document.querySelectorAll('#options .tabs button').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('#options .tabs button').forEach((x) => x.classList.toggle('on', x === t));
  document.querySelectorAll('#options .tab').forEach((x) => x.classList.toggle('hidden', x.id !== 'tab-' + t.dataset.tab));
}));
function bindSeg(id, key, parse, onChange) {
  const seg = $(id), sync = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(b.dataset.val) === String(settings[key])));
  seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings[key] = parse(b.dataset.val); sync(); saveSettings(); onChange(); });
  sync();
}
bindSeg('optTime', 'night', (v) => v === 'night', applyTime);
bindSeg('optFps', 'fps', Number, () => {});
bindSeg('optRes', 'res', Number, applyRes);
bindSeg('optShader', 'shader', String, applyShader);
function bindRange(id, key, onChange) { const el = $(id); el.value = settings[key]; el.addEventListener('input', () => { settings[key] = +el.value; saveSettings(); onChange && onChange(); }); }
bindRange('optBtnScale', 'btnScale', applyLayout); bindRange('optSens', 'sens'); bindRange('optGloss', 'gloss', applyShader);
function applyAllSettings() { applyTime(); applyShader(); applyRes(); applyLayout(); }

/* ---------------- Start ---------------- */
async function init() {
  buildGround(); buildCity();
  $('loadText').textContent = 'Lade Modelle …';
  const [pm, ...zms] = await Promise.all([tryLoadModel(CONFIG.playerModelUrl), ...CONFIG.zombieModelUrls.map((u) => tryLoadModel(u, rigZombie))]);
  models.zombies = zms.filter(Boolean);
  bodyModel = pm || buildHumanoid(PLAYER_SPEC); bodyModel.visible = false; scene.add(bodyModel); // Spielerkörper (Ego-Perspektive: ausgeblendet)
  $('loading').classList.add('hidden');
  selectWeapon(0); applyAllSettings();
  // Menü-Hintergrund
  camera.position.set(0, 1.7, 8);
  requestAnimationFrame(frame);
}
init().catch((e) => { $('loadText').textContent = 'Fehler: ' + e.message; console.error(e); });
window.__game = { CONFIG, player, zombies, spawnZombie, waves };
