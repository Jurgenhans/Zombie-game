import * as THREE from 'three';

/* ============================================================
   Müll mit echten Texturen (Becher mit COFFEE-Aufdruck, Dosen mit Marken,
   Flaschen mit Etikett, Zeitungen, Pizzakartons, ...). Nur Optik, KEINE Kollision.
   Die Platzierung (Zufallsfolge, Anzahl, Positionen) ist identisch zur alten Version.
   ============================================================ */

const rg = (rng, a, b) => a + (b - a) * rng();
const FONT = '"Arial Black", Impact, Arial, sans-serif';
function txt(g, s, x, y, size, col, opt = {}) {
  g.save(); g.translate(x, y); if (opt.rot) g.rotate(opt.rot);
  g.font = `${opt.style || 'bold'} ${size | 0}px ${opt.font || FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (opt.shadow) { g.fillStyle = opt.shadow; g.fillText(s, 1.5, 1.5); }
  g.fillStyle = col; g.fillText(s, 0, 0); g.restore();
}
function grime(g, w, h, rng, n = 16, a = 0.18) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(30,22,14,${rg(rng, a * 0.3, a)})`; g.beginPath(); g.ellipse(rng() * w, rng() * h, rg(rng, w * 0.02, w * 0.1), rg(rng, h * 0.02, h * 0.08), rng() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < w * h / 80; i++) { const l = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rg(rng, 0.03, 0.09)})`; g.fillRect(rng() * w, rng() * h, 1.6, 1.6); }
}
function creases(g, w, h, rng, n = 10) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h, a = rng() * Math.PI, l = rg(rng, w * 0.08, w * 0.3), dx = Math.cos(a) * l, dy = Math.sin(a) * l;
    g.strokeStyle = `rgba(0,0,0,${rg(rng, 0.07, 0.18)})`; g.lineWidth = rg(rng, 1, 2.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
    g.strokeStyle = `rgba(255,255,255,${rg(rng, 0.06, 0.14)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1.6, y + 1.6); g.lineTo(x + 1.6 + dx, y + 1.6 + dy); g.stroke();
  }
}

