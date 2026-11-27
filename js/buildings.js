import * as THREE from 'three';
import { settings } from './config.js';
import { canvasTex, hashXZ, lambert, mkRng, renderer, rnd, rr } from './core.js';
import { addFenceLine } from './fences.js';
import { radialTex } from './lamps.js';
import { boxes, interiorSpots, mapRoot } from './mapdata.js';
import { crateMats } from './props.js';
import { phongCache } from './shader.js';

export const FLOOR_H = 3.4, TILE_W = 12, TILE_H = 6.8;
export const FACADE = { mats: [], neon: [], pools: [], cache: {} };
export const NEON_WORDS = [['CAFFE', '#ff4fa8'], ['CAFFE', '#ffb347'], ['BAR', '#35e0ff'], ['PIZZA', '#ff5a3c'], ['PUB', '#5dff7a'], ['DINER', '#ff4fa8'], ['HOTEL', '#35e0ff'], ['KIOSK', '#ffe14d'], ['BURGER', '#ff8a2a'], ['OPEN 24h', '#5dff7a'], ['APOTHEKE', '#4dff9a'], ['TABAK', '#ff4f4f']];
// Fassade: 12 m x 6.8 m Kachel (2 Etagen a 3,4 m, 4 Fenster je Etage = 8 Fenster, genau 1 Fenster beleuchtet).
// Hohe Aufloesung (64 px/m), Wandstil Backstein / Putz / Betonplatten, Fensterrahmen mit Laibung, Glas mit Spiegelung, Vorhaenge.
// Texturen werden pro Variante gecacht (FACADE.cache) und von allen Gebaeuden geteilt.
export function facadeTexture(base, lit, variant = 0) {
  const key = base + lit + variant;
  if (FACADE.cache[key]) return FACADE.cache[key];
  const r = mkRng(hashXZ(base.length * 977 + base.charCodeAt(1) * 31 + base.charCodeAt(3) * 7 + base.charCodeAt(5), lit.charCodeAt(1) * 13 + variant * 101));
  const rg = (a, b) => a + (b - a) * r();
  const PX = 88, W = TILE_W * PX, H = Math.round(TILE_H * PX);
  const style = ((parseInt(base.slice(1, 3), 16) + variant) % 3);          // 0 Backstein, 1 Putz, 2 Betonplatten
  const [br, bg, bb] = [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)];
  const litIdx = (r() * 8) | 0;
  const wins = []; for (let f = 0; f < 2; f++) for (let c = 0; c < 4; c++) wins.push({ x: (1.5 + 3 * c - 0.7) * PX, y: (TILE_H - 2.3 - FLOOR_H * f) * PX, w: 1.4 * PX, h: 1.4 * PX });
  const kinds = wins.map(() => r());
  const col = (k, a = 1) => `rgba(${Math.max(0, Math.min(255, br * k)) | 0},${Math.max(0, Math.min(255, bg * k)) | 0},${Math.max(0, Math.min(255, bb * k)) | 0},${a})`;
  const map = canvasTex(W, H, (g) => {
    g.fillStyle = col(1); g.fillRect(0, 0, W, H);
    if (style === 0) { // Backstein-Verband
      const bh = 0.075 * PX, bw = 0.24 * PX; g.fillStyle = col(1.25, 0.9); g.fillRect(0, 0, W, H);
      for (let row = 0, y = 0; y < H; row++, y += bh) for (let x = -(row % 2) * bw / 2; x < W; x += bw) {
        const k = rg(0.78, 1.12); g.fillStyle = `rgb(${(br * k * 1.12 + 14) | 0},${(bg * k * 0.92) | 0},${(bb * k * 0.85) | 0})`; g.fillRect(x + 0.7, y + 0.7, bw - 1.4, bh - 1.4);
        if (r() < 0.06) { g.fillStyle = 'rgba(20,10,5,.35)'; g.fillRect(x + 0.7, y + 0.7, bw - 1.4, bh - 1.4); }
      }
      for (let i = 0; i < 14; i++) { const px = r() * W, py = r() * H * 0.6; g.fillStyle = col(1.55, 0.5); g.fillRect(px, py, rg(20, 90), rg(15, 60)); } // Putzreste
    } else if (style === 1) { // Putz mit Flecken, abgeplatztem Putz (Backstein darunter), Rissen
      for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${rg(0.01, 0.07)})` : `rgba(255,255,255,${rg(0.01, 0.06)})`; g.fillRect(r() * W, r() * H, rg(4, 46), rg(4, 46)); }
      for (let i = 0; i < 7; i++) { // abgeplatzt
        const px = r() * W, py = r() * H * 0.9, pw = rg(40, 120), ph = rg(30, 90); g.fillStyle = '#7a4a38'; g.beginPath(); g.ellipse(px, py, pw / 2, ph / 2, r() * 3, 0, 7); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke(); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${(120 + r() * 50) | 0},${(60 + r() * 30) | 0},${(40 + r() * 20) | 0},.8)`; g.fillRect(px + rg(-pw / 2.4, pw / 2.4), py + rg(-ph / 2.4, ph / 2.4), 9, 4); }
      }
    } else { // Betonplatten: Fugen, Schraubenkoepfe, Rostspuren
      g.fillStyle = col(1.05); g.fillRect(0, 0, W, H);
      for (let i = 0; i < 900; i++) { const l = r() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rg(0.015, 0.06)})`; g.fillRect(r() * W, r() * H, rg(2, 30), rg(2, 30)); }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; for (let x = 0; x <= W; x += 3 * PX) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y <= H; y += 1.7 * PX) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.fillStyle = 'rgba(40,40,40,.7)'; for (let x = 0; x < W; x += 3 * PX) for (let y = 0; y < H; y += 1.7 * PX) for (const [ox, oy] of [[10, 10], [-10, 10], [10, -10], [-10, -10]]) { g.beginPath(); g.arc(x + (ox > 0 ? ox : 3 * PX + ox), y + (oy > 0 ? oy : 1.7 * PX + oy), 2.5, 0, 7); g.fill(); }
      for (let i = 0; i < 10; i++) { const x = r() * W, y = r() * H * 0.7, gr = g.createLinearGradient(0, y, 0, y + rg(60, 200)); gr.addColorStop(0, 'rgba(120,60,25,.45)'); gr.addColorStop(1, 'rgba(120,60,25,0)'); g.fillStyle = gr; g.fillRect(x, y, rg(3, 9), 220); }
    }
    // Sockel, Geschossband (Gesims) mit Schatten, Dachkante
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, H - 0.35 * PX, W, 0.35 * PX); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, H - 0.37 * PX, W, 3);
    const gy = (TILE_H - FLOOR_H) * PX; g.fillStyle = col(0.6); g.fillRect(0, gy - 0.1 * PX, W, 0.16 * PX); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, gy - 0.1 * PX, W, 3); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, gy + 0.06 * PX, W, 0.12 * PX);
    // Fenster
    wins.forEach((q, i) => {
      const isLit = i === litIdx, k = kinds[i];
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(q.x - 7, q.y - 7, q.w + 14, q.h + 12);                   // Laibung (Tiefe)
      g.fillStyle = col(1.35); g.fillRect(q.x - 9, q.y - 12, q.w + 18, 6);                                  // Sturz
      g.fillStyle = '#c9c6bc'; g.fillRect(q.x - 10, q.y + q.h + 5, q.w + 20, 8); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(q.x - 10, q.y + q.h + 13, q.w + 20, 4); // Fensterbank
      g.fillStyle = '#3a3a3c'; g.fillRect(q.x - 4, q.y - 4, q.w + 8, q.h + 8);                              // Rahmen aussen
      if (isLit) { const gr = g.createLinearGradient(0, q.y, 0, q.y + q.h); gr.addColorStop(0, lit); gr.addColorStop(1, '#fff0c4'); g.fillStyle = gr; }
      else if (k < 0.28) g.fillStyle = '#06080b';
      else { const gr = g.createLinearGradient(q.x, q.y, q.x + q.w, q.y + q.h); gr.addColorStop(0, '#2a3844'); gr.addColorStop(0.5, '#16212a'); gr.addColorStop(1, '#0c141a'); g.fillStyle = gr; }
      g.fillRect(q.x, q.y, q.w, q.h);
      if (!isLit && k >= 0.28) { g.fillStyle = 'rgba(190,215,235,.14)'; g.beginPath(); g.moveTo(q.x, q.y + q.h); g.lineTo(q.x + q.w * .5, q.y); g.lineTo(q.x + q.w * .78, q.y); g.lineTo(q.x + q.w * .28, q.y + q.h); g.fill(); }  // Spiegelung
      if (isLit) { g.fillStyle = 'rgba(90,50,20,.55)'; g.fillRect(q.x, q.y, q.w * .2, q.h); g.fillRect(q.x + q.w * .8, q.y, q.w * .2, q.h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(q.x + q.w * .3, q.y + q.h * .5, q.w * .4, q.h * .5); } // Vorhang + Moebel
      else if (k > 0.45 && k < 0.6) { g.fillStyle = 'rgba(120,100,80,.55)'; g.fillRect(q.x, q.y, q.w, q.h * rg(0.3, 0.7)); }                                           // Rollo
      g.fillStyle = isLit ? '#5a3f22' : '#d8d6cf'; g.fillRect(q.x + q.w / 2 - 2.5, q.y, 5, q.h); g.fillRect(q.x, q.y + q.h * .4, q.w, 5);     // Fensterkreuz
      g.strokeStyle = isLit ? '#5a3f22' : '#d8d6cf'; g.lineWidth = 3; g.strokeRect(q.x + 1.5, q.y + 1.5, q.w - 3, q.h - 3);
      if (!isLit && k > 0.85) { g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(q.x + 4, q.y + 4); g.lineTo(q.x + q.w * .6, q.y + q.h * .55); g.lineTo(q.x + q.w - 6, q.y + 6); g.moveTo(q.x + q.w * .6, q.y + q.h * .55); g.lineTo(q.x + q.w * .45, q.y + q.h - 4); g.stroke(); g.fillStyle = '#06080b'; g.beginPath(); g.moveTo(q.x + q.w * .45, q.y + 4); g.lineTo(q.x + q.w * .75, q.y + 4); g.lineTo(q.x + q.w * .6, q.y + q.h * .5); g.fill(); } // zerbrochen
      else if (!isLit && k > 0.7 && k <= 0.85) { g.fillStyle = '#5a4630'; for (let b = 0; b < 4; b++) { g.fillRect(q.x - 3, q.y + b * q.h / 4 + 3, q.w + 6, q.h / 4 - 6); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(q.x - 3, q.y + b * q.h / 4 + q.h / 4 - 4, q.w + 6, 3); g.fillStyle = '#5a4630'; } } // zugenagelt
      const gr2 = g.createLinearGradient(0, q.y + q.h + 17, 0, q.y + q.h + 130); gr2.addColorStop(0, 'rgba(15,10,6,.38)'); gr2.addColorStop(1, 'rgba(15,10,6,0)'); g.fillStyle = gr2; g.fillRect(q.x + 4, q.y + q.h + 17, q.w - 8, 113); // Wasserspuren
    });
    // Regenfallrohre + Verschmutzung
    for (const px of [0.18 * PX, W - 0.18 * PX]) { g.fillStyle = '#2d2f31'; g.fillRect(px - 4, 0, 8, H); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(px - 4, 0, 2, H); }
    const dg = g.createLinearGradient(0, H * 0.55, 0, H); dg.addColorStop(0, 'rgba(25,18,12,0)'); dg.addColorStop(1, 'rgba(25,18,12,.45)'); g.fillStyle = dg; g.fillRect(0, H * 0.55, W, H * 0.45);
    for (let i = 0; i < 40; i++) { const x = r() * W, gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, rg(1, 4), H); }
    if (r() < 0.55) { // Graffiti-Tag am Sockel
      g.save(); g.translate(rg(0.2, 0.7) * W, H - 1.2 * PX); g.rotate(rg(-.15, .15)); g.font = 'bold 70px Arial'; g.fillStyle = ['rgba(200,40,60,.55)', 'rgba(40,160,200,.5)', 'rgba(230,220,60,.5)'][(r() * 3) | 0]; g.fillText(['ZED', 'RIP', 'NO EXIT', 'RUN', 'HELP'][(r() * 5) | 0], 0, 0); g.restore();
    }
  }, true);
  const EW = W >> 1, EH = H >> 1, es = EW / W;
  const em = canvasTex(EW, EH, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, EW, EH);
    const q = wins[litIdx]; g.fillStyle = lit; g.fillRect(q.x * es, q.y * es, q.w * es, q.h * es);
    g.fillStyle = '#000'; g.fillRect((q.x + q.w / 2 - 2.5) * es, q.y * es, 5 * es, q.h * es); g.fillRect(q.x * es, (q.y + q.h * .4) * es, q.w * es, 5 * es);
  }, true);
  map.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  return (FACADE.cache[key] = { map, em });
}
// Fassadenmaterial (Lambert + Emissive-Map fuer das beleuchtete Fenster, nachts an)
export function facadeMat(F, rx, ry, ox, oy) {
  const t = F.map.clone(), e = F.em.clone();
  for (const x of [t, e]) { x.repeat.set(rx, ry); x.offset.set(ox || 0, oy || 0); x.needsUpdate = true; }
  const m = new THREE.MeshLambertMaterial({ map: t, emissiveMap: e, emissive: settings.night ? 0xffffff : 0x000000 });
  FACADE.mats.push(m); return m;
}
export function applyFacadeNight(n) {
  for (const m of FACADE.mats) { const p = phongCache.get(m); m.emissive.setHex(n ? 0xffffff : 0); if (p) p.emissive.setHex(n ? 0xffffff : 0); }
  for (const m of FACADE.neon) m.color.setHex(n ? 0xffffff : 0xb8b8b8);
  for (const o of FACADE.pools) o.visible = n;
}
// Vordach mit Neon-Reklame ueber einem Eingang. dir: Richtung nach aussen (x/z), (px,pz) = Tuermitte an der Aussenwand
export function addCanopy(px, pz, ax, az, k) {
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
export let _interiorMats = null;
export function interiorMats() {
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

export function buildEnterable(cx, cz, w, d, h, tex) {
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
    doors.forEach(([px, pz, ax, az]) => { if (cr() < 0.5) addCanopy(px, pz, ax, az, (cr() * 99) | 0); });
    const fr = mkRng(hashXZ(cx, cz) + 123); doors.forEach(([px, pz, ax, az]) => { if (fr() < 0.35) addFenceLine(px, pz, ax, az, fr); }); } // Absperrgitter vor manchen Eingängen
  interiorSpots.push({ x: cx, z: cz });
  if (rnd() < 0.5) interiorSpots.push({ x: cx + (rnd() < 0.5 ? -1 : 1) * 3.2, z: cz + 0.0 });
  if (rnd() < 0.5) { const a = new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2, d * .3), roofMat); a.position.set(cx + rr(-w / 4, w / 4), h + 1, cz + rr(-d / 4, d / 4)); mapRoot.add(a); }
}

