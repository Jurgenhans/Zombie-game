import * as THREE from 'three';
import { settings } from './config.js';
import { canvasTex, hashXZ, lambert, mkRng, renderer, rnd, rr, shade } from './core.js';
import { addLampHead, finalizeLamps } from './lamps.js';
import { MAP, addBox, boxes, groundH, mapRoot } from './mapdata.js';


/* ============================================================
   Deckungsobjekte: Holzkisten, Fässer, Betonbarrieren
   Nur Optik! Kollisionsboxen (addBox) bleiben exakt wie vorher.
   Eigener Zufallsgenerator -> die Map-Zufallsfolge (seed) bleibt unverändert.
   ============================================================ */

// Alte Farbe -> Kisten-Stil (gleiche Farbzuordnung wie vorher: braun / grün / grau)
export const CRATE_STYLES = {
  0x6b5a3c: { wood: [132, 98, 58], chip: null, stencil: null, straps: false },            // Holzkiste (natur)
  0x4d5a3c: { wood: [82, 96, 58], chip: [120, 90, 56], stencil: 'AMMO', straps: false },   // Militärkiste (olivgrün lackiert)
  0x555a60: { wood: [112, 98, 78], chip: null, stencil: null, straps: true },              // Kiste mit Stahlbändern
};
export const crateStyle = (c) => CRATE_STYLES[c] || CRATE_STYLES[0x6b5a3c];

export function woodGrain(g, x, y, w, h, vertical, rgb, rng, n) {
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
export const rr2 = (rng, a, b) => a + (b - a) * rng();

export function knot(g, x, y, r, rgb) {
  for (let i = 4; i >= 1; i--) { g.fillStyle = shade(rgb, 0.4 + i * 0.08, 0.55); g.beginPath(); g.ellipse(x, y, r * i / 2.2, r * i / 3.2, 0, 0, 7); g.fill(); }
  g.fillStyle = shade(rgb, 0.3, 0.8); g.beginPath(); g.ellipse(x, y, r * 0.3, r * 0.2, 0, 0, 7); g.fill();
}

export function nail(g, x, y, S, rust) {
  const r = S * 0.012 + 1;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x + 0.8, y + 1, r + 0.6, 0, 7); g.fill();
  g.fillStyle = rust ? '#6a4a34' : '#7d7f80'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, 7); g.fill();
}

export function beamEdges(g, x, y, w, h) { // Kanten-Schatten/Licht, damit Leisten plastisch wirken
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.strokeStyle = 'rgba(255,235,200,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 3, y + h - 3); g.lineTo(x + 3, y + 3); g.lineTo(x + w - 3, y + 3); g.stroke();
}