/* ---------- Pappbecher ---------- */
const CUPS = [
  { base: '#f4f1ea', style: 'sleeve', sleeve: '#8a5a36', text: 'COFFEE', sub: 'HOT & FRESH', tcol: '#f6e7c8', lid: '#f1eee6' },
  { base: '#b3282b', style: 'plain', text: 'CAFE', sub: 'TO GO', tcol: '#ffffff', lid: '#1d1b1a' },
  { base: '#f4f1ea', style: 'logo', text: 'B&C', sub: 'BEAN & CO', tcol: '#1f6b43', lid: null },
  { base: '#a9815a', style: 'kraft', text: 'TO GO', sub: 'COFFEE', tcol: '#2a1a10', lid: '#2a2624' },
];
function drawCup(g, W, H, v, rng) {
  g.fillStyle = v.base; g.fillRect(0, 0, W, H);
  const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
  if (v.style === 'sleeve') { // Pappmanschette mit Wellpappe-Struktur
    g.fillStyle = v.sleeve; g.fillRect(0, H * 0.3, W, H * 0.46);
    for (let x = 0; x < W; x += 3) { g.fillStyle = x % 6 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)'; g.fillRect(x, H * 0.3, 1.4, H * 0.46); }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H * 0.3, W, 2); g.fillRect(0, H * 0.76 - 2, W, 2);
  }
  for (const cx of [W * 0.25, W * 0.75]) {
    if (v.style === 'sleeve') {
      txt(g, v.text, cx, H * 0.53, H * 0.2, v.tcol, { shadow: 'rgba(0,0,0,.35)' }); txt(g, v.sub, cx, H * 0.67, H * 0.075, v.tcol, { style: 'bold', font: 'Arial, sans-serif' });
      g.strokeStyle = v.tcol; g.lineWidth = 2; g.lineCap = 'round';
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + k * 9, H * 0.45); g.bezierCurveTo(cx + k * 9 + 5, H * 0.42, cx + k * 9 - 5, H * 0.39, cx + k * 9, H * 0.36); g.stroke(); } // Dampf
    } else if (v.style === 'plain') {
      txt(g, v.text, cx, H * 0.46, H * 0.27, v.tcol, { shadow: 'rgba(0,0,0,.3)' }); txt(g, v.sub, cx, H * 0.7, H * 0.1, v.tcol, { font: 'Arial, sans-serif' });
      g.fillStyle = v.tcol; g.beginPath(); g.ellipse(cx, H * 0.24, 7, 4, 0.6, 0, 7); g.fill(); g.strokeStyle = v.base; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 5, H * 0.24 + 3); g.quadraticCurveTo(cx, H * 0.24 - 2, cx + 5, H * 0.24 - 3); g.stroke(); // Kaffeebohne
    } else if (v.style === 'logo') {
      g.fillStyle = v.tcol; g.beginPath(); g.arc(cx, H * 0.46, H * 0.26, 0, 7); g.fill(); g.strokeStyle = '#f4f1ea'; g.lineWidth = 2; g.beginPath(); g.arc(cx, H * 0.46, H * 0.22, 0, 7); g.stroke();
      txt(g, v.text, cx, H * 0.46, H * 0.17, '#f4f1ea'); txt(g, v.sub, cx, H * 0.8, H * 0.08, v.tcol, { font: 'Arial, sans-serif' });
    } else {
      txt(g, v.text, cx, H * 0.45, H * 0.21, v.tcol); txt(g, v.sub, cx, H * 0.68, H * 0.1, v.tcol, { font: 'Arial, sans-serif', style: 'bold' });
      g.strokeStyle = v.tcol; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 28, H * 0.78); g.lineTo(cx + 28, H * 0.78); g.stroke();
    }
  }
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 0, W, H * 0.07); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, H * 0.93, W, H * 0.07); // Rand
  for (let i = 0; i < 4; i++) { const x = rng() * W, l = rg(rng, 10, 36); const gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(70,38,16,.55)'); gr.addColorStop(1, 'rgba(70,38,16,0)'); g.fillStyle = gr; g.fillRect(x, 0, rg(rng, 2, 5), l); } // Kaffee-Tropfen
  g.strokeStyle = 'rgba(80,45,20,.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(rng() * W, H * 0.8, 10, 6, 0, 0, 7); g.stroke(); // Kaffeering
  creases(g, W, H, rng, 6); grime(g, W, H, rng, 14, 0.2);
}
function drawLid(g, S, v, rng) {
  const c = S / 2; g.fillStyle = '#d8d4ca'; g.fillRect(0, 0, S, S);
  if (!v.lid) { // offener Becher: Rest Kaffee
    g.fillStyle = '#f1eee6'; g.beginPath(); g.arc(c, c, c * 0.98, 0, 7); g.fill();
    const gr = g.createRadialGradient(c * 0.85, c * 0.85, 2, c, c, c * 0.88); gr.addColorStop(0, '#6a4326'); gr.addColorStop(1, '#2a170a'); g.fillStyle = gr; g.beginPath(); g.arc(c, c, c * 0.86, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(c * 0.8, c * 0.78, c * 0.2, c * 0.1, -0.6, 0, 7); g.fill();
  } else {
    g.fillStyle = v.lid; g.beginPath(); g.arc(c, c, c * 0.98, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; for (const r of [0.86, 0.7, 0.55]) { g.beginPath(); g.arc(c, c, c * r, 0, 7); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(c, c, c * 0.78, 0, 7); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.65)'; g.beginPath(); g.ellipse(c + c * 0.38, c - c * 0.1, c * 0.2, c * 0.07, 0.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(c - c * 0.35, c + c * 0.25, c * 0.08, c * 0.05, 0, 0, 7); g.fill();
  }
  grime(g, S, S, rng, 8, 0.2);
}

/* ---------- Dosen ---------- */
const CANS = [
  { name: 'COLA', kind: 'wave', c1: '#d01a22', c2: '#7d0b10', tcol: '#ffffff' },
  { name: 'FIZZ', kind: 'bubbles', c1: '#2a7ae0', c2: '#0e3b82', tcol: '#ffffff' },
  { name: 'KRONE', sub: 'LAGER', kind: 'beer', c1: '#dcae2a', c2: '#80600e', tcol: '#6f0f10' },
  { name: 'VOLT', kind: 'bolt', c1: '#16181b', c2: '#050506', tcol: '#8dff2e' },
  { name: 'LIME', kind: 'wave', c1: '#44ad4c', c2: '#1d6224', tcol: '#fffbe0' },
];
function drawCan(g, W, H, v, rng) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, v.c1); gr.addColorStop(1, v.c2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (const cx of [W * 0.25, W * 0.75]) {
    if (v.kind === 'wave') { txt(g, v.name, cx, H * 0.4, H * 0.25, v.tcol, { style: 'italic bold', shadow: 'rgba(0,0,0,.3)' }); g.strokeStyle = v.tcol; g.lineWidth = H * 0.06; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - W * 0.17, H * 0.68); g.bezierCurveTo(cx - W * 0.08, H * 0.5, cx + W * 0.06, H * 0.86, cx + W * 0.17, H * 0.62); g.stroke(); }
    else if (v.kind === 'bubbles') { txt(g, v.name, cx, H * 0.45, H * 0.28, v.tcol, { style: 'italic bold', shadow: 'rgba(0,0,40,.4)' }); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(cx + rg(rng, -W * 0.2, W * 0.2), H * rg(rng, 0.18, 0.85), rg(rng, 2, 6), 0, 7); g.stroke(); } }
    else if (v.kind === 'beer') { txt(g, v.name, cx, H * 0.33, H * 0.2, v.tcol, { font: 'Georgia, serif', shadow: 'rgba(255,255,255,.25)' }); g.fillStyle = '#9a1418'; g.fillRect(cx - W * 0.2, H * 0.52, W * 0.4, H * 0.2); txt(g, v.sub, cx, H * 0.62, H * 0.12, '#f4e9c4', { font: 'Georgia, serif' }); g.strokeStyle = v.tcol; g.lineWidth = 2; g.beginPath(); g.arc(cx, H * 0.82, 4, 0, 7); g.stroke(); }
    else { txt(g, v.name, cx, H * 0.7, H * 0.2, '#fff', { shadow: 'rgba(0,0,0,.5)' }); g.fillStyle = v.tcol; g.shadowColor = v.tcol; g.shadowBlur = 8; g.beginPath(); g.moveTo(cx + 6, H * 0.15); g.lineTo(cx - 14, H * 0.46); g.lineTo(cx - 2, H * 0.46); g.lineTo(cx - 8, H * 0.6); g.lineTo(cx + 15, H * 0.36); g.lineTo(cx + 3, H * 0.36); g.closePath(); g.fill(); g.shadowBlur = 0; }
  }
  for (const [y0, y1] of [[0, H * 0.1], [H * 0.9, H]]) { const sg = g.createLinearGradient(0, y0, 0, y1); sg.addColorStop(0, '#dfe3e6'); sg.addColorStop(0.5, '#8b9197'); sg.addColorStop(1, '#c9cdd1'); g.fillStyle = sg; g.fillRect(0, y0, W, y1 - y0); }
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(W * 0.08, 0, W * 0.05, H); g.fillRect(W * 0.58, 0, W * 0.05, H); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(W * 0.38, 0, W * 0.06, H);
  for (let i = 0; i < 2; i++) { const x = rng() * W, y = H * rg(rng, 0.2, 0.8); const dg = g.createRadialGradient(x, y, 1, x, y, 14); dg.addColorStop(0, 'rgba(0,0,0,.45)'); dg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = dg; g.fillRect(x - 14, y - 14, 28, 28); } // Dellen
  g.strokeStyle = 'rgba(230,230,230,.35)'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { const x = rng() * W, y = rng() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rg(rng, -14, 14), y + rg(rng, -4, 4)); g.stroke(); }
  grime(g, W, H, rng, 10, 0.2);
}
function drawCanTop(g, S, v, rng) {
  const c = S / 2, gr = g.createRadialGradient(c * 0.8, c * 0.8, 2, c, c, c); gr.addColorStop(0, '#eceff1'); gr.addColorStop(1, '#8e949a'); g.fillStyle = '#6d7379'; g.fillRect(0, 0, S, S);
  g.fillStyle = gr; g.beginPath(); g.arc(c, c, c * 0.97, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, c * 0.78, 0, 7); g.stroke();
  g.fillStyle = 'rgba(30,30,30,.5)'; g.beginPath(); g.ellipse(c + c * 0.3, c - c * 0.05, c * 0.28, c * 0.14, 0.3, 0, 7); g.fill();
  g.fillStyle = '#b7bcc1'; g.strokeStyle = '#555'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(c - c * 0.08, c + c * 0.05, c * 0.34, c * 0.18, 0.3, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#4a4f54'; g.beginPath(); g.arc(c - c * 0.3, c + c * 0.12, 2.4, 0, 7); g.fill(); grime(g, S, S, rng, 5, 0.25);
}

/* ---------- Flaschen (Textur wird per Höhe auf die Drehform gelegt) ---------- */
const BOTTLES = [
  { liquid: '#cfe7f2', label: '#1c70c8', name: 'AQUA', sub: 'STILL WATER', cap: '#1c70c8', lt: '#ffffff' },
  { liquid: '#c8e6b0', label: '#2f9a3a', name: 'LIME', sub: 'SODA', cap: '#ececec', lt: '#fffbe0' },
  { liquid: '#5c3410', label: '#e8dcc0', name: 'ALE', sub: 'BROWN ALE', cap: '#c9a227', lt: '#4a2a10', glass: true },
  { liquid: '#dbe9ee', label: null, cap: '#2a6fb0' },
];
function drawBottle(g, W, H, v, rng) {
  g.fillStyle = v.liquid; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(W * 0.1, H * 0.07, W * 0.05, H * 0.9); g.fillRect(W * 0.6, H * 0.07, W * 0.04, H * 0.9);
  g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(W * 0.38, H * 0.07, W * 0.07, H * 0.9);
  if (v.label) {
    g.fillStyle = v.label; g.fillRect(0, H * 0.42, W, H * 0.44);
    for (const cx of [W * 0.25, W * 0.75]) {
      txt(g, v.name, cx, H * 0.6, H * 0.13, v.lt, { shadow: 'rgba(0,0,0,.25)', font: v.glass ? 'Georgia, serif' : FONT }); txt(g, v.sub, cx, H * 0.73, H * 0.05, v.lt, { font: 'Arial, sans-serif' });
      g.strokeStyle = v.lt; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - W * 0.12, H * 0.49); g.bezierCurveTo(cx - W * 0.05, H * 0.44, cx + W * 0.05, H * 0.54, cx + W * 0.12, H * 0.48); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, H * 0.42, W, 2); g.fillRect(0, H * 0.86 - 2, W, 2);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(rng() * W, H * rg(rng, 0.42, 0.86), rg(rng, 2, 8), 2); } // abgeblättert
  }
  g.fillStyle = v.cap; g.fillRect(0, 0, W, H * 0.07); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < W; x += 5) g.fillRect(x, 0, 1.5, H * 0.07); // Kappe mit Riffelung
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, H * 0.085, W, 3); // Abrissring
  g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, H * 0.9, W, H * 0.1); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, H * 0.95, W, H * 0.05);
  grime(g, W, H, rng, 10, 0.2);
}

