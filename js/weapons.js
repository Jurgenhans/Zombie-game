import * as THREE from 'three';
import { SFX } from './audio.js';
import { WEAPONS } from './config.js';
import { $, camera, lambert, rnd, rr } from './core.js';
import { addDecal, addTracer, emit } from './effects.js';
import { updateHUD } from './hud.js';
import { boxes } from './mapdata.js';
import { PLAYER_SPEC } from './models.js';
import { _o, rayBox, raySphere } from './physics.js';
import { player } from './state.js';
import { damageZombie, noise, zombies } from './zombies.js';

/* Viewmodel */
export const view = new THREE.Group(); camera.add(view);
export const viewGuns = [];
export const handSkin = lambert(PLAYER_SPEC.skin), sleeve = lambert(PLAYER_SPEC.top);
export const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
export const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), flashMat); flash.visible = false;
export const flashLight = new THREE.PointLight(0xffc070, 0, 12); flashLight.visible = true; camera.add(flashLight); flashLight.position.set(0.2, -0.1, -0.8);
export function buildViewGuns() {
  const metal = lambert(0x74777c), black = lambert(0x141416), wood = lambert(0x6a4a2c), red = new THREE.MeshBasicMaterial({ color: 0xff2a1a }), brass = lambert(0xb08a3a), cuff = lambert(0x24262a);
  WEAPONS.forEach((w, i) => {
    const g = new THREE.Group(), mm = lambert(w.color);
    const bx = (sx, sy, sz, x, y, z, m, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || mm); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
    const cy = (r, l, x, y, z, m, seg = 12) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2), m || black); c.position.set(x, y, z); g.add(c); return c; };
    const limb = (a, b, r0, r1, m) => { // Zylinder von a nach b
      const d = new THREE.Vector3().subVectors(b, a), l = d.length(), c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, l, 10), m);
      c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(c); return c;
    };
    const hand = (x, y, z, side) => { // Hand mit Fingern um den Griff + Daumen
      const h = new THREE.Group(); h.position.set(x, y, z);
      const add = (sx, sy, sz, px, py, pz, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), handSkin); b.position.set(px, py, pz); b.rotation.x = rx; h.add(b); };
      add(0.062, 0.05, 0.075, 0, 0, 0.01);                                      // Handballen/Rücken
      for (let k = 0; k < 4; k++) add(0.013, 0.02, 0.05, side * (-0.021 + k * 0.014) * -1, -0.03, -0.012, 0.25); // Finger
      add(0.018, 0.018, 0.05, -side * 0.034, 0.012, -0.03, -0.3);                // Daumen
      g.add(h); return h;
    };
    // --- Waffen
    let muz, rh, lh; // muz = Mündung, rh/lh = Handposition rechts/links
    if (i === 0) { // Pistole
      bx(0.045, 0.038, 0.23, 0, -0.012, -0.12); bx(0.05, 0.04, 0.27, 0, 0.026, -0.135, metal);
      for (let k = 0; k < 5; k++) bx(0.054, 0.034, 0.008, 0, 0.026, -0.03 - k * 0.014, black);        // Rillen
      cy(0.011, 0.03, 0, 0.026, -0.28); bx(0.008, 0.014, 0.01, 0, 0.052, -0.26, black); bx(0.03, 0.012, 0.01, 0, 0.052, -0.012, black);
      bx(0.042, 0.13, 0.055, 0, -0.095, -0.03, black, -0.22);                                          // Griff
      bx(0.01, 0.012, 0.075, 0, -0.04, -0.11, black); bx(0.01, 0.03, 0.01, 0, -0.03, -0.145, black); bx(0.012, 0.025, 0.012, 0, -0.03, -0.095, metal, 0.3); // Abzugsbügel/Abzug
      muz = -0.3; rh = [0.022, -0.085, -0.03]; lh = [-0.03, -0.095, -0.022];
    } else if (i === 1) { // MP
      bx(0.06, 0.07, 0.34, 0, 0, -0.18); bx(0.03, 0.012, 0.3, 0, 0.041, -0.2, black);
      bx(0.034, 0.03, 0.045, 0, 0.066, -0.17, black); bx(0.022, 0.02, 0.005, 0, 0.068, -0.195, red);       // Rotpunkt
      cy(0.026, 0.2, 0, 0.005, -0.44, mm); for (let k = 0; k < 4; k++) cy(0.0275, 0.012, 0, 0.005, -0.37 - k * 0.04, black);
      cy(0.011, 0.1, 0, 0.005, -0.59, black);
      bx(0.034, 0.17, 0.05, 0, -0.12, -0.24, black, 0.12); bx(0.045, 0.12, 0.055, 0, -0.09, -0.05, black, -0.25); bx(0.04, 0.09, 0.04, 0, -0.07, -0.41, black);
      bx(0.012, 0.012, 0.2, 0.022, 0.0, 0.1, metal); bx(0.012, 0.012, 0.2, -0.022, 0.0, 0.1, metal); bx(0.056, 0.075, 0.02, 0, 0, 0.2, black); // Drahtschulterstütze
      muz = -0.66; rh = [0.022, -0.085, -0.05]; lh = [0, -0.1, -0.41];
    } else if (i === 2) { // Sturmgewehr
      bx(0.06, 0.085, 0.3, 0, 0, -0.15); bx(0.072, 0.07, 0.3, 0, -0.005, -0.45); bx(0.03, 0.012, 0.58, 0, 0.044, -0.3, black);
      for (let k = 0; k < 5; k++) bx(0.076, 0.012, 0.014, 0, 0.0, -0.34 - k * 0.055, black);              // Lüftungsschlitze
      cy(0.011, 0.3, 0, 0.012, -0.75); cy(0.017, 0.07, 0, 0.012, -0.93); bx(0.008, 0.04, 0.008, 0, 0.068, -0.8, black); bx(0.04, 0.025, 0.01, 0, 0.062, -0.05, black);
      cy(0.022, 0.11, 0, 0.078, -0.22, black); cy(0.0235, 0.004, 0, 0.078, -0.275, red);                   // Visier
      bx(0.04, 0.1, 0.06, 0, -0.12, -0.27, black, 0.1); bx(0.04, 0.08, 0.06, 0, -0.205, -0.295, black, 0.35); // gebogenes Magazin
      bx(0.045, 0.12, 0.05, 0, -0.1, -0.05, black, -0.3); bx(0.045, 0.09, 0.25, 0, -0.015, 0.14, black);
      bx(0.05, 0.1, 0.02, 0, -0.015, 0.275, metal);
      muz = -0.97; rh = [0.022, -0.09, -0.055]; lh = [0, -0.07, -0.46];
    } else { // Schrotflinte
      bx(0.065, 0.09, 0.28, 0, 0, -0.1); cy(0.017, 0.62, 0, 0.026, -0.6); cy(0.014, 0.5, 0, -0.03, -0.54, metal); cy(0.02, 0.03, 0, -0.03, -0.8);
      bx(0.062, 0.05, 0.2, 0, -0.035, -0.46, wood); for (let k = 0; k < 4; k++) bx(0.066, 0.01, 0.008, 0, -0.035, -0.39 - k * 0.04, black);
      bx(0.008, 0.012, 0.008, 0, 0.049, -0.9, black); bx(0.05, 0.11, 0.32, 0, -0.03, 0.2, wood, 0.12); bx(0.046, 0.1, 0.05, 0, -0.095, -0.02, wood, -0.25);
      cy(0.01, 0.04, 0.034, 0.005, -0.08, red); cy(0.01, 0.012, 0.034, 0.005, -0.1, brass); cy(0.01, 0.04, 0.034, 0.005, -0.15, red);
      muz = -0.92; rh = [0.022, -0.09, -0.02]; lh = [0, -0.075, -0.46];
    }
    // --- Arme + Hände (Ärmel bis zum Handgelenk, Manschette)
    const R = hand(rh[0], rh[1], rh[2], 1), L = hand(lh[0], lh[1], lh[2], -1);
    const wr = (h, sx) => new THREE.Vector3(h.position.x + sx * 0.012, h.position.y - 0.012, h.position.z + 0.05);
    const rw = wr(R, 1), lw = wr(L, -1);
    limb(new THREE.Vector3(0.2, -0.32, 0.5), rw, 0.052, 0.04, sleeve); limb(rw.clone().add(new THREE.Vector3(0.004, 0.0, 0.03)), rw, 0.046, 0.041, cuff);
    limb(new THREE.Vector3(-0.24, -0.32, 0.5), lw, 0.052, 0.04, sleeve); limb(lw.clone().add(new THREE.Vector3(-0.004, 0.0, 0.03)), lw, 0.046, 0.041, cuff);
    g.visible = false; g.muzzle = new THREE.Vector3(0, 0.02, muz); view.add(g); viewGuns.push(g);
  });
  view.position.set(0.2, -0.22, -0.4); view.add(flash);
}
buildViewGuns();
export function selectWeapon(i) {
  if (i === player.weapon && viewGuns[i].visible) return;
  player.weapon = i; player.reloading = false; player.reloadT = 0; player.swapT = 0.25;
  viewGuns.forEach((g, k) => (g.visible = k === i));
  flash.position.copy(viewGuns[i].muzzle); flash.visible = false;
  updateHUD();
}
export const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3();

