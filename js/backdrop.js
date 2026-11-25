import * as THREE from 'three';
import { settings } from './config.js';
import { c8, canvasTex, clamp, mkRng } from './core.js';
import { HALF, MAP, mapRoot } from './mapdata.js';


/* ============================================================
   Randkulisse: flache Wand rund um die Map mit Bergen, Wald,
   Häusern und LKW-Kolonnen in unterschiedlichen Höhen.
   - Reine Optik: die Kollisionsbox der Begrenzung bleibt wie vorher (addBox)
   - Eigener Zufallsgenerator (mkRng) -> Map-Zufallsfolge bleibt unverändert
   - 4 Typen x 3 Varianten Texturen, werden auf 24 Segmente verteilt
   ============================================================ */
export const BD = { SEG0: 250 / 6, W: 768, HM: { berg: 48, haus: 26, wald: 20, lkw: 14 }, TYPES: ['berg', 'haus', 'wald', 'lkw'], VARIANTS: 3, mats: {} };
BD.ppm = BD.W / BD.SEG0;
export const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgbS = (c, a = 1) => `rgba(${c8(c[0])},${c8(c[1])},${c8(c[2])},${a})`;
export const HAZE = [150, 164, 178];

export function drawBackdrop(g, W, H, ppm, type, rng) {
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

export function backdropMat(type, variant) {
  const key = type + variant;
  if (BD.mats[key]) return BD.mats[key];
  const H = Math.round(BD.HM[type] * BD.ppm), seed = BD.TYPES.indexOf(type) * 101 + variant * 977 + 31;
  const tex = canvasTex(BD.W, H, (g) => drawBackdrop(g, BD.W, H, BD.ppm, type, mkRng(seed)), false);
  return (BD.mats[key] = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.4, fog: false }));
}
export function applyBackdropNight(n) { for (const k in BD.mats) BD.mats[k].color.setHex(n ? 0x2f3a5c : 0xffffff); }
export function buildBackdrop() {
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
