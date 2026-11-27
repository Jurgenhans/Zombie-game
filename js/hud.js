import { SFX } from './audio.js';
import { CONFIG, WEAPONS } from './config.js';
import { $ } from './core.js';
import { player } from './state.js';
import { alive, waves } from './zombies.js';

/* ---------------- HUD ---------------- */
export function updateHUD() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  $('hpfill').style.width = Math.max(0, player.hp / CONFIG.playerMaxHp * 100) + '%'; $('hptext').textContent = Math.max(0, Math.ceil(player.hp));
  $('wave').textContent = CONFIG.wavesEnabled ? (waves.n || 1) + '/' + CONFIG.maxWave : '–';
  $('remaining').textContent = alive() + (CONFIG.wavesEnabled ? waves.queue.length : 0);
  $('kills').textContent = player.kills; $('gold').textContent = player.gold;
  $('wname').textContent = w.name; $('mag').textContent = a.mag; $('reserve').textContent = a.reserve;
  $('ammo').classList.toggle('low', a.mag <= Math.ceil(w.mag * 0.25));
  $('slots').innerHTML = WEAPONS.map((_, i) => (player.owned[i] ? `<i class="${i === player.weapon ? 'on' : ''}"></i>` : '')).join('');
}
export let toastT = 0;
export function toast(t) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => (el.style.opacity = 0), 1400); }
export function hurtPlayer(d) {
  if (player.dead) return;
  player.hp -= d; SFX.pain(); player.shake = 1;
  const el = $('damage'); el.style.opacity = 1; setTimeout(() => (el.style.opacity = 0), 150);
  if (player.hp <= 0) { player.hp = 0; player.dead = true; setTimeout(() => { $('goKills').textContent = player.kills; $('goWave').textContent = CONFIG.wavesEnabled ? waves.n : '–'; $('gameOver').classList.remove('hidden'); }, 1200); }
  updateHUD();
}