export function startReload() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  if (player.reloading || a.mag >= w.mag || a.reserve <= 0 || player.dead) return;
  player.reloading = true; player.reloadT = w.reload; playReloadSound(player.weapon, w.reload);
}
// Nachladegeräusch je Waffe, passend zur Nachladedauer (wird bei Waffenwechsel abgebrochen)
export let reloadSeq = 0;
export function playReloadSound(wi, dur) {
  const id = ++reloadSeq, S = SFX;
  const seqs = [
    [[0.04, S.rClick], [0.22, S.rOut], [0.3, S.rRustle], [0.55, S.rThunk], [0.62, S.rClick], [0.8, S.rScrape], [0.9, S.rClack]],                                  // Pistole
    [[0.04, S.rClick], [0.2, S.rOut], [0.35, S.rRustle], [0.58, S.rThunk], [0.66, S.rClick], [0.78, S.rScrape], [0.88, S.rClack]],                                // MP
    [[0.04, S.rClick], [0.18, S.rOut], [0.32, S.rRustle], [0.55, S.rThunk], [0.63, S.rClick], [0.74, S.rScrape], [0.82, S.rClack], [0.94, S.rClick]],             // Sturmgewehr
    [[0.08, S.rClick], [0.2, S.rShell], [0.34, S.rShell], [0.48, S.rShell], [0.62, S.rShell], [0.74, S.rScrape], [0.82, S.rClack], [0.9, S.rScrape], [0.96, S.rClack]], // Schrotflinte (Patronen + Pumpen)
  ];
  for (const [f, fn] of seqs[wi] || seqs[0]) setTimeout(() => { if (player.reloading && reloadSeq === id) fn(); }, f * dur * 1000);
}
export function finishReload() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon], n = Math.min(w.mag - a.mag, a.reserve);
  a.mag += n; a.reserve -= n; player.reloading = false; updateHUD();
}

