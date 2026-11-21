// Inventar-Oberfläche. Bedienung per Tippen/Klicken:
//  Gegenstand antippen = auswählen · danach leeres/anderes Feld = verschieben/tauschen ·
//  Ausrüstungsfeld = anlegen · Knopf unten: "Ausrüsten" / "Ablegen".

import { INV_COLS, INV_ROWS } from './config.js';
import { ITEMS, SLOTS, SLOT_LAYOUT, TYPE_NAMES } from './items.js';
import { INV_SIZE } from './inventory.js';

const $ = (id) => document.getElementById(id);

export class InventoryUI {
  constructor(inv, onChange) {
    this.inv = inv; this.onChange = onChange;
    this.sel = null;   // { where: 'bag'|'equip', key }
    this.msg = '';
    this.grid = $('invGrid'); this.equipEl = $('invEquip');
    this.info = $('invInfoText'); this.act = $('btnInvAction');
    this.grid.style.setProperty('--cols', INV_COLS);

    this.bagCells = [];
    for (let i = 0; i < INV_SIZE; i++) {
      const b = document.createElement('button');
      b.className = 'cell'; b.onclick = () => this.clickBag(i);
      this.grid.appendChild(b); this.bagCells.push(b);
    }
    this.equipCells = {};
    for (const k of SLOT_LAYOUT) {
      if (!k) { this.equipEl.appendChild(document.createElement('div')); continue; }
      const b = document.createElement('button');
      b.className = 'cell equip'; b.title = SLOTS[k].label; b.onclick = () => this.clickEquip(k);
      this.equipEl.appendChild(b); this.equipCells[k] = b;
    }
    this.act.onclick = () => this.action();
    window.addEventListener('resize', () => this.layout());
    this.render();
  }

  // Feldgröße an den Bildschirm anpassen
  layout() {
    const byH = (innerHeight - 170) / INV_ROWS - 4;
    const byW = (innerWidth - 70 - 4 * INV_COLS) / (INV_COLS + 2);
    document.documentElement.style.setProperty('--cell', Math.round(Math.min(56, Math.max(26, byH, 0) , Math.max(26, byW))) + 'px');
  }

  open() { this.sel = null; this.msg = ''; this.layout(); this.render(); }
  clearSelection() { this.sel = null; this.msg = ''; }

  itemAt(s) { return s ? (s.where === 'bag' ? this.inv.bag[s.key] : this.inv.equip[s.key]) : null; }
  changed() { this.sel = null; this.render(); this.onChange?.(); }

  clickBag(i) {
    const inv = this.inv, s = this.sel; this.msg = '';
    if (!s) { if (inv.bag[i]) this.sel = { where: 'bag', key: i }; }
    else if (s.where === 'bag') {
      if (s.key === i) this.sel = null;
      else { inv.swapBag(s.key, i); return this.changed(); }
    } else {   // Ausrüstung ausgewählt -> ins Feld i ablegen
      if (!inv.bag[i]) { if (inv.unequip(s.key, i)) return this.changed(); }
      else if (inv.fits(inv.bag[i], s.key)) { inv.equipTo(s.key, i); return this.changed(); }
      else this.sel = { where: 'bag', key: i };
    }
    this.render();
  }

  clickEquip(k) {
    const inv = this.inv, s = this.sel; this.msg = '';
    if (s && s.where === 'bag' && inv.bag[s.key]) {
      if (inv.equipTo(k, s.key)) return this.changed();
      this.msg = `${ITEMS[inv.bag[s.key]].name} passt nicht in „${SLOTS[k].label}“.`;
    } else if (s && s.where === 'equip' && s.key === k) this.sel = null;
    else this.sel = inv.equip[k] ? { where: 'equip', key: k } : null;
    this.render();
  }

  action() {
    const s = this.sel; if (!s) return;
    const ok = s.where === 'bag' ? this.inv.equipFromBag(s.key) : this.inv.unequip(s.key);
    if (ok) this.changed(); else { this.msg = 'Kein Platz im Rucksack.'; this.render(); }
  }

  render() {
    const inv = this.inv, sel = this.sel;
    const paint = (el, id, isSel) => {
      el.classList.toggle('sel', isSel);
      el.classList.toggle('filled', !!id);
      const label = el.classList.contains('equip') && !id ? `<small>${el.title}</small>` : '';
      el.innerHTML = id ? `<span class="ico">${ITEMS[id].icon}</span>` : label;
    };
    this.bagCells.forEach((el, i) => paint(el, inv.bag[i], sel?.where === 'bag' && sel.key === i));
    for (const k in this.equipCells) paint(this.equipCells[k], inv.equip[k], sel?.where === 'equip' && sel.key === k);

    const id = this.itemAt(sel), it = id && ITEMS[id];
    if (it) {
      this.info.innerHTML = '';
      const t = document.createElement('div'); t.className = 'ii-title';
      const ic = document.createElement('span'); ic.className = 'ico'; ic.innerHTML = it.icon;
      t.append(ic, ` ${it.name}`);
      const d = document.createElement('div'); d.className = 'ii-sub';
      d.textContent = `${TYPE_NAMES[it.type]}${it.damage ? ` · Schaden ${it.damage}` : ''} — ${it.desc}`;
      this.info.append(t, d);
      this.act.classList.remove('hidden');
      this.act.textContent = sel.where === 'bag' ? 'Ausrüsten' : 'Ablegen';
      this.act.disabled = sel.where === 'bag' && !inv.slotForItem(id);
    } else {
      this.info.textContent = this.msg || 'Tippe auf einen Gegenstand, um ihn auszuwählen.';
      this.act.classList.add('hidden');
    }
    if (it && this.msg) { const m = document.createElement('div'); m.className = 'ii-sub warn'; m.textContent = this.msg; this.info.appendChild(m); }
  }
}
