import * as THREE from 'three';
import { initAudio } from './audio.js';
import { CONFIG, WEAPONS, settings } from './config.js';
import { $, camera, renderer, scene } from './core.js';
import { updateEffects } from './effects.js';
import { clearGore, updateGore } from './gore.js';
import { sky, stars } from './environment.js';
import { toast, updateHUD } from './hud.js';
import { input } from './input.js';
import { updateLamps } from './lamps.js';
import { MAPS, boxes, mapId } from './mapdata.js';
import { releaseZombie } from './models.js';
import { setPaused } from './options.js';
import { _o, rayBox, raySphere, resolveCircle, supportY } from './physics.js';
import { buildVending, clearDrops, spawnPickups, updatePickups } from './pickups.js';
import { S, player } from './state.js';
import { _d, animateGun, finishReload, flash, flashLight, selectWeapon, shoot, view, viewGuns } from './weapons.js';
import { loadMap } from './world.js';
import { alive, randomSpawn, spawnZombie, updateAudible, updateZombie, waves, zombies } from './zombies.js';

/* ---------------- Spielablauf ---------------- */

export const gameRunning = () => S.running && !player.dead && !S.paused;
export function resetGame() {
  zombies.forEach((z) => { scene.remove(z.root); releaseZombie(z); }); zombies.length = 0; clearGore();
  Object.assign(player, { hp: CONFIG.playerMaxHp, kills: 0, dead: false, vy: 0, reloading: false, fireCd: 0, yaw: 0, pitch: 0, recoilKick: 0, swapT: 0, gold: 0, lives: 0, inv: false, owned: [true, true, true, true, false] });
  player.pos.set(0, 0, 8); player.ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
  waves.n = 0; waves.active = false; waves.pause = 3; waves.queue = []; S.won = false; setPaused(false);
  $('goTitle').textContent = 'GAME OVER'; $('goTitle').classList.add('red'); $('goTitle').classList.remove('green');
  for (let i = 0; i < CONFIG.trainingZombies && !CONFIG.wavesEnabled; i++) { const p = randomSpawn(18, 60); spawnZombie(p.x, p.z); }
  clearDrops(); spawnPickups(); buildVending(); selectWeapon(0); viewGuns.forEach((g, k) => (g.visible = k === 0)); updateHUD();
}
export async function startGame(id) {
  id = id || mapId || 'big'; initAudio();
  if (id !== mapId) { $('loadText').textContent = 'Lade ' + MAPS[id].name + ' …'; $('loading').classList.remove('hidden'); await new Promise((r) => setTimeout(r, 40)); loadMap(id); $('loading').classList.add('hidden'); }
  $('startScreen').classList.add('hidden'); $('gameOver').classList.add('hidden'); $('hud').classList.remove('hidden');
  resetGame(); S.running = true;
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignorieren */ }
}
$('btnStartSmall').addEventListener('click', () => startGame('small'));
$('btnStartBig').addEventListener('click', () => startGame('big'));
$('btnRestart').addEventListener('click', () => startGame(mapId));
$('btnMenu').addEventListener('click', () => { S.running = false; setPaused(false); $('gameOver').classList.add('hidden'); $('hud').classList.add('hidden'); $('startScreen').classList.remove('hidden'); });

