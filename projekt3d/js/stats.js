// Spielerwerte: Level, Lebenspunkte (HP), Kills und Skills.
// Level n hat HP_PER_LEVEL * n HP (Level 1 = 100 HP ... Level 10 = 1000 HP).
// Für den Aufstieg von Level n auf n+1 braucht man KILLS_PER_LEVEL * n Kills in diesem Level
// (1 -> 2: 100, 2 -> 3: 200, 3 -> 4: 300 ... 9 -> 10: 900). Bei jedem Aufstieg wird man voll geheilt.
// Skills: alle SKILL_KILLS Kills (gesamt) gibt es 1 Skillpunkt. Er gibt in einem der Skills +1 % (höchstens SKILL_MAX Level = 15 %).

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
const MAX_POINTS = SKILL_MAX * SKILL_KEYS.length;

const zeroSkills = () => Object.fromEntries(SKILL_KEYS.map((k) => [k, 0]));

export class PlayerStats {
  constructor() { this.reset(); }

  reset() { this.level = 1; this.kills = 0; this.total = 0; this.skills = zeroSkills(); this.hp = this.maxHp; }

  bonus(key) { return (this.skills[key] ?? 0) * SKILL_STEP; }   // 0.03 = +3 %

  get maxHp() { return Math.round(maxHpFor(this.level) * (1 + this.bonus('hp'))); }
  get isMaxLevel() { return this.level >= MAX_LEVEL; }
  get needed() { return this.isMaxLevel ? 0 : killsNeeded(this.level); }   // Kills bis zum nächsten Level

  get pointsEarned() { return Math.min(MAX_POINTS, Math.floor(this.total / SKILL_KILLS)); }
  get pointsSpent() { return SKILL_KEYS.reduce((a, k) => a + this.skills[k], 0); }
  get pointsFree() { return Math.max(0, this.pointsEarned - this.pointsSpent); }
  get killsToPoint() { return this.pointsEarned >= MAX_POINTS ? 0 : SKILL_KILLS - (this.total % SKILL_KILLS); }

  // Zählt einen Kill. Gibt true zurück, wenn dadurch ein neues Level erreicht wurde.
  addKill() {
    this.total++;
    if (this.isMaxLevel) return false;
    if (++this.kills < this.needed) return false;
    this.level++; this.kills = 0; this.hp = this.maxHp;
    return true;
  }

  // Einen Skillpunkt in einen Skill stecken. false, wenn kein Punkt frei oder der Skill schon voll ist.
  spend(key) {
    if (!(key in SKILLS) || this.skills[key] >= SKILL_MAX || this.pointsFree <= 0) return false;
    const before = this.maxHp;
    this.skills[key]++;
    this.hp += this.maxHp - before;   // zusätzliche HP sind sofort da
    return true;
  }

  damage(n) { this.hp = Math.max(0, this.hp - n); }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  // Zombie-Schlag: Verteidigung senkt den Schaden. Gibt den echten Schaden zurück.
  takeHit(raw) { const a = raw * (1 - this.bonus('defense')); this.damage(a); return a; }

  toJSON() { return { level: this.level, kills: this.kills, total: this.total, hp: this.hp, skills: { ...this.skills } }; }

  load(d) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    const int = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : def);
    this.level = int(d.level, 1, MAX_LEVEL, 1);
    this.kills = this.isMaxLevel ? 0 : int(d.kills, 0, this.needed - 1, 0);
    this.total = int(d.total, 0, Infinity, 0);
    for (const k of SKILL_KEYS) this.skills[k] = int(d.skills?.[k], 0, SKILL_MAX, 0);
    if (this.pointsSpent > this.pointsEarned) this.skills = zeroSkills();   // unstimmiger Spielstand
    this.hp = int(d.hp, 1, this.maxHp, this.maxHp);
  }
}