/* ---------- Tüten, Papierknäuel ---------- */
const BAGS = [
  { base: '#ecece6', text: 'THANK YOU', col: '#d02a2a' },
  { base: '#eef2f6', text: 'SHOP 24', col: '#1b5fc4' },
  { base: '#1d1d20', text: '', col: '#505058' },
  { base: '#cdb98e', text: 'MARKT', col: '#5a3a1a' },
];
function drawBag(g, S, v, rng) {
  g.fillStyle = v.base; g.fillRect(0, 0, S, S);
  if (v.text) for (let j = 0; j < 3; j++) txt(g, v.text, S * (0.5 + (j % 2 ? 0.18 : -0.12)), S * (0.2 + 0.3 * j), S * 0.11, v.col, { rot: rg(rng, -0.12, 0.12) });
  
  const sh = g.createLinearGradient(0, 0, S, S); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = sh; g.fillRect(0, 0, S, S);
  creases(g, S, S, rng, 22); grime(g, S, S, rng, 10, 0.2);
}
const BALLS = [{ base: '#ece9df', kind: 'paper' }, { base: '#b9bec3', kind: 'foil' }, { base: '#b99a6c', kind: 'kraft' }];
function drawBall(g, S, v, rng) {
  g.fillStyle = v.base; g.fillRect(0, 0, S, S);
  if (v.kind === 'paper') { g.fillStyle = 'rgba(30,30,40,.35)'; for (let y = 4; y < S; y += 6) g.fillRect(0, y, S, 1.2); for (let i = 0; i < 5; i++) txt(g, 'NEWS', rng() * S, rng() * S, 9, 'rgba(20,20,20,.45)', { rot: rng() * 3 }); }
  if (v.kind === 'foil') { for (let i = 0; i < 30; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(60,66,74,.35)'; g.beginPath(); g.moveTo(rng() * S, rng() * S); g.lineTo(rng() * S, rng() * S); g.lineTo(rng() * S, rng() * S); g.fill(); } }
  creases(g, S, S, rng, 26); grime(g, S, S, rng, 6, 0.2);
}

/* ---------- Papier ---------- */
const SHEETS = [{ kind: 'news', title: 'DEAD CITY TIMES', head: 'OUTBREAK SPREADS', sub: 'CITY ON LOCKDOWN' }, { kind: 'tab', title: 'EVENING POST', head: 'RUN!', sub: 'THEY ARE HERE' }, { kind: 'missing' }, { kind: 'note' }];
function drawSheet(g, W, H, v, rng) {
  const cols = (x0, y0, x1, y1, n) => { const cw = (x1 - x0) / n; for (let c = 0; c < n; c++) for (let y = y0; y < y1; y += 4) { g.fillStyle = 'rgba(40,38,34,.55)'; g.fillRect(x0 + c * cw + 2, y, cw - 6 - (rng() < 0.15 ? rng() * (cw - 10) : 0), 1.6); } };
  if (v.kind === 'news' || v.kind === 'tab') {
    g.fillStyle = v.kind === 'news' ? '#dcd7c6' : '#e3dfd0'; g.fillRect(0, 0, W, H);
    if (v.kind === 'tab') { g.fillStyle = '#b3181c'; g.fillRect(0, 0, W, H * 0.2); txt(g, v.title, W / 2, H * 0.1, H * 0.13, '#fff'); txt(g, v.head, W / 2, H * 0.42, H * 0.3, '#111'); txt(g, v.sub, W / 2, H * 0.62, H * 0.08, '#b3181c', { font: 'Arial, sans-serif' }); cols(8, H * 0.7, W - 8, H - 10, 4); }
    else {
      txt(g, v.title, W / 2, H * 0.09, H * 0.12, '#1a1a1a', { font: 'Georgia, serif' }); g.fillStyle = '#222'; g.fillRect(8, H * 0.17, W - 16, 2); g.fillRect(8, H * 0.185, W - 16, 1);
      txt(g, v.head, W * 0.5, H * 0.29, H * 0.1, '#111', { font: 'Georgia, serif' }); txt(g, v.sub, W * 0.5, H * 0.38, H * 0.05, '#222', { font: 'Arial, sans-serif' });
      const gr = g.createLinearGradient(0, H * 0.44, 0, H * 0.7); gr.addColorStop(0, '#6a6a68'); gr.addColorStop(1, '#2c2c2c'); g.fillStyle = gr; g.fillRect(10, H * 0.44, W * 0.4, H * 0.26);
      g.fillStyle = 'rgba(0,0,0,.55)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(24 + i * 16, H * 0.6, 6, 0, 7); g.fill(); g.fillRect(19 + i * 16, H * 0.62, 10, H * 0.07); }
      cols(W * 0.46, H * 0.44, W - 8, H * 0.7, 2); cols(8, H * 0.74, W - 8, H - 8, 4);
    }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); // Falz
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2 + 2, 0); g.lineTo(W / 2 + 2, H); g.stroke();
  } else if (v.kind === 'missing') {
    g.fillStyle = '#ecebe4'; g.fillRect(0, 0, W, H); txt(g, 'MISSING', W / 2, H * 0.13, H * 0.17, '#c01818');
    g.fillStyle = '#9a9a98'; g.fillRect(W * 0.28, H * 0.24, W * 0.44, H * 0.34); g.fillStyle = '#4a4a4a'; g.beginPath(); g.arc(W / 2, H * 0.37, H * 0.07, 0, 7); g.fill(); g.fillRect(W * 0.4, H * 0.43, W * 0.2, H * 0.15);
    txt(g, 'LAST SEEN NEAR THE HOSPITAL', W / 2, H * 0.64, H * 0.05, '#222', { font: 'Arial, sans-serif' }); txt(g, 'PLEASE CALL', W / 2, H * 0.72, H * 0.06, '#222', { font: 'Arial, sans-serif' }); txt(g, '555-0199', W / 2, H * 0.8, H * 0.09, '#111');
    g.fillStyle = '#ecebe4'; g.strokeStyle = '#999'; g.lineWidth = 1; for (let i = 0; i < 7; i++) { g.strokeRect(i * W / 7, H * 0.88, W / 7, H * 0.12); }
  } else {
    g.fillStyle = '#e8d97a'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(40,90,160,.45)'; g.lineWidth = 1; for (let y = 16; y < H; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.strokeStyle = 'rgba(200,40,40,.5)'; g.beginPath(); g.moveTo(26, 0); g.lineTo(26, H); g.stroke();
    ['DON\'T GO TO', 'THE HOSPITAL!!', 'they are all', 'infected...'].forEach((s, i) => txt(g, s, W / 2 + 8, 24 + i * 24, i < 2 ? 22 : 18, i < 2 ? '#7a1010' : '#222', { font: '"Comic Sans MS", cursive, Arial', rot: rg(rng, -0.04, 0.04) }));
  }
  g.fillStyle = 'rgba(70,45,10,.12)'; g.fillRect(0, 0, W, 5); creases(g, W, H, rng, 7); grime(g, W, H, rng, 12, 0.22);
}
function drawCardboard(g, W, H, rng, tag) {
  g.fillStyle = '#a07c4e'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 3) { g.fillStyle = y % 6 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)'; g.fillRect(0, y, W, 1.4); }
  if (tag) {
    g.fillStyle = 'rgba(214,190,140,.75)'; g.fillRect(W * 0.45, 0, W * 0.1, H); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(W * 0.45, 0, 2, H); // Klebeband
    txt(g, 'FRAGILE', W * 0.25, H * 0.3, H * 0.13, '#2a1608', { rot: -0.05 }); txt(g, 'THIS SIDE UP', W * 0.25, H * 0.48, H * 0.055, '#2a1608', { font: 'Arial, sans-serif' });
    g.fillStyle = '#2a1608'; for (const cx of [W * 0.16, W * 0.34]) { g.beginPath(); g.moveTo(cx, H * 0.58); g.lineTo(cx - 9, H * 0.7); g.lineTo(cx - 3, H * 0.7); g.lineTo(cx - 3, H * 0.84); g.lineTo(cx + 3, H * 0.84); g.lineTo(cx + 3, H * 0.7); g.lineTo(cx + 9, H * 0.7); g.closePath(); g.fill(); }
    g.fillStyle = '#efece2'; g.fillRect(W * 0.62, H * 0.16, W * 0.3, H * 0.3); g.fillStyle = '#222'; for (let i = 0; i < 26; i++) g.fillRect(W * 0.64 + i * 3, H * 0.34, i % 3 ? 1 : 2, H * 0.1); for (let i = 0; i < 4; i++) g.fillRect(W * 0.64, H * 0.2 + i * 6, W * (0.26 - i * 0.03), 2);
    g.strokeStyle = 'rgba(30,15,5,.5)'; g.lineWidth = 3; g.strokeRect(W * 0.58, H * 0.62, W * 0.34, H * 0.28); txt(g, 'RECYCLE', W * 0.75, H * 0.76, H * 0.09, 'rgba(30,15,5,.6)');
  }
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(rng() * W, 0); g.lineTo(rng() * W, 8); g.lineTo(rng() * W, 0); g.fill(); }
  creases(g, W, H, rng, 6); grime(g, W, H, rng, 14, 0.25);
}

