// Ablauf: Ladebildschirm -> Hauptmenü -> (Neues Spiel -> Sicherheitsfrage -> Charakterwahl) -> Spiel
//                                   \-> (Spiel laden) -----------------------------------> Spiel

import * as THREE from 'three';
import {
  CHARACTERS, FIELD_SIZE, MAP_SIZE, BIOME, BIOME_NAMES, BIOME_SHARE,
} from './config.js';
import { generateFieldBiomes, buildSplat, countBiomes, findSpawnField, fieldCenter, fieldNumber, fieldRowCol } from './mapgen.js';
import { loadAssets } from './characters.js';
import { Game } from './game.js';
import { CharacterSelect } from './select.js';
import { MapView } from './minimap.js';
import { loadSave, writeSave } from './save.js';
import { TouchControls, initSlots, isTouchDevice } from './touch.js';
import { Inventory } from './inventory.js';
import { InventoryUI } from './inventory-ui.js';

window.__started = true;
const $ = (id) => document.getElementById(id);

// ---------- Hilfsfunktionen für Bildschirme ----------------------------------------
const screens = ['loading', 'mainMenu', 'confirm', 'charSelect', 'bigMap', 'inventory', 'pause', 'errorBox'];
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');
function showOnly(...ids) { screens.forEach((s) => (ids.includes(s) ? show(s) : hide(s))); }

function fatal(err) {
  console.error(err);
  $('errorText').textContent = String(err && err.message ? err.message : err);
  show('errorBox');
}
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