export function drawCrateSide(g, S, st, rng) {
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

export function drawCrateTop(g, S, st, rng) {
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

export const _crateCache = {};
export function crateMats(color, variant = 0) {
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
export const _postCache = {};
export const cratePostMat = (color) => _postCache[color] || (_postCache[color] = lambert(new THREE.Color().setRGB(...crateStyle(color).wood.map((v) => v / 255 * 0.78)).getHex()));

/* ---- Fässer ---- */
export const BARREL_STYLES = {
  0x7a2f20: { rgb: [138, 52, 36], label: null },
  0x3a5a3a: { rgb: [62, 102, 66], label: 'hazard' },
  0x2f4a6a: { rgb: [48, 80, 122], label: null },
};
export function drawBarrelSide(g, W, H, st, rng) {
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
export function drawBarrelTop(g, S, st, rng) {
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
export let _barrelShared = null;
export const _barrelByColor = {};
export function makeBarrel(color) {
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
export function drawConcrete(g, S, rng, tint) {
  g.fillStyle = tint; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr2(rng, 0.02, 0.06)})`; g.beginPath(); g.ellipse(rng() * S, rng() * S, rr2(rng, 10, 40), rr2(rng, 8, 30), rng() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 2600; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr2(rng, 0.05, 0.16)})`; g.fillRect(rng() * S, rng() * S, rr2(rng, 1, 3), rr2(rng, 1, 3)); }
  for (let i = 0; i < 9; i++) { const x = rng() * S, y = rng() * S, r = rr2(rng, 3, 8); g.fillStyle = 'rgba(20,20,20,.5)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(210,210,200,.25)'; g.beginPath(); g.arc(x - 1, y - 1, r * 0.6, 0, 7); g.fill(); } // Lunker
  for (let i = 0; i < 5; i++) { const x = rng() * S, y = rng() * S; g.fillStyle = 'rgba(120,60,25,.28)'; g.beginPath(); g.ellipse(x, y, rr2(rng, 3, 8), rr2(rng, 8, 26), 0, 0, 7); g.fill(); } // Rostspuren
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { let x = rng() * S, y = rng() * S; g.strokeStyle = 'rgba(25,25,25,.65)'; g.lineWidth = rr2(rng, 0.8, 1.6); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += rr2(rng, -12, 12); y += rr2(rng, -12, 12); g.lineTo(x, y); } g.stroke(); } // Risse
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(15,15,15,.28)'; g.fillRect(rng() * S, rng() * S, rr2(rng, 20, 60), rr2(rng, 3, 8)); } // Schleifspuren
}
export let _jersey = null;
export function jerseyAssets(variant) {
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

// Umgebungs-Reflexion fuer Autolack/Glas/Chrom (kleiner Himmel-Equirect -> PMREM), einmalig
export const CAR_MATS = [];
export let _carEnv;
export function carEnv() {
  if (_carEnv !== undefined) return _carEnv;
  try {
    const t = canvasTex(512, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6f8fb4'); gr.addColorStop(0.42, '#d6e2ec'); gr.addColorStop(0.5, '#f4f6f6'); gr.addColorStop(0.52, '#4d4a44'); gr.addColorStop(1, '#23211e');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${0.12 + (i % 4) * 0.05})`; g.beginPath(); g.ellipse((i * 97) % w, 25 + (i * 41) % 70, 30 + (i * 13) % 50, 8 + (i * 7) % 12, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,248,225,.95)'; g.beginPath(); g.arc(w * 0.7, h * 0.18, 16, 0, 7); g.fill();
      g.fillStyle = 'rgba(30,30,32,.55)'; for (let i = 0; i < 22; i++) g.fillRect((i * 53) % w, h * 0.5 - 6 - (i * 17) % 28, 20 + (i * 11) % 36, 40); // Haeuserzeile
    }, false);
    t.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer); _carEnv = pm.fromEquirectangular(t).texture; pm.dispose();
  } catch (e) { _carEnv = null; }
  return _carEnv;
}
export function carMat(o, k = 1) { const m = new THREE.MeshPhysicalMaterial(o); m.envMap = carEnv(); m.userData.k = k; m.envMapIntensity = settings.night ? 0.12 * k : k; CAR_MATS.push(m); return m; }
export function applyCarNight(n) { for (const m of CAR_MATS) m.envMapIntensity = n ? 0.12 * m.userData.k : m.userData.k; }
export function addTree(x, z) {
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
export const LEAF_COLORS = [0x6b3e1c, 0x7a4a22, 0x8b5a2b, 0x9a6a30, 0xa0522d, 0x7c3f1a, 0xb07a38, 0x5a3418];
export let _leafMat = null, _leafPileMat = null;
export function leafPileMat() {
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
export function makeCanopy(x, z) {
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

export function buildStreetProps() {
  // ---- Autos (Profil-Extrusion, Räder, Lichter, Rost/Schmutz, Schäden)
  const carColors = [0x7a2a22, 0x2c3e55, 0x4a5a4a, 0x8a7a3a, 0x252525, 0x6a6a70, 0xb8b8b0, 0x30506a];
  const prof = (pts, R) => { // Polygon mit abgerundeten Ecken (Radius R)
    const s = new THREE.Shape(), n = pts.length, P = (k) => pts[(k + n) % n];
    for (let k = 0; k < n; k++) {
      const [px, py] = P(k), [ax, ay] = P(k - 1), [bx, by] = P(k + 1);
      const la = Math.hypot(ax - px, ay - py), lb = Math.hypot(bx - px, by - py), r = Math.min(R, la / 2.2, lb / 2.2);
      const sx = px + (ax - px) / la * r, sy = py + (ay - py) / la * r, ex = px + (bx - px) / lb * r, ey = py + (by - py) / lb * r;
      if (k === 0) s.moveTo(sx, sy); else s.lineTo(sx, sy);
      s.quadraticCurveTo(px, py, ex, ey);
    }
    s.closePath(); return s;
  };
  const smooth = (g) => { // weiche Normalen (Winkelgrenze ~50°), damit die Rundungen nicht kantig schattiert sind
    g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, map = new Map(), key = (i) => pos.getX(i).toFixed(3) + ',' + pos.getY(i).toFixed(3) + ',' + pos.getZ(i).toFixed(3);
    for (let i = 0; i < pos.count; i++) { const k = key(i); (map.get(k) || map.set(k, []).get(k)).push(i); }
    const out = new Float32Array(nor.array.length), cs = Math.cos(0.87);
    for (let i = 0; i < pos.count; i++) {
      let x = 0, y = 0, z = 0; const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      for (const j of map.get(key(i))) { const mx = nor.getX(j), my = nor.getY(j), mz = nor.getZ(j); if (mx * nx + my * ny + mz * nz > cs) { x += mx; y += my; z += mz; } }
      const l = Math.hypot(x, y, z) || 1; out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(out, 3)); return g;
  };
  const ext = (pts, depth, bev, R) => { const g = new THREE.ExtrudeGeometry(prof(pts, R), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 8, steps: 1 }); g.translate(0, 0, -depth / 2); return smooth(g); };
  const carBodyG = ext([[-2.15, 0.32], [-2.15, 0.82], [-1.7, 0.94], [-0.9, 0.98], [1.0, 0.98], [1.7, 0.86], [2.15, 0.7], [2.15, 0.32]], 1.56, 0.12, 0.3);
  const roofSplit = (g) => { // Dachflaeche (Normale zeigt nach oben) -> Gruppe 1 (Lack), Rest -> Gruppe 0 (Glas)
    const pos = g.attributes.position, nor = g.attributes.normal, glass = [], paint = [];
    for (let t = 0; t < pos.count; t += 3) { const ny = (nor.getY(t) + nor.getY(t + 1) + nor.getY(t + 2)) / 3; (ny > 0.8 ? paint : glass).push(t, t + 1, t + 2); }
    g.setIndex(glass.concat(paint)); g.clearGroups(); g.addGroup(0, glass.length, 0); g.addGroup(glass.length, paint.length, 1); return g;
  };
  const carCabG = roofSplit(ext([[-1.15, 0.97], [-0.8, 1.48], [0.5, 1.48], [1.0, 0.97]], 1.41, 0.1, 0.22));
  const roofG = new THREE.BoxGeometry(1.4, 0.07, 1.62), wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 22), hubG = new THREE.CylinderGeometry(0.17, 0.17, 0.28, 8);
  wheelG.rotateX(Math.PI / 2); hubG.rotateX(Math.PI / 2);
  const dirt = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const l = (150 + rnd() * 105) | 0; g.fillStyle = `rgba(${l},${l},${l},.35)`; g.fillRect(rnd() * w, rnd() * h, rr(1, 6), rr(1, 6)); }
    for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(${(120 + rnd() * 40) | 0},${(60 + rnd() * 30) | 0},30,${rr(.35, .7)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(2, 8), 0, 7); g.fill(); }
    const dr = mkRng(99), drr = (a, b) => a + (b - a) * dr();
    { const gd = g.createLinearGradient(0, 0, 0, h); gd.addColorStop(0, 'rgba(255,255,255,0)'); gd.addColorStop(0.6, 'rgba(0,0,0,0)'); gd.addColorStop(1, 'rgba(70,55,40,.45)'); g.fillStyle = gd; g.fillRect(0, 0, w, h); }  // Strassendreck unten
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(255,255,255,${drr(.15, .4)})`; g.lineWidth = 1; const x = dr() * w, y = dr() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + drr(-18, 18), y + drr(-6, 6)); g.stroke(); }                      // Kratzer
    for (let i = 0; i < 6; i++) { const x = dr() * w, y = dr() * h; g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x, y, drr(10, 26), drr(6, 14), dr() * 3, 0, 7); g.fill(); }    // ausgeblichen
    for (let i = 0; i < 8; i++) { const x = dr() * w, y = dr() * h * .5 + h * .5; g.fillStyle = 'rgba(110,55,25,.55)'; g.beginPath(); g.arc(x, y, drr(2, 6), 0, 7); g.fill(); g.fillStyle = 'rgba(80,40,18,.35)'; g.beginPath(); g.arc(x + 2, y + 1, drr(4, 9), 0, 7); g.fill(); }  // Rost
    for (let i = 0; i < 20; i++) { g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = rr(1, 2); const x = rnd() * w; g.beginPath(); g.moveTo(x, rnd() * h * .4); g.lineTo(x + rr(-3, 3), h); g.stroke(); }
  }, true);
  const glassM = carMat({ color: 0x10161b, metalness: 0.1, roughness: 0.05 }, 1.4), glassBroken = carMat({ color: 0x3a4650, metalness: 0.1, roughness: 0.35 });
  const tireM = lambert(0x111111), hubM = carMat({ color: 0x9a9da0, metalness: 0.9, roughness: 0.3 }), blackM = lambert(0x1a1a1a), chromeM = carMat({ color: 0xc4c7ca, metalness: 1, roughness: 0.12 });
  const headM = new THREE.MeshBasicMaterial({ color: 0xf1e7b0 }), tailM = new THREE.MeshBasicMaterial({ color: 0x8a1212 }), plateM = lambert(0xc9c4a0);
  const burntM = lambert(0x161412), burntRoof = lambert(0x24211e);
  function makeCar() {
    const burned = rnd() < 0.15, g = new THREE.Group();
    const body = burned ? burntM : carMat({ color: carColors[(rnd() * carColors.length) | 0], map: dirt, metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(carBodyG, body, 0, 0, 0);
    add(carCabG, burned ? [burntRoof, burntRoof] : [rnd() < 0.4 ? glassBroken : glassM, body], 0, 0, 0); // Scheiben + lackiertes Dach
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
    const m = makeBarrel([0x7a2f20, 0x3a5a3a, 0x2f4a6a][i % 3]); m.position.set(x, 0.45 + groundH(x, z), z); m.rotation.y = (hashXZ(x, z) % 628) / 100; mapRoot.add(m); addBox(x, z, 0.6, 0.6, 0.9 + groundH(x, z));
  }
  finalizeLamps(); // Laternen: Lichtpfützen, Glow, Lichter
}
