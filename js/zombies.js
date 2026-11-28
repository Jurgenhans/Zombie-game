import * as THREE from 'three';
import { ZOMBIE_COUNT } from '../zombiegen.js';
import { SFX } from './audio.js';
import { CONFIG, WEAPONS } from './config.js';
import { $, clamp, rnd, rr, scene } from './core.js';
import { emit } from './effects.js';
import { severPart } from './gore.js';
import { update } from './flow.js';
import { hurtPlayer, toast, updateHUD } from './hud.js';
import { HALF, boxes, groundH } from './mapdata.js';
import { ZOMBIE_SPEC, buildHumanoid, getVariant, limb, meshList, models, releaseZombie, updateLod } from './models.js';
import { setPaused } from './options.js';
import { resolveCircle } from './physics.js';
import { applyShaderTo } from './shader.js';
import { S, player } from './state.js';

/* ---------------- Zombies ---------------- */
export const zombies = [];

export function spawnZombie(x, z, opts = {}) {
  let root, parts = null;
  const gen = models.genOk ? getVariant(opts.variant !== undefined ? opts.variant : (Math.random() * ZOMBIE_COUNT) | 0) : null;
  const src = gen || (models.zombies.length ? models.zombies[(rnd() * models.zombies.length) | 0] : null);
  if (gen) {
    root = gen.clone(true); const nd = (n) => root.getObjectByName(n);
    parts = { head: limb(nd('head'), 'head'), armL: limb(nd('armL'), 'arm'), armR: limb(nd('armR'), 'arm'), legL: limb(nd('legL'), 'leg'), legR: limb(nd('legR'), 'leg'), torso: limb(nd('torso'), 'torso') };
  } else if (src) {
    root = src.clone(true); const pv = (n) => root.getObjectByName('pv_' + n);
    parts = { head: pv('head'), armL: pv('armL'), armR: pv('armR'), foreL: pv('foreL'), foreR: pv('foreR'), legL: pv('legL'), legR: pv('legR'), torso: { rotation: { x: 0, y: 0, z: 0 } } };
    if (!parts.head || !parts.armL || !parts.legL) parts = null; // Rig unvollständig -> nur Ganzkörper-Animation
  } else { root = buildHumanoid(ZOMBIE_SPEC); parts = root.parts; }
  const sc = rr(0.95, 1.08); root.scale.multiplyScalar(sc);
  const runner = opts.runner ?? rnd() < 0.2;
  const hp = (opts.hp || 100) * (runner ? 0.7 : 1);
  const zb = {
    root, parts, pos: new THREE.Vector3(x, 0, z), yaw: rr(0, 6.28), hp, maxHp: hp, state: 'wander', t: rnd() * 5,
    speed: (runner ? rr(3.2, 4.2) : rr(1.1, 2.0)) * (opts.speedMul || 1), dmg: opts.dmg || 12, atkCd: 0, stun: 0, headY: ((src && src.userData.headY) || 1.62) * sc,
    wander: new THREE.Vector3(x, 0, z), phase: rnd() * 6, stuckT: 0, lastP: new THREE.Vector3(x, 0, z), side: 0, dieT: 0, fall: rnd() < 0.5 ? -1 : 1, groanT: rr(3, 9),
    target: null, runner, gen,
    lost: {}, legMul: 1, atkMul: 1, crawl: false, limbHp: { head: 45 * hp / 100, armL: 34 * hp / 100, armR: 34 * hp / 100, legL: 48 * hp / 100, legR: 48 * hp / 100 }, // Trefferpunkte der abschießbaren Körperteile
  };
  if (gen) { gen.userData.refs++; zb.meshes = meshList(root); zb.geos0 = zb.meshes.map((m) => m.geometry); zb.lod = 0; zb.lodT = 0; }
  root.position.copy(zb.pos); scene.add(root); applyShaderTo(root); zombies.push(zb); return zb;
}
export function damageZombie(z, dmg, head, dir, at, pg) {
  z.hp -= dmg; z.stun = 0.2; const za = zAudio(z); SFX.hit(za.vol, za.pan);
  if (z.state === 'wander') { z.state = 'chase'; }
  emit(at, head ? 14 : 7, 'blood', head ? 3.5 : 2.5, 0.05, 9, dir);
  const name = pg && pg.name;
  if (name && z.limbHp[name] !== undefined && !z.lost[name]) { // Körperteil getroffen: Teil-Trefferpunkte (ohne Kopfschuss-Bonus) -> bei 0 abgetrennt
    z.limbHp[name] -= head ? dmg / 2.5 : dmg;
    if (z.limbHp[name] <= 0) sever(z, name, pg, at, dir);
  }
  if (z.hp <= 0) { killZombie(z, head); return true; }
  SFX.zhurt(za.vol, za.pan); return false;
}
// Körperteil abtrennen: Kopf = sofort tot, Arme = schwächerer Angriff, Beine = langsamer / kriechend
export function sever(z, name, pg, at, dir) {
  z.lost[name] = true; z.parts[name] = { rotation: { x: 0, y: 0, z: 0 } };
  severPart(z, pg, at, dir);
  if (name === 'head') z.hp = Math.min(z.hp, 0);
  else if (name[0] === 'a') z.atkMul = z.lost.armL && z.lost.armR ? 0.35 : 0.7;
  else { const n = (z.lost.legL ? 1 : 0) + (z.lost.legR ? 1 : 0); z.legMul = n === 2 ? 0.22 : 0.55; z.crawl = n === 2; }
}
export function preciseHit(z, origin, dir) { // genauer Treffer auf die Modell-Geometrie -> Distanz + getroffenes Körperteil (Gruppe mit userData.part)
  z.root.updateMatrixWorld(true); _rc.set(origin, dir); _rc.far = 200;
  const hit = _rc.intersectObject(z.root, true)[0]; if (!hit) return null;
  let o = hit.object, pg = null; for (; o && o !== z.root; o = o.parent) if (o.userData && o.userData.part) { pg = o; break; }
  return { t: hit.distance, pg };
}
const _rc = new THREE.Raycaster();
export function killZombie(z, head) {
  z.state = 'dying'; z.dieT = 0; player.kills++; player.gold += 5; S.killsTotal++; { const za = zAudio(z); SFX.death(za.vol, za.pan); }
  emit(new THREE.Vector3(z.pos.x, z.pos.y + 1, z.pos.z), head ? 25 : 14, 'blood', 3, 0.06, 9);
  updateHUD();
}
export function noise(pos, radius) { for (const z of zombies) if (z.state === 'wander' && z.pos.distanceTo(pos) < radius) { z.state = 'chase'; } }

