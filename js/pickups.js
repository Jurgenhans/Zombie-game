import * as THREE from 'three';
import { SFX } from './audio.js';
import { CONFIG, WEAPONS } from './config.js';
import { $, lambert, rnd, rr, scene } from './core.js';
import { toast, updateHUD } from './hud.js';
import { HALF, MAP, addBox, boxes, groundH, interiorSpots } from './mapdata.js';
import { applyShaderTo } from './shader.js';
import { player } from './state.js';
import { randomSpawn, waves } from './zombies.js';
import { selectWeapon } from './weapons.js';

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
  updateVending();
  for (const p of pickups) {
    if (p.t > 0) { p.t -= dt; if (p.t <= 0) p.m.visible = true; continue; }
    p.m.rotation.y += dt * 2; p.m.position.y = 0.6 + Math.sin(performance.now() / 300 + p.x) * 0.08;
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 1.5) {
      if (p.ammo) { player.ammo.forEach((a, i) => { if (player.owned[i]) a.reserve += Math.ceil(WEAPONS[i].mag * 1.5); }); toast('MUNITION'); }
      else if (player.hp < CONFIG.playerMaxHp) { player.hp = Math.min(CONFIG.playerMaxHp, player.hp + 35); toast('+35 LEBEN'); } else continue;
      p.m.visible = false; p.t = 60; SFX.pickup(p.ammo); updateHUD();
    }
  }
}


/* ---------------- Gold-Automat & Minigun-Abwurf ---------------- */
let vend = null, gunDrop = null;
export function buildVending() {
  waves.onStart = (n) => { if (n === 5 && !player.owned[4]) dropMinigun(); }; // Minigun fällt zu Beginn von Welle 5
  if (vend) { scene.remove(vend.m); const k = boxes.indexOf(vend.box); if (k >= 0) boxes.splice(k, 1); vend = null; }
  let spot = null;
  for (const needWalk of [true, false]) { // erst Gehweg, sonst irgendein freier Platz nahe dem Start
    for (let r = 5; r < 40 && !spot; r += 2) for (let a = 0; a < 16 && !spot; a++) {
      const x = Math.sin(a * 0.39) * r, z = 8 + Math.cos(a * 0.39) * r;
      if (Math.abs(x) > HALF - 4 || Math.abs(z) > HALF - 4 || (needWalk && groundH(x, z) <= 0)) continue;
      if (!boxes.some((b) => x > b.x0 - 1.6 && x < b.x1 + 1.6 && z > b.z0 - 1.6 && z < b.z1 + 1.6)) spot = { x, z };
    }
    if (spot) break;
  }
  if (!spot) return;
  const m = new THREE.Group(), cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#10161c'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#ffd24a'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('MUNITION', 64, 40);
  g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.fillText('50 SCHUSS', 64, 84); g.fillText('= 50 GOLD', 64, 108);
  g.fillStyle = '#c9a227'; for (let i = 0; i < 6; i++) g.fillRect(14 + (i % 3) * 36, 140 + ((i / 3) | 0) * 40, 28, 28);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.95, 0.8), lambert(0x8a1c1c)); body.position.y = 0.975; m.add(body);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), new THREE.MeshBasicMaterial({ map: tex })); front.position.set(0, 1.05, 0.405); m.add(front);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.85), new THREE.MeshBasicMaterial({ color: 0xffd24a })); top.position.y = 2.03; m.add(top);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), lambert(0x111111)); slot.position.set(0, 0.2, 0.41); m.add(slot);
  m.position.set(spot.x, groundH(spot.x, spot.z), spot.z); m.rotation.y = Math.atan2(0 - spot.x, 8 - spot.z); scene.add(m); applyShaderTo(m);
  addBox(spot.x, spot.z, 1.1, 1.1, 2.1); vend = { m, x: spot.x, z: spot.z, box: boxes[boxes.length - 1] };
}
export function dropMinigun() {
  if (gunDrop) scene.remove(gunDrop.m);
  const p = randomSpawn(10, 22), m = new THREE.Group(), dark = lambert(0x2b2d31);
  m.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.6), dark));
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), dark); c.rotation.x = Math.PI / 2; c.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.55); m.add(c); }
  m.scale.setScalar(1.3); m.position.set(p.x, 0.7, p.z);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc933, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
  const root = new THREE.Group(); root.add(m, beam); beam.position.set(p.x - p.x, 7, 0); root.position.set(0, 0, 0); beam.position.set(p.x, 8, p.z);
  scene.add(root); gunDrop = { m: root, gun: m, x: p.x, z: p.z }; toast('MINIGUN IST GELANDET – GELBER LICHTSTRAHL!');
}
export function updateVending() {
  const btn = $('btnBuy');
  if (gunDrop) {
    gunDrop.gun.rotation.y += 0.03; gunDrop.gun.position.y = 0.7 + Math.sin(performance.now() / 300) * 0.1;
    if (Math.hypot(gunDrop.x - player.pos.x, gunDrop.z - player.pos.z) < 1.8) {
      scene.remove(gunDrop.m); gunDrop = null; player.owned[4] = true; player.ammo[4].mag = WEAPONS[4].mag; SFX.pickup(true); selectWeapon(4); toast('MINIGUN! 200 SCHUSS');
    }
  }
  const near = vend && Math.hypot(vend.x - player.pos.x, vend.z - player.pos.z) < 3;
  btn.classList.toggle('hidden', !near);
}
export function buyAmmo() {
  if (!vend || player.dead || Math.hypot(vend.x - player.pos.x, vend.z - player.pos.z) >= 3) return;
  if (player.gold < 50) { toast('NICHT GENUG GOLD (50 nötig)'); return; }
  player.gold -= 50; player.ammo[player.weapon].reserve += 50; SFX.pickup(true); toast('+50 SCHUSS · ' + WEAPONS[player.weapon].name); updateHUD();
}
export function clearDrops() { if (gunDrop) { scene.remove(gunDrop.m); gunDrop = null; } }
