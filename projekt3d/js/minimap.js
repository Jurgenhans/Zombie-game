// Zeichnet die Karte (Minimap und große Karte nutzen denselben Code).
// Aus den Splat-Daten des Bodens entsteht ein Bild; darüber kommen Gitter,
// Feldnummern 1-100, aktives Feld und die Spielerfigur.

import { GRID, MAP_SIZE, FIELD_COUNT, BIOME_MAP_COLORS } from './config.js';
import { fieldNumber } from './mapgen.js';

export class MapView {
  constructor(splat, splatSize = 512) {
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = splatSize;
    const ctx = this.base.getContext('2d');
    const img = ctx.createImageData(splatSize, splatSize);
    const [g, r, s] = BIOME_MAP_COLORS;
    for (let i = 0; i < splatSize * splatSize; i++) {
      const wg = splat[i * 4] / 255, wr = splat[i * 4 + 1] / 255, ws = splat[i * 4 + 2] / 255;
      for (let c = 0; c < 3; c++) img.data[i * 4 + c] = g[c] * wg + r[c] * wr + s[c] * ws;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  // Canvas auf CSS-Größe x Pixeldichte einstellen
  static fit(canvas, cssSize) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = canvas.style.height = cssSize + 'px';
    canvas.width = canvas.height = Math.round(cssSize * dpr);
  }

  draw(canvas, { player = null, activeField = -1, hoverField = -1, selectedField = -1 } = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const cell = W / GRID;
    ctx.clearRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, W, W);

    // Gitter
    ctx.strokeStyle = 'rgba(15,20,30,0.45)';
    ctx.lineWidth = Math.max(1, W / 400);
    ctx.beginPath();
    for (let i = 0; i <= GRID; i++) {
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, W);
      ctx.moveTo(0, i * cell); ctx.lineTo(W, i * cell);
    }
    ctx.stroke();

    const box = (idx, fill, stroke, lw) => {
      const x = (idx % GRID) * cell, y = Math.floor(idx / GRID) * cell;
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, cell, cell); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + lw / 2, y + lw / 2, cell - lw, cell - lw); }
    };
    if (hoverField >= 0) box(hoverField, 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0.9)', Math.max(2, W / 250));
    if (activeField >= 0) box(activeField, 'rgba(255,200,60,0.22)', '#ffc83c', Math.max(2, W / 170));
    if (selectedField >= 0 && selectedField !== activeField) box(selectedField, null, '#ffffff', Math.max(3, W / 160));

    // Feldnummern 1..100
    ctx.font = `700 ${Math.round(cell * 0.36)}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, cell * 0.09);
    for (let i = 0; i < FIELD_COUNT; i++) {
      const cx = (i % GRID) * cell + cell / 2, cy = Math.floor(i / GRID) * cell + cell / 2;
      const label = String(fieldNumber(i));
      ctx.strokeStyle = 'rgba(10,14,20,0.85)';
      ctx.strokeText(label, cx, cy);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, cx, cy);
    }

    // Spieler (Dreieck zeigt Blickrichtung; Norden = oben)
    if (player) {
      const px = (player.x / MAP_SIZE) * W, py = (player.z / MAP_SIZE) * W;
      const s = Math.max(6, W / 34);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - player.yaw);
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.75, s * 0.8); ctx.lineTo(0, s * 0.4); ctx.lineTo(-s * 0.75, s * 0.8);
      ctx.closePath();
      ctx.fillStyle = '#e8453c';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, s / 4);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    }

    // Rahmen
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(2, W / 200);
    ctx.strokeRect(0, 0, W, W);
  }

  // Welches Feld (0..99) liegt unter der Maus? -1 = keins
  static fieldAt(canvas, clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width, y = (clientY - r.top) / r.height;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1;
    return Math.floor(y * GRID) * GRID + Math.floor(x * GRID);
  }
}
