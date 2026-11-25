import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildZombie, disposeZombie, ZOMBIE_COUNT } from './zombiegen.js';

/* ============================================================
   DEAD CITY – 3D Zombie Shooter (Three.js, Android via Capacitor)
   ============================================================ */

const CONFIG = {
  mapSize: 250,
  wavesEnabled: true,       // Zombie-Wellen: Welle n = 10·n Zombies (Welle 30 = alle 300 Varianten)
  maxWave: 30,
  soundVoices: 5,           // nur die nächsten N Zombies machen Schritt-/Stöhn-Geräusche
  soundRange: 40,           // Hörweite in Metern
  maxAlive: 9999,           // gleichzeitig lebende Zombies (bei Leistungsproblemen z.B. auf 40 setzen)
  spawnInterval: 0.12,      // Sekunden zwischen Spawns (verteilt das Erzeugen der Zombies)
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


/* ============================================================
   Deckungsobjekte: Holzkisten, Fässer, Betonbarrieren
   Nur Optik! Kollisionsboxen (addBox) bleiben exakt wie vorher.
   Eigener Zufallsgenerator -> die Map-Zufallsfolge (seed) bleibt unverändert.
   ============================================================ */
function mkRng(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashXZ = (x, z) => Math.floor(x * 131.7 + z * 71.3) & 0x7fffffff;
const c8 = (v) => Math.max(0, Math.min(255, v | 0));
const shade = (rgb, k, a = 1) => `rgba(${c8(rgb[0] * k)},${c8(rgb[1] * k)},${c8(rgb[2] * k)},${a})`;

// Alte Farbe -> Kisten-Stil (gleiche Farbzuordnung wie vorher: braun / grün / grau)
const CRATE_STYLES = {
  0x6b5a3c: { wood: [132, 98, 58], chip: null, stencil: null, straps: false },            // Holzkiste (natur)
  0x4d5a3c: { wood: [82, 96, 58], chip: [120, 90, 56], stencil: 'AMMO', straps: false },   // Militärkiste (olivgrün lackiert)
  0x555a60: { wood: [112, 98, 78], chip: null, stencil: null, straps: true },              // Kiste mit Stahlbändern
};
const crateStyle = (c) => CRATE_STYLES[c] || CRATE_STYLES[0x6b5a3c];

function woodGrain(g, x, y, w, h, vertical, rgb, rng, n) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const dark = rng() < 0.7; g.strokeStyle = dark ? shade(rgb, 0.45, rr2(rng, 0.1, 0.28)) : shade(rgb, 1.4, rr2(rng, 0.06, 0.16));
    g.lineWidth = rr2(rng, 0.6, 1.8); g.beginPath();
    if (vertical) { const px = x + rng() * w, wob = rr2(rng, -2, 2); g.moveTo(px, y); g.bezierCurveTo(px + wob, y + h * 0.33, px - wob, y + h * 0.66, px + wob * 0.5, y + h); }
    else { const py = y + rng() * h, wob = rr2(rng, -2, 2); g.moveTo(x, py); g.bezierCurveTo(x + w * 0.33, py + wob, x + w * 0.66, py - wob, x + w, py + wob * 0.5); }
    g.stroke();
  }
  g.restore();
}
const rr2 = (rng, a, b) => a + (b - a) * rng();

function knot(g, x, y, r, rgb) {
  for (let i = 4; i >= 1; i--) { g.fillStyle = shade(rgb, 0.4 + i * 0.08, 0.55); g.beginPath(); g.ellipse(x, y, r * i / 2.2, r * i / 3.2, 0, 0, 7); g.fill(); }
  g.fillStyle = shade(rgb, 0.3, 0.8); g.beginPath(); g.ellipse(x, y, r * 0.3, r * 0.2, 0, 0, 7); g.fill();
}

function nail(g, x, y, S, rust) {
  const r = S * 0.012 + 1;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x + 0.8, y + 1, r + 0.6, 0, 7); g.fill();
  g.fillStyle = rust ? '#6a4a34' : '#7d7f80'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, 7); g.fill();
}

function beamEdges(g, x, y, w, h) { // Kanten-Schatten/Licht, damit Leisten plastisch wirken
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.strokeStyle = 'rgba(255,235,200,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 3, y + h - 3); g.lineTo(x + 3, y + 3); g.lineTo(x + w - 3, y + 3); g.stroke();
}

function drawCrateSide(g, S, st, rng) {
  const rgb = st.wood, fx = S * 0.1, fy = S * 0.11, n = 4, ph = (S - 2 * fy) / n;
  g.fillStyle = shade(rgb, 0.4); g.fillRect(0, 0, S, S);
  // Bretter (waagerecht) mit Fugen, Maserung, Ästen
  for (let i = 0; i < n; i++) {
    const y0 = fy + i * ph, k = 0.85 + rng() * 0.3;
    g.fillStyle = shade(rgb, k); g.fillRect(0, y0, S, ph);
    woodGrain(g, 0, y0, S, ph, false, rgb, rng, 11);
    if (rng() < 0.6) knot(g, fx + 8 + rng() * (S - 2 * fx - 16), y0 + ph * (0.3 + rng() * 0.4), 5 + rng() * 5, rgb);
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, y0, S, 2.2);                     // Fuge oben
    g.fillStyle = 'rgba(255,235,200,.12)'; g.fillRect(0, y0 + 2.2, S, 1.2);          // Lichtkante
  }
  // Diagonale Strebe (zwischen den Rahmenleisten)
  g.save(); g.beginPath(); g.rect(fx, fy, S - 2 * fx, S - 2 * fy); g.clip();
  g.translate(S / 2, S / 2); const iw = S - 2 * fx, ih = S - 2 * fy; g.rotate(rng() < 0.5 ? Math.atan2(-ih, iw) : Math.atan2(ih, iw));
  const len = Math.hypot(iw, ih) + 8, th = S * 0.1;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-len / 2 + 2, -th / 2 + 4, len, th);
  g.fillStyle = shade(rgb, 1.02); g.fillRect(-len / 2, -th / 2, len, th);
  g.save(); g.translate(0, 0); woodGrain(g, -len / 2, -th / 2, len, th, false, rgb, rng, 8); g.restore();
  beamEdges(g, -len / 2, -th / 2, len, th);
  g.restore();
  // Rahmen: linke/rechte Pfosten + obere/untere Leiste
  const beam = (x, y, w, h, vert) => {
    g.fillStyle = shade(rgb, 0.92); g.fillRect(x, y, w, h); woodGrain(g, x, y, w, h, vert, rgb, rng, vert ? 5 : 7); beamEdges(g, x, y, w, h);
  };
  beam(0, 0, S, fy, false); beam(0, S - fy, S, fy, false); beam(0, fy, fx, S - 2 * fy, true); beam(S - fx, fy, fx, S - 2 * fy, true);
  // Nägel
  const rustN = st.chip === null;
  for (let i = 0; i < n; i++) { const yc = fy + (i + 0.5) * ph; nail(g, fx * 0.5, yc, S, rustN); nail(g, S - fx * 0.5, yc, S, rustN); }
  for (const x of [fx * 0.5, S * 0.3, S * 0.7, S - fx * 0.5]) { nail(g, x, fy * 0.5, S, rustN); nail(g, x, S - fy * 0.5, S, rustN); }
  // Stahlbänder
  if (st.straps) {
    for (const yy of [S * 0.27, S * 0.66]) {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, yy + 3, S, S * 0.085);
      const gr = g.createLinearGradient(0, yy, 0, yy + S * 0.085); gr.addColorStop(0, '#6b7176'); gr.addColorStop(0.5, '#454a4e'); gr.addColorStop(1, '#2f3336');
      g.fillStyle = gr; g.fillRect(0, yy, S, S * 0.085);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, yy + 1, S, 1.4);
      for (let x = S * 0.06; x < S; x += S * 0.17) { g.fillStyle = '#1d2022'; g.beginPath(); g.arc(x, yy + S * 0.0425, 3.2, 0, 7); g.fill(); g.fillStyle = '#8a9096'; g.beginPath(); g.arc(x - 0.6, yy + S * 0.0425 - 0.6, 1.6, 0, 7); g.fill(); }
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(130,70,30,${rr2(rng, 0.25, 0.6)})`; g.fillRect(rng() * S, yy + rng() * S * 0.085, rr2(rng, 2, 8), rr2(rng, 1, 3)); }
    }
  }
  // Abgeplatzte Farbe (lackierte Kiste)
  if (st.chip) {
    for (let i = 0; i < 70; i++) {
      const nearEdge = rng() < 0.7, x = nearEdge ? (rng() < 0.5 ? rng() * fx * 1.4 : S - rng() * fx * 1.4) : rng() * S, y = nearEdge && rng() < 0.4 ? (rng() < 0.5 ? rng() * fy * 1.3 : S - rng() * fy * 1.3) : rng() * S;
      g.fillStyle = shade(st.chip, rr2(rng, 0.55, 1), 0.9); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) g.lineTo(x + rr2(rng, -6, 6), y + rr2(rng, -4, 4)); g.fill();
    }
  }
  // Schablone
  if (st.stencil) {
    g.save(); g.font = `bold ${(S * 0.17) | 0}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(st.stencil, S / 2 + 1.5, S * 0.52 + 2);
    g.fillStyle = 'rgba(225,220,175,.82)'; g.fillText(st.stencil, S / 2, S * 0.52);
    g.fillRect(S * 0.2, S * 0.7, S * 0.6, 3); g.restore();
  }
  // Schmutz & Alterung
  const dg = g.createLinearGradient(0, S * 0.55, 0, S); dg.addColorStop(0, 'rgba(25,18,10,0)'); dg.addColorStop(1, 'rgba(25,18,10,.5)');
  g.fillStyle = dg; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(20,14,8,${rr2(rng, 0.05, 0.16)})`; g.beginPath(); g.ellipse(rng() * S, rng() * S, rr2(rng, 6, 26), rr2(rng, 4, 14), rng() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 900; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr2(rng, 0.03, 0.09)})`; g.fillRect(rng() * S, rng() * S, 1.6, 1.6); }
}

function drawCrateTop(g, S, st, rng) {
  const rgb = st.wood, f = S * 0.11, n = 4, pw = (S - 2 * f) / n;
  g.fillStyle = shade(rgb, 0.4); g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const x0 = f + i * pw; g.fillStyle = shade(rgb, 0.85 + rng() * 0.3); g.fillRect(x0, f, pw, S - 2 * f);
    woodGrain(g, x0, f, pw, S - 2 * f, true, rgb, rng, 7);
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x0, f, 2.2, S - 2 * f);
    for (const y of [f + 8, S - f - 8]) nail(g, x0 + pw / 2, y, S, !st.chip);
  }
  const beam = (x, y, w, h, vert) => { g.fillStyle = shade(rgb, 0.92); g.fillRect(x, y, w, h); woodGrain(g, x, y, w, h, vert, rgb, rng, 6); beamEdges(g, x, y, w, h); };
  beam(0, 0, S, f, false); beam(0, S - f, S, f, false); beam(0, f, f, S - 2 * f, true); beam(S - f, f, f, S - 2 * f, true);
  for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(20,14,8,${rr2(rng, 0.06, 0.2)})`; g.beginPath(); g.ellipse(rng() * S, rng() * S, rr2(rng, 6, 24), rr2(rng, 4, 12), rng() * 3, 0, 7); g.fill(); }
  if (st.chip) for (let i = 0; i < 30; i++) { g.fillStyle = shade(st.chip, rr2(rng, 0.6, 1), 0.85); g.fillRect(rng() * S, rng() * S, rr2(rng, 2, 7), rr2(rng, 2, 5)); }
  for (let i = 0; i < 700; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr2(rng, 0.03, 0.09)})`; g.fillRect(rng() * S, rng() * S, 1.6, 1.6); }
}

const _crateCache = {};
function crateMats(color, variant = 0) {
  const key = color + '_' + variant;
  if (_crateCache[key]) return _crateCache[key];
  const st = crateStyle(color), S = 256, seed0 = (color & 0xffff) * 7 + variant * 1013;
  const mk = (t) => new THREE.MeshLambertMaterial({ map: t });
  const side = mk(canvasTex(S, S, (g) => drawCrateSide(g, S, st, mkRng(seed0 + 1)), false));
  const topKey = color + '_top';
  if (!_crateCache[topKey]) _crateCache[topKey] = mk(canvasTex(S, S, (g) => drawCrateTop(g, S, st, mkRng(seed0 + 99)), false));
  const top = _crateCache[topKey];
  return (_crateCache[key] = [side, side, top, top, side, side]); // +x, -x, +y, -y, +z, -z
}
const _postCache = {};
const cratePostMat = (color) => _postCache[color] || (_postCache[color] = lambert(new THREE.Color().setRGB(...crateStyle(color).wood.map((v) => v / 255 * 0.78)).getHex()));

