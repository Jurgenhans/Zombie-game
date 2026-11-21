// Touch-Steuerung für Android:
//  - links: Joystick (erscheint dort, wo der Daumen die linke Seite berührt)
//  - rechts: Wischen dreht die Kamera, zwei Finger = Zoom (ohne sichtbaren Joystick)
//  - Slot-Leisten (Tränke/Booster unten Mitte, Fertigkeiten rechts) sind nur Oberfläche.
//    Beim Antippen wird das Fenster-Ereignis "slotuse" gesendet, daran kann man später die Funktion hängen.

import { TOUCH } from './config.js';

export function isTouchDevice() {
  return new URLSearchParams(location.search).has('touch') || window.matchMedia('(pointer: coarse)').matches;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class TouchControls {
  constructor(game, canvas) {
    this.game = game;
    this.base = document.getElementById('joyBase');
    this.knob = document.getElementById('joyKnob');
    this.joyId = null; this.ox = 0; this.oy = 0;
    this.look = new Map();   // pointerId -> letzte Position (Kamera-Finger)
    this.pinch = 0;
    this.layout();
    window.addEventListener('resize', () => this.layout());
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
  }

  get radius() { return Math.round(clamp(Math.min(innerWidth, innerHeight) * 0.13, 40, 70)); }

  place(x, y) {
    const R = this.radius;
    this.base.style.setProperty('--r', R + 'px');
    this.base.style.left = (x - R) + 'px';
    this.base.style.top = (y - R) + 'px';
  }
  setKnob(dx, dy) { this.knob.style.transform = `translate(${dx}px, ${dy}px)`; }

  // Ruheposition: unten links
  layout() {
    if (this.joyId !== null) return;
    const R = this.radius;
    this.place(R + 36, innerHeight - R - 36);
    this.setKnob(0, 0);
    this.base.classList.remove('active');
  }

  span() {
    const [a, b] = [...this.look.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  down(e) {
    if (e.pointerType !== 'touch' || this.game.mode !== 'play' || this.game.paused) return;
    if (e.clientX < innerWidth * TOUCH.JOY_ZONE && this.joyId === null) {
      this.joyId = e.pointerId; this.ox = e.clientX; this.oy = e.clientY;
      this.place(this.ox, this.oy);
      this.setKnob(0, 0);
      this.base.classList.add('active');
    } else {
      this.look.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.look.size === 2) this.pinch = this.span();
    }
  }

  move(e) {
    if (e.pointerType !== 'touch') return;
    if (e.pointerId === this.joyId) {
      const R = this.radius;
      let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      this.setKnob(dx, dy);
      this.game.setTouchMove(dx / R, -dy / R);   // nach oben = vorwärts
      return;
    }
    const p = this.look.get(e.pointerId);
    if (!p) return;
    if (this.look.size === 1) this.game.touchLook(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
    if (this.look.size === 2) {
      const s = this.span();
      if (this.pinch > 0 && s > 0) this.game.touchZoom(this.pinch / s);
      this.pinch = s;
    }
  }

  up(e) {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.game.setTouchMove(0, 0);
      this.layout();
    } else if (this.look.delete(e.pointerId)) {
      this.pinch = 0;
    }
  }
}

// Slots: nur Oberfläche, noch ohne Funktion im Spiel
export function initSlots() {
  document.querySelectorAll('.slot').forEach((s) => {
    const end = () => s.classList.remove('press');
    s.addEventListener('pointerdown', () => s.classList.add('press'));
    s.addEventListener('pointerup', () => {
      end();
      window.dispatchEvent(new CustomEvent('slotuse', { detail: { bar: s.dataset.bar, index: Number(s.dataset.index) } }));
    });
    s.addEventListener('pointerleave', end);
    s.addEventListener('pointercancel', end);
  });
}
