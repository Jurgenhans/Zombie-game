import * as THREE from 'three';
import { SFX } from './audio.js';
import { CONFIG, WEAPONS } from './config.js';
import { lambert, rnd, rr, scene } from './core.js';
import { toast, updateHUD } from './hud.js';
import { HALF, MAP, interiorSpots } from './mapdata.js';
import { applyShaderTo } from './shader.js';
import { player } from './state.js';
import { randomSpawn } from './zombies.js';

/* ---------------- Pickups ---------------- */
export const pickups = [];
export function spawnPickups() {
  pickups.forEach((p) => scene.remove(p.m)); pickups.length = 0;
  const ammoM = lambert(0xc9a227), medM = lambert(0xdddddd), red = lambert(0xcc2222);
  for (let i = 0; i < Math.max(6, Math.round(16 * (MAP.size / 250) ** 2)); i++) {
    const sp = i < 6 && interiorSpots.length ? interiorSpots[(i * 7 + (rnd() * 3 | 0)) % interiorSpots.length] : null;
    const p = sp ? { x: sp.x + rr(-0.6, 0.6), z: sp.z + rr(-0.6, 0.6) } : randomSpawn(8, Math.min(110, HALF - 10)); const ammo = i % 3 !== 0;
    const m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.28), ammo ? ammoM : medM); m.add(b);
    if (!ammo) { const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.3), red), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.3), red); m.add(c1, c2); }
    m.position.set(p.x, 0.6, p.z); scene.add(m); applyShaderTo(m); pickups.push({ m, ammo, t: 0, x: p.x, z: p.z });
  }
}
export function updatePickups(dt) {
  for (const p of pickups) {
    if (p.t > 0) { p.t -= dt; if (p.t <= 0) p.m.visible = true; continue; }
    p.m.rotation.y += dt * 2; p.m.position.y = 0.6 + Math.sin(performance.now() / 300 + p.x) * 0.08;
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 1.5) {
      if (p.ammo) { player.ammo.forEach((a, i) => (a.reserve += Math.ceil(WEAPONS[i].mag * 1.5))); toast('MUNITION'); }
      else if (player.hp < CONFIG.playerMaxHp) { player.hp = Math.min(CONFIG.playerMaxHp, player.hp + 35); toast('+35 LEBEN'); } else continue;
      p.m.visible = false; p.t = 60; SFX.pickup(p.ammo); updateHUD();
    }
  }
}