/* ---- Fässer ---- */
const BARREL_STYLES = {
  0x7a2f20: { rgb: [138, 52, 36], label: null },
  0x3a5a3a: { rgb: [62, 102, 66], label: 'hazard' },
  0x2f4a6a: { rgb: [48, 80, 122], label: null },
};
function drawBarrelSide(g, W, H, st, rng) {
  const rgb = st.rgb;
  g.fillStyle = shade(rgb, 1); g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { g.fillStyle = shade(rgb, rr2(rng, 0.8, 1.2), 0.5); g.fillRect(rng() * W, rng() * H, rr2(rng, 2, 10), rr2(rng, 1, 4)); }
  // Rillen an den Rippen (v=1/3 und 2/3) + Rand oben/unten
  for (const yy of [H * 0.333, H * 0.667]) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, yy - 6, W, 2); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, yy + 5, W, 2); }
  // Etikett (Warnzeichen)
  if (st.label === 'hazard') {
    const cx = W * 0.25, cy = H * 0.5, r = W * 0.1;
    g.fillStyle = '#d9b82a'; g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - r * 1.1); g.lineTo(cx + r * 1.1, cy + r * 0.85); g.lineTo(cx - r * 1.1, cy + r * 0.85); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#111'; g.font = `bold ${(r * 1.5) | 0}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', cx, cy + r * 0.3);
  } else {
    g.fillStyle = 'rgba(235,230,210,.55)'; g.font = `bold ${(H * 0.06) | 0}px Arial, sans-serif`; g.textAlign = 'center'; g.fillText(String(10 + ((rng() * 80) | 0)), W * 0.62, H * 0.5);
    g.fillRect(W * 0.54, H * 0.52, W * 0.16, 2);
  }
  // Rost-Streifen von oben und von den Rippen
  for (let i = 0; i < 26; i++) {
    const x = rng() * W, y0 = rng() < 0.5 ? 0 : (rng() < 0.5 ? H * 0.333 : H * 0.667), len = rr2(rng, 14, 80), w = rr2(rng, 2, 7);
    const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, `rgba(120,58,22,${rr2(rng, 0.35, 0.6)})`); gr.addColorStop(1, 'rgba(120,58,22,0)');
    g.fillStyle = gr; g.fillRect(x, y0, w, len);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${(110 + rng() * 40) | 0},${(55 + rng() * 25) | 0},22,${rr2(rng, 0.35, 0.8)})`; g.beginPath(); g.ellipse(rng() * W, H * (0.75 + rng() * 0.25), rr2(rng, 1.5, 6), rr2(rng, 1, 4), 0, 0, 7); g.fill(); } // Rost unten
  for (let i = 0; i < 6; i++) { const x = rng() * W, y = rng() * H; g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x, y, rr2(rng, 5, 12), rr2(rng, 4, 9), 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x - 2, y - 2, rr2(rng, 3, 7), rr2(rng, 2, 5), 0, 0, 7); g.fill(); } // Dellen
  for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(190,190,190,.4)'; g.lineWidth = 1; const x = rng() * W, y = rng() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr2(rng, -14, 14), y + rr2(rng, -5, 5)); g.stroke(); } // Kratzer
  const dg = g.createLinearGradient(0, H * 0.8, 0, H); dg.addColorStop(0, 'rgba(20,14,8,0)'); dg.addColorStop(1, 'rgba(20,14,8,.5)'); g.fillStyle = dg; g.fillRect(0, 0, W, H);
}
function drawBarrelTop(g, S, st, rng) {
  const rgb = st.rgb, c = S / 2;
  g.fillStyle = shade(rgb, 0.5); g.fillRect(0, 0, S, S);
  g.fillStyle = shade(rgb, 0.85); g.beginPath(); g.arc(c, c, c * 0.97, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, c * 0.84, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, c * 0.8, 0, 7); g.stroke();
  for (const [dx, dy, r] of [[-0.36, 0.05, 0.14], [0.34, -0.3, 0.09]]) { // Spundlöcher
    const x = c + dx * c * 1.6, y = c + dy * c * 1.6, rr_ = r * S;
    g.fillStyle = '#25282a'; g.beginPath(); g.arc(x, y, rr_ + 2, 0, 7); g.fill();
    g.fillStyle = '#7b8084'; g.beginPath(); g.arc(x, y, rr_, 0, 7); g.fill();
    g.strokeStyle = '#3a3e41'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr_ * 0.6, 0, 7); g.stroke();
    g.fillStyle = '#4a4f53'; g.fillRect(x - rr_ * 0.5, y - 1, rr_, 2);
  }
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${(110 + rng() * 40) | 0},${(55 + rng() * 25) | 0},22,${rr2(rng, 0.3, 0.7)})`; g.beginPath(); g.arc(c + rr2(rng, -c, c) * 0.85, c + rr2(rng, -c, c) * 0.85, rr2(rng, 1, 4), 0, 7); g.fill(); }
  g.fillStyle = 'rgba(15,12,8,.25)'; g.beginPath(); g.ellipse(c + 8, c + 10, 18, 11, 0.5, 0, 7); g.fill();
}
let _barrelShared = null;
const _barrelByColor = {};
function makeBarrel(color) {
  if (!_barrelShared) {
    const rim = new THREE.TorusGeometry(0.272, 0.024, 6, 16); rim.rotateX(Math.PI / 2);
    _barrelShared = { body: new THREE.CylinderGeometry(0.29, 0.29, 0.9, 16, 1), hoop: new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16, 1, true), rim };
  }
  if (!_barrelByColor[color]) {
    const st = BARREL_STYLES[color] || BARREL_STYLES[0x7a2f20], seed0 = (color & 0xffff) * 3;
    const side = new THREE.MeshLambertMaterial({ map: canvasTex(128, 256, (g, w, h) => drawBarrelSide(g, w, h, st, mkRng(seed0 + 5)), false) });
    const top = new THREE.MeshLambertMaterial({ map: canvasTex(128, 128, (g, w) => drawBarrelTop(g, w, st, mkRng(seed0 + 9)), false) });
    const metal = lambert(new THREE.Color().setRGB(st.rgb[0] / 255 * 0.72, st.rgb[1] / 255 * 0.72, st.rgb[2] / 255 * 0.72).getHex());
    _barrelByColor[color] = { mats: [side, top, lambert(0x1e1c1a)], metal };
  }
  const S = _barrelShared, C = _barrelByColor[color], g = new THREE.Group();
  g.add(new THREE.Mesh(S.body, C.mats));
  for (const y of [-0.15, 0.15]) { const h = new THREE.Mesh(S.hoop, C.metal); h.position.y = y; g.add(h); }   // Rippen
  for (const y of [-0.428, 0.428]) { const r = new THREE.Mesh(S.rim, C.metal); r.position.y = y; g.add(r); }  // Ränder oben/unten
  return g;
}

/* ---- Betonbarrieren (Jersey-Profil) ---- */
function drawConcrete(g, S, rng, tint) {
  g.fillStyle = tint; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr2(rng, 0.02, 0.06)})`; g.beginPath(); g.ellipse(rng() * S, rng() * S, rr2(rng, 10, 40), rr2(rng, 8, 30), rng() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 2600; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr2(rng, 0.05, 0.16)})`; g.fillRect(rng() * S, rng() * S, rr2(rng, 1, 3), rr2(rng, 1, 3)); }
  for (let i = 0; i < 9; i++) { const x = rng() * S, y = rng() * S, r = rr2(rng, 3, 8); g.fillStyle = 'rgba(20,20,20,.5)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(210,210,200,.25)'; g.beginPath(); g.arc(x - 1, y - 1, r * 0.6, 0, 7); g.fill(); } // Lunker
  for (let i = 0; i < 5; i++) { const x = rng() * S, y = rng() * S; g.fillStyle = 'rgba(120,60,25,.28)'; g.beginPath(); g.ellipse(x, y, rr2(rng, 3, 8), rr2(rng, 8, 26), 0, 0, 7); g.fill(); } // Rostspuren
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { let x = rng() * S, y = rng() * S; g.strokeStyle = 'rgba(25,25,25,.65)'; g.lineWidth = rr2(rng, 0.8, 1.6); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += rr2(rng, -12, 12); y += rr2(rng, -12, 12); g.lineTo(x, y); } g.stroke(); } // Risse
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(15,15,15,.28)'; g.fillRect(rng() * S, rng() * S, rr2(rng, 20, 60), rr2(rng, 3, 8)); } // Schleifspuren
}
let _jersey = null;
function jerseyAssets(variant) {
  if (!_jersey) {
    const s = new THREE.Shape(); // Querschnitt: Breite 0.6, Höhe 0.9 (wie die alte Box) – Länge 2.4
    [[-0.3, 0], [0.3, 0], [0.3, 0.1], [0.18, 0.4], [0.1, 0.9], [-0.1, 0.9], [-0.18, 0.4], [-0.3, 0.1]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const geo = new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: false, steps: 1 });
    geo.translate(0, -0.45, -1.2); geo.rotateY(Math.PI / 2); // Länge entlang X, Mittelpunkt wie vorher (y=0.45 per Mesh-Position)
    _jersey = { geo, mats: [] };
  }
  if (!_jersey.mats[variant]) {
    const tints = ['#8b8b86', '#7d7f7c', '#97958d'];
    _jersey.mats[variant] = new THREE.MeshLambertMaterial({ map: canvasTex(256, 256, (g, w) => drawConcrete(g, w, mkRng(4242 + variant * 77), tints[variant % 3]), true) });
  }
  return { geo: _jersey.geo, mat: _jersey.mats[variant] };
}


/* ============================================================
   Straßenlaternen: Lampenkopf + Nachtbeleuchtung
   - Lichtpfützen (Boden) und Glow = je 1 Draw-Call für ALLE Laternen
   - echte Lichter nur an den nächsten Laternen (LAMP.lightCount), das spart Leistung
   - einige Laternen sind kaputt (aus) oder flackern (ohne rnd() -> Map bleibt gleich)
   ============================================================ */