/* Zombie-Geräusche: nur die nächsten Zombies (max. CONFIG.soundVoices) sind hörbar, Lautstärke nach Entfernung, Stereo-Richtung */
export const audible = new Set();
export let audT = 0;
export function updateAudible(dt) {
  audT -= dt; if (audT > 0) return; audT = 0.15; audible.clear();
  const list = [];
  for (const z of zombies) { if (z.state === 'dead' || z.state === 'dying') continue; const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z); if (d < CONFIG.soundRange) list.push([d, z]); }
  list.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Math.min(CONFIG.soundVoices, list.length); i++) audible.add(list[i][1]);
}
export function audioOf(z, dist) {
  const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.max(0.5, dist);
  const f = Math.max(0, 1 - d / CONFIG.soundRange);
  return { vol: f * f, pan: (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d * Math.min(1, 4 / d + 0.5) };
}
export function zAudio(z) { // Lautstärke/Richtung für Treffer- und Sterbegeräusche
  const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
  return { vol: clamp(1 - d / 80, 0.2, 1), pan: audioOf(z, d).pan };
}
export function updateZombie(z, dt) {
  const pp = player.pos; const dx = pp.x - z.pos.x, dz = pp.z - z.pos.z; const dist = Math.hypot(dx, dz);
  if (z.gen && (z.lodT -= dt) <= 0) { z.lodT = 0.3 + rnd() * 0.2; updateLod(z, dist); } // Detailstufe nach Entfernung
  z.t += dt; z.phase += dt * (z.state === 'chase' ? z.speed * 2.2 : 3);
  if (z.state === 'dying') {
    z.dieT += dt; const k = Math.min(1, z.dieT / 0.9), e = 1 - (1 - k) * (1 - k);
    z.root.rotation.x = -z.fall * e * Math.PI / 2; z.root.position.y = 0.05 * e;
    if (z.parts) { z.parts.armL.rotation.x = -2 * e; z.parts.armR.rotation.x = -2.2 * e; z.parts.legL.rotation.x = 0.4 * e; z.parts.legR.rotation.x = -0.3 * e; z.parts.head.rotation.x = -z.fall * 0.5 * e; }
    if (k >= 1) { z.state = 'dead'; z.deadT = 0; }
    return;
  }
  if (z.state === 'dead') { z.deadT += dt; if (z.deadT > 12) { z.root.position.y -= dt * 0.15; if (z.deadT > 18) { scene.remove(z.root); releaseZombie(z); z.gone = true; } } return; }
  if (player.dead) z.state = 'wander';
  if (z.stun > 0) { z.stun -= dt; return; }
  z.atkCd -= dt; z.groanT -= dt;
  if (z.groanT <= 0) { z.groanT = rr(5, 12); if (audible.has(z)) { const a = audioOf(z, dist); SFX.groan(a.vol, a.pan); } }
  if (z.state === 'wander') {
    if (dist < 18 || (dist < 30 && Math.abs(Math.atan2(dx, dz) - z.yaw) < 1)) z.state = 'chase';
    if (z.pos.distanceTo(z.wander) < 1 || z.t > 8) { z.wander.set(z.pos.x + rr(-12, 12), 0, z.pos.z + rr(-12, 12)); z.t = 0; }
  }
  let tx, tz, spd;
  if (z.state === 'chase' || z.state === 'attack') {
    tx = pp.x; tz = pp.z; spd = z.speed * z.legMul;
    z.state = dist > 80 ? 'wander' : dist < 1.5 && Math.abs(pp.y - z.pos.y) < 1.8 ? 'attack' : 'chase';
  } else { tx = z.wander.x; tz = z.wander.z; spd = z.speed * 0.4 * z.legMul; }
  let ang = Math.atan2(tx - z.pos.x, tz - z.pos.z);
  if (z.side) { ang += z.side; z.sideT -= dt; if (z.sideT <= 0) z.side = 0; }
  // Drehung glätten
  let da = ang - z.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); z.yaw += clamp(da, -4 * dt, 4 * dt);
  if (z.state !== 'attack') {
    z.pos.x += Math.sin(z.yaw) * spd * dt; z.pos.z += Math.cos(z.yaw) * spd * dt;
  } else if (z.atkCd <= 0) {
    z.atkCd = 1.1; z.atkAnim = 0.45;
    setTimeout(() => { if (z.state === 'attack' && !player.dead && z.hp > 0 && Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z) < 2) hurtPlayer(z.dmg * z.atkMul); }, 300);
  }
  const stepIdx = Math.floor(z.phase / Math.PI); // Schritt bei jedem Beinwechsel – nur für die nächsten Zombies hörbar
  if (stepIdx !== z.stepIdx) { z.stepIdx = stepIdx; if (z.state !== 'attack' && audible.has(z)) { const a = audioOf(z, dist); SFX.step(a.vol, a.pan, z.runner); } }
  for (const o of zombies) { if (o === z || o.state === 'dead' || o.state === 'dying') continue; const ox = z.pos.x - o.pos.x, oz = z.pos.z - o.pos.z, d2 = ox * ox + oz * oz; if (d2 < 0.55 && d2 > 1e-6) { const d = Math.sqrt(d2); z.pos.x += ox / d * 0.5 * dt * 2; z.pos.z += oz / d * 0.5 * dt * 2; } }
  resolveCircle(z.pos, 0.38, 0, 0.3);
  // Hängen geblieben? -> seitlich ausweichen
  z.stuckT += dt; if (z.stuckT > 0.5) { if (z.state === 'chase' && z.pos.distanceTo(z.lastP) < spd * 0.5 * 0.3) { z.side = (rnd() < 0.5 ? 1 : -1) * rr(1.0, 1.7); z.sideT = rr(0.8, 1.6); } z.lastP.copy(z.pos); z.stuckT = 0; }
  z.pos.y = groundH(z.pos.x, z.pos.z); z.root.position.set(z.pos.x, z.pos.y, z.pos.z); z.root.rotation.set(0, z.yaw, 0);
  if (z.crawl) z.root.position.y -= 0.72; else if (z.lost.legL !== z.lost.legR) z.root.rotation.z = z.lost.legL ? 0.16 : -0.16; // ohne Beine: Oberkörper am Boden; ein Bein: schief
  // Animation
  const sw = Math.sin(z.phase), amp = z.state === 'attack' ? 0.1 : (z.runner ? 0.9 : 0.55);
  if (z.parts) {
    z.parts.legL.rotation.x = sw * amp; z.parts.legR.rotation.x = -sw * amp;
    let arm = -1.35 + Math.sin(z.phase * 0.5) * 0.1;
    if (z.atkAnim > 0) { z.atkAnim -= dt; arm = -1.35 + Math.sin(Math.min(1, z.atkAnim / 0.45) * Math.PI) * -0.9; }
    z.parts.armL.rotation.x = arm; z.parts.armR.rotation.x = arm + 0.1;
    if (z.parts.foreL) { z.parts.foreL.rotation.x = -0.7; z.parts.foreR.rotation.x = -0.7; } z.parts.armL.rotation.z = 0.08; z.parts.armR.rotation.z = -0.08;
    z.parts.torso.rotation.x = 0.2 + Math.abs(sw) * 0.05 + (z.crawl ? 0.9 : 0); z.parts.torso.rotation.z = sw * 0.06; z.parts.head.rotation.z = Math.sin(z.phase * 0.7) * 0.12;
  } else { z.root.rotation.x = 0.12; z.root.position.y += Math.abs(sw) * 0.06; z.root.rotation.z = sw * 0.05; }
}

