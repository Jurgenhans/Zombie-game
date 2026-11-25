import { SFX, applyVolume, initAudio } from './audio.js';
import { saveSettings, settings } from './config.js';
import { $, clamp } from './core.js';
import { applyTime } from './environment.js';
import { input, joyReset, look } from './input.js';
import { applyRes, applyShader } from './shader.js';
import { S } from './state.js';


/* Tasten-Layout */
export const BTN_IDS = ['btnFire', 'btnJump', 'btnReload', 'btnSwap', 'btnSprint'];
export function applyLayout() {
  $('hud').style.setProperty('--bs', settings.btnScale / 100);
  for (const id of BTN_IDS) {
    const f = settings.layout[id], el = $(id); if (!f) continue;
    el.style.left = clamp(f.x * window.innerWidth, 0, window.innerWidth - 40) + 'px'; el.style.top = clamp(f.y * window.innerHeight, 0, window.innerHeight - 40) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
  }
}
window.addEventListener('resize', applyLayout);
export let drag = null;
for (const id of BTN_IDS) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { if (!S.editMode) return; drag = { id, pid: e.pointerId, dx: e.clientX - b.getBoundingClientRect().left, dy: e.clientY - b.getBoundingClientRect().top }; });
  b.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== id || drag.pid !== e.pointerId) return;
    const r = b.getBoundingClientRect(), x = clamp(e.clientX - drag.dx, 0, window.innerWidth - r.width), y = clamp(e.clientY - drag.dy, 0, window.innerHeight - r.height);
    b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto'; settings.layout[id] = { x: x / window.innerWidth, y: y / window.innerHeight };
  });
  const endDrag = () => { if (drag && drag.id === id) { drag = null; saveSettings(); } };
  b.addEventListener('pointerup', endDrag); b.addEventListener('pointercancel', endDrag);
}
export function resetLayout() {
  settings.layout = {}; settings.btnScale = 100; $('optBtnScale').value = 100;
  for (const id of BTN_IDS) { const el = $(id); el.style.left = el.style.top = el.style.right = el.style.bottom = ''; }
  applyLayout(); saveSettings();
}

/* Menü */
export function setPaused(p) { S.paused = p; if (p) { input.fire = false; input.jump = false; input.fireQueued = false; joyReset(); look.id = null; } }
export function openOptions() { setPaused(true); $('options').classList.remove('hidden'); }
export function closeOptions() { $('options').classList.add('hidden'); if (!S.editMode) setPaused(false); }
export function setEdit(on) {
  S.editMode = on; $('hud').classList.toggle('editing', on); $('editBar').classList.toggle('hidden', !on);
  if (on) { $('options').classList.add('hidden'); setPaused(true); } else setPaused(false);
}
$('btnOptions').addEventListener('click', openOptions);
$('btnCloseOptions').addEventListener('click', closeOptions);
$('btnEditLayout').addEventListener('click', () => setEdit(true));
$('btnEditDone').addEventListener('click', () => setEdit(false));
$('btnEditReset').addEventListener('click', resetLayout);
$('btnResetLayout').addEventListener('click', resetLayout);
document.querySelectorAll('#options .tabs button').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('#options .tabs button').forEach((x) => x.classList.toggle('on', x === t));
  document.querySelectorAll('#options .tab').forEach((x) => x.classList.toggle('hidden', x.id !== 'tab-' + t.dataset.tab));
}));
export function bindSeg(id, key, parse, onChange) {
  const seg = $(id), sync = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(b.dataset.val) === String(settings[key])));
  seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings[key] = parse(b.dataset.val); sync(); saveSettings(); onChange(); });
  sync();
}
bindSeg('optTime', 'night', (v) => v === 'true', applyTime);
bindSeg('optSound', 'sound', (v) => v === 'true', () => { initAudio(); applyVolume(); if (settings.sound) SFX.rClack(); });
bindSeg('optFps', 'fps', Number, () => {});
bindSeg('optShowFps', 'showFps', (v) => v === 'true', () => $('fpsBox').classList.toggle('hidden', !settings.showFps));
$('fpsBox').classList.toggle('hidden', !settings.showFps);
bindSeg('optRes', 'res', Number, applyRes);
bindSeg('optShader', 'shader', String, applyShader);
export function bindRange(id, key, onChange) { const el = $(id); el.value = settings[key]; el.addEventListener('input', () => { settings[key] = +el.value; saveSettings(); onChange && onChange(); }); }
$('optVolume').addEventListener('change', () => { initAudio(); applyVolume(); SFX.rClack(); }); // Hörprobe beim Loslassen
bindRange('optVolume', 'volume', applyVolume); bindRange('optBtnScale', 'btnScale', applyLayout); bindRange('optSens', 'sens'); bindRange('optGloss', 'gloss', applyShader);
export function applyAllSettings() { applyTime(); applyShader(); applyRes(); applyLayout(); applyVolume(); }

