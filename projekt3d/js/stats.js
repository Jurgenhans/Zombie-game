// Spielerwerte: Level, Lebenspunkte (HP) und Kills.
// Level n hat HP_PER_LEVEL * n HP (Level 1 = 100 HP ... Level 10 = 1000 HP).
// Für den Aufstieg von Level n auf n+1 braucht man KILLS_PER_LEVEL * n Kills in diesem Level
// (1 -> 2: 100, 2 -> 3: 200, 3 -> 4: 300 ... 9 -> 10: 900). Bei jedem Aufstieg wird man voll geheilt.

import { MAX_LEVEL, HP_PER_LEVEL, KILLS_PER_LEVEL } from './config.js';

export const maxHpFor = (level) => HP_PER_LEVEL * level;
export const killsNeeded = (level) => KILLS_PER_LEVEL * level;

export class PlayerStats {
  constructor() { this.reset(); }

  reset() { this.level = 1; this.kills = 0; this.total = 0; this.hp = maxHpFor(1); }

  get maxHp() { return maxHpFor(this.level); }
  get isMaxLevel() { return this.level >= MAX_LEVEL; }
  get needed() { return this.isMaxLevel ? 0 : killsNeeded(this.level); }   // Kills bis zum nächsten Level

  // Zählt einen Kill. Gibt true zurück, wenn dadurch ein neues Level erreicht wurde.
  addKill() {
    this.total++;
    if (this.isMaxLevel) return false;
    if (++this.kills < this.needed) return false;
    this.level++; this.kills = 0; this.hp = this.maxHp;
    return true;
  }

  damage(n) { this.hp = Math.max(0, this.hp - n); }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  toJSON() { return { level: this.level, kills: this.kills, total: this.total, hp: this.hp }; }

  load(d) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    const int = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : def);
    this.level = int(d.level, 1, MAX_LEVEL, 1);
    this.kills = this.isMaxLevel ? 0 : int(d.kills, 0, this.needed - 1, 0);
    this.total = int(d.total, 0, Infinity, 0);
    this.hp = int(d.hp, 1, this.maxHp, this.maxHp);
  }
}
