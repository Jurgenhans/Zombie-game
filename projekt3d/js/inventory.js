// Inventar-Daten: Rucksack (INV_COLS x INV_ROWS Felder) + Ausrüstung. Speichert nur Item-IDs.

import { INV_COLS, INV_ROWS } from './config.js';
import { ITEMS, SLOTS, SLOT_KEYS, STARTER_ITEMS } from './items.js';

const VERSION = 2;   // 2: Testwaffen hinzugefügt

export const INV_SIZE = INV_COLS * INV_ROWS;

export class Inventory {
  constructor() { this.reset(); }

  // Startzustand: leer, nur das Testschwert liegt im ersten Feld
  reset() {
    this.bag = Array(INV_SIZE).fill(null);
    this.equip = Object.fromEntries(SLOT_KEYS.map((k) => [k, null]));
    STARTER_ITEMS.forEach((id, i) => { this.bag[i] = id; });
  }

  load(data) {
    this.reset();
    if (!data || typeof data !== 'object') return;
    this.bag.fill(null);
    if (Array.isArray(data.bag)) data.bag.slice(0, INV_SIZE).forEach((id, i) => { if (ITEMS[id]) this.bag[i] = id; });
    for (const k of SLOT_KEYS) { const id = data.equip?.[k]; if (ITEMS[id] && this.fits(id, k)) this.equip[k] = id; }
    // Ältere Spielstände: neue Testwaffen nachliefern
    if ((data.v ?? 1) < VERSION) {
      for (const id of STARTER_ITEMS) {
        if (this.bag.includes(id) || Object.values(this.equip).includes(id)) continue;
        const free = this.bag.indexOf(null);
        if (free >= 0) this.bag[free] = id;
      }
    }
  }

  toJSON() { return { v: VERSION, bag: [...this.bag], equip: { ...this.equip } }; }

  fits(id, slot) { return !!ITEMS[id] && ITEMS[id].type === (SLOTS[slot].type ?? slot); }

  slotForItem(id) {
    const ok = SLOT_KEYS.filter((k) => this.fits(id, k));
    return ok.find((k) => !this.equip[k]) ?? ok[0] ?? null;
  }

  equipFromBag(i) {
    const slot = this.bag[i] && this.slotForItem(this.bag[i]);
    return slot ? this.equipTo(slot, i) : false;
  }

  equipTo(slot, i) {
    const id = this.bag[i];
    if (!id || !this.fits(id, slot)) return false;
    this.bag[i] = this.equip[slot];
    this.equip[slot] = id;
    return true;
  }

  unequip(slot, toIndex = -1) {
    const id = this.equip[slot];
    if (!id) return false;
    const t = toIndex >= 0 && !this.bag[toIndex] ? toIndex : this.bag.indexOf(null);
    if (t < 0) return false;
    this.bag[t] = id; this.equip[slot] = null;
    return true;
  }

  swapBag(a, b) { [this.bag[a], this.bag[b]] = [this.bag[b], this.bag[a]]; }
}
