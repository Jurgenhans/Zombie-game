// Spielerwerte: Level, Lebenspunkte (HP), Kills und Skills.
// Level n hat HP_PER_LEVEL * n HP (Level 1 = 100 HP ... Level 10 = 1000 HP).
// Für den Aufstieg von Level n auf n+1 braucht man KILLS_PER_LEVEL * n Kills in diesem Level
// (1 -> 2: 100, 2 -> 3: 200, 3 -> 4: 300 ... 9 -> 10: 900). Bei jedem Aufstieg wird man voll geheilt.
// Skills: Man wählt einen Skill aus. Jeder Kill zählt für den gewählten Skill, alle SKILL_KILLS Kills
// steigt er um 1 Level (+1 %), höchstens SKILL_MAX Level (= 15 %). Jeder Skill merkt sich seinen eigenen Fortschritt.

import { MAX_LEVEL, HP_PER_LEVEL, KILLS_PER_LEVEL, SKILL_MAX, SKILL_KILLS, SKILL_STEP } from './config.js';

export const maxHpFor = (level) => HP_PER_LEVEL * level;
export const killsNeeded = (level) => KILLS_PER_LEVEL * level;

export const SKILLS = {
  damage:  { label: 'Schaden',      icon: '⚔️', desc: 'Mehr Schaden mit allen Waffen.' },
  hp:      { label: 'Lebenspunkte', icon: '❤️', desc: 'Mehr maximale HP.' },
  defense: { label: 'Verteidigung', icon: '🛡️', desc: 'Weniger Schaden durch Zombie-Schläge.' },
  resist:  { label: 'Resistenz',    icon: '🔮', desc: 'Weniger Schaden durch Magie und Gift (noch ohne Wirkung).' },
};
export const SKILL_KEYS = Object.keys(SKILLS);

const zeros = () => Object.fromEntries(SKILL_KEYS.map((k) => [k, 0]));

export class PlayerStats {
  constructor() { this.reset(); }

  reset() {
    this.level = 1; this.kills = 0; this.total = 0;
    this.skills = zeros();       // Level je Skill (0..SKILL_MAX)
    this.skillKills = zeros();   // Kills auf dem Weg zum nächsten Skill-Level (0..SKILL_KILLS-1)
    this.selected = SKILL_KEYS[0];   // dieser Skill bekommt die Kills
    this.hp = this.maxHp;
  }

  bonus(key) { return (this.skills[key] ?? 0) * SKILL_STEP; }   // 0.03 = +3 %

  get maxHp() { return Math.round(maxHpFor(this.level) * (1 + this.bonus('hp'))); }
  get isMaxLevel() { return this.level >= MAX_LEVEL; }
  get needed() { return this.isMaxLevel ? 0 : killsNeeded(this.level); }   // Kills bis zum nächsten Level

  // Skill auswählen: ab jetzt zählen die Kills für ihn. Gibt false bei unbekanntem Skill zurück.
  select(key) {
    if (!(key in SKILLS)) return false;
    this.selected = key;
    return true;
  }

  // Zählt einen Kill für Spieler-Level und gewählten Skill.
  // Gibt zurück: { levelUp: bool, skillUp: Skill-Key oder null, skillMaxed: bool }
  addKill() {
    const r = { levelUp: false, skillUp: null, skillMaxed: false };
    this.total++;

    if (!this.isMaxLevel && ++this.kills >= this.needed) {
      this.level++; this.kills = 0; this.hp = this.maxHp; r.levelUp = true;
    }

    const k = this.selected;
    if (this.skills[k] < SKILL_MAX && ++this.skillKills[k] >= SKILL_KILLS) {
      const before = this.maxHp;
      this.skills[k]++; this.skillKills[k] = 0;
      this.hp += this.maxHp - before;   // zusätzliche HP (HP-Skill) sind sofort da
      r.skillUp = k; r.skillMaxed = this.skills[k] >= SKILL_MAX;
    }
    return r;
  }

  damage(n) { this.hp = Math.max(0, this.hp - n); }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  // Zombie-Schlag: Verteidigung senkt den Schaden. Gibt den echten Schaden zurück.
  takeHit(raw) { const a = raw * (1 - this.bonus('defense')); this.damage(a); return a; }

  toJSON() {
    return { level: this.level, kills: this.kills, total: this.total, hp: this.hp,
      skills: { ...this.skills }, skillKills: { ...this.skillKills }, selected: this.selected };
  }

  load(d) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    const int = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : def);
    this.level = int(d.level, 1, MAX_LEVEL, 1);
    this.kills = this.isMaxLevel ? 0 : int(d.kills, 0, this.needed - 1, 0);
    this.total = int(d.total, 0, Infinity, 0);
    if (d.selected in SKILLS) this.selected = d.selected;
    for (const k of SKILL_KEYS) {
      this.skills[k] = int(d.skills?.[k], 0, SKILL_MAX, 0);
      this.skillKills[k] = this.skills[k] >= SKILL_MAX ? 0 : int(d.skillKills?.[k], 0, SKILL_KILLS - 1, 0);
    }
    // Alter Spielstand (Skillpunkte zum Verteilen): ungenutzte Punkte gehen in den gewählten Skill
    if (d.skillKills === undefined && d.skills) {
      const spent = SKILL_KEYS.reduce((a, k) => a + this.skills[k], 0);
      const free = Math.max(0, Math.floor(this.total / SKILL_KILLS) - spent);
      this.skills[this.selected] = Math.min(SKILL_MAX, this.skills[this.selected] + free);
    }
    this.hp = int(d.hp, 1, this.maxHp, this.maxHp);
  }
}
