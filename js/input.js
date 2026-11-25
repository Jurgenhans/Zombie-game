import { CONFIG, WEAPONS, settings } from './config.js';
import { $, canvas, clamp } from './core.js';
import { gameRunning } from './flow.js';
import { S, player } from './state.js';
import { selectWeapon, startReload } from './weapons.js';

/* ---------------- Input ---------------- */
export const input = { mx: 0, mz: 0, fire: false, fireQueued: false, sprint: false, jump: false, keys: {} };
export const joy = { id: null, cx: 0, cy: 0 };
export const look = { id: null, x: 0, y: 0 };
export const joyBase = $('joyBase'), joyKnob = $('joyKnob');
export function lookDelta(dx, dy) { const k = CONFIG.lookSensitivity * settings.sens / 100; player.yaw -= dx * k; player.pitch = clamp(player.pitch - dy * k, -1.45, 1.45); }
export function joyUpdate(x, y) {
  let dx = x - joy.cx, dy = y - joy.cy; const R = 60, d = Math.hypot(dx, dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  input.mx = dx / R; input.mz = dy / R; // mz>0 = rückwärts
  if (d > R * 1.1) input.sprintAuto = true; else input.sprintAuto = false;
}
export function joyReset() { joy.id = null; input.mx = input.mz = 0; input.sprintAuto = false; joyKnob.style.transform = 'translate(0,0)'; joyBase.classList.add('idle'); joyBase.style.left = joyBase.style.top = joyBase.style.bottom = ''; }
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('.btn')) return;
  if (!gameRunning() || e.pointerType === 'mouse') return;
  if (e.clientX < window.innerWidth * 0.4 && joy.id === null) {
    joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joyBase.classList.remove('idle'); joyBase.style.left = (joy.cx - 75) + 'px'; joyBase.style.top = (joy.cy - 75) + 'px'; joyBase.style.bottom = 'auto'; joyUpdate(e.clientX, e.clientY);
  } else if (e.clientX >= window.innerWidth * 0.4 && look.id === null && e.pointerType !== 'mouse') {
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
  }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) joyUpdate(e.clientX, e.clientY);
  else if (e.pointerId === look.id) { lookDelta(e.clientX - look.x, e.clientY - look.y); look.x = e.clientX; look.y = e.clientY; }
  else if (e.pointerId === fireBtnPointer) { lookDelta(e.clientX - fbx, e.clientY - fby); fbx = e.clientX; fby = e.clientY; }
});
export const up = (e) => { if (e.pointerId === joy.id) joyReset(); if (e.pointerId === look.id) look.id = null; };
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
export let fireBtnPointer = null, fbx = 0, fby = 0;
export function bindBtn(id, down, upfn) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (S.editMode) return; b.classList.add('down'); down(e); });
  const end = (e) => { b.classList.remove('down'); if (upfn && !S.editMode) upfn(e); };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
}
bindBtn('btnFire', (e) => { input.fire = true; input.fireQueued = true; fireBtnPointer = e.pointerId; fbx = e.clientX; fby = e.clientY; }, () => { input.fire = false; fireBtnPointer = null; });
bindBtn('btnJump', () => { input.jump = true; }, () => { input.jump = false; });
bindBtn('btnReload', () => startReload());
bindBtn('btnSwap', () => selectWeapon((player.weapon + 1) % WEAPONS.length));
bindBtn('btnSprint', () => { input.sprint = !input.sprint; $('btnSprint').classList.toggle('on', input.sprint); });
// Desktop
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyR') startReload(); if (e.code === 'KeyQ') selectWeapon((player.weapon + 1) % WEAPONS.length);
  if (e.code >= 'Digit1' && e.code <= 'Digit4') selectWeapon(+e.code.slice(5) - 1);
});
window.addEventListener('keyup', (e) => (input.keys[e.code] = false));
canvas.addEventListener('mousedown', (e) => { if (!gameRunning()) return; if (document.pointerLockElement !== canvas) { canvas.requestPointerLock && canvas.requestPointerLock(); return; } input.fire = true; input.fireQueued = true; });
window.addEventListener('mouseup', () => { if (!fireBtnPointer) input.fire = false; });
window.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) lookDelta(e.movementX, e.movementY); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

