import * as THREE from 'three';
import { SFX } from './audio.js';
import { WEAPONS } from './config.js';
import { $, camera, lambert, rnd, rr } from './core.js';
import { addDecal, addTracer, emit } from './effects.js';
import { updateHUD } from './hud.js';
import { boxes } from './mapdata.js';
import { gunMats, buildGunBody } from './gunmodels.js';
import { PLAYER_SPEC } from './models.js';
import { gunMat } from './props.js';
import { _o, rayBox, raySphere } from './physics.js';
import { player } from './state.js';
import { damageZombie, noise, preciseHit, zombies } from './zombies.js';

/* Viewmodel */
export const view = new THREE.Group(); camera.add(view);
export const viewGuns = [];
export const handSkin = lambert(PLAYER_SPEC.skin), sleeve = lambert(PLAYER_SPEC.top);
export const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
export const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), flashMat); flash.visible = false;
export const flashLight = new THREE.PointLight(0xffc070, 0, 12); flashLight.visible = true; camera.add(flashLight); flashLight.position.set(0.2, -0.1, -0.8);
export function buildViewGuns() {
  const M = gunMats(gunMat), glove = lambert(0x2a2c30), cuff = lambert(0x1c1d20), jacket = lambert(0x3b4237); // Armel: dunkles Olivgruen
  const VOFF = [[-0.03, 0.01, 0.0], [-0.05, 0.015, 0.2], [-0.06, 0.01, 0.3], [-0.06, 0.01, 0.3]]; // Waffe nach hinten/vorn verschieben, damit Schaft nicht in die Kamera ragt
  WEAPONS.forEach((w, i) => {
    const g = new THREE.Group(), B = buildGunBody(i, M); g.add(B.group);
    const add = (grp, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); grp.add(o); return o; };
    const limb = (a, b, r0, r1, m) => { // Zylinder von a nach b
      const d = new THREE.Vector3().subVectors(b, a), l = d.length(), c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, l, 12), m);
      c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(c); return c;
    };
    const finger = (grp, x, y, z, len, rad, m, ry = 0, rx = 0) => add(grp, new THREE.CapsuleGeometry(rad, len, 3, 8), m, x, y, z, rx, ry, Math.PI / 2); // Finger quer (entlang x)
    const hand = (pos, side, grip) => { // Handschuh: Handruecken + Finger (grip=true: um den Griff gewickelt), Daumen
      const h = new THREE.Group(); h.position.set(pos[0], pos[1], pos[2]);
      add(h, new THREE.BoxGeometry(0.052, 0.036, 0.075), glove, 0, 0.004, 0.012);                                  // Handruecken
      add(h, new THREE.BoxGeometry(0.054, 0.012, 0.03), cuff, 0, 0.02, 0.008);                                      // Knoechelschutz
      for (let k = 0; k < 4; k++) finger(h, -side * 0.026, -0.004, -0.028 - k * 0.0135 + (grip ? 0 : 0), 0.04, 0.0072, glove, 0, 0.0);
      add(h, new THREE.CapsuleGeometry(0.0085, 0.03, 3, 8), glove, side * 0.0, 0.018, -0.03, -0.9, 0, 0);          // Daumen
      g.add(h); return h;
    };
    g.position.set(VOFF[i][0], VOFF[i][1], -VOFF[i][2]);
    const R = hand(B.rh, 1, true), L = hand(B.lh, -1, false);
    const wr = (h, sx) => new THREE.Vector3(h.position.x + sx * 0.01, h.position.y - 0.006, h.position.z + 0.06);
    const rw = wr(R, 1), lw = wr(L, -1);
    limb(new THREE.Vector3(0.2, -0.34, 0.5), rw, 0.056, 0.042, jacket); limb(rw.clone().add(new THREE.Vector3(0.003, 0.0, 0.025)), rw, 0.05, 0.044, cuff);
    limb(new THREE.Vector3(-0.24, -0.34, 0.5), lw, 0.056, 0.042, jacket); limb(lw.clone().add(new THREE.Vector3(-0.003, 0.0, 0.025)), lw, 0.05, 0.044, cuff);
    g.parts = B.parts; g.L = L; g.Lrest = B.lh; g.Lmag = B.lhMag; g.S = B.S; // fuer die Animation
    g.visible = false; g.muzzle = new THREE.Vector3(VOFF[i][0], 0.02 + VOFF[i][1], B.muzzle - VOFF[i][2]); view.add(g); viewGuns.push(g);
  });
  view.position.set(0.2, -0.22, -0.4); view.add(flash);
}
buildViewGuns();
/* Waffen-Animation (nur Transformationen bestehender Teile, keine Allokation):
   Rueckstoss von Schlitten/Verschluss/Pumpe beim Schuss, Magazinwechsel mit Linkshand beim Nachladen. */
