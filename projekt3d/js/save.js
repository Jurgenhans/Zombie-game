// Spielstand im Browser (localStorage). Ein Slot.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.characterId !== 'string' || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return null;
    return d;
  } catch { return null; }
}

export function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() })); return true; }
  catch { return false; }
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignorieren */ }
}