export let last = performance.now(), lastRender = 0, fpsN = 0, fpsT = performance.now();
export function frame(now) {
  requestAnimationFrame(frame);
  const minDt = 1000 / settings.fps, el = now - lastRender;
  if (el < minDt - 1) return;
  lastRender = now - (el % minDt);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (settings.showFps) { fpsN++; if (now - fpsT >= 500) { $('fpsBox').textContent = Math.round(fpsN * 1000 / (now - fpsT)) + ' FPS'; fpsN = 0; fpsT = now; } }
  if (S.running && !S.paused) update(dt);
  sky.position.copy(camera.position); stars.position.copy(camera.position); stars.rotation.y += dt * 0.003;
  updateEffects(dt); updateGore(dt);
  updateLamps(now / 1000, camera.position);
  renderer.render(scene, camera);
}
export function update(dt) {
  const k = input.keys;
  // Bewegung
  let mx = input.mx + ((k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)), mz = input.mz + ((k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0));
  const len = Math.hypot(mx, mz), mag = Math.min(1, len); if (len > 1) { mx /= len; mz /= len; }
  const sprint = (input.sprint || k.ShiftLeft || input.sprintAuto) && mz < 0.2 && mag > 0.3;
  const speed = (sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed) * (player.reloading ? 0.85 : 1) * mag;
  if (!player.dead) {
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const wx = (mx * cy + mz * sy), wz = (-mx * sy + mz * cy);
    const tvx = wx * speed, tvz = wz * speed, acc = player.onGround ? 14 : 4;
    player.vel.x += (tvx - player.vel.x) * Math.min(1, acc * dt); player.vel.z += (tvz - player.vel.z) * Math.min(1, acc * dt);
    player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt;
    resolveCircle(player.pos, CONFIG.playerRadius, player.pos.y, 0.35);
    if ((input.jump || k.Space) && player.onGround) { player.vy = CONFIG.jumpSpeed; player.onGround = false; }
    player.vy -= CONFIG.gravity * dt; player.pos.y += player.vy * dt;
    const ground = supportY(player.pos.x, player.pos.z, player.pos.y, CONFIG.playerRadius, 0.35);
    if (player.pos.y <= ground) { player.pos.y = ground; player.vy = 0; player.onGround = true; } else if (player.pos.y > ground + 0.05) player.onGround = false;
    const moving = Math.hypot(player.vel.x, player.vel.z); player.bob += moving * dt * (sprint ? 1.9 : 1.6) * (player.onGround ? 1 : 0);
    // Waffen
    player.fireCd -= dt; if (player.swapT > 0) player.swapT -= dt;
    const w = WEAPONS[player.weapon];
    if (player.reloading) { player.reloadT -= dt; if (player.reloadT <= 0) finishReload(); }
    if (input.fireQueued) { shoot(); input.fireQueued = false; }
    else if (input.fire && w.auto) shoot();
    else if (S.autoFire && aimingAtZombie(w.range)) shoot();
  } else { player.pos.y = Math.max(0, player.pos.y - dt); }
  // Kamera
  const ey = player.dead ? 0.4 : CONFIG.eyeHeight + Math.sin(player.bob * 2) * 0.035;
  camera.position.set(player.pos.x, player.pos.y + ey, player.pos.z);
  player.shake = Math.max(0, player.shake - dt * 4);
  camera.rotation.set(player.pitch + (Math.random() - 0.5) * player.shake * 0.02, player.yaw + (Math.random() - 0.5) * player.shake * 0.02, player.dead ? 0.8 : 0);
  if (S.bodyModel) S.bodyModel.position.set(player.pos.x, player.pos.y, player.pos.z);
  // Viewmodel
  player.recoilKick *= Math.max(0, 1 - dt * 14);
  const rl = player.reloading ? Math.sin(Math.min(1, 1 - player.reloadT / WEAPONS[player.weapon].reload) * Math.PI) : 0;
  const sw = player.swapT > 0 ? player.swapT / 0.25 : 0;
  view.position.set(0.2 + Math.sin(player.bob) * 0.012, -0.22 + Math.abs(Math.cos(player.bob)) * 0.01 - rl * 0.25 - sw * 0.3, -0.4 + player.recoilKick * 0.05);
  view.rotation.set(player.recoilKick * 0.05 + rl * 0.6, 0, rl * -0.2);
  animateGun(dt);
  if (player.flashT > 0) { player.flashT -= dt; if (player.flashT <= 0) { flash.visible = false; flashLight.intensity = 0; } }
  // Zombies
  updateAudible(dt);
  for (const z of zombies) updateZombie(z, dt);
  for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].gone) zombies.splice(i, 1);
  waves.update(dt); updatePickups(dt);
  $('remaining').textContent = alive() + (CONFIG.wavesEnabled ? waves.queue.length : 0);
  updateArrow();
}
// Auto-Feuer: schießt automatisch, sobald das Fadenkreuz auf einen (nicht verdeckten) Zombie zeigt

export function aimingAtZombie(range) {
  const cp = Math.cos(player.pitch), d = _d.set(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp);
  const o = new THREE.Vector3(player.pos.x, player.pos.y + CONFIG.eyeHeight, player.pos.z);
  let tz = Infinity;
  for (const z of zombies) {
    if (z.state === 'dead' || z.state === 'dying') continue;
    tz = Math.min(tz, raySphere(o, d, _o.set(z.pos.x, z.pos.y + z.headY, z.pos.z), 0.25));
    for (const yy of [0.35, 0.8, 1.25]) tz = Math.min(tz, raySphere(o, d, _o.set(z.pos.x, z.pos.y + yy, z.pos.z), 0.38));
  }
  if (tz > range) return false;
  for (const b of boxes) { const h = rayBox(o, d, b, tz); if (h && h.t < tz) return false; }
  return true;
}
$('btnAuto').addEventListener('click', () => { S.autoFire = !S.autoFire; $('btnAuto').classList.toggle('on', S.autoFire); toast(S.autoFire ? 'AUTO-FEUER AN' : 'AUTO-FEUER AUS'); });
// Richtungspfeil zum nächsten Zombie (nur bei weniger als 10 lebenden Zombies)
export function updateArrow() {
  const el = $('zArrow'); let best = null, bd = Infinity, n = 0;
  for (const z of zombies) { if (z.state === 'dead' || z.state === 'dying') continue; n++; const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z); if (d < bd) { bd = d; best = z; } }
  if (!best || n >= 10 || player.dead) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const dx = best.pos.x - player.pos.x, dz = best.pos.z - player.pos.z, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const right = dx * cy - dz * sy, fwd = -dx * sy - dz * cy; // Kamera blickt nach (-sin yaw, -cos yaw)
  $('zArrowIcon').style.transform = `rotate(${Math.atan2(right, fwd) * 180 / Math.PI}deg)`;
  $('zDist').textContent = Math.round(bd) + ' m';
}