const LAMP = { list: [], alive: [], ready: false, lightCount: 3, lights: [], bulbOn: null, pools: null, halos: null, haloCol: null, poolCol: null, flick: [] };
function mergeBoxes(parts) {
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
let _lampA = null;
function lampAssets() { // Koordinaten relativ zur Mitte des Mastes (Mast: y -3 … +3), Arm zeigt nach -X
  return _lampA || (_lampA = {
    head: mergeBoxes([[1.5, 0.07, 0.07, -0.75, 2.92, 0], [0.12, 0.2, 0.12, -0.04, 2.9, 0], [0.52, 0.1, 0.3, -1.45, 2.86, 0], [0.58, 0.035, 0.35, -1.45, 2.94, 0]]),
    lens: new THREE.BoxGeometry(0.42, 0.02, 0.2).translate(-1.45, 2.795, 0),
    metal: lambert(0x3a3d3f), bulbDead: new THREE.MeshBasicMaterial({ color: 0x2a2c2d }),
  });
}
function addLampHead(pole, x, z, typeA) {
  const A = lampAssets(), h = hashXZ(x, z), dead = h % 7 === 0, flick = !dead && h % 11 === 0;
  if (!LAMP.bulbOn) LAMP.bulbOn = new THREE.MeshBasicMaterial({ color: 0xa8aaa6 });
  const ry = typeA ? 0 : -Math.PI / 2;
  const arm = new THREE.Mesh(A.head, A.metal); arm.rotation.y = ry; pole.add(arm);
  const bulb = new THREE.Mesh(A.lens, dead ? A.bulbDead : LAMP.bulbOn); bulb.rotation.y = ry; pole.add(bulb);
  LAMP.list.push({ x: typeA ? x - 1.45 : x, z: typeA ? z : z - 1.45, dead, flick, ph: (h % 100) / 10 });
}
function radialTex(S, stops) {
  return canvasTex(S, S, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false);
}
function finalizeLamps() {
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
function applyLampNight(n) {
  if (!LAMP.ready) return;
  LAMP.bulbOn.color.setHex(n ? 0xffe9b8 : 0xa8aaa6);
  LAMP.pools.visible = LAMP.halos.visible = n;
  LAMP.lights.forEach((l) => { l.visible = n; });
}
const lampLevel = (l, t) => (l.flick ? (Math.sin(t * 31 + l.ph) * Math.sin(t * 5.3 + l.ph * 2.1) > 0.55 ? 0.08 : 1) : 1);
function updateLamps(t, p) {
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


/* ============================================================
   Randkulisse: flache Wand rund um die Map mit Bergen, Wald,
   Häusern und LKW-Kolonnen in unterschiedlichen Höhen.
   - Reine Optik: die Kollisionsbox der Begrenzung bleibt wie vorher (addBox)
   - Eigener Zufallsgenerator (mkRng) -> Map-Zufallsfolge bleibt unverändert
   - 4 Typen x 3 Varianten Texturen, werden auf 24 Segmente verteilt
   ============================================================ */
const BD = { SEG0: 250 / 6, W: 768, HM: { berg: 48, haus: 26, wald: 20, lkw: 14 }, TYPES: ['berg', 'haus', 'wald', 'lkw'], VARIANTS: 3, mats: {} };
BD.ppm = BD.W / BD.SEG0;
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgbS = (c, a = 1) => `rgba(${c8(c[0])},${c8(c[1])},${c8(c[2])},${a})`;
const HAZE = [150, 164, 178];

function drawBackdrop(g, W, H, ppm, type, rng) {
  const R = (a, b) => a + (b - a) * rng(), yM = (m) => H - m * ppm, HM = H / ppm, EDGE = 7;
  const env = (x, p) => Math.pow(Math.max(0, Math.sin(Math.PI * x / W)), p);
  const poly = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };

  /* ---- Bergketten (Rand immer auf EDGE m, damit Segmente nahtlos aneinander passen) ---- */
  const ridge = (c0, c1, peakM, snow) => {
    const o = R(0, 20), pts = [];
    for (let x = 0; x <= W; x += 6) {
      const n = Math.sin(x * 0.011 + o) * 0.5 + Math.sin(x * 0.026 + o * 1.7) * 0.32 + Math.sin(x * 0.05 + o * 2.3) * 0.18, r = 1 - Math.abs(n);
      const m = EDGE + (peakM - EDGE) * env(x, 0.55) * (0.3 + 0.7 * Math.pow(r, 1.3)) + (x > 0 && x < W ? R(-0.25, 0.25) : 0);
      pts.push([x, yM(m), m]);
    }
    g.save(); poly([[0, H], ...pts, [W, H]]); g.closePath();
    const gr = g.createLinearGradient(0, yM(peakM), 0, H); gr.addColorStop(0, rgbS(c0)); gr.addColorStop(1, rgbS(c1));
    g.fillStyle = gr; g.fill(); g.clip();
    for (let i = 2; i < pts.length - 2; i++) { // Licht-/Schattenflanken an den Gipfeln
      const m = pts[i][2];
      if (m > pts[i - 1][2] && m > pts[i + 1][2] && m > pts[i - 2][2] && m > pts[i + 2][2] && m > EDGE + 4) {
        const px = pts[i][0], py = pts[i][1];
        g.fillStyle = 'rgba(15,25,45,.22)'; g.beginPath(); g.moveTo(px, py); g.lineTo(px + R(30, 90), H); g.lineTo(px + R(-5, 10), H); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.09)'; g.beginPath(); g.moveTo(px, py); g.lineTo(px - R(30, 90), H); g.lineTo(px, H); g.closePath(); g.fill();
      }
    }
    if (snow) {
      const thr = EDGE + (peakM - EDGE) * 0.55, d = pts.map((p) => (p[2] > thr ? (p[2] - thr) * 0.9 * ppm + R(0, 9) : 0));
      for (let i = 0; i < pts.length - 1; i++) if (d[i] + d[i + 1] > 0) {
        g.fillStyle = 'rgba(240,245,252,.96)'; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]);
        g.lineTo(pts[i + 1][0], pts[i + 1][1] + d[i + 1]); g.lineTo(pts[i][0], pts[i][1] + d[i]); g.closePath(); g.fill();
      }
    }
    g.restore();
  };

  /* ---- Hügel-Sockel (Rand ebenfalls EDGE m) ---- */
  const hillTop = [];
  const hills = (c0, c1, amp) => {
    const o = R(0, 20), pts = [];
    for (let x = 0; x <= W; x += 6) {
      const m = EDGE + amp * env(x, 0.8) * (0.5 + 0.5 * Math.sin(x * 0.02 + o) * Math.sin(x * 0.047 + o * 2));
      pts.push([x, yM(m)]); hillTop.push(m);
    }
    poly([[0, H], ...pts, [W, H]]); g.closePath();
    const gr = g.createLinearGradient(0, yM(EDGE + amp), 0, H); gr.addColorStop(0, rgbS(c0)); gr.addColorStop(1, rgbS(c1));
    g.fillStyle = gr; g.fill();
  };
  const hillM = (x) => hillTop[Math.max(0, Math.min(hillTop.length - 1, Math.round(x / 6)))];

  /* ---- Bäume ---- */
  const conifer = (x, baseY, hp, tone, haze) => {
    const w = hp * R(0.3, 0.4), col = mixC([R(26, 46) * tone, R(56, 80) * tone, R(32, 50) * tone], HAZE, haze);
    g.fillStyle = rgbS(mixC([50, 38, 28], HAZE, haze)); g.fillRect(x - w * 0.05, baseY - hp * 0.14, w * 0.1, hp * 0.14);
    for (let i = 0; i < 5; i++) {
      const bot = baseY - hp * (0.1 + 0.15 * i), top = bot - hp * 0.3, hw = w * 0.5 * (1 - i * 0.17), k = 0.82 + (i % 2) * 0.18;
      g.fillStyle = rgbS(col.map((v) => v * k));
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + hw, bot);
      for (let t = 1; t < 4; t++) g.lineTo(x + hw - hw * 2 * t / 4, bot - (t % 2 ? hp * 0.03 : 0));
      g.lineTo(x - hw, bot); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(x, top); g.lineTo(x - hw, bot); g.lineTo(x, bot); g.closePath(); g.fill();
    }
  };
  const leafy = (x, baseY, hp, tone, haze) => {
    const cols = [[48, 74, 36], [62, 86, 40], [84, 92, 44], [112, 84, 40]], base = cols[(rng() * (rng() < 0.75 ? 2 : 4)) | 0];
    g.fillStyle = rgbS(mixC([62, 46, 34], HAZE, haze)); g.fillRect(x - hp * 0.025, baseY - hp * 0.5, hp * 0.05, hp * 0.5);
    for (let i = 0; i < 7; i++) {
      const cx = x + R(-0.24, 0.24) * hp, cy = baseY - hp * R(0.5, 0.86), r = hp * R(0.15, 0.25);
      g.fillStyle = rgbS(mixC(base.map((v) => v * tone * R(0.8, 1.15)), HAZE, haze)); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,220,.08)'; g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.3, r * 0.55, 0, 7); g.fill();
    }
  };
  const deadTree = (x, baseY, hp, haze) => {
    g.strokeStyle = rgbS(mixC([46, 38, 32], HAZE, haze)); g.lineCap = 'round';
    const br = (x0, y0, ang, len, wd, depth) => {
      const x1 = x0 + Math.sin(ang) * len, y1 = y0 - Math.cos(ang) * len; g.lineWidth = Math.max(1, wd);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (depth > 0) { br(x1, y1, ang + R(0.3, 0.8), len * 0.7, wd * 0.65, depth - 1); br(x1, y1, ang - R(0.3, 0.8), len * 0.7, wd * 0.65, depth - 1); if (rng() < 0.6) br(x1, y1, ang + R(-0.2, 0.2), len * 0.75, wd * 0.65, depth - 1); }
    };
    br(x, baseY, R(-0.1, 0.1), hp * 0.38, hp * 0.04, 3);
  };
  const treeLine = (minM, maxM, step, haze) => {
    for (let x = R(8, 20); x < W - 8; x += R(step * 0.7, step * 1.3)) {
      const base = yM(hillM(x) - 0.6), hp = R(minM, maxM) * ppm;
      if (rng() < 0.7) conifer(x, base, hp, 0.85, haze); else leafy(x, base, hp, 0.9, haze);
    }
  };

  /* ---- Häuser ---- */
  const BASES = [[140, 132, 121], [122, 109, 98], [108, 115, 120], [138, 107, 90], [95, 98, 91]];
  const building = (x, wm, hm, baseM, haze, kind) => {
    const wp = wm * ppm, hp = hm * ppm, by = yM(baseM), burnt = rng() < 0.12, ruin = kind === 'flat' && rng() < 0.25;
    const col = mixC(burnt ? [52, 48, 46] : BASES[(rng() * 5) | 0], HAZE, haze);
    const wallH = kind === 'gable' ? hp * 0.66 : hp, wallTop = by - wallH;
    const NC = 6, colTop = []; // Dachlinie pro Spalte (Ruinen: eingestürzte Seite)
    const sideR = rng() < 0.5, dh = hp * R(0.14, 0.3);
    for (let i = 0; i < NC; i++) { const f = ruin ? (sideR ? (i >= NC - 3 ? R(0.3, 1) * (i - (NC - 4)) / 3 : 0) : (i < 3 ? R(0.3, 1) * (3 - i) / 3 : 0)) : 0; colTop.push(wallTop + f * dh); }
    const topAt = (xc) => colTop[Math.max(0, Math.min(NC - 1, Math.floor((xc - x) / wp * NC)))];
    const bodyPath = () => {
      g.beginPath(); g.moveTo(x, by); g.lineTo(x, colTop[0]);
      for (let i = 0; i < NC; i++) { g.lineTo(x + wp * i / NC, colTop[i]); g.lineTo(x + wp * (i + 1) / NC, colTop[i]); }
      g.lineTo(x + wp, by); g.closePath();
    };
    g.fillStyle = rgbS(col); bodyPath(); g.fill();
    g.save(); bodyPath(); g.clip();
    for (let i = 0; i < wm * 2; i++) { g.fillStyle = `rgba(0,0,0,${R(0.04, 0.12)})`; g.fillRect(x + R(0, wp), wallTop + R(0, wallH), R(6, 30), R(5, 24)); }
    const wc = (c) => rgbS(mixC(c, HAZE, haze * 0.8));
    for (let fy = by - 3.0 * ppm, fl = 0; fy > wallTop + 1.4 * ppm; fy -= 3.5 * ppm, fl++) {
      for (let fx = x + 1.2 * ppm; fx < x + wp - 1.7 * ppm; fx += 3.0 * ppm) {
        const ww = 1.5 * ppm, wh = 1.9 * ppm; if (fy < topAt(fx + ww / 2) + 0.6 * ppm) continue;
        const r = rng();
        g.fillStyle = r < 0.1 && !burnt ? wc([255, 217, 138]) : r < 0.3 || burnt ? wc([10, 12, 15]) : r < 0.38 ? wc([77, 58, 40]) : wc([26, 34, 41]);
        g.fillRect(fx, fy, ww, wh);
        if (r >= 0.38 && r < 0.9 && !burnt) { g.fillStyle = 'rgba(150,180,200,.22)'; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + ww * 0.55, fy); g.lineTo(fx, fy + wh * 0.6); g.closePath(); g.fill(); }
        if (r >= 0.3 && r < 0.38) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(fx, fy + wh * k / 4); g.lineTo(fx + ww, fy + wh * k / 4); g.stroke(); } }
        if (r > 0.9) { g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + ww, fy + wh); g.moveTo(fx + ww, fy); g.lineTo(fx + ww * 0.3, fy + wh * 0.7); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(fx - 2, fy + wh, ww + 4, 3);
        const sg = g.createLinearGradient(0, fy + wh, 0, fy + wh + 2.2 * ppm); sg.addColorStop(0, burnt ? 'rgba(0,0,0,.55)' : 'rgba(20,14,8,.22)'); sg.addColorStop(1, 'rgba(20,14,8,0)');
        g.fillStyle = sg; g.fillRect(fx + 1, fy + wh, ww - 2, 2.2 * ppm);
      }
    }
    g.fillStyle = wc([30, 26, 24]); g.fillRect(x + wp / 2 - 0.7 * ppm, by - 2.3 * ppm, 1.4 * ppm, 2.3 * ppm); // Tür
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, wallTop, 3, wallH); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + wp - 4, wallTop, 4, wallH);
    const dg = g.createLinearGradient(0, by - 4 * ppm, 0, by); dg.addColorStop(0, 'rgba(25,18,10,0)'); dg.addColorStop(1, 'rgba(25,18,10,.4)'); g.fillStyle = dg; g.fillRect(x, by - 4 * ppm, wp, 4 * ppm);
    g.restore();
    if (kind === 'gable') {
      g.fillStyle = rgbS(mixC([92, 62, 52], HAZE, haze)); g.beginPath(); g.moveTo(x - 0.6 * ppm, wallTop); g.lineTo(x + wp / 2, by - hp); g.lineTo(x + wp + 0.6 * ppm, wallTop); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(x + wp / 2, by - hp); g.lineTo(x + wp + 0.6 * ppm, wallTop); g.lineTo(x + wp / 2, wallTop); g.closePath(); g.fill();
      g.fillStyle = rgbS(mixC([70, 60, 56], HAZE, haze)); g.fillRect(x + wp * 0.7, by - hp * 0.95, 0.9 * ppm, hp * 0.3); // Schornstein
    } else if (!ruin) {
      g.fillStyle = rgbS(col.map((v) => v * 1.12)); g.fillRect(x - 0.3 * ppm, wallTop - 0.5 * ppm, wp + 0.6 * ppm, 0.5 * ppm); // Dachkante
      const e = rng();
      if (e < 0.35) { const tx = x + wp * R(0.2, 0.7), tw = 2.2 * ppm; g.fillStyle = rgbS(mixC([70, 62, 56], HAZE, haze)); g.fillRect(tx, wallTop - 1.6 * ppm, 0.2 * ppm, 1.1 * ppm); g.fillRect(tx + tw - 0.2 * ppm, wallTop - 1.6 * ppm, 0.2 * ppm, 1.1 * ppm); g.fillStyle = rgbS(mixC([96, 70, 52], HAZE, haze)); g.fillRect(tx - 2, wallTop - 3.4 * ppm, tw + 4, 1.9 * ppm); }
      else if (e < 0.65) { g.fillStyle = rgbS(mixC([90, 94, 96], HAZE, haze)); g.fillRect(x + wp * R(0.1, 0.5), wallTop - 1.3 * ppm, 2 * ppm, 0.8 * ppm); }
      else if (e < 0.85) { const ax = x + wp * R(0.2, 0.8); g.strokeStyle = rgbS(mixC([50, 50, 52], HAZE, haze)); g.lineWidth = 2; g.beginPath(); g.moveTo(ax, wallTop - 0.5 * ppm); g.lineTo(ax, wallTop - R(3, 6) * ppm); g.moveTo(ax - 0.8 * ppm, wallTop - 3 * ppm); g.lineTo(ax + 0.8 * ppm, wallTop - 3 * ppm); g.stroke(); }
    }
  };

  /* ---- LKW (Seitenansicht, abgestellt) ---- */
  const TRUCKCOL = [[205, 205, 198], [150, 62, 52], [64, 92, 122], [92, 112, 72], [212, 192, 122], [120, 124, 128]];
  const drawTruck = (xp, kind, dir) => {
    g.save(); g.translate(xp, 0); g.scale(dir, 1);
    const X = (m) => m * ppm, Y = (m) => yM(m), tc = TRUCKCOL[(rng() * TRUCKCOL.length) | 0], cc = TRUCKCOL[(rng() * TRUCKCOL.length) | 0];
    const rust = (x0, w, y0, h) => { for (let i = 0; i < w * 2; i++) { g.fillStyle = `rgba(${(110 + rng() * 40) | 0},${(56 + rng() * 24) | 0},24,${R(0.2, 0.5)})`; g.fillRect(X(x0 + R(0, w)), Y(y0 + R(0, h)), R(2, 9), R(1, 5)); } g.fillStyle = 'rgba(20,14,8,.22)'; g.fillRect(X(x0), Y(y0 + 0.4), X(w), X(0.4)); };
    const wheel = (wx) => { const cy = Y(0.52), r = X(0.52); g.fillStyle = '#121212'; g.beginPath(); g.arc(X(wx), cy, r, 0, 7); g.fill(); g.fillStyle = '#7d8084'; g.beginPath(); g.arc(X(wx), cy, r * 0.5, 0, 7); g.fill(); g.fillStyle = '#2b2d2f'; g.beginPath(); g.arc(X(wx), cy, r * 0.22, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(wx), cy, r * 0.88, 3.6, 5.2); g.stroke(); };
    const cab = (ox) => {
      g.fillStyle = rgbS(cc); g.beginPath(); g.moveTo(X(ox), Y(1.2)); g.lineTo(X(ox), Y(3.8)); g.lineTo(X(ox + 1.7), Y(3.8)); g.lineTo(X(ox + 2.4), Y(3.0)); g.lineTo(X(ox + 2.4), Y(1.2)); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(X(ox), Y(1.7), X(2.4), X(0.5));
      g.fillStyle = '#161d22'; g.beginPath(); g.moveTo(X(ox + 0.5), Y(3.55)); g.lineTo(X(ox + 1.65), Y(3.55)); g.lineTo(X(ox + 2.2), Y(2.95)); g.lineTo(X(ox + 2.2), Y(2.35)); g.lineTo(X(ox + 0.5), Y(2.35)); g.closePath(); g.fill();
      g.fillStyle = 'rgba(160,190,210,.22)'; g.beginPath(); g.moveTo(X(ox + 0.5), Y(3.55)); g.lineTo(X(ox + 1.2), Y(3.55)); g.lineTo(X(ox + 0.5), Y(2.7)); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.strokeRect(X(ox + 0.1), Y(3.7), X(2.0), X(2.3)); // Tür
      g.fillStyle = '#e9d9a0'; g.beginPath(); g.arc(X(ox + 2.35), Y(1.8), X(0.14), 0, 7); g.fill();
      g.fillStyle = '#1c1c1c'; g.fillRect(X(ox + 2.3), Y(1.5), X(0.35), X(0.3)); // Stoßstange
      g.fillStyle = '#4a4d50'; g.fillRect(X(ox + 0.05), Y(5.0), X(0.14), X(1.3)); g.fillStyle = '#9a9ea2'; g.fillRect(X(ox + 0.05), Y(5.0), X(0.05), X(1.3)); // Auspuff
      rust(ox, 2.4, 1.2, 1.2);
    };
    g.fillStyle = '#17191a';
    if (kind === 'semi' || kind === 'container' || kind === 'tank') {
      g.fillRect(0, Y(1.25), X(15.4), X(0.35));
      if (kind === 'semi') {
        g.fillStyle = rgbS(tc); g.fillRect(0, Y(3.9), X(12.6), X(2.7));
        g.fillStyle = 'rgba(0,0,0,.28)'; for (let m = 0.9; m < 12.6; m += 1.05) g.fillRect(X(m), Y(3.9), 2, X(2.7));
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, Y(3.9), X(12.6), X(0.15)); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, Y(1.55), X(12.6), X(0.3));
        g.fillStyle = rgbS(mixC(tc, [30, 30, 30], 0.55)); g.fillRect(0, Y(2.9), X(12.6), X(0.28));
        g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(X(3.2), Y(3.55), X(4.6), X(0.5)); g.fillRect(X(3.8), Y(3.0), X(3.4), X(0.22));
        rust(0, 12.6, 1.8, 2.0);
      } else if (kind === 'container') {
        g.fillStyle = rgbS(mixC(tc, [60, 60, 60], 0.15)); g.fillRect(X(0.2), Y(3.9), X(12.2), X(2.55));
        g.fillStyle = 'rgba(0,0,0,.32)'; for (let m = 0.4; m < 12.4; m += 0.32) g.fillRect(X(m), Y(3.9), 2, X(2.55));
        g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(X(0.2), Y(3.9), X(12.2), X(0.12)); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(X(0.2), Y(1.45), X(12.2), X(0.12));
        g.fillStyle = 'rgba(235,235,225,.55)'; g.fillRect(X(1.2), Y(3.6), X(3.2), X(0.4)); g.fillRect(X(1.2), Y(3.05), X(2.2), X(0.2));
        rust(0.2, 12.2, 1.5, 2.4);
      } else {
        const gr = g.createLinearGradient(0, Y(3.8), 0, Y(1.5)); gr.addColorStop(0, '#d7dade'); gr.addColorStop(0.45, '#8f959b'); gr.addColorStop(1, '#52575c');
        g.fillStyle = gr; g.beginPath(); const r0 = X(1.1); g.moveTo(X(0) + r0, Y(3.8)); g.lineTo(X(11.8) - r0, Y(3.8)); g.arcTo(X(11.8), Y(3.8), X(11.8), Y(3.8) + r0, r0); g.lineTo(X(11.8), Y(1.5) - r0); g.arcTo(X(11.8), Y(1.5), X(11.8) - r0, Y(1.5), r0); g.lineTo(X(0) + r0, Y(1.5)); g.arcTo(X(0), Y(1.5), X(0), Y(1.5) - r0, r0); g.lineTo(X(0), Y(3.8) + r0); g.arcTo(X(0), Y(3.8), X(0) + r0, Y(3.8), r0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.28)'; for (const m of [2.4, 5.0, 7.6, 10.0]) g.fillRect(X(m), Y(3.8), 3, X(2.3));
        g.fillStyle = '#44484c'; g.fillRect(X(5.3), Y(4.1), X(1.0), X(0.3)); g.fillStyle = '#d9b82a'; g.fillRect(X(8.2), Y(3.3), X(1.4), X(0.7)); g.fillStyle = '#111'; g.fillRect(X(8.4), Y(3.25), X(1.0), X(0.1)); // Luke, Warnschild
        rust(0, 11.8, 1.6, 2.0);
      }
      g.fillStyle = '#26292b'; g.fillRect(X(9.4), Y(1.25), X(0.14), X(0.6)); // Stützfuß
      cab(13.0); for (const wx of [1.8, 3.1, 13.7, 14.9]) wheel(wx); // (Zugmaschine hinten, Vorderachse vorn)
    } else { // Kasten-LKW
      g.fillRect(0, Y(1.25), X(8.6), X(0.35));
      g.fillStyle = rgbS(tc); g.fillRect(0, Y(3.9), X(6.0), X(2.5));
      g.fillStyle = 'rgba(0,0,0,.28)'; for (let m = 0.8; m < 6; m += 1.0) g.fillRect(X(m), Y(3.9), 2, X(2.5));
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, Y(3.9), X(6.0), X(0.14)); g.fillStyle = 'rgba(240,235,220,.5)'; g.fillRect(X(1.0), Y(3.4), X(3.6), X(0.6));
      rust(0, 6.0, 1.5, 2.2); cab(6.3); for (const wx of [1.2, 2.5, 7.0, 8.2]) wheel(wx);
    }
    g.restore();
  };

  /* ---- Pro Typ zusammensetzen ---- */
  const nearRidge = type !== 'berg';
  if (type === 'berg') {
    ridge([160, 176, 194], [132, 148, 166], R(40, 46), true);
    ridge([122, 140, 156], [96, 112, 122], R(27, 34), false);
    ridge([88, 108, 98], [64, 82, 70], R(16, 22), false);
  } else ridge([156, 170, 176], [132, 146, 150], Math.min(HM - 3, R(11, 16)), false);
  hills([70, 88, 58], [44, 58, 40], type === 'berg' ? 3 : 4);
  if (type !== 'wald') treeLine(type === 'berg' ? 4 : 3.5, type === 'berg' ? 8 : 7, 20, 0.28);

  if (type === 'haus') {
    for (const [row, haze, y0, wR, hR] of [[0, 0.38, 2.2, [8, 13], [7, 15]], [1, 0, 0, [10, 16], [10, 23]]]) {
      for (let xm = R(0.5, 3); xm < BD.SEG0 - 8; xm += 0) {
        const w = R(wR[0], wR[1]); if (xm + w > BD.SEG0 - 0.5) break;
        building(xm * ppm, w, R(hR[0], hR[1]), y0, haze, rng() < (row ? 0.25 : 0.4) ? 'gable' : 'flat');
        xm += w + R(0.4, 2.8);
      }
    }
  } else if (type === 'wald') {
    for (const [row, haze, tone, minM, maxM, baseM, step] of [[0, 0.45, 0.95, 9, 13, 4.5, 3.2], [1, 0.22, 0.9, 11, 16, 2.4, 3.6], [2, 0, 0.85, 12, 18, 0.2, 4.2]]) {
      for (let x = R(0, 12); x < W; x += R(step * 0.7, step * 1.3) * ppm * 0.5) {
        const hp = R(minM, maxM) * ppm, by = yM(baseM + R(0, 1.2)), r = rng();
        if (row === 2 && r < 0.07) deadTree(x, by, hp * 0.8, haze); else if (r < 0.68) conifer(x, by, hp, tone, haze); else leafy(x, by, hp * 0.85, tone, haze);
      }
    }
  } else if (type === 'lkw') {
    for (let k = 0; k < 2; k++) { // Strommasten
      const px = W * (0.18 + k * 0.5 + R(-0.04, 0.04)), ph_ = 10.5 * ppm; g.fillStyle = '#2a2420'; g.fillRect(px - 0.14 * ppm, yM(0) - ph_, 0.28 * ppm, ph_); g.fillRect(px - 1.4 * ppm, yM(0) - ph_ + 0.8 * ppm, 2.8 * ppm, 0.2 * ppm); g.fillRect(px - 1.0 * ppm, yM(0) - ph_ + 2.2 * ppm, 2.0 * ppm, 0.18 * ppm);
    }
    const kinds = ['semi', 'container', 'tank', 'box'];
    let xm = R(0.5, 2.5);
    for (let k = 0; k < 3 && xm < BD.SEG0 - 8; k++) {
      const kind = kinds[(rng() * 4) | 0], len = kind === 'box' ? 8.8 : 16.2, dir = rng() < 0.5 ? 1 : -1;
      if (xm + len > BD.SEG0 - 0.5) { if (k) break; }
      drawTruck(dir > 0 ? xm * ppm : (xm + len) * ppm, kind, dir); xm += len + R(1.0, 4.0);
    }
  }
  void nearRidge;

  /* ---- Körnung & Schmutz nur auf bereits gemalten Pixeln ---- */
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 2400; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${R(0.03, 0.08)})`; g.fillRect(rng() * W, rng() * H, R(1, 3), R(1, 3)); }
  g.globalCompositeOperation = 'source-over';
}

function backdropMat(type, variant) {
  const key = type + variant;
  if (BD.mats[key]) return BD.mats[key];
  const H = Math.round(BD.HM[type] * BD.ppm), seed = BD.TYPES.indexOf(type) * 101 + variant * 977 + 31;
  const tex = canvasTex(BD.W, H, (g) => drawBackdrop(g, BD.W, H, BD.ppm, type, mkRng(seed)), false);
  return (BD.mats[key] = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.4, fog: false }));
}
function applyBackdropNight(n) { for (const k in BD.mats) BD.mats[k].color.setHex(n ? 0x2f3a5c : 0xffffff); }
function buildBackdrop() {
  for (const k in BD.mats) delete BD.mats[k]; // Texturen werden pro Karte neu erzeugt (disposeMap räumt die alten ab)
  const rng = mkRng(20261125 + MAP.size), cnt = {}, geo = {}, hf = HALF;
  const s0 = clamp(HALF / 125, 0.55, 1), n = Math.max(3, Math.round(MAP.size / (BD.SEG0 * s0))), segA = MAP.size / n, sa = segA / BD.SEG0; // kleine Karte: kleinere Kulisse
  const sides = [[0, -hf + 0.005, 0], [0, hf - 0.005, Math.PI], [-hf + 0.005, 0, Math.PI / 2], [hf - 0.005, 0, -Math.PI / 2]]; // Norden, Süden, Westen, Osten
  for (const [sx, sz, ry] of sides) {
    const grp = new THREE.Group(); grp.position.set(sx, 0, sz); grp.rotation.y = ry; mapRoot.add(grp);
    const seq = BD.TYPES.slice(); for (let i = seq.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [seq[i], seq[j]] = [seq[j], seq[i]]; } // jede Seite enthält alle 4 Typen
    while (seq.length < n) { const t = BD.TYPES[(rng() * 4) | 0]; if (t !== seq[seq.length - 1] && t !== seq[0]) seq.push(t); }
    seq.length = n;
    seq.forEach((t, i) => {
      cnt[t] = (cnt[t] || 0) + 1;
      const hm = BD.HM[t], m = new THREE.Mesh(geo[t] || (geo[t] = new THREE.PlaneGeometry(BD.SEG0, hm)), backdropMat(t, cnt[t] % BD.VARIANTS));
      m.scale.set(sa, sa, 1); m.position.set(-hf + (i + 0.5) * segA, hm * sa / 2, 0); grp.add(m);
    });
  }
  applyBackdropNight(settings.night);
}

/* ---------------- World / Map ---------------- */
const MAPS = {
  big:   { name: 'GROSSE MAP', size: 250, blocks: [-75, -25, 25, 75], roads: [-100, -50, 0, 50, 100], edge: 120, ring: 18 },
  small: { name: 'KLEINE MAP', size: 120, blocks: [-25, 25], roads: [-50, 0, 50], edge: 55, ring: 0 },
};
let MAP = MAPS.big, HALF = MAP.size / 2, mapId = null;
const mapRoot = new THREE.Group(); scene.add(mapRoot);
function disposeMap() {
  mapRoot.traverse((o) => { if (o.geometry) o.geometry.dispose(); for (const m of (o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [])) { if (m.map) m.map.dispose(); m.dispose(); } });
  mapRoot.clear(); boxes.length = 0; interiorSpots.length = 0; phongCache.clear(); FACADE.mats = []; FACADE.neon = []; FACADE.pools = [];
  Object.assign(LAMP, { list: [], alive: [], flick: [], lights: [], ready: false, pools: null, halos: null, haloCol: null });
}
function loadMap(id) {
  disposeMap(); MAP = MAPS[id]; HALF = MAP.size / 2; mapId = id; seed = 1337;
  buildGround(); buildCity(); applyShaderTo(mapRoot); applyLampNight(settings.night); applyFacadeNight(settings.night);
}
const boxes = []; // Kollision: {x0,x1,z0,z1,top}
function addBox(cx, cz, w, d, top) { boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top }); }

function buildGround() {
  const SIZE = Math.min(3072, renderer.capabilities.maxTextureSize || 2048);
  const aniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  const tex = canvasTex(SIZE, SIZE, (g, w, h) => {
    const px = w / MAP.size;                 // Pixel pro Meter
    const X = (m) => (m + HALF) * px;
    const R = (x, z, ww, hh) => g.fillRect(X(x), X(z), ww * px, hh * px);
    // --- Asphalt mit Flecken
    g.fillStyle = '#3e4144'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const l = rnd() < .5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr(.02, .07)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(.3, 2.6) * px, 0, 7); g.fill(); }
    // --- Blöcke: Gehsteig-Ring + Betonplatten
    for (const bx of MAP.blocks) for (const bz of MAP.blocks) {
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
    g.fillRect(0, 0, w, X(-MAP.edge)); g.fillRect(0, X(MAP.edge), w, h); g.fillRect(0, 0, X(-MAP.edge), h); g.fillRect(X(MAP.edge), 0, w, h);
    for (let i = 0; i < 26000; i++) { const x = rnd() * w, y = rnd() * h; if (x > X(-MAP.edge) && x < X(MAP.edge) && y > X(-MAP.edge) && y < X(MAP.edge)) continue; g.strokeStyle = `rgba(${(40 + rnd() * 50) | 0},${(60 + rnd() * 60) | 0},${(20 + rnd() * 20) | 0},.8)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-3, 3), y - rr(2, 7)); g.stroke(); }
    // --- Straßenmarkierungen
    const inter = MAP.roads;
    const segs = []; let a0 = -MAP.edge; for (const c of inter) { segs.push([a0, c - 5]); a0 = c + 5; } segs.push([a0, MAP.edge]);
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
    const rp = () => { for (let k = 0; k < 40; k++) { const x = rr(-MAP.edge + 2, MAP.edge - 2), z = rr(-MAP.edge + 2, MAP.edge - 2); if (onRoad(x, z)) return [x, z]; } return [0, 20]; };
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
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP.size, MAP.size), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2; mapRoot.add(m);
  // Detail-Textur (gekachelt) für Schärfe im Nahbereich
  const det = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) { const l = rnd() < .5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr(.08, .35)})`; g.fillRect(rnd() * w, rnd() * h, rr(1, 2.5), rr(1, 2.5)); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${rr(.15, .3)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(1.5, 3.5), 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(rnd() * w - 1, rnd() * h - 1, rr(.8, 1.8), 0, 7); g.fill(); }
  }, true);
  det.repeat.set(MAP.size / 1.6, MAP.size / 1.6); det.anisotropy = aniso;
  const ov = new THREE.Mesh(new THREE.PlaneGeometry(MAP.size, MAP.size), new THREE.MeshLambertMaterial({ map: det, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  ov.rotation.x = -Math.PI / 2; ov.position.y = 0.004; mapRoot.add(ov);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), lambert(0x3d4430));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; mapRoot.add(outer);
}

const FLOOR_H = 3.4, TILE_W = 12, TILE_H = 6.8;
const FACADE = { mats: [], neon: [], pools: [] };
const NEON_WORDS = [['CAFFE', '#ff4fa8'], ['CAFFE', '#ffb347'], ['BAR', '#35e0ff'], ['PIZZA', '#ff5a3c'], ['PUB', '#5dff7a'], ['DINER', '#ff4fa8'], ['HOTEL', '#35e0ff'], ['KIOSK', '#ffe14d'], ['BURGER', '#ff8a2a'], ['OPEN 24h', '#5dff7a'], ['APOTHEKE', '#4dff9a'], ['TABAK', '#ff4f4f']];
// Fassade: 12 m x 6.8 m Kachel (2 Etagen a 3,4 m, 4 Fenster je Etage = 8 Fenster, genau 1 Fenster beleuchtet)
function facadeTexture(base, lit) {
  const PX = 40, W = TILE_W * PX, H = TILE_H * PX;
  const litIdx = (rnd() * 8) | 0;
  const wins = []; for (let f = 0; f < 2; f++) for (let c = 0; c < 4; c++) wins.push({ x: (1.5 + 3 * c - 0.7) * PX, y: (TILE_H - 2.3 - FLOOR_H * f) * PX, w: 1.4 * PX, h: 1.4 * PX, f, c });
  const kinds = wins.map(() => rnd());
  const map = canvasTex(W, H, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .07})`; g.fillRect(rnd() * W, rnd() * H, rr(4, 30), rr(4, 30)); }
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, H - 0.3 * PX, W, 0.3 * PX); g.fillRect(0, (TILE_H - FLOOR_H - 0.12) * PX, W, 0.12 * PX); // Sockel + Geschossband
    wins.forEach((q, i) => {
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(q.x - 5, q.y - 4, q.w + 10, q.h + 10);          // Laibung
      g.fillStyle = '#d0cdc4'; g.fillRect(q.x - 6, q.y + q.h + 4, q.w + 12, 7);                   // Fensterbank
      if (i === litIdx) { const gr = g.createLinearGradient(0, q.y, 0, q.y + q.h); gr.addColorStop(0, lit); gr.addColorStop(1, '#fff3cf'); g.fillStyle = gr; }
      else g.fillStyle = kinds[i] < .3 ? '#07090c' : '#1d2830';
      g.fillRect(q.x, q.y, q.w, q.h);
      if (i !== litIdx && kinds[i] >= .3) { g.fillStyle = 'rgba(160,190,210,.12)'; g.beginPath(); g.moveTo(q.x, q.y + q.h); g.lineTo(q.x + q.w * .55, q.y); g.lineTo(q.x + q.w * .8, q.y); g.lineTo(q.x + q.w * .25, q.y + q.h); g.fill(); }
      g.fillStyle = i === litIdx ? 'rgba(70,45,10,.85)' : '#0d0f12'; g.fillRect(q.x + q.w / 2 - 2, q.y, 4, q.h); g.fillRect(q.x, q.y + q.h * .42, q.w, 4); // Rahmenkreuz
      if (i === litIdx) { g.fillStyle = 'rgba(40,25,10,.5)'; g.fillRect(q.x, q.y, q.w * .18, q.h); }
      else if (kinds[i] > .8) { g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(q.x + 3, q.y + 3); g.lineTo(q.x + q.w - 8, q.y + q.h * .6); g.moveTo(q.x + q.w - 4, q.y + 4); g.lineTo(q.x + q.w * .4, q.y + q.h - 4); g.stroke(); }   // zerbrochen
      else if (kinds[i] > .68) { g.fillStyle = '#4b3a28'; for (let b = 0; b < 4; b++) g.fillRect(q.x - 2, q.y + b * q.h / 4 + 2, q.w + 4, q.h / 4 - 4); } // zugenagelt
    });
    if (rnd() < .7) { const gr = g.createLinearGradient(0, H * .6, 0, H); gr.addColorStop(0, 'rgba(30,22,16,0)'); gr.addColorStop(1, 'rgba(30,22,16,.35)'); g.fillStyle = gr; g.fillRect(0, H * .6, W, H * .4); }
  }, true);
  const em = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const q = wins[litIdx]; g.fillStyle = lit; g.fillRect(q.x, q.y, q.w, q.h);
    g.fillStyle = '#000'; g.fillRect(q.x + q.w / 2 - 2, q.y, 4, q.h); g.fillRect(q.x, q.y + q.h * .42, q.w, 4);
  }, true);
  return { map, em };
}
// Fassadenmaterial (Lambert + Emissive-Map fuer das beleuchtete Fenster, nachts an)
function facadeMat(F, rx, ry, ox, oy) {
  const t = F.map.clone(), e = F.em.clone();
  for (const x of [t, e]) { x.repeat.set(rx, ry); x.offset.set(ox || 0, oy || 0); x.needsUpdate = true; }
  const m = new THREE.MeshLambertMaterial({ map: t, emissiveMap: e, emissive: settings.night ? 0xffffff : 0x000000 });
  FACADE.mats.push(m); return m;
}
function applyFacadeNight(n) {
  for (const m of FACADE.mats) { const p = phongCache.get(m); m.emissive.setHex(n ? 0xffffff : 0); if (p) p.emissive.setHex(n ? 0xffffff : 0); }
  for (const m of FACADE.neon) m.color.setHex(n ? 0xffffff : 0xb8b8b8);
  for (const o of FACADE.pools) o.visible = n;
}
// Vordach mit Neon-Reklame ueber einem Eingang. dir: Richtung nach aussen (x/z), (px,pz) = Tuermitte an der Aussenwand
function addCanopy(px, pz, ax, az, k) {
  const [word, col] = NEON_WORDS[k % NEON_WORDS.length], g = new THREE.Group();
  const horiz = az !== 0, D = 1.4, Wd = 3.4;
  const dark = lambert(0x2b2d30);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.12, D), dark); roof.position.set(0, 2.95, D / 2); g.add(roof);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, D), dark); st.position.set(sx * (Wd / 2 - 0.05), 2.65, D / 2); st.rotation.x = 0; g.add(st); }
  const tex = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#0a0a0e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = col; c.lineWidth = 4; c.shadowColor = col; c.shadowBlur = 14; c.strokeRect(8, 8, w - 16, h - 16);
    let fs = 84; c.font = `bold ${fs}px Arial, sans-serif`; while (c.measureText(word).width > w - 50 && fs > 20) { fs -= 4; c.font = `bold ${fs}px Arial, sans-serif`; }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowBlur = 22; c.fillStyle = col; c.fillText(word, w / 2, h / 2 + 4); c.shadowBlur = 6; c.fillStyle = '#fff'; c.globalAlpha = .75; c.fillText(word, w / 2, h / 2 + 4);
  }, false);
  const sm = new THREE.MeshBasicMaterial({ map: tex, color: settings.night ? 0xffffff : 0xb8b8b8 }); FACADE.neon.push(sm);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.1), [dark, dark, dark, dark, sm, sm]); sign.position.set(0, 3.5, D - 0.1); g.add(sign);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), dark); st.position.set(sx * 1.2, 3.2, D - 0.1); g.add(st); }
  g.position.set(px, 0, pz); g.rotation.y = Math.atan2(ax, az); mapRoot.add(g);
  // Lichtschein auf dem Boden (nur nachts)
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex(64, [[0, col + 'aa'], [0.5, col + '44'], [1, col + '00']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  pool.position.set(px + ax * 2.2, 0.06, pz + az * 2.2); pool.visible = !!settings.night; mapRoot.add(pool); FACADE.pools.push(pool);
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
  const segMat = (len, ht) => facadeMat(tex, Math.max(0.05, len / TILE_W), ht / TILE_H, 0, 0);
  const solid = (x0, x1, z0, z1, y0, y1, mat, collide = true) => {
    if (x1 - x0 < 0.001 || z1 - z0 < 0.001) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat === 'facade' ? segMat(Math.max(x1 - x0, z1 - z0), y1 - y0) : mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); mapRoot.add(m);
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
  const hu = h - H, mA = facadeMat(tex, w / TILE_W, hu / TILE_H, 0, H / TILE_H), mB = facadeMat(tex, d / TILE_W, hu / TILE_H, 0, H / TILE_H);
  const up = new THREE.Mesh(new THREE.BoxGeometry(w, hu, d), [mB, mB, roofMat, M.ceil, mA, mA]); up.position.set(cx, H + hu / 2, cz); mapRoot.add(up);
  boxes.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, top: h, y0: H });
  const fl = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * T, 0.04, d - 2 * T), M.floor); fl.position.set(cx, 0.02, cz); mapRoot.add(fl);
  M.floor.map.repeat.set(5, 5);
  // Innenräume: Kreuzflur, vier Räume
  const ihw = hw - T, ihd = hd - T;
  const mat = M.plaster;
  const furn = (sx, sy, sz, m, x, y, z, collide, topH, y0 = 0) => { // Möbelteil
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); mapRoot.add(b);
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
      cabinet(midx, midz, 1.0, 1.0, 1.0, crateMats(0x6b5a3c, 0)); cabinet(midx + sx * 1.3, midz - sz * 0.8, 0.8, 0.8, 0.8, crateMats(0x4d5a3c, 1));
      cabinet(midx - sx * 0.6, fz - sz * 0.3, 2.2, 0.45, 1.9, M.metal);
    }
    // Papiere am Boden
    for (let i = 0; i < 3; i++) furn(rr(0.2, 0.4), 0.01, rr(0.15, 0.3), M.paper, midx + rr(-2, 2), 0.045, midz + rr(-2, 2), false);
  }
  // Flurobjekte
  if (rnd() < 0.7) chair(cx + rr(-0.4, 0.4), cz - hd + T + 1.6, true);
  if (rnd() < 0.6) cabinet(cx + RD - 0.3, cz + hd - T - 0.4, 0.5, 0.6, 1.0, lambert(0x6b5a3c));
  { const cr = mkRng(hashXZ(cx, cz) + 77); // Vordaecher mit Neon-Reklame (eigener RNG)
    const doors = [[cx, cz - hd, 0, -1], [cx, cz + hd, 0, 1], [cx - hw, cz, -1, 0], [cx + hw, cz, 1, 0]];
    doors.forEach(([px, pz, ax, az]) => { if (cr() < 0.5) addCanopy(px, pz, ax, az, (cr() * 99) | 0); }); }
  interiorSpots.push({ x: cx, z: cz });
  if (rnd() < 0.5) interiorSpots.push({ x: cx + (rnd() < 0.5 ? -1 : 1) * 3.2, z: cz + 0.0 });
  if (rnd() < 0.5) { const a = new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2, d * .3), roofMat); a.position.set(cx + rr(-w / 4, w / 4), h + 1, cz + rr(-d / 4, d / 4)); mapRoot.add(a); }
}