/* Wellen: Welle n hat 10·n verschiedene Zombies (Generator-Varianten 0..10n-1); Welle 30 = alle 300 */
export const waves = {
  n: 0, queue: [], spawnT: 0, pause: 3, active: false,
  start() {
    this.n++; this.active = true; this.spawnT = 1;
    const q = []; for (let i = 0; i < this.n * 10; i++) q.push(i);
    for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [q[i], q[j]] = [q[j], q[i]]; }
    this.queue = q; if (this.n % 5 === 0) player.lives++; // alle 5 Wellen +1 Respawn
    toast('WELLE ' + this.n + ' – ' + q.length + ' ZOMBIES' + (this.n % 5 === 0 ? ' · +1 RESPAWN' : '')); if (this.onStart) this.onStart(this.n); updateHUD();
  },
  update(dt) {
    if (!CONFIG.wavesEnabled || player.dead || S.won) return;
    if (!this.active) { this.pause -= dt; if (this.pause <= 0) this.start(); return; }
    if (this.queue.length > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && alive() < CONFIG.maxAlive) {
        this.spawnT = CONFIG.spawnInterval; const v = this.queue.pop(), p = randomSpawn(HALF * 0.28, HALF * 0.72);
        spawnZombie(p.x, p.z, { variant: v, hp: 100 + this.n * 6, speedMul: 1 + Math.min(0.6, this.n * 0.02), dmg: 10 + Math.floor(this.n / 2) }); updateHUD();
      }
    } else if (alive() === 0) {
      this.active = false; this.pause = 8;
      if (this.n >= CONFIG.maxWave) { victory(); return; }
      player.hp = Math.min(CONFIG.playerMaxHp, player.hp + 25); player.ammo.forEach((a, i) => { if (player.owned[i]) a.reserve += WEAPONS[i].mag; });
      toast('WELLE ' + this.n + ' GESCHAFFT  (+25 Leben, +Munition)'); updateHUD();
    }
  },
};

export function victory() {
  S.won = true; setPaused(true);
  $('goTitle').textContent = 'ÜBERLEBT!'; $('goTitle').classList.remove('red'); $('goTitle').classList.add('green');
  $('goKills').textContent = player.kills; $('goWave').textContent = waves.n; $('gameOver').classList.remove('hidden');
}
export const alive = () => zombies.reduce((n, z) => n + (z.state === 'dead' || z.state === 'dying' ? 0 : 1), 0);
export function randomSpawn(minD, maxD) {
  for (let i = 0; i < 60; i++) {
    const a = rnd() * 6.28, d = rr(minD, maxD), x = clamp(player.pos.x + Math.sin(a) * d, -HALF + 2, HALF - 2), z = clamp(player.pos.z + Math.cos(a) * d, -HALF + 2, HALF - 2);
    if (!boxes.some((b) => x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6)) return { x, z };
  }
  return { x: 0, z: -30 };
}