let slideT = 0, pumpT = 0;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function animateGun(dt) {
  const g = viewGuns[player.weapon]; if (!g || !g.parts) return;
  const P = g.parts, S = g.S, w = WEAPONS[player.weapon];
  if (slideT > 0) slideT = Math.max(0, slideT - dt / Math.min(0.12, w.rate * 0.9));
  if (pumpT > 0) pumpT = Math.max(0, pumpT - dt);
  const k = Math.sin(Math.min(1, 1 - slideT) * Math.PI) * (slideT > 0 ? 1 : 0); // 0 -> 1 -> 0 ueber die Rueckstosszeit
  if (P.slide) P.slide.position.z = k * 0.032;                    // Pistole: Schlitten faehrt zurueck
  if (P.bolt) P.bolt.position.z = k * 0.045;                      // MP/Gewehr: Verschluss + Ladehebel
  let p = player.reloading ? 1 - player.reloadT / w.reload : 0;   // Nachlade-Fortschritt 0..1
  // Linke Hand + Magazin
  const L = g.L, a = g.Lrest, b = g.Lmag;
  let hand = 0, drop = 0;
  if (player.reloading) {
    hand = sstep(0.0, 0.25, p) * (1 - sstep(0.82, 1.0, p));        // Hand wandert zum Magazinschacht und zurueck
    drop = sstep(0.28, 0.42, p) * (1 - sstep(0.55, 0.78, p));       // altes Magazin faellt, neues kommt hoch
  }
  L.position.set(a[0] + (b[0] - a[0]) * hand, a[1] + (b[1] - a[1]) * hand, a[2] + (b[2] - a[2]) * hand);
  if (P.mag) { P.mag.position.y = -drop * 0.16 * S; P.mag.rotation.x = drop * 0.25; if (P.mag.children[0]) P.mag.visible = !(p > 0.4 && p < 0.52); }
  if (P.bolt && player.reloading) P.bolt.position.z = sstep(0.86, 0.92, p) * (1 - sstep(0.94, 1.0, p)) * 0.045; // Durchladen am Ende
  if (P.shells) { P.shells.position.set(-hand * 0.02, -hand * 0.02, 0); }
  if (P.pump) { // Schrotflinte: nach dem Schuss durchladen (Pumpbewegung), auch am Ende des Nachladens
    const t = pumpT > 0 ? 1 - pumpT / 0.5 : 0, pk = Math.sin(sstep(0.35, 1, t) * Math.PI) * (pumpT > 0 ? 1 : 0);
    P.pump.position.z = Math.max(pk, player.reloading ? Math.sin(sstep(0.7, 1, p) * Math.PI) : 0) * 0.07;
  }
}
export function kickGun() { slideT = 1; if (player.weapon === 3) pumpT = 0.5; }
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
    let pg = null;
    if (best && best.gen) { const ph = preciseHit(best, origin, _d); if (ph) { tBest = ph.t; pg = ph.pg; head = !!pg && pg.name === 'head'; } } // genauer Treffer: Kopf/Arm/Bein
    const end = new THREE.Vector3().copy(origin).addScaledVector(_d, tBest);
    if (p < 3) addTracer(_w, end);
    if (best) {
      hitAny = true; const dmg = w.dmg * (head ? 2.5 : 1) * (1 - Math.min(0.5, tBest / (w.range * 2)));
      if (damageZombie(best, dmg, head, _d, end, pg)) killAny = true;
    } else if (wn) {
      const n = new THREE.Vector3(wn.nx || 0, wn.ny || 0, wn.nz || 0);
      addDecal(end, n); emit(end, 3, 'spark', 2.5, 0.03, 9, n); emit(end, 2, 'dust', 1.2, 0.08, 1, n);
    }
  }
  noise(player.pos, 60);
  if (hitAny) { const hm = $('hitmark'); hm.className = 'on' + (killAny ? ' kill' : ''); clearTimeout(hm._t); hm._t = setTimeout(() => (hm.className = ''), 90); }
  // Rückstoß & Mündungsfeuer
  player.recoilKick += w.recoil * 30; player.pitch += w.recoil * (0.4 + rnd() * 0.5); player.yaw += rr(-1, 1) * w.recoil * 0.3; player.shake = Math.min(1, player.shake + w.recoil * 6);
  kickGun();
  flash.visible = true; flash.rotation.z = rnd() * 6; flash.scale.setScalar(w.pellets > 1 ? 1.8 : 1 + rnd() * 0.5); flashLight.intensity = 22; player.flashT = 0.05;
  if (a.mag === 0 && a.reserve > 0) setTimeout(startReload, 250);
  updateHUD();
}