function buildCity() {
  const bases = ['#8c8479', '#7a6d62', '#6c7378', '#8a6b5a', '#5f625b'];
  const lits = ['#ffd98a', '#cfe8ff'];
  const roofMat = lambert(0x3b3a38);
  let houseCount = 0;
  const addBuilding = (cx, cz, w, d, h, canEnter) => {
    const tex = facadeTexture(bases[(rnd() * bases.length) | 0], lits[(rnd() * 2) | 0]);
    h = Math.max(2, Math.round(h / FLOOR_H)) * FLOOR_H; // ganze Etagen -> Fenster auf realistischer Hoehe
    if (canEnter && w >= 12 && d >= 12 && ++houseCount % 3 === 0) { buildEnterable(cx, cz, w, d, Math.max(h, 3 * FLOOR_H), tex); return; }
    const mats = [facadeMat(tex, d / TILE_W, h / TILE_H), facadeMat(tex, d / TILE_W, h / TILE_H), roofMat, roofMat, facadeMat(tex, w / TILE_W, h / TILE_H), facadeMat(tex, w / TILE_W, h / TILE_H)];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(cx, h / 2, cz); mapRoot.add(m);
    addBox(cx, cz, w, d, h);
    if (rnd() < 0.5) { // Dachaufbau
      const a = new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2, d * .3), roofMat);
      a.position.set(cx + rr(-w / 4, w / 4), h + 1, cz + rr(-d / 4, d / 4)); mapRoot.add(a);
    }
  };
  const crateBody = new THREE.BoxGeometry(0.96, 0.96, 0.96), cratePost = new THREE.BoxGeometry(0.1, 1, 0.1);
  const addCrate = (x, z, s, c) => { // Optik: Holzkiste mit Brettern, Eckpfosten, Strebe, Nägeln. Kollision: unverändert (addBox)
    const h = hashXZ(x, z), g = new THREE.Group(), pm = cratePostMat(c);
    g.add(new THREE.Mesh(crateBody, crateMats(c, h & 1)));
    for (const px of [-1, 1]) for (const pz of [-1, 1]) { const p = new THREE.Mesh(cratePost, pm); p.position.set(px * 0.45, 0, pz * 0.45); g.add(p); }
    g.scale.set(s, s, s); g.position.set(x, s / 2, z); g.rotation.y = ((h >> 1) & 3) * Math.PI / 2; // 90°-Drehung: Quadrat -> Kollision identisch
    mapRoot.add(g); addBox(x, z, s, s, s);
  };

  // Bordstein: 3D-Absatz (0,15 m) am Rand jedes Blocks zur Straße (Spieler steigt automatisch hinauf)
  const curbMat = lambert(0xaaa89f), CH = 0.15, CT = 0.25;
  const curb = (x0, x1, z0, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, CH, z1 - z0), curbMat); m.position.set((x0 + x1) / 2, CH / 2, (z0 + z1) / 2); mapRoot.add(m);
    boxes.push({ x0, x1, z0, z1, top: CH });
  };
  for (const bx of MAP.blocks) for (const bz of MAP.blocks) {
    curb(bx - 20, bx + 20, bz - 20, bz - 20 + CT); curb(bx - 20, bx + 20, bz + 20 - CT, bz + 20);
    curb(bx - 20, bx - 20 + CT, bz - 20 + CT, bz + 20 - CT); curb(bx + 20 - CT, bx + 20, bz - 20 + CT, bz + 20 - CT);
  }
  for (const bx of MAP.blocks) for (const bz of MAP.blocks) {
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
  for (let i = 0; i < MAP.ring; i++) {
    const side = i % 4, t = rr(-(MAP.edge - 10), MAP.edge - 10), o = rr(MAP.edge - 10, MAP.edge);
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? -o : o;
    const z = side === 0 ? -o : side === 1 ? o : t;
    if (i % 3 === 0) addBuilding(x, z, rr(8, 12), rr(8, 12), rr(5, 10)); else addTree(x, z);
  }
  // Begrenzung: Kollisionsboxen wie bisher (unverändert); sichtbar ist die Randkulisse (Berge, Wald, Häuser, LKW)
  [[0, -HALF - 1, MAP.size + 4, 2], [0, HALF + 1, MAP.size + 4, 2], [-HALF - 1, 0, 2, MAP.size + 4], [HALF + 1, 0, 2, MAP.size + 4]].forEach(([x, z, w, d]) => addBox(x, z, w, d, 50));
  buildBackdrop();
  buildStreetProps();
  scatterTrash();
}

