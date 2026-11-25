import { buildZombie, disposeZombie } from './zombiegen.js';
import { CONFIG } from './js/config.js';
import { $, camera, scene } from './js/core.js';
import { frame } from './js/flow.js';
import { PLAYER_SPEC, buildHumanoid, models, rigZombie, tryLoadModel } from './js/models.js';
import { applyAllSettings } from './js/options.js';
import { S, player } from './js/state.js';
import { selectWeapon } from './js/weapons.js';
import { spawnZombie, waves, zombies } from './js/zombies.js';

/* ---------------- Start ---------------- */
async function init() {
  $('loadText').textContent = 'Lade Modelle …';
  try { disposeZombie(buildZombie(0)); models.genOk = true; } catch (e) { console.warn('Zombie-Generator fehlgeschlagen, nutze Fallback:', e); models.genOk = false; }
  const [pm, ...zms] = await Promise.all([tryLoadModel(CONFIG.playerModelUrl), ...(models.genOk ? [] : CONFIG.zombieModelUrls.map((u) => tryLoadModel(u, rigZombie)))]);
  models.zombies = zms.filter(Boolean);
  S.bodyModel = pm || buildHumanoid(PLAYER_SPEC); S.bodyModel.visible = false; scene.add(S.bodyModel); // Spielerkörper (Ego-Perspektive: ausgeblendet)
  $('loading').classList.add('hidden');
  selectWeapon(0); applyAllSettings();
  // Menü-Hintergrund
  camera.position.set(0, 1.7, 8);
  requestAnimationFrame(frame);
}
init().catch((e) => { $('loadText').textContent = 'Fehler: ' + e.message; console.error(e); });
window.__game = { CONFIG, player, zombies, spawnZombie, waves };