export function shoot() {
  const w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  if (player.reloading || player.fireCd > 0 || player.dead || (player.swapT || 0) > 0) return;
  if (a.mag <= 0) { SFX.empty(); player.fireCd = 0.25; startReload(); return; }
  a.mag--; player.fireCd = w.rate; SFX.shot(w.snd);
  camera.getWorldDirection(_f); _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1);
  _w.copy(viewGuns[player.weapon].muzzle); viewGuns[player.weapon].localToWorld(_w);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  let hitAny = false, killAny = false;
  for (let p = 0; p < w.pellets; p++) {
    _d.copy(_f).addScaledVector(_r, rr(-1, 1) * w.spread).addScaledVector(_u, rr(-1, 1) * w.spread).normalize();
    // Welt
    let tWorld = w.range, wn = null;
    for (const b of boxes) { const h = rayBox(origin, _d, b, tWorld); if (h && h.t < tWorld) { tWorld = h.t; wn = h; } }
    if (_d.y < 0) { const tg = -origin.y / _d.y; if (tg > 0 && tg < tWorld) { tWorld = tg; wn = { nx: 0, ny: 1, nz: 0 }; } }
    // Zombies
    let best = null, tBest = tWorld, head = false;
    for (const z of zombies) {
      if (z.state === 'dead' || z.state === 'dying') continue;
      const hc = _o.set(z.pos.x, z.pos.y + z.headY, z.pos.z); const th = raySphere(origin, _d, hc, 0.25);
      if (th < tBest) { tBest = th; best = z; head = true; }
      for (const yy of [0.35, 0.8, 1.25]) { const tb = raySphere(origin, _d, _o.set(z.pos.x, z.pos.y + yy, z.pos.z), 0.38); if (tb < tBest) { tBest = tb; best = z; head = false; } }
    }
    const end = new THREE.Vector3().copy(origin).addScaledVector(_d, tBest);
    if (p < 3) addTracer(_w, end);
    if (best) {
      hitAny = true; const dmg = w.dmg * (head ? 2.5 : 1) * (1 - Math.min(0.5, tBest / (w.range * 2)));
      if (damageZombie(best, dmg, head, _d, end)) killAny = true;
    } else if (wn) {
      const n = new THREE.Vector3(wn.nx || 0, wn.ny || 0, wn.nz || 0);
      addDecal(end, n); emit(end, 3, 'spark', 2.5, 0.03, 9, n); emit(end, 2, 'dust', 1.2, 0.08, 1, n);
    }
  }
  noise(player.pos, 60);
  if (hitAny) { const hm = $('hitmark'); hm.className = 'on' + (killAny ? ' kill' : ''); clearTimeout(hm._t); hm._t = setTimeout(() => (hm.className = ''), 90); }
  // Rückstoß & Mündungsfeuer
  player.recoilKick += w.recoil * 30; player.pitch += w.recoil * (0.4 + rnd() * 0.5); player.yaw += rr(-1, 1) * w.recoil * 0.3; player.shake = Math.min(1, player.shake + w.recoil * 6);
  flash.visible = true; flash.rotation.z = rnd() * 6; flash.scale.setScalar(w.pellets > 1 ? 1.8 : 1 + rnd() * 0.5); flashLight.intensity = 22; player.flashT = 0.05;
  if (a.mag === 0 && a.reserve > 0) setTimeout(startReload, 250);
  updateHUD();
}

