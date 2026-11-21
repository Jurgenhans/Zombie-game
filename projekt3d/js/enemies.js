// Gegner: Zombie-Gruppe, Verhalten (Stehen / Verfolgen / Angreifen / Zurückgehen), Trefferlogik und Geschosse.

import * as THREE from 'three';
import { MAP_SIZE } from './config.js';
import { createZombieModel, ZOMBIE_TYPES, ZOMBIE_SCALE } from './zombies.js';

const AGGRO = 18;      // ab dieser Entfernung (m) bemerken sie den Spieler
const LOSE = 35;       // ab dieser Entfernung geben sie auf
const REACH = 1.5 * ZOMBIE_SCALE;     // so nah gehen sie heran
const HITS_TO_KILL = 2;   // Treffer, die ein Zombie aushält (egal mit welcher Waffe)
const RESPAWN = 20;    // Sekunden, bis ein besiegter Zombie wieder aufsteht (zum Testen)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => t * t * (3 - 2 * t);

let shadowTex = null;
function blobShadow() {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.position.y = 0.03;
  m.scale.setScalar(ZOMBIE_SCALE);
  return m;
}

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.shots = [];
  }

  // count Zombies als dichter Haufen, dessen Mitte `radius` m vom Startpunkt entfernt liegt
  // (dir = Richtung in rad; -PI/2 = nach Norden, also geradeaus vom Startpunkt aus gesehen).
  // Abwechselnd Schlurfer / Brocken.
  spawnHorde(center, count = 10, radius = 50, dir = -Math.PI / 2) {
    this.clear();
    const cx = center.x + Math.cos(dir) * radius, cz = center.z + Math.sin(dir) * radius;
    const kinds = ['walker', 'brute'];
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996, r = 1.35 * Math.sqrt(i);                    // Sonnenblumen-Muster: dicht, ohne Überlappung
      this._add(kinds[i % 2], cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.random() * Math.PI * 2);
    }
  }

  clear() {
    for (const z of this.list) this.scene.remove(z.holder);
    for (const s of this.shots) this.scene.remove(s.mesh);
    this.list = []; this.shots = [];
  }

  get aliveCount() { return this.list.filter((z) => z.state !== 'dead').length; }

  _add(kind, x, z, yaw) {
    const type = ZOMBIE_TYPES[kind];
    const model = createZombieModel(kind);
    const holder = new THREE.Group();
    holder.add(model.group, blobShadow());

    const mk = (color, order) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, fog: false, transparent: true }));
      s.renderOrder = order; s.position.set(0, type.height + 0.35, 0); s.visible = false; holder.add(s); return s;
    };
    const bg = mk(0x1a1410, 20), fill = mk(0xe0392b, 21);
    bg.scale.set(1, 0.13, 1);

    const e = { kind, type, holder, model, rig: model.rig, mats: model.mats, bg, fill,
      x, z, yaw, bx: x, bz: z, byaw: yaw, hp: HITS_TO_KILL, state: 'idle', phase: Math.random() * 6, flash: 0, deathT: 0, atkT: 0 };
    this.scene.add(holder);
    this.list.push(e);
    this._place(e);
  }

  _place(e) { e.holder.position.set(e.x, e.holder.position.y, e.z); e.holder.rotation.y = e.yaw; }

  _reset(e) {
    e.x = e.bx; e.z = e.bz; e.yaw = e.byaw; e.hp = HITS_TO_KILL; e.state = 'idle'; e.deathT = 0; e.flash = 0;
    e.model.group.rotation.x = 0; e.holder.position.y = 0;
    e.bg.visible = e.fill.visible = false;
    this._place(e);
  }

  // ---- Treffer ------------------------------------------------------------------
  hit(e, dmg, fromX, fromZ) {
    if (e.state === 'dead') return;
    e.hp -= 1;                                                          // jeder Treffer zählt gleich (HITS_TO_KILL)
    e.flash = 0.15;
    const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d) * 0.35; e.z += (dz / d) * 0.35;                    // kleiner Rückstoß
    if (e.hp <= 0) {
      e.hp = 0; e.state = 'dead'; e.deathT = 0;
      e.bg.visible = e.fill.visible = false;
      return;
    }
    if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
    const r = e.hp / HITS_TO_KILL;
    e.bg.visible = e.fill.visible = true;
    e.fill.scale.set(0.94 * r, 0.09, 1);
    e.fill.center.set(0.47 / (0.94 * r), 0.5);                         // linksbündig
  }

  // nächster lebender Zombie im Blickkegel (dx,dz = Blickrichtung, cosMin = Kegel)
  nearestInCone(px, pz, dx, dz, maxDist, cosMin) {
    let best = null, bd = maxDist;
    for (const e of this.list) {
      if (e.state === 'dead') continue;
      const vx = e.x - px, vz = e.z - pz, d = Math.hypot(vx, vz);
      if (d > bd || d < 0.01) continue;
      if ((vx * dx + vz * dz) / d < cosMin) continue;
      best = e; bd = d;
    }
    return best;
  }

  // Nahkampf: alle Zombies vor dem Spieler in Reichweite
  meleeHit({ x, z, dx, dz, range, damage }) {
    let n = 0;
    for (const e of this.list) {
      if (e.state === 'dead') continue;
      const vx = e.x - x, vz = e.z - z, d = Math.hypot(vx, vz);
      if (d > range + e.type.radius * 0.6) continue;
      if (d > 0.9 && (vx * dx + vz * dz) / d < 0.2) continue;          // ca. +-78 Grad vor dem Spieler
      this.hit(e, damage, x, z); n++;
    }
    return n;
  }

  // Fernkampf: Pfeil, Bolzen oder Zauberkugel fliegt geradeaus
  shoot({ x, y, z, dx, dz, speed, damage, kind }) {
    let mesh;
    if (kind === 'orb') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2aa8ff, emissiveIntensity: 2, flatShading: true }));
    } else {
      const len = kind === 'bolt' ? 0.45 : 0.75, steel = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.8, roughness: 0.3 });
      mesh = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 5), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 }));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), steel); tip.position.y = len / 2 + 0.05;
      mesh.add(shaft, tip);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz).normalize());
    }
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.shots.push({ mesh, x, y, z, dx, dz, speed, damage, life: 1.6, ox: x, oz: z });
  }

  // ---- Update -------------------------------------------------------------------
  update(dt, player) {
    for (const e of this.list) this._updateZombie(e, dt, player);
    // Zombies schieben sich auseinander
    for (let i = 0; i < this.list.length; i++) for (let j = i + 1; j < this.list.length; j++) {
      const a = this.list[i], b = this.list[j];
      if (a.state === 'dead' || b.state === 'dead') continue;
      const vx = b.x - a.x, vz = b.z - a.z, d = Math.hypot(vx, vz), min = 0.9 * ZOMBIE_SCALE;
      if (d > 0 && d < min) { const k = (min - d) / 2 / d; a.x -= vx * k; a.z -= vz * k; b.x += vx * k; b.z += vz * k; }
    }
    for (const e of this.list) { e.x = Math.min(MAP_SIZE - 1, Math.max(1, e.x)); e.z = Math.min(MAP_SIZE - 1, Math.max(1, e.z)); this._place(e); }
    this._updateShots(dt);
  }

  _walk(e, tx, tz, speed, dt) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d) * speed * dt; e.z += (dz / d) * speed * dt;
    e.yaw += wrap(Math.atan2(dx, dz) - e.yaw) * (1 - Math.exp(-dt * 6));
  }

  _updateZombie(e, dt, player) {
    const r = e.rig, t = e.type;
    // Trefferblitz
    if (e.flash > 0 || e._flashing) {
      e.flash = Math.max(0, e.flash - dt);
      const on = e.flash > 0;
      for (const m of e.mats) { m.emissive.setHex(on ? 0xff2a1a : m.userData.e0); m.emissiveIntensity = on ? 1.4 : m.userData.i0; }
      e._flashing = on;
    }

    if (e.state === 'dead') {
      e.deathT += dt;
      e.model.group.rotation.x = -ease(Math.min(1, e.deathT / 0.7)) * (Math.PI / 2);   // fällt nach hinten
      e.model.group.position.y = ease(Math.min(1, e.deathT / 0.7)) * 0.12;
      r.armL.rotation.x = -0.4; r.armR.rotation.x = -0.9; r.legL.rotation.x = 0.1; r.legR.rotation.x = -0.15;
      if (e.deathT > 12) e.holder.position.y = -(e.deathT - 12) * 0.12;             // versinkt
      if (e.deathT > RESPAWN) this._reset(e);
      return;
    }

    const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz);
    if ((e.state === 'idle' || e.state === 'return') && d < AGGRO) e.state = 'chase';
    else if ((e.state === 'chase' || e.state === 'attack') && d > LOSE) e.state = 'return';

    let moving = false;
    if (e.state === 'chase') {
      if (d > REACH) { this._walk(e, player.x, player.z, t.speed, dt); moving = true; } else e.state = 'attack';
    } else if (e.state === 'attack') {
      if (d > REACH + 0.6) e.state = 'chase';
      else { e.yaw += wrap(Math.atan2(dx, dz) - e.yaw) * (1 - Math.exp(-dt * 8)); e.atkT += dt; }
    } else if (e.state === 'return') {
      if (Math.hypot(e.bx - e.x, e.bz - e.z) < 0.8) e.state = 'idle';
      else { this._walk(e, e.bx, e.bz, t.speed * 0.8, dt); moving = true; }
    }

    // Animation (alles per Code)
    e.phase += dt * (moving ? t.speed * 4.2 : e.state === 'attack' ? 7 : 1.2);
    const p = e.phase;
    if (moving) {
      r.legL.rotation.x = Math.sin(p) * 0.55; r.legR.rotation.x = -Math.sin(p) * 0.55;
      r.armL.rotation.x = -1.35 + Math.sin(p * 0.5) * 0.12; r.armR.rotation.x = -1.25 - Math.sin(p * 0.5) * 0.12;
      r.body.rotation.x = t.lean + 0.1; r.body.rotation.z = Math.sin(p) * 0.05;
      r.body.position.y = r.baseY + Math.abs(Math.sin(p)) * 0.035;
      r.head.rotation.z = Math.sin(p * 0.5) * 0.12;
    } else if (e.state === 'attack') {
      r.legL.rotation.x = r.legR.rotation.x = 0;
      r.armL.rotation.x = -1.1 + Math.sin(p) * 0.6; r.armR.rotation.x = -1.1 - Math.sin(p) * 0.6;
      r.body.rotation.x = t.lean + 0.12 + Math.sin(p) * 0.06; r.body.rotation.z = 0; r.body.position.y = r.baseY;
    } else {
      r.legL.rotation.x = r.legR.rotation.x = 0;
      r.armL.rotation.x = -0.3 + Math.sin(p) * 0.08; r.armR.rotation.x = -0.25 - Math.sin(p * 0.9) * 0.08;
      r.body.rotation.x = t.lean; r.body.rotation.z = Math.sin(p * 0.5) * 0.04; r.body.position.y = r.baseY;
      r.head.rotation.z = Math.sin(p * 0.6) * 0.1;
    }
  }

  _updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const nx = s.x + s.dx * s.speed * dt, nz = s.z + s.dz * s.speed * dt;
      let hitZ = null;
      for (const e of this.list) {
        if (e.state === 'dead' || s.y > e.type.height) continue;
        // Abstand des Zombies zur Flugstrecke dieses Bildes
        const sx = nx - s.x, sz = nz - s.z, l2 = sx * sx + sz * sz || 1;
        const t = Math.min(1, Math.max(0, ((e.x - s.x) * sx + (e.z - s.z) * sz) / l2));
        if (Math.hypot(e.x - (s.x + sx * t), e.z - (s.z + sz * t)) < e.type.radius * 0.7) { hitZ = e; break; }
      }
      s.x = nx; s.z = nz; s.life -= dt;
      s.mesh.position.set(nx, s.y, nz);
      if (hitZ) this.hit(hitZ, s.damage, s.ox, s.oz);
      if (hitZ || s.life <= 0 || nx < 0 || nz < 0 || nx > MAP_SIZE || nz > MAP_SIZE) { this.scene.remove(s.mesh); this.shots.splice(i, 1); }
    }
  }
}