/* ---- Müll: Pappbecher, Dosen, Flaschen, Tüten, Papier, Pappe, Fast-Food-Boxen – nur Optik, KEINE Kollision (man läuft einfach drüber) ---- */
function scatterTrash() {
  const r = mkRng(4711 + MAP.size), AF = (MAP.size / 250) ** 2, T = {};
  const bag = new THREE.IcosahedronGeometry(1, 1); { const p = bag.attributes.position, jr = mkRng(5), seen = new Map(); for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(2) + p.getY(i).toFixed(2) + p.getZ(i).toFixed(2); if (!seen.has(k)) seen.set(k, [0.75 + jr() * 0.5, jr() - 0.5]); const j = seen.get(k); p.setXYZ(i, p.getX(i) * j[0], p.getY(i) * (0.7 + j[1] * 0.8), p.getZ(i) * j[0]); } bag.computeVertexNormals(); }
  const defs = {
    cup:   { w: 0.22, geo: new THREE.CylinderGeometry(0.042, 0.03, 0.11, 8), cols: [0xf2f2ee, 0xf2f2ee, 0xb83232, 0x8a5a36, 0xe8d8b0] },
    can:   { w: 0.18, geo: new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8), cols: [0xc83030, 0xaab0b4, 0x2f5fa8, 0x3a8a4a, 0xd8a020] },
    bottle:{ w: 0.12, geo: new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), cols: [0x9ec8e0, 0xcfe4ea, 0x6aa86a, 0xd8e8f0] },
    bag:   { w: 0.14, geo: bag, cols: [0xe8e8e0, 0xcfd3d6, 0x5a6b8a, 0x222222, 0xb04040, 0xd8c8a0] },
    ball:  { w: 0.14, geo: new THREE.IcosahedronGeometry(0.06, 0), cols: [0xe6e2d4, 0xd8d0b0, 0xcfd2d6] },
    sheet: { w: 0.12, geo: new THREE.BoxGeometry(0.3, 0.004, 0.21), cols: [0xdedbd0, 0xc9c6b8, 0xd8c9a0, 0xb8c0c8] },
    card:  { w: 0.05, geo: new THREE.BoxGeometry(0.5, 0.025, 0.36), cols: [0x9c7a4c, 0x8a6a40, 0xa88a58] },
    food:  { w: 0.03, geo: new THREE.BoxGeometry(0.17, 0.06, 0.17), cols: [0xc83030, 0xe8c030, 0xeeeeee] },
  };
  const keys = Object.keys(defs); for (const k of keys) T[k] = [];
  const blocked = (x, z) => boxes.some((b) => !b.y0 && b.top > 0.3 && x > b.x0 - 0.15 && x < b.x1 + 0.15 && z > b.z0 - 0.15 && z < b.z1 + 0.15);
  const pickType = () => { let t = r(), acc = 0; for (const k of keys) { acc += defs[k].w; if (t < acc) return k; } return 'cup'; };
  const place = (cx, cz, n, spread, fy) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (r() + r() + r() - 1.5) * spread, z = cz + (r() + r() + r() - 1.5) * spread;
      if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1 || blocked(x, z)) continue;
      const k = pickType(), c = defs[k].cols[(r() * defs[k].cols.length) | 0], yaw = r() * 6.283, s = 0.85 + r() * 0.4;
      let y = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1;
      if (k === 'cup') { if (r() < 0.7) { rz = Math.PI / 2; y = 0.042; } else { y = 0.055; rx = (r() - 0.5) * 0.3; } }
      else if (k === 'can') { if (r() < 0.8) { rz = Math.PI / 2; y = 0.033; } else y = 0.06; }
      else if (k === 'bottle') { rz = Math.PI / 2; y = 0.04; }
      else if (k === 'bag') { sx = 0.22 * s * (1 + r()); sy = 0.05 + r() * 0.04; sz = 0.18 * s * (1 + r() * 0.8); y = sy * 0.5; }
      else if (k === 'ball') { sx = sy = sz = s; y = 0.05 * s; }
      else if (k === 'sheet') { y = 0.008; rx = (r() - 0.5) * 0.06; }
      else if (k === 'card') { y = 0.02; sx = s; sz = s; }
      else { y = 0.032; }
      T[k].push({ x, y: y + fy, z, rx, ry: yaw, rz, sx, sy, sz, c });
    }
  };
  const nCl = Math.round(95 * AF) + 4;
  for (let i = 0; i < nCl; i++) { const x = (r() - 0.5) * 2 * (MAP.edge - 3), z = (r() - 0.5) * 2 * (MAP.edge - 3); place(x, z, 3 + ((r() * 7) | 0), 1.2, 0); }
  for (const sp of interiorSpots) for (let i = 0; i < 2; i++) place(sp.x + (r() - 0.5) * 6, sp.z + (r() - 0.5) * 6, 4 + ((r() * 4) | 0), 1.4, 0.04); // auch in den Häusern
  const d = new THREE.Object3D(), col = new THREE.Color();
  for (const k of keys) {
    const list = T[k]; if (!list.length) continue;
    const im = new THREE.InstancedMesh(defs[k].geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
    list.forEach((o, i) => { d.position.set(o.x, o.y, o.z); d.rotation.set(o.rx, o.ry, o.rz); d.scale.set(o.sx, o.sy, o.sz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.setHex(o.c)); });
    im.frustumCulled = false; mapRoot.add(im);
  }
}

function addTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 4, 6), lambert(0x3a2e24)); trunk.position.y = 2; g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 1.8, 4), lambert(0x3a2e24));
    b.position.set(0.5 * Math.cos(i * 1.6), 3.2 + i * 0.2, 0.5 * Math.sin(i * 1.6)); b.rotation.set(Math.sin(i * 1.6) * .9, 0, -Math.cos(i * 1.6) * .9); g.add(b);
  }
  g.add(makeCanopy(x, z));
  const pile = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), leafPileMat()); pile.rotation.x = -Math.PI / 2; pile.rotation.z = (hashXZ(x, z) % 628) / 100; pile.position.y = 0.035; g.add(pile); // Laub am Boden
  g.position.set(x, 0, z); mapRoot.add(g); addBox(x, z, 0.5, 0.5, 5);
}

/* ---- Herbstlaub: braune/rostige Krone aus unregelmäßigen Low-Poly-Blöcken (1 Mesh pro Baum, Vertexfarben) ---- */
const LEAF_COLORS = [0x6b3e1c, 0x7a4a22, 0x8b5a2b, 0x9a6a30, 0xa0522d, 0x7c3f1a, 0xb07a38, 0x5a3418];
let _leafMat = null, _leafPileMat = null;
function leafPileMat() {
  if (!_leafPileMat) _leafPileMat = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, map: canvasTex(256, 256, (g, w) => {
    const r = mkRng(777);
    for (let i = 0; i < 900; i++) { // Blätter, nach außen dünner werdend
      const a = r() * 6.283, d = Math.pow(r(), 0.7) * w * 0.48, c = LEAF_COLORS[(r() * LEAF_COLORS.length) | 0];
      g.save(); g.translate(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d); g.rotate(r() * 6.283); g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.globalAlpha = 0.9 - d / (w * 0.55);
      g.beginPath(); g.ellipse(0, 0, 2 + r() * 3, 1.2 + r() * 1.6, 0, 0, 7); g.fill(); g.restore();
    }
  }, false) });
  return _leafPileMat;
}
function makeCanopy(x, z) {
  const r = mkRng(hashXZ(x, z) + 91), pos = [], col = [];
  const blobs = 6 + ((r() * 3) | 0), tone = LEAF_COLORS[(r() * LEAF_COLORS.length) | 0];
  for (let b = 0; b < blobs; b++) {
    const geo = new THREE.IcosahedronGeometry(0.9 + r() * 0.7, 1), p = geo.attributes.position, a = r() * 6.283, d = b ? 0.8 + r() * 1.3 : 0;
    const ox = Math.cos(a) * d, oy = 4.5 + (b ? r() * 1.4 - 0.2 : 0.9), oz = Math.sin(a) * d;
    const jit = new Map(), c = new THREE.Color(r() < 0.5 ? tone : LEAF_COLORS[(r() * LEAF_COLORS.length) | 0]);
    for (let i = 0; i < p.count; i++) { // gleiche Eckpunkte gleich verschieben, damit keine Löcher entstehen
      const k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
      if (!jit.has(k)) jit.set(k, [(r() - 0.5) * 0.45, (r() - 0.5) * 0.35, (r() - 0.5) * 0.45]);
      const j = jit.get(k); pos.push(p.getX(i) + j[0] + ox, p.getY(i) * 0.8 + j[1] + oy, p.getZ(i) + j[2] + oz);
    }
    for (let f = 0; f < p.count / 3; f++) { const v = 0.82 + r() * 0.3; for (let q = 0; q < 3; q++) col.push(c.r * v, c.g * v, c.b * v); } // pro Fläche leicht andere Helligkeit
    geo.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  if (!_leafMat) _leafMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(g, _leafMat);
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
  const AF = (MAP.size / 250) ** 2;
  for (let i = 0; i < Math.max(8, Math.round(46 * AF)); i++) {
    const vertical = rnd() < 0.5, road = MAP.roads[(rnd() * MAP.roads.length) | 0];
    const along = rr(-(MAP.edge - 5), MAP.edge - 5);
    let x = vertical ? road + rr(-3.6, 3.6) : along, z = vertical ? along : road + rr(-3.6, 3.6);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue; // Spawn freihalten
    const g = makeCar();
    g.position.set(x, 0, z);
    g.rotation.y = (vertical ? Math.PI / 2 : 0) + (rnd() < 0.5 ? Math.PI : 0) + rr(-0.06, 0.06);
    mapRoot.add(g);
    vertical ? addBox(x, z, 1.9, 4.5, 1.5) : addBox(x, z, 4.5, 1.9, 1.5);
  }
  // Betonbarrieren & Straßenlaternen
  const barG = jerseyAssets(0).geo; // Jersey-Profil (Länge 2,4 · Breite 0,6 · Höhe 0,9 – wie die alte Box)
  for (let i = 0; i < Math.max(4, Math.round(26 * AF)); i++) {
    const vertical = rnd() < 0.5, road = MAP.roads[(rnd() * MAP.roads.length) | 0], along = rr(-(MAP.edge - 5), MAP.edge - 5);
    const x = vertical ? road + rr(-4, 4) : along, z = vertical ? along : road + rr(-4, 4);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    const m = new THREE.Mesh(barG, jerseyAssets(hashXZ(x, z) % 3).mat); m.position.set(x, 0.45, z); mapRoot.add(m);
    if (rnd() < 0.5) { m.rotation.y = Math.PI / 2; addBox(x, z, 0.6, 2.4, 0.9); } else addBox(x, z, 2.4, 0.6, 0.9);
  }
  const poleG = new THREE.CylinderGeometry(0.08, 0.1, 6, 6), poleM = lambert(0x2d2f30);
  const RM = MAP.roads[MAP.roads.length - 1];
  for (const r1 of MAP.roads) for (let r2 = -RM; r2 <= RM; r2 += 25) {
    for (const [x, z] of [[r1 + 5.5, r2], [r2, r1 + 5.5]]) {
      if (Math.abs(x) > MAP.edge || Math.abs(z) > MAP.edge || Math.abs(x % 50) < 6 && Math.abs(z % 50) < 6) continue;
      const m = new THREE.Mesh(poleG, poleM); m.position.set(x, 3, z); m.rotation.z = rnd() < 0.2 ? 0.15 : 0; mapRoot.add(m); addBox(x, z, 0.3, 0.3, 6); addLampHead(m, x, z, x === r1 + 5.5);
    }
  }
  // Fässer
  
  for (let i = 0; i < Math.max(4, Math.round(24 * AF)); i++) {
    const x = rr(-(MAP.edge - 5), MAP.edge - 5), z = rr(-(MAP.edge - 5), MAP.edge - 5);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    if (boxes.some((b) => x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5)) continue;
    const m = makeBarrel([0x7a2f20, 0x3a5a3a, 0x2f4a6a][i % 3]); m.position.set(x, 0.45, z); m.rotation.y = (hashXZ(x, z) % 628) / 100; mapRoot.add(m); addBox(x, z, 0.6, 0.6, 0.9);
  }
  finalizeLamps(); // Laternen: Lichtpfützen, Glow, Lichter
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
let master = null;
const audioOff = () => !actx || !settings.sound;
function applyVolume() { if (master) master.gain.value = settings.sound ? Math.pow(settings.volume / 100, 2) : 0; }
function initAudio() {
  try { if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.connect(actx.destination); applyVolume(); } if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
}
let _nb = null;
function noiseStart(src, t0, dur) { // gemeinsamer Rauschpuffer, zufälliger Startpunkt (spart Speicher)
  if (!_nb) { _nb = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate); const d = _nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  src.buffer = _nb; src.start(t0, Math.random() * 0.8, dur + 0.05);
}
function outNode(pan) { // Stereo-Position (-1 links … +1 rechts)
  if (!pan || !actx.createStereoPanner) return master;
  const p = actx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p;
}
function sfxNoise(dur, freq, vol, type = 'lowpass', q = 0.7, pan = 0, delay = 0, attack = 0) {
  if (audioOff()) return; const t0 = actx.currentTime + delay, s = actx.createBufferSource();
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain();
  if (attack > 0) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); } else g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(outNode(pan)); noiseStart(s, t0, dur);
}
function sfxTone(freq, dur, vol, type = 'sine', slide = 0, pan = 0, delay = 0) {
  if (audioOff()) return; const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(outNode(pan)); o.start(t0); o.stop(t0 + dur);
}
// Metallisch/hölzern klingender Anschlag: mehrere kurze, abklingende Obertöne
function sfxPing(freqs, dur, vol, pan = 0, delay = 0) {
  if (audioOff()) return; const t0 = actx.currentTime + delay, out = outNode(pan);
  freqs.forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain(), d = dur * (1 - i * 0.12);
    o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.03);
    g.gain.setValueAtTime(vol / (1 + i * 0.7), t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + d + 0.02);
  });
}
// Stimme (Zombie-Stöhnen): Sägezahn mit Vibrato, starker Verzerrung, Knarz-Amplitudenmodulation, Formantfiltern, kratzigem Atem – kurz & trocken (kein Nachhall)
const _curves = {};
function sfxVoice({ f0 = 80, glide = -20, dur = 1.0, vol = 0.2, pan = 0, form = [[500, 7], [1100, 8], [2400, 9]], rasp = 18, breath = 0.45, vib = 6, delay = 0, attack = 0.06, growl = 0.6 } = {}) {
  if (audioOff() || vol < 0.004) return; const t0 = actx.currentTime + delay, t1 = t0 + dur, out = outNode(pan);
  const osc = actx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f0, t0); osc.frequency.linearRampToValueAtTime(Math.max(30, f0 + glide), t1);
  const lfo = actx.createOscillator(), lg = actx.createGain(); lfo.frequency.value = vib + Math.random() * 2; lg.gain.value = f0 * 0.06; lfo.connect(lg); lg.connect(osc.frequency);
  const sh = actx.createWaveShaper();
  if (!_curves[rasp]) { const c = new Float32Array(257); for (let i = 0; i < 257; i++) c[i] = Math.tanh(rasp * (i / 128 - 1)); _curves[rasp] = c; }
  sh.curve = _curves[rasp]; osc.connect(sh);
  // Knarzen: schnelle Amplitudenmodulation (Stimmbandflattern)
  const am = actx.createGain(); am.gain.value = 1 - growl * 0.5; const amL = actx.createOscillator(), amG = actx.createGain();
  amL.type = 'square'; amL.frequency.value = 28 + Math.random() * 30; amG.gain.value = growl * 0.5; amL.connect(amG); amG.connect(am.gain);
  // Hüllkurve: schneller Einsatz, kurzer Abfall, KEIN langer Ausklang
  const env = actx.createGain(); env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(vol, t0 + attack);
  env.gain.linearRampToValueAtTime(vol * 0.75, Math.max(t0 + attack + 0.01, t1 - 0.12)); env.gain.linearRampToValueAtTime(0.0001, t1);
  const mix = actx.createGain(); mix.gain.value = 1;
  for (const [fr, q] of form) {
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q * 0.5; bp.frequency.setValueAtTime(fr, t0); bp.frequency.linearRampToValueAtTime(fr * 0.88, t1);
    const fg = actx.createGain(); fg.gain.value = 2.6; sh.connect(bp); bp.connect(fg); fg.connect(mix);
  }
  mix.connect(am); am.connect(env); env.connect(out);
  if (breath > 0) { // kratziger Atem (hohes Rauschen)
    const n = actx.createBufferSource(), bf = actx.createBiquadFilter(), bg = actx.createGain();
    bf.type = 'bandpass'; bf.frequency.value = 2600; bf.Q.value = 0.6; bg.gain.setValueAtTime(0.0001, t0); bg.gain.linearRampToValueAtTime(breath * vol, t0 + attack); bg.gain.linearRampToValueAtTime(0.0001, t1);
    n.connect(bf); bf.connect(bg); bg.connect(out); noiseStart(n, t0, dur);
  }
  osc.start(t0); lfo.start(t0); amL.start(t0); osc.stop(t1 + 0.05); lfo.stop(t1 + 0.05); amL.stop(t1 + 0.05);
}
const VOWELS = [[[700, 8], [1200, 9], [2600, 10]], [[350, 7], [800, 8], [2400, 10]], [[450, 7], [900, 8], [2500, 10]], [[500, 8], [1700, 9], [2500, 10]]];
const SFX = {
  shot(k) { const big = k === 3 ? 1 : k === 2 ? 0.8 : 0.6; sfxNoise(0.25 + big * 0.15, k === 3 ? 1400 : 3000, 0.9 * big, 'lowpass'); sfxTone(k === 3 ? 90 : 140, 0.18, 0.6 * big, 'sine', -80); },
  empty() { sfxPing([2600, 4100], 0.03, 0.25); sfxNoise(0.015, 3500, 0.2, 'highpass'); },
  // Nachlade-Bausteine: mechanisch – kurze, trockene Metall-Transienten, Ratschen, Federn; keine Töne mit Ausklang
  tick(f, v, d = 0) { sfxNoise(0.012, f, v, 'bandpass', 3, 0, d); sfxPing([f * 1.4], 0.015, v * 0.6, 0, d); },
  rattle(n, sp, f, v, d = 0) { for (let i = 0; i < n; i++) SFX.tick(f * (1 + i * 0.04), v, d + i * sp); },
  rClick() { SFX.tick(3800, 0.35); SFX.tick(2600, 0.2, 0.012); },                                                                   // Magazinhalter-Knopf
  rOut()   { sfxNoise(0.14, 1800, 0.25, 'bandpass', 1.4, 0, 0, 0.01); SFX.rattle(4, 0.03, 2200, 0.12); SFX.tick(3000, 0.25, 0.13); }, // Magazin gleitet heraus
  rRustle() { SFX.rattle(2, 0.03, 3000, 0.12); },                                                                                   // Fummeln
  rThunk() { sfxNoise(0.03, 1400, 0.6, 'bandpass', 1.2); sfxPing([900, 1700], 0.035, 0.35); sfxPing([120], 0.06, 0.55); SFX.tick(3200, 0.3, 0.045); }, // Magazin rastet ein
  rScrape() { sfxNoise(0.2, 2400, 0.2, 'bandpass', 1, 0, 0, 0.03); SFX.rattle(7, 0.026, 2800, 0.22); },                              // Spannschieber zurück (Ratsche)
  rClack() { sfxNoise(0.035, 2200, 0.7, 'bandpass', 1.5); sfxPing([1400, 2300, 3300], 0.045, 0.4); sfxPing([160], 0.05, 0.5); SFX.rattle(2, 0.02, 3500, 0.12, 0.05); }, // Verschluss schnappt vor
  rShell() { SFX.tick(2400, 0.3); sfxPing([180], 0.05, 0.3, 0, 0.01); SFX.tick(3200, 0.2, 0.04); },                                  // Patrone in Magazinrohr
  // Treffer & Zombie-Geräusche
  hit(vol = 1, pan = 0) { sfxNoise(0.09, 450, 0.65 * vol, 'lowpass', 0.7, pan); sfxNoise(0.05, 1100, 0.3 * vol, 'bandpass', 1.2, pan, 0.01); sfxPing([95], 0.1, 0.4 * vol, pan); },
  zhurt(vol = 1, pan = 0) { sfxVoice({ f0: 130, glide: -40, dur: 0.3, vol: 0.2 * vol, pan, form: VOWELS[0], attack: 0.02, rasp: 20, breath: 0.5, vib: 7 }); },
  groan(vol, pan) { sfxVoice({ f0: rr(60, 95), glide: rr(-28, -6), dur: rr(0.7, 1.2), vol: 0.17 * vol, pan, form: VOWELS[(Math.random() * VOWELS.length) | 0], rasp: rr(14, 24), breath: 0.5, growl: rr(0.5, 0.8) }); },
  step(vol, pan, run) {
    sfxNoise(run ? 0.06 : 0.09, run ? 520 : 380, 0.7 * vol, 'lowpass', 0.8, pan);                              // Ferse
    sfxPing([run ? 85 : 62], 0.1, 0.55 * vol, pan);                                                            // Körper-Dump
    sfxNoise(0.1, 2600, 0.18 * vol, 'highpass', 0.7, pan, run ? 0.025 : 0.045, 0.01);                          // Schleifen/Kiesel
  },
  death(vol = 1, pan = 0) {
    sfxVoice({ f0: 110, glide: -55, dur: 1.1, vol: 0.24 * vol, pan, form: VOWELS[0], rasp: 20, breath: 0.5, attack: 0.04, growl: 0.7 });
    sfxNoise(0.2, 260, 0.6 * vol, 'lowpass', 0.7, pan, 0.7); sfxPing([55], 0.25, 0.5 * vol, pan, 0.7);        // Aufprall
  },
  pain() { sfxNoise(0.12, 500, 0.8); sfxPing([70], 0.18, 0.6); sfxNoise(0.35, 1200, 0.22, 'bandpass', 0.8, 0, 0.08, 0.06); },
  pickup(ammo) {
    if (ammo) { sfxPing([1800, 2800, 4200], 0.07, 0.3); sfxPing([1500, 2400, 3600], 0.08, 0.28, 0, 0.06); sfxNoise(0.05, 900, 0.2, 'lowpass', 0.7, 0, 0.02); }
    else { sfxNoise(0.06, 3200, 0.18, 'highpass'); sfxPing([1300, 1950], 0.09, 0.22, 0, 0.05); sfxPing([1700, 2550], 0.12, 0.22, 0, 0.12); }
  },
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

const models = { player: null, zombies: [], genOk: false };
// Generator-Varianten mit Cache (LRU) – nicht mehr benutzte Zombies werden freigegeben, damit der Speicher nicht wächst
const variantCache = new Map();
function getVariant(idx) {
  let g = variantCache.get(idx);
  if (g) { variantCache.delete(idx); variantCache.set(idx, g); return g; }
  g = buildZombie(idx); g.userData.refs = 0; variantCache.set(idx, g);
  for (const [k, v] of variantCache) { if (variantCache.size <= 40) break; if (v.userData.refs === 0 && k !== idx) { disposeZombie(v); variantCache.delete(k); } }
  return g;
}
const releaseZombie = (z) => { if (z.gen && !z.released) { z.gen.userData.refs--; z.released = true; } };
// Gelenk-Wrapper: Animationswerte werden zur Grundpose des Generator-Zombies addiert
function limb(node, kind) {
  if (!node) return null;
  const b = node.rotation.clone(), o = { rotation: {} };
  for (const ax of ['x', 'y', 'z']) Object.defineProperty(o.rotation, ax, { get: () => 0, set: (v) => { node.rotation[ax] = b[ax] + (kind === 'arm' && ax === 'x' ? v + 1.35 : kind === 'torso' && ax === 'x' ? v - 0.2 : v); } });
  return o;
}
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
  player.reloading = true; player.reloadT = w.reload; playReloadSound(player.weapon, w.reload);
}
// Nachladegeräusch je Waffe, passend zur Nachladedauer (wird bei Waffenwechsel abgebrochen)
let reloadSeq = 0;
function playReloadSound(wi, dur) {
  const id = ++reloadSeq, S = SFX;
  const seqs = [
    [[0.04, S.rClick], [0.22, S.rOut], [0.3, S.rRustle], [0.55, S.rThunk], [0.62, S.rClick], [0.8, S.rScrape], [0.9, S.rClack]],                                  // Pistole
    [[0.04, S.rClick], [0.2, S.rOut], [0.35, S.rRustle], [0.58, S.rThunk], [0.66, S.rClick], [0.78, S.rScrape], [0.88, S.rClack]],                                // MP
    [[0.04, S.rClick], [0.18, S.rOut], [0.32, S.rRustle], [0.55, S.rThunk], [0.63, S.rClick], [0.74, S.rScrape], [0.82, S.rClack], [0.94, S.rClick]],             // Sturmgewehr
    [[0.08, S.rClick], [0.2, S.rShell], [0.34, S.rShell], [0.48, S.rShell], [0.62, S.rShell], [0.74, S.rScrape], [0.82, S.rClack], [0.9, S.rScrape], [0.96, S.rClack]], // Schrotflinte (Patronen + Pumpen)
  ];
  for (const [f, fn] of seqs[wi] || seqs[0]) setTimeout(() => { if (player.reloading && reloadSeq === id) fn(); }, f * dur * 1000);
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
  const gen = models.genOk ? getVariant(opts.variant !== undefined ? opts.variant : (Math.random() * ZOMBIE_COUNT) | 0) : null;
  const src = gen || (models.zombies.length ? models.zombies[(rnd() * models.zombies.length) | 0] : null);
  if (gen) {
    root = gen.clone(true); const nd = (n) => root.getObjectByName(n);
    parts = { head: limb(nd('head'), 'head'), armL: limb(nd('armL'), 'arm'), armR: limb(nd('armR'), 'arm'), legL: limb(nd('legL'), 'leg'), legR: limb(nd('legR'), 'leg'), torso: limb(nd('torso'), 'torso') };
  } else if (src) {
    root = src.clone(true); const pv = (n) => root.getObjectByName('pv_' + n);
    parts = { head: pv('head'), armL: pv('armL'), armR: pv('armR'), foreL: pv('foreL'), foreR: pv('foreR'), legL: pv('legL'), legR: pv('legR'), torso: { rotation: { x: 0, y: 0, z: 0 } } };
    if (!parts.head || !parts.armL || !parts.legL) parts = null; // Rig unvollständig -> nur Ganzkörper-Animation
  } else { root = buildHumanoid(ZOMBIE_SPEC); parts = root.parts; }
  const sc = rr(0.95, 1.08); root.scale.multiplyScalar(sc);
  const runner = opts.runner ?? rnd() < 0.2;
  const hp = (opts.hp || 100) * (runner ? 0.7 : 1);
  const zb = {
    root, parts, pos: new THREE.Vector3(x, 0, z), yaw: rr(0, 6.28), hp, maxHp: hp, state: 'wander', t: rnd() * 5,
    speed: (runner ? rr(3.2, 4.2) : rr(1.1, 2.0)) * (opts.speedMul || 1), dmg: opts.dmg || 12, atkCd: 0, stun: 0, headY: ((src && src.userData.headY) || 1.62) * sc,
    wander: new THREE.Vector3(x, 0, z), phase: rnd() * 6, stuckT: 0, lastP: new THREE.Vector3(x, 0, z), side: 0, dieT: 0, fall: rnd() < 0.5 ? -1 : 1, groanT: rr(3, 9),
    target: null, runner, gen,
  };
  if (gen) gen.userData.refs++;
  root.position.copy(zb.pos); scene.add(root); applyShaderTo(root); zombies.push(zb); return zb;
}
function damageZombie(z, dmg, head, dir, at) {
  z.hp -= dmg; z.stun = 0.2; const za = zAudio(z); SFX.hit(za.vol, za.pan);
  if (z.state === 'wander') { z.state = 'chase'; }
  emit(at, head ? 14 : 7, 'blood', head ? 3.5 : 2.5, 0.05, 9, dir);
  if (z.hp <= 0) { killZombie(z, head); return true; }
  SFX.zhurt(za.vol, za.pan); return false;
}
function killZombie(z, head) {
  z.state = 'dying'; z.dieT = 0; player.kills++; killsTotal++; { const za = zAudio(z); SFX.death(za.vol, za.pan); }
  emit(new THREE.Vector3(z.pos.x, z.pos.y + 1, z.pos.z), head ? 25 : 14, 'blood', 3, 0.06, 9);
  updateHUD();
}
function noise(pos, radius) { for (const z of zombies) if (z.state === 'wander' && z.pos.distanceTo(pos) < radius) { z.state = 'chase'; } }