/* ---------- Fast Food ---------- */
function drawBurger(g, S, rng) {
  g.fillStyle = '#c62b2b'; g.fillRect(0, 0, S, S); g.fillStyle = '#f2c230'; g.fillRect(0, 0, S, S * 0.12); g.fillRect(0, S * 0.88, S, S * 0.12);
  g.fillStyle = '#e8a33a'; g.beginPath(); g.ellipse(S / 2, S * 0.4, S * 0.26, S * 0.16, 0, Math.PI, 0); g.fill(); g.fillStyle = '#f2c230'; for (let i = 0; i < 6; i++) g.fillRect(S * (0.32 + i * 0.07), S * (0.3 + (i % 2) * 0.03), 3, 2);
  g.fillStyle = '#5a2a14'; g.fillRect(S * 0.24, S * 0.42, S * 0.52, S * 0.06); g.fillStyle = '#6dbf3a'; g.fillRect(S * 0.22, S * 0.48, S * 0.56, S * 0.04); g.fillStyle = '#e8a33a'; g.beginPath(); g.ellipse(S / 2, S * 0.56, S * 0.26, S * 0.07, 0, 0, Math.PI); g.fill();
  txt(g, 'BURGER', S / 2, S * 0.72, S * 0.15, '#fff', { shadow: 'rgba(0,0,0,.35)' }); creases(g, S, S, rng, 8); grime(g, S, S, rng, 10, 0.3);
}
function drawPizza(g, S, rng) {
  g.fillStyle = '#c9ab7c'; g.fillRect(0, 0, S, S); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 3; g.strokeRect(6, 6, S - 12, S - 12);
  g.fillStyle = '#b81f1f'; g.beginPath(); g.arc(S / 2, S * 0.42, S * 0.27, 0, 7); g.fill(); g.fillStyle = '#f4e8c8'; g.beginPath(); g.arc(S / 2, S * 0.42, S * 0.23, 0, 7); g.fill();
  g.fillStyle = '#e3a533'; g.beginPath(); g.moveTo(S / 2, S * 0.2); g.arc(S / 2, S * 0.42, S * 0.21, -Math.PI * 0.45, -Math.PI * 0.05); g.closePath(); g.fill(); g.fillStyle = '#b81f1f'; for (const [x, y] of [[0.55, 0.27], [0.62, 0.34], [0.52, 0.34]]) { g.beginPath(); g.arc(S * x, S * y, 4, 0, 7); g.fill(); }
  txt(g, 'PIZZA', S / 2, S * 0.78, S * 0.17, '#b81f1f'); txt(g, 'HOT & FRESH', S / 2, S * 0.9, S * 0.055, '#5a2a14', { font: 'Arial, sans-serif' });
  g.fillStyle = 'rgba(120,70,20,.3)'; g.beginPath(); g.ellipse(S * 0.7, S * 0.6, S * 0.12, S * 0.08, 0.4, 0, 7); g.fill(); // Fettfleck
  creases(g, S, S, rng, 8); grime(g, S, S, rng, 12, 0.28);
}
function drawFriesSide(g, W, H, rng) {
  g.fillStyle = '#d02a2a'; g.fillRect(0, 0, W, H); g.fillStyle = '#f2c230'; g.fillRect(0, H * 0.8, W, H * 0.2); g.fillRect(0, 0, W, H * 0.06);
  txt(g, 'FRIES', W / 2, H * 0.4, H * 0.24, '#f2c230', { shadow: 'rgba(0,0,0,.3)' }); txt(g, 'SALTED', W / 2, H * 0.62, H * 0.1, '#fff', { font: 'Arial, sans-serif' });
  grime(g, W, H, rng, 10, 0.3);
}
function drawFriesTop(g, S, rng) {
  g.fillStyle = '#d02a2a'; g.fillRect(0, 0, S, S); g.fillStyle = '#e8c04a'; g.fillRect(S * 0.12, S * 0.12, S * 0.76, S * 0.76);
  for (let i = 0; i < 24; i++) { g.fillStyle = `hsl(${40 + rng() * 8},${75 + rng() * 15}%,${52 + rng() * 14}%)`; g.save(); g.translate(S * rg(rng, 0.15, 0.85), S * rg(rng, 0.15, 0.85)); g.rotate(rng() * 3); g.fillRect(-S * 0.1, -2, S * 0.2, 4); g.restore(); } grime(g, S, S, rng, 6, 0.3);
}