let toastTimer = 0;
function toast(msg) {
  const t = $('hudToast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

// ---------- Setup ------------------------------------------------------------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const biomes = generateFieldBiomes();
const splat = buildSplat(biomes);
const counts = countBiomes(biomes);
$('cntGrass').textContent = `${counts[BIOME.GRASS]} Felder (${BIOME_SHARE.grass} %)`;
$('cntRock').textContent = `${counts[BIOME.ROCK]} Felder (${BIOME_SHARE.rock} %)`;
$('cntSnow').textContent = `${counts[BIOME.SNOW]} Felder (${BIOME_SHARE.snow} %)`;

const mapView = new MapView(splat);
const game = new Game(renderer, biomes, splat);

// Menühintergrund kreist um die Schneefelder, dort treffen alle drei Böden aufeinander
{
  const snow = biomes.map((b, i) => (b === BIOME.SNOW ? i : -1)).filter((i) => i >= 0);
  const cx = snow.reduce((a, i) => a + fieldCenter(i).x, 0) / snow.length;
  const cz = snow.reduce((a, i) => a + fieldCenter(i).z, 0) / snow.length;
  game.setBackdropCenter(cx, cz);
}

// Inventar + Ausrüstung
const inventory = new Inventory();
game.inventory = inventory;
let invOpen = false;
function refreshEquipment() {
  game.applyEquipment();
  $('btnAttack').textContent = inventory.equip.weapon ? '🗡️' : '👊';
}
const invUI = new InventoryUI(inventory, () => { refreshEquipment(); if (state === 'game') saveNow(false); });

// Android / Touch: Joystick, Kamera-Wischen, Slot-Leisten
const touchMode = isTouchDevice();
document.body.classList.toggle('touch', touchMode);
if (touchMode) { new TouchControls(game, canvas); initSlots(); }

let select = null;
let state = 'loading'; // loading | menu | select | game
let paused = false;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  game.resize(w, h);
  select?.resize();
  if (state === 'game') fitMaps();
}
window.addEventListener('resize', resize);

// ---------- Hauptmenü --------------------------------------------------------------
function refreshMenu() {
  const save = loadSave();
  $('btnLoad').disabled = !save;
  $('loadHint').textContent = save
    ? `Gespeichert: ${CHARACTERS.find((c) => c.id === save.characterId)?.name ?? save.characterId}, Feld ${fieldNumber(save.activeField ?? 0)}`
    : 'Kein Spielstand vorhanden.';
}

function toMainMenu() {
  if (state === 'game') saveNow(false);
  game.stopPlay();
  state = 'menu';
  paused = false;
  invOpen = false;
  hide('hud');
  refreshMenu();
  showOnly('mainMenu');
}

$('btnNew').onclick = () => {
  $('confirmWarn').classList.toggle('hidden', !loadSave());
  showOnly('mainMenu', 'confirm');
};
$('btnConfirmNo').onclick = () => showOnly('mainMenu');
$('btnConfirmYes').onclick = () => {
  state = 'select';
  select.enter(0);
  showOnly('charSelect');
};

$('btnLoad').onclick = () => {
  const save = loadSave();
  if (!save) return;
  startGame({
    characterId: CHARACTERS.some((c) => c.id === save.characterId) ? save.characterId : CHARACTERS[0].id,
    x: save.x, z: save.z, yaw: save.yaw ?? 0, activeField: save.activeField, inventory: save.inventory,
  });
};

// ---------- Charakterwahl ----------------------------------------------------------
function updateCharInfo(def, i) {
  $('charName').textContent = def.name;
  $('charDesc').textContent = def.desc;
  $('charCount').textContent = `${i + 1} / ${CHARACTERS.length}`;
}
$('btnPrev').onclick = () => select.prev();
$('btnNext').onclick = () => select.next();
$('btnSelectBack').onclick = () => { state = 'menu'; refreshMenu(); showOnly('mainMenu'); };
$('btnSelectStart').onclick = () => {
  const spawn = fieldCenter(findSpawnField(biomes));
  const data = { characterId: select.selected.id, x: spawn.x, z: spawn.z, yaw: Math.PI };
  startGame(data);
  saveNow(false);
};
canvas.addEventListener('click', (e) => { if (state === 'select') select.pick(e.clientX, e.clientY); });

// ---------- Spiel ------------------------------------------------------------------
function startGame(data) {
  inventory.load(data.inventory);   // ohne Daten: Startinventar mit Testschwert
  invUI.clearSelection();
  game.startPlay(data);
  refreshEquipment();
  state = 'game';
  paused = false;
  showOnly();
  show('hud');
  fitMaps();
  miniTimer = 0;
  autosaveTimer = 0;
}

function saveNow(notify = true) {
  const ok = writeSave(game.saveData());
  if (notify) toast(ok ? 'Spiel gespeichert' : 'Speichern nicht möglich (Browser blockiert Speicher)');
}

// Minimap + große Karte
const mini = $('miniMap');
const big = $('bigMapCanvas');
let miniTimer = 0, autosaveTimer = 0, hudTimer = 0;
let bigOpen = false, hoverField = -1, selectedField = -1;

function fitMaps() {
  const miniSize = touchMode
    ? Math.round(Math.min(130, Math.max(90, window.innerHeight * 0.26)))
    : Math.round(Math.min(230, Math.max(150, window.innerWidth * 0.22)));
  document.documentElement.style.setProperty('--mini', miniSize + 'px');
  MapView.fit(mini, miniSize);
  const bigSize = Math.floor(Math.min(window.innerHeight * 0.78, window.innerWidth * 0.9, 820));
  MapView.fit(big, Math.max(260, bigSize));
  drawMaps();
}

function drawMaps() {
  const p = { x: game.player.x, z: game.player.z, yaw: game.player.yaw };
  mapView.draw(mini, { player: p, activeField: game.activeField });
  if (bigOpen) mapView.draw(big, { player: p, activeField: game.activeField, hoverField, selectedField });
}

function openInventory() {
  if (state !== 'game' || paused) return;
  invOpen = true;
  paused = game.paused = true;
  invUI.open();
  showOnly('inventory');
}
function closeInventory() {
  invOpen = false;
  paused = game.paused = false;
  showOnly();
}
$('btnInv').onclick = () => { if (invOpen) closeInventory(); else openInventory(); };
$('btnInvClose').onclick = closeInventory;
$('btnAttack').addEventListener('pointerdown', (e) => { e.preventDefault(); game.attack(); });

function openBigMap() {
  if (state !== 'game') return;
  bigOpen = true;
  paused = game.paused = true;
  selectedField = game.currentField;
  updateFieldInfo();
  showOnly('bigMap');
  fitMaps();
}
function closeBigMap() {
  bigOpen = false;
  paused = game.paused = false;
  showOnly();
}

function updateFieldInfo() {
  const info = $('fieldInfo');
  if (selectedField < 0) {
    info.innerHTML = '<div class="fi-title">Feld wählen</div><div class="fi-sub">Klicke auf ein Feld der Karte.</div>';
    $('btnGoField').disabled = true;
    return;
  }
  const c = fieldCenter(selectedField);
  const { row, col } = fieldRowCol(selectedField);
  const tags = [];
  if (selectedField === game.activeField) tags.push('aktives Feld');
  if (selectedField === game.currentField) tags.push('hier stehst du');
  info.innerHTML =
    `<div class="fi-title">Feld ${fieldNumber(selectedField)}</div>` +
    `<div class="fi-sub">${BIOME_NAMES[biomes[selectedField]]} · Reihe ${row + 1}, Spalte ${col + 1}</div>` +
    `<div class="fi-sub dim">Mitte: x ${c.x} m, z ${c.z} m</div>` +
    (tags.length ? `<div class="fi-tag">${tags.join(' · ')}</div>` : '');
  $('btnGoField').disabled = false;
}

function goToSelectedField() {
  if (selectedField < 0) return;
  game.teleportToField(selectedField);
  closeBigMap();
  drawMaps();
  toast(`Feld ${fieldNumber(selectedField)} ist jetzt aktiv`);
  saveNow(false);
}

mini.addEventListener('click', openBigMap);
$('btnMapClose').onclick = closeBigMap;
$('btnGoField').onclick = goToSelectedField;
big.addEventListener('mousemove', (e) => {
  const f = MapView.fieldAt(big, e.clientX, e.clientY);
  if (f !== hoverField) { hoverField = f; drawMaps(); }
});
big.addEventListener('mouseleave', () => { hoverField = -1; drawMaps(); });
big.addEventListener('click', (e) => {
  const f = MapView.fieldAt(big, e.clientX, e.clientY);
  if (f >= 0) { selectedField = f; updateFieldInfo(); drawMaps(); }
});
big.addEventListener('dblclick', (e) => {
  const f = MapView.fieldAt(big, e.clientX, e.clientY);
  if (f >= 0) { selectedField = f; goToSelectedField(); }
});

// Pause
function openPause() { paused = game.paused = true; showOnly('pause'); }
function closePause() { paused = game.paused = false; showOnly(); }
$('btnResume').onclick = closePause;
$('btnSave').onclick = () => saveNow(true);
$('btnToMenu').onclick = toMainMenu;
$('btnPauseTouch').onclick = () => { if (state === 'game' && !paused) openPause(); };
$('btnGridTouch').onclick = () => {
  if (state !== 'game' || paused) return;
  game.toggleGrid();
  toast(game.terrain.gridOn ? 'Feldgitter an' : 'Feldgitter aus');
};
// Vollbild (Android): blendet die Browserleiste aus und sperrt das Querformat
document.querySelectorAll('.js-fs').forEach((b) => {
  b.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen(); await screen.orientation?.lock?.('landscape'); }
    } catch (e) { /* nicht unterstützt */ }
  };
});

