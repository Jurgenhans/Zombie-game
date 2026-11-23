// Grafik-Einstellungen: Sichtweite (Meter) und Objekt-Limit (nur die nächsten N Objekte
// werden gezeichnet). Wird im Browser gespeichert und gilt für alle Spielstände.

export const GFX_KEY = 'projekt3d_grafik_v1';
export const VIEW_MIN = 200, VIEW_MAX = 2200, VIEW_STEP = 100;
export const OBJ_MIN = 500, OBJ_MAX = 10000, OBJ_STEP = 500;   // OBJ_MAX = unbegrenzt (0)

export const PRESETS = {
  low:    { label: 'Niedrig', view: 400,  objects: 1000 },
  medium: { label: 'Mittel',  view: 900,  objects: 2000 },
  high:   { label: 'Hoch',    view: 1500, objects: 5000 },
  ultra:  { label: 'Maximal', view: 2200, objects: 0 },
};
export const DEFAULT_GFX = { view: 1500, objects: 0 };   // wie bisher: alles zeichnen

export function clampGfx(g) {
  const view = Math.round(Math.min(VIEW_MAX, Math.max(VIEW_MIN, Number(g?.view) || DEFAULT_GFX.view)) / VIEW_STEP) * VIEW_STEP;
  let objects = Number(g?.objects);
  if (!Number.isFinite(objects) || objects >= OBJ_MAX) objects = 0;
  else if (objects > 0) objects = Math.max(OBJ_MIN, Math.round(objects / OBJ_STEP) * OBJ_STEP);
  return { view, objects };
}

export function loadGfx() {
  try { return clampGfx(JSON.parse(localStorage.getItem(GFX_KEY))); } catch { return { ...DEFAULT_GFX }; }
}
export function saveGfx(g) {
  try { localStorage.setItem(GFX_KEY, JSON.stringify(g)); } catch { /* ignorieren */ }
}