/* ---------- Geometrie & Materialien ---------- */
function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
const lam = (map) => new THREE.MeshLambertMaterial({ map });
const flatM = (c) => new THREE.MeshLambertMaterial({ color: c });
function jitterIco(radius, detail, rng, amp) { // unregelmäßig zerknüllte Kugel (gleiche Eckpunkte gleich verschoben -> keine Löcher)
  const g = new THREE.IcosahedronGeometry(radius, detail), p = g.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3);
    if (!seen.has(k)) seen.set(k, [1 - amp + rng() * amp * 2, 1 - amp + rng() * amp * 2, 1 - amp + rng() * amp * 2]);
    const j = seen.get(k); p.setXYZ(i, p.getX(i) * j[0], p.getY(i) * j[1], p.getZ(i) * j[2]);
  }
  g.computeVertexNormals(); return g;
}
function buildArt(mkRng) {
  const A = { cup: [], can: [], bottle: [], bag: [], ball: [], sheet: [], card: [], food: [] };
  const cupGeo = new THREE.CylinderGeometry(0.042, 0.03, 0.11, 12);
  CUPS.forEach((v, i) => A.cup.push({ geo: cupGeo, mat: [lam(tex(256, 128, (g, w, h) => drawCup(g, w, h, v, mkRng(10 + i)))), lam(tex(64, 64, (g, w) => drawLid(g, w, v, mkRng(20 + i)))), flatM(v.base)] }));
  const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14), silver = flatM(0x9aa0a6);
  CANS.forEach((v, i) => A.can.push({ geo: canGeo, mat: [lam(tex(256, 128, (g, w, h) => drawCan(g, w, h, v, mkRng(30 + i)))), lam(tex(64, 64, (g, w) => drawCanTop(g, w, v, mkRng(40 + i)))), silver] }));
  const prof = [[0, 0], [0.036, 0], [0.04, 0.01], [0.04, 0.11], [0.038, 0.14], [0.03, 0.165], [0.017, 0.19], [0.016, 0.205], [0.019, 0.205], [0.019, 0.22], [0, 0.22]].map(([r, y]) => new THREE.Vector2(r, y));
  const bottleGeo = new THREE.LatheGeometry(prof, 14); bottleGeo.translate(0, -0.11, 0);
  { const p = bottleGeo.attributes.position, uv = bottleGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setY(i, (p.getY(i) + 0.11) / 0.22); } // Textur nach Höhe statt nach Punktindex
  BOTTLES.forEach((v, i) => A.bottle.push({ geo: bottleGeo, mat: lam(tex(256, 224, (g, w, h) => drawBottle(g, w, h, v, mkRng(50 + i)))) }));
  const bagGeo = jitterIco(1, 1, mkRng(5), 0.3);
  BAGS.forEach((v, i) => A.bag.push({ geo: bagGeo, mat: lam(tex(128, 128, (g, w) => drawBag(g, w, v, mkRng(60 + i)))) }));
  const ballGeo = jitterIco(0.06, 1, mkRng(8), 0.18);
  BALLS.forEach((v, i) => A.ball.push({ geo: ballGeo, mat: lam(tex(64, 64, (g, w) => drawBall(g, w, v, mkRng(70 + i)))) }));
  const sheetGeo = new THREE.BoxGeometry(0.3, 0.004, 0.21), edge = flatM(0xd8d3c4);
  SHEETS.forEach((v, i) => { const top = lam(tex(256, 180, (g, w, h) => drawSheet(g, w, h, v, mkRng(80 + i)))); A.sheet.push({ geo: sheetGeo, mat: [edge, edge, top, edge, edge, edge] }); });
  const cardGeo = new THREE.BoxGeometry(0.5, 0.025, 0.36), kraft = flatM(0x8d6b42);
  [true, false].forEach((tag, i) => { const top = lam(tex(256, 184, (g, w, h) => drawCardboard(g, w, h, mkRng(90 + i), tag))); A.card.push({ geo: cardGeo, mat: [kraft, kraft, top, kraft, kraft, kraft] }); });
  const red = flatM(0xb82828), burger = lam(tex(128, 128, (g, w) => drawBurger(g, w, mkRng(100))));
  A.food.push({ geo: new THREE.BoxGeometry(0.17, 0.06, 0.17), mat: [red, red, burger, red, red, red], y: 0.03 });
  const pk = flatM(0xbfa070), pizza = lam(tex(128, 128, (g, w) => drawPizza(g, w, mkRng(101))));
  A.food.push({ geo: new THREE.BoxGeometry(0.3, 0.035, 0.3), mat: [pk, pk, pizza, pk, pk, pk], y: 0.0175 });
  const fs = lam(tex(128, 128, (g, w, h) => drawFriesSide(g, w, h, mkRng(102)))), ft = lam(tex(64, 64, (g, w) => drawFriesTop(g, w, mkRng(103))));
  A.food.push({ geo: new THREE.BoxGeometry(0.07, 0.09, 0.05), mat: [red, red, ft, red, fs, fs], y: 0.045 });
  return A;
}