/* Zombie-Geräusche: nur die nächsten Zombies (max. CONFIG.soundVoices) sind hörbar, Lautstärke nach Entfernung, Stereo-Richtung */
const audible = new Set(); let audT = 0;
function updateAudible(dt) {
  audT -= dt; if (audT > 0) return; audT = 0.15; audible.clear();
  const list = [];
  for (const z of zombies) { if (z.state === 'dead' || z.state === 'dying') continue; const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z); if (d < CONFIG.soundRange) list.push([d, z]); }
  list.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Math.min(CONFIG.soundVoices, list.length); i++) audible.add(list[i][1]);
}
function audioOf(z, dist) {
  const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.max(0.5, dist);
  const f = Math.max(0, 1 - d / CONFIG.soundRange);
  return { vol: f * f, pan: (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d * Math.min(1, 4 / d + 0.5) };
}
function zAudio(z) { // Lautstärke/Richtung für Treffer- und Sterbegeräusche
  const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
  return { vol: clamp(1 - d / 80, 0.2, 1), pan: audioOf(z, d).pan };
}
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
  if (z.state === 'dead') { z.deadT += dt; if (z.deadT > 12) { z.root.position.y -= dt * 0.15; if (z.deadT > 18) { scene.remove(z.root); releaseZombie(z); z.gone = true; } } return; }
  if (player.dead) z.state = 'wander';
  if (z.stun > 0) { z.stun -= dt; return; }
  z.atkCd -= dt; z.groanT -= dt;
  if (z.groanT <= 0) { z.groanT = rr(5, 12); if (audible.has(z)) { const a = audioOf(z, dist); SFX.groan(a.vol, a.pan); } }
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
  const stepIdx = Math.floor(z.phase / Math.PI); // Schritt bei jedem Beinwechsel – nur für die nächsten Zombies hörbar
  if (stepIdx !== z.stepIdx) { z.stepIdx = stepIdx; if (z.state !== 'attack' && audible.has(z)) { const a = audioOf(z, dist); SFX.step(a.vol, a.pan, z.runner); } }
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

/* Wellen: Welle n hat 10·n verschiedene Zombies (Generator-Varianten 0..10n-1); Welle 30 = alle 300 */
const waves = {
  n: 0, queue: [], spawnT: 0, pause: 3, active: false,
  start() {
    this.n++; this.active = true; this.spawnT = 1;
    const q = []; for (let i = 0; i < this.n * 10; i++) q.push(i);
    for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [q[i], q[j]] = [q[j], q[i]]; }
    this.queue = q; toast('WELLE ' + this.n + ' – ' + q.length + ' ZOMBIES'); updateHUD();
  },
  update(dt) {
    if (!CONFIG.wavesEnabled || player.dead || won) return;
    if (!this.active) { this.pause -= dt; if (this.pause <= 0) this.start(); return; }
    if (this.queue.length > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && alive() < CONFIG.maxAlive) {
        this.spawnT = CONFIG.spawnInterval; const v = this.queue.pop(), p = randomSpawn(HALF * 0.28, HALF * 0.72);
        spawnZombie(p.x, p.z, { variant: v, hp: 100 + this.n * 6, speedMul: 1 + Math.min(0.6, this.n * 0.02), dmg: 10 + Math.floor(this.n / 2) }); updateHUD();
      }
    } else if (alive() === 0) {
      this.active = false; this.pause = 8;
      if (this.n >= CONFIG.maxWave) { victory(); return; }
      player.hp = Math.min(CONFIG.playerMaxHp, player.hp + 25); player.ammo.forEach((a, i) => (a.reserve += WEAPONS[i].mag));
      toast('WELLE ' + this.n + ' GESCHAFFT  (+25 Leben, +Munition)'); updateHUD();
    }
  },
};
let won = false;
function victory() {
  won = true; setPaused(true);
  $('goTitle').textContent = 'ÜBERLEBT!'; $('goTitle').classList.remove('red'); $('goTitle').classList.add('green');
  $('goKills').textContent = player.kills; $('goWave').textContent = waves.n; $('gameOver').classList.remove('hidden');
}
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
  for (let i = 0; i < Math.max(6, Math.round(16 * (MAP.size / 250) ** 2)); i++) {
    const sp = i < 6 && interiorSpots.length ? interiorSpots[(i * 7 + (rnd() * 3 | 0)) % interiorSpots.length] : null;
    const p = sp ? { x: sp.x + rr(-0.6, 0.6), z: sp.z + rr(-0.6, 0.6) } : randomSpawn(8, Math.min(110, HALF - 10)); const ammo = i % 3 !== 0;
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
      p.m.visible = false; p.t = 60; SFX.pickup(p.ammo); updateHUD();
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
  $('wave').textContent = CONFIG.wavesEnabled ? (waves.n || 1) + '/' + CONFIG.maxWave : '–';
  $('remaining').textContent = alive() + (CONFIG.wavesEnabled ? waves.queue.length : 0);
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
  zombies.forEach((z) => { scene.remove(z.root); releaseZombie(z); }); zombies.length = 0;
  Object.assign(player, { hp: CONFIG.playerMaxHp, kills: 0, dead: false, vy: 0, reloading: false, fireCd: 0, yaw: 0, pitch: 0, recoilKick: 0, swapT: 0 });
  player.pos.set(0, 0, 8); player.ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
  waves.n = 0; waves.active = false; waves.pause = 3; waves.queue = []; won = false; setPaused(false);
  $('goTitle').textContent = 'GAME OVER'; $('goTitle').classList.add('red'); $('goTitle').classList.remove('green');
  for (let i = 0; i < CONFIG.trainingZombies && !CONFIG.wavesEnabled; i++) { const p = randomSpawn(18, 60); spawnZombie(p.x, p.z); }
  spawnPickups(); selectWeapon(0); viewGuns.forEach((g, k) => (g.visible = k === 0)); updateHUD();
}
async function startGame(id) {
  id = id || mapId || 'big'; initAudio();
  if (id !== mapId) { $('loadText').textContent = 'Lade ' + MAPS[id].name + ' …'; $('loading').classList.remove('hidden'); await new Promise((r) => setTimeout(r, 40)); loadMap(id); $('loading').classList.add('hidden'); }
  $('startScreen').classList.add('hidden'); $('gameOver').classList.add('hidden'); $('hud').classList.remove('hidden');
  resetGame(); running = true;
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignorieren */ }
}
$('btnStartSmall').addEventListener('click', () => startGame('small'));
$('btnStartBig').addEventListener('click', () => startGame('big'));
$('btnRestart').addEventListener('click', () => startGame(mapId));
$('btnMenu').addEventListener('click', () => { running = false; setPaused(false); $('gameOver').classList.add('hidden'); $('hud').classList.add('hidden'); $('startScreen').classList.remove('hidden'); });

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
  updateLamps(now / 1000, camera.position);
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
  updateAudible(dt);
  for (const z of zombies) updateZombie(z, dt);
  for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].gone) zombies.splice(i, 1);
  waves.update(dt); updatePickups(dt);
  $('remaining').textContent = alive() + (CONFIG.wavesEnabled ? waves.queue.length : 0);
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
const settings = { sound: true, volume: 80, night: false, fps: 60, res: 1, shader: 'off', gloss: 100, sens: 100, btnScale: 100, layout: {} };
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
  applyLampNight(n);
  applyFacadeNight(n);
  applyBackdropNight(n);
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
  if (!p) { p = new THREE.MeshPhongMaterial({ color: m.color, map: m.map, alphaTest: m.alphaTest, vertexColors: m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits, emissive: m.emissive, emissiveMap: m.emissiveMap }); p.userData.orig = m; phongCache.set(m, p); }
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
bindSeg('optTime', 'night', (v) => v === 'true', applyTime);
bindSeg('optSound', 'sound', (v) => v === 'true', () => { initAudio(); applyVolume(); if (settings.sound) SFX.rClack(); });
bindSeg('optFps', 'fps', Number, () => {});
bindSeg('optRes', 'res', Number, applyRes);
bindSeg('optShader', 'shader', String, applyShader);
function bindRange(id, key, onChange) { const el = $(id); el.value = settings[key]; el.addEventListener('input', () => { settings[key] = +el.value; saveSettings(); onChange && onChange(); }); }
$('optVolume').addEventListener('change', () => { initAudio(); applyVolume(); SFX.rClack(); }); // Hörprobe beim Loslassen
bindRange('optVolume', 'volume', applyVolume); bindRange('optBtnScale', 'btnScale', applyLayout); bindRange('optSens', 'sens'); bindRange('optGloss', 'gloss', applyShader);
function applyAllSettings() { applyTime(); applyShader(); applyRes(); applyLayout(); applyVolume(); }

/* ---------------- Start ---------------- */
async function init() {
  $('loadText').textContent = 'Lade Modelle …';
  try { disposeZombie(buildZombie(0)); models.genOk = true; } catch (e) { console.warn('Zombie-Generator fehlgeschlagen, nutze Fallback:', e); models.genOk = false; }
  const [pm, ...zms] = await Promise.all([tryLoadModel(CONFIG.playerModelUrl), ...(models.genOk ? [] : CONFIG.zombieModelUrls.map((u) => tryLoadModel(u, rigZombie)))]);
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