// Tastatur
window.addEventListener('keydown', (e) => {
  if (state === 'select') {
    if (e.code === 'ArrowLeft') select.prev();
    else if (e.code === 'ArrowRight') select.next();
    else if (e.code === 'Enter') $('btnSelectStart').click();
    else if (e.code === 'Escape') $('btnSelectBack').click();
    return;
  }
  if (state === 'menu' && e.code === 'Escape' && !$('confirm').classList.contains('hidden')) { $('btnConfirmNo').click(); return; }
  if (state !== 'game') return;
  if (e.code === 'Escape') {
    if (bigOpen) closeBigMap();
    else if (invOpen) closeInventory();
    else if (paused) closePause();
    else openPause();
  } else if (e.code === 'KeyM') {
    if (bigOpen) closeBigMap(); else if (!paused) openBigMap();
  } else if (e.code === 'KeyI') {
    if (invOpen) closeInventory(); else openInventory();
  } else if (e.code === 'KeyF' && !paused && !e.repeat) {
    game.attack();
  } else if (e.code === 'KeyG' && !paused) {
    game.toggleGrid();
    toast(game.terrain.gridOn ? 'Feldgitter an' : 'Feldgitter aus');
  }
});

window.addEventListener('beforeunload', () => { if (state === 'game') saveNow(false); });

// ---------- HUD --------------------------------------------------------------------
function updateHud(dt) {
  hudTimer -= dt; miniTimer -= dt; autosaveTimer += dt;
  if (hudTimer <= 0) {
    hudTimer = 0.15;
    $('hudField').textContent = `Feld ${game.currentFieldNumber}`;
    $('hudBiome').textContent = game.currentBiomeName + (game.currentField === game.activeField ? ' · aktives Feld' : '');
    $('hudPos').textContent = `x ${Math.round(game.player.x)}  z ${Math.round(game.player.z)}`;
  }
  if (miniTimer <= 0) { miniTimer = 0.1; drawMaps(); }
  if (autosaveTimer > 20) { autosaveTimer = 0; saveNow(false); }
}

// ---------- Start ------------------------------------------------------------------
async function init() {
  resize();
  const clock = new THREE.Clock();
  (function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (state === 'select') {
      select.update(dt);
      select.render();
    } else {
      game.update(dt);
      game.render();
      if (state === 'game') updateHud(dt);
    }
    requestAnimationFrame(frame);
  })();

  await loadAssets((p) => {
    $('loadingBar').style.width = `${Math.round(p * 100)}%`;
  });
  select = new CharacterSelect(renderer);
  select.onChange = updateCharInfo;
  select.resize();

  state = 'menu';
  refreshMenu();
  showOnly('mainMenu');
}

init().catch(fatal);

// Zum Testen / Weiterbauen in der Browser-Konsole erreichbar
window.__game = { game, biomes, counts, mapView };