/* ---------- Verteilung (Zufallsfolge wie vorher) ---------- */
export function scatterTrash({ mapRoot, MAP, HALF, boxes, interiorSpots, mkRng, groundH }) {
  const r = mkRng(4711 + MAP.size), tr = mkRng(31 + MAP.size), AF = (MAP.size / 250) ** 2;
  const A = buildArt(mkRng), L = new Map();
  const W = { cup: 0.22, can: 0.18, bottle: 0.12, bag: 0.14, ball: 0.14, sheet: 0.12, card: 0.05, food: 0.03 }, keys = Object.keys(W);
  const blocked = (x, z) => boxes.some((b) => !b.y0 && b.top > 0.3 && x > b.x0 - 0.15 && x < b.x1 + 0.15 && z > b.z0 - 0.15 && z < b.z1 + 0.15);
  const pickType = () => { let t = r(), acc = 0; for (const k of keys) { acc += W[k]; if (t < acc) return k; } return 'cup'; };
  const place = (cx, cz, n, spread, fy) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (r() + r() + r() - 1.5) * spread, z = cz + (r() + r() + r() - 1.5) * spread;
      if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1 || blocked(x, z)) continue;
      const k = pickType(), vs = A[k], v = vs[(r() * vs.length) | 0], yaw = r() * 6.283, s = 0.85 + r() * 0.4;
      let y = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1;
      if (k === 'cup') { if (r() < 0.7) { rz = Math.PI / 2; y = 0.042; } else { y = 0.055; rx = (r() - 0.5) * 0.3; } }
      else if (k === 'can') { if (r() < 0.8) { rz = Math.PI / 2; y = 0.033; } else y = 0.06; }
      else if (k === 'bottle') { rz = Math.PI / 2; y = 0.04; }
      else if (k === 'bag') { sx = 0.22 * s * (1 + r()); sy = 0.05 + r() * 0.04; sz = 0.18 * s * (1 + r() * 0.8); y = sy * 0.5; }
      else if (k === 'ball') { sx = sy = sz = s; y = 0.05 * s; }
      else if (k === 'sheet') { y = 0.008; rx = (r() - 0.5) * 0.06; }
      else if (k === 'card') { y = 0.02; sx = s; sz = s; }
      else { y = 0.032; }
      if (v.y !== undefined) y = v.y;
      let arr = L.get(v); if (!arr) L.set(v, arr = []);
      arr.push({ x, y: y + fy + groundH(x, z), z, rx, ry: yaw, rz, sx, sy, sz, t: 0.82 + tr() * 0.22 });
    }
  };
  const nCl = (Math.round(195 * AF) + 4) * 10; // 10x Müll
  for (let i = 0; i < nCl; i++) { const x = (r() - 0.5) * 2 * (MAP.edge - 3), z = (r() - 0.5) * 2 * (MAP.edge - 3); place(x, z, 3 + ((r() * 7) | 0), 1.2, 0); }
  for (const sp of interiorSpots) for (let i = 0; i < 20; i++) place(sp.x + (r() - 0.5) * 6, sp.z + (r() - 0.5) * 6, 4 + ((r() * 4) | 0), 1.4, 0.04); // auch in den Häusern
  const d = new THREE.Object3D(), col = new THREE.Color();
  for (const [v, list] of L) { // 1 InstancedMesh pro Variante (ca. 30 Draw-Calls insgesamt)
    const im = new THREE.InstancedMesh(v.geo, v.mat, list.length);
    list.forEach((o, i) => { d.position.set(o.x, o.y, o.z); d.rotation.set(o.rx, o.ry, o.rz); d.scale.set(o.sx, o.sy, o.sz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.setScalar(o.t)); });
    im.frustumCulled = false; mapRoot.add(im);
  }
}
