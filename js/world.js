import * as THREE from 'three';
import { scatterTrash as buildTrash } from '../trash.js';
import { buildBackdrop } from './backdrop.js';
import { FACADE, FLOOR_H, TILE_H, TILE_W, applyFacadeNight, buildEnterable, facadeMat, facadeTexture } from './buildings.js';
import { settings } from './config.js';
import { canvasTex, hashXZ, lambert, mkRng, renderer, resetSeed, rnd, rr } from './core.js';
import { LAMP, applyLampNight } from './lamps.js';
import { finalizeFences, resetFences } from './fences.js';
import { HALF, MAP, SIDEWALK_H, addBox, boxes, groundH, interiorSpots, mapRoot, setMap } from './mapdata.js';
import { CAR_MATS, addTree, buildStreetProps, crateMats, cratePostMat } from './props.js';
import { applyShaderTo, phongCache } from './shader.js';
import { alive } from './zombies.js';

export function disposeMap() {
  mapRoot.traverse((o) => { if (o.geometry) o.geometry.dispose(); for (const m of (o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [])) { if (m.map) m.map.dispose(); m.dispose(); } });
  mapRoot.clear(); resetFences(); boxes.length = 0; interiorSpots.length = 0; phongCache.clear(); FACADE.mats = []; FACADE.neon = []; FACADE.pools = []; FACADE.cache = {}; CAR_MATS.length = 0;
  Object.assign(LAMP, { list: [], alive: [], flick: [], lights: [], ready: false, pools: null, halos: null, haloCol: null });
}
export function loadMap(id) {
  disposeMap(); setMap(id); resetSeed();
  buildGround(); buildCity(); finalizeFences(); applyShaderTo(mapRoot); applyLampNight(settings.night); applyFacadeNight(settings.night);
}
export let groundTex = null;
export function buildGround() {
  const SIZE = Math.min(3072, renderer.capabilities.maxTextureSize || 2048);
  const aniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  const tex = canvasTex(SIZE, SIZE, (g, w, h) => {
    const px = w / MAP.size;                 // Pixel pro Meter
    const X = (m) => (m + HALF) * px;
    const R = (x, z, ww, hh) => g.fillRect(X(x), X(z), ww * px, hh * px);
    // --- Asphalt mit Flecken
    g.fillStyle = '#3e4144'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const l = rnd() < .5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr(.02, .07)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(.3, 2.6) * px, 0, 7); g.fill(); }
    // --- Blöcke: Gehsteig-Ring + Betonplatten
    for (const bx of MAP.blocks) for (const bz of MAP.blocks) {
      g.fillStyle = '#85847d'; R(bx - 20, bz - 20, 40, 40);
      for (let a = 0; a < 40; a += 0.6) for (let b = 0; b < 2; b += 0.6) { // Pflaster im Ring (alle 4 Seiten)
        const t = 118 + rnd() * 26; g.fillStyle = `rgb(${t},${t - 1},${t - 6})`;
        R(bx - 20 + a, bz - 20 + b, 0.56, 0.56); R(bx - 20 + a, bz + 18 + b, 0.56, 0.56);
        R(bx - 20 + b, bz - 20 + a, 0.56, 0.56); R(bx + 18 + b, bz - 20 + a, 0.56, 0.56);
      }
      g.fillStyle = '#5f5e59'; R(bx - 18, bz - 18, 36, 36); // Grundstück
      for (let a = 0; a < 36; a += 3) for (let b = 0; b < 36; b += 3) { const t = 84 + rnd() * 22; g.fillStyle = `rgb(${t},${t},${t - 4})`; R(bx - 18 + a + .04, bz - 18 + b + .04, 2.92, 2.92); }
      g.strokeStyle = '#b9b7ae'; g.lineWidth = Math.max(1.5, .18 * px); g.strokeRect(X(bx - 20), X(bz - 20), 40 * px, 40 * px); // Bordstein
      g.strokeStyle = 'rgba(15,15,15,.55)'; g.lineWidth = Math.max(1, .06 * px); g.strokeRect(X(bx - 20) - g.lineWidth, X(bz - 20) - g.lineWidth, 40 * px + 2 * g.lineWidth, 40 * px + 2 * g.lineWidth);
    }
    // --- Gras am Rand
    g.fillStyle = '#48512f';
    g.fillRect(0, 0, w, X(-MAP.edge)); g.fillRect(0, X(MAP.edge), w, h); g.fillRect(0, 0, X(-MAP.edge), h); g.fillRect(X(MAP.edge), 0, w, h);
    for (let i = 0; i < 26000; i++) { const x = rnd() * w, y = rnd() * h; if (x > X(-MAP.edge) && x < X(MAP.edge) && y > X(-MAP.edge) && y < X(MAP.edge)) continue; g.strokeStyle = `rgba(${(40 + rnd() * 50) | 0},${(60 + rnd() * 60) | 0},${(20 + rnd() * 20) | 0},.8)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-3, 3), y - rr(2, 7)); g.stroke(); }
    // --- Straßenmarkierungen
    const inter = MAP.roads;
    const segs = []; let a0 = -MAP.edge; for (const c of inter) { segs.push([a0, c - 5]); a0 = c + 5; } segs.push([a0, MAP.edge]);
    for (const r of inter) for (const vert of [true, false]) {
      const rect = (a, b, la, lb) => (vert ? R(r + a, b, la, lb) : R(b, r + a, lb, la)); // a: quer zur Straße, b: längs
      for (const [s0, s1] of segs) {
        g.fillStyle = '#d6b53a'; rect(-0.22, s0, 0.1, s1 - s0); rect(0.12, s0, 0.1, s1 - s0);      // Doppel-Mittellinie
        g.fillStyle = 'rgba(225,225,215,.8)'; rect(-4.55, s0, 0.12, s1 - s0); rect(4.43, s0, 0.12, s1 - s0); // Randlinien
        for (let t = s0 + 1; t < s1 - 3; t += 6) { rect(-2.55, t, 0.1, 3); rect(2.45, t, 0.1, 3); }        // Leitlinien gestrichelt
      }
      for (const c of inter) for (const sg of [-1, 1]) { // Zebrastreifen
        const b0 = sg < 0 ? c - 9 : c + 6; g.fillStyle = 'rgba(230,230,220,.78)';
        for (let q = -4.2; q < 4.2; q += 1.1) rect(q, b0, 0.55, 2.4);
      }
    }
    // --- Details: Flecken, Risse, Gullys, Müll
    g.setLineDash([]);
    const onRoad = (x, z) => inter.some((r) => Math.abs(x - r) < 4.5 || Math.abs(z - r) < 4.5);
    const rp = () => { for (let k = 0; k < 40; k++) { const x = rr(-MAP.edge + 2, MAP.edge - 2), z = rr(-MAP.edge + 2, MAP.edge - 2); if (onRoad(x, z)) return [x, z]; } return [0, 20]; };
    for (let i = 0; i < 260; i++) { const [x, z] = rp(); g.fillStyle = `rgba(8,8,8,${rr(.15, .4)})`; g.beginPath(); g.ellipse(X(x), X(z), rr(.3, 1.2) * px, rr(.2, .8) * px, rnd() * 3, 0, 7); g.fill(); } // Ölflecken
    for (let i = 0; i < 40; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(60,70,85,.35)'; g.beginPath(); g.ellipse(X(x), X(z), rr(.6, 1.6) * px, rr(.4, 1) * px, rnd() * 3, 0, 7); g.fill(); } // Pfützen
    for (let i = 0; i < 18; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(5,5,5,.8)'; g.beginPath(); g.ellipse(X(x), X(z), rr(.25, .5) * px, rr(.2, .4) * px, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,120,120,.5)'; g.lineWidth = 1; g.stroke(); } // Schlaglöcher
    for (let i = 0; i < 40; i++) { const [x, z] = rp(); g.fillStyle = '#2a2c2e'; g.beginPath(); g.arc(X(x), X(z), .45 * px, 0, 7); g.fill(); g.strokeStyle = '#6b6e70'; g.lineWidth = Math.max(1, .05 * px); g.stroke(); g.beginPath(); g.moveTo(X(x) - .3 * px, X(z)); g.lineTo(X(x) + .3 * px, X(z)); g.moveTo(X(x), X(z) - .3 * px); g.lineTo(X(x), X(z) + .3 * px); g.stroke(); } // Kanaldeckel
    for (let i = 0; i < 30; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(18,18,18,.6)'; g.fillRect(X(x), X(z), rr(.5, 1.5) * px, rr(.4, 1) * px); g.fillStyle = 'rgba(70,72,74,.35)'; g.fillRect(X(x) + 4, X(z) + 4, rr(.4, 1.2) * px, rr(.3, .8) * px); } // Flickstellen
    for (let i = 0; i < 40; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(15,15,15,.35)'; g.fillRect(X(x), X(z), rr(4, 12) * px, .22 * px); } // Reifenspuren
    g.lineCap = 'round';
    for (let i = 0; i < 700; i++) { // Risse mit Verzweigung
      let x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(10,10,10,${rr(.45, .85)})`; g.lineWidth = Math.max(1, rr(.02, .05) * px);
      g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += rr(-.5, .5) * px; y += rr(-.5, .5) * px; g.lineTo(x, y); if (rnd() < .25) { g.moveTo(x, y); g.lineTo(x + rr(-.6, .6) * px, y + rr(-.6, .6) * px); g.moveTo(x, y); } } g.stroke();
    }
    for (let i = 0; i < 90; i++) { const [x, z] = rp(); g.fillStyle = 'rgba(80,6,6,.4)'; g.beginPath(); g.arc(X(x), X(z), rr(.1, .5) * px, 0, 7); g.fill(); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(X(x) + rr(-1, 1) * px, X(z) + rr(-1, 1) * px, rr(.03, .1) * px, 0, 7); g.fill(); } } // Blut
    for (let i = 0; i < 2600; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = rnd() < .5 ? `rgba(${(150 + rnd() * 90) | 0},${(140 + rnd() * 90) | 0},${(120 + rnd() * 80) | 0},.55)` : 'rgba(95,70,40,.55)'; g.fillRect(x, y, rr(1, 3.5), rr(1, 3.5)); } // Papier, Laub, Splitt
    // --- Feines Korn (pixelgenau)
    const id = g.getImageData(0, 0, w, h), d = id.data; let s = 987654321;
    for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 16) & 31) - 15; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
  }, false);
  tex.anisotropy = aniso; groundTex = tex;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP.size, MAP.size), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2; mapRoot.add(m);
  // Detail-Textur (gekachelt) für Schärfe im Nahbereich
  const det = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) { const l = rnd() < .5 ? 0 : 255; g.fillStyle = `rgba(${l},${l},${l},${rr(.08, .35)})`; g.fillRect(rnd() * w, rnd() * h, rr(1, 2.5), rr(1, 2.5)); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${rr(.15, .3)})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(1.5, 3.5), 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(rnd() * w - 1, rnd() * h - 1, rr(.8, 1.8), 0, 7); g.fill(); }
  }, true);
  det.repeat.set(MAP.size / 1.6, MAP.size / 1.6); det.anisotropy = aniso;
  const ov = new THREE.Mesh(new THREE.PlaneGeometry(MAP.size, MAP.size), new THREE.MeshLambertMaterial({ map: det, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  ov.rotation.x = -Math.PI / 2; ov.position.y = 0.004; mapRoot.add(ov);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), lambert(0x3d4430));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; mapRoot.add(outer);
}

export function buildCity() {
  const bases = ['#8c8479', '#7a6d62', '#6c7378', '#8a6b5a', '#5f625b'];
  const lits = ['#ffd98a', '#cfe8ff'];
  const roofMat = lambert(0x3b3a38);
  let houseCount = 0;
  const addBuilding = (cx, cz, w, d, h, canEnter) => {
    const tex = facadeTexture(bases[(rnd() * bases.length) | 0], lits[(rnd() * 2) | 0], (rnd() * 3) | 0);
    h = Math.max(2, Math.round(h / FLOOR_H)) * FLOOR_H; // ganze Etagen -> Fenster auf realistischer Hoehe
    if (canEnter && w >= 12 && d >= 12 && ++houseCount % 3 === 0) { buildEnterable(cx, cz, w, d, Math.max(h, 3 * FLOOR_H), tex); return; }
    const mats = [facadeMat(tex, d / TILE_W, h / TILE_H), facadeMat(tex, d / TILE_W, h / TILE_H), roofMat, roofMat, facadeMat(tex, w / TILE_W, h / TILE_H), facadeMat(tex, w / TILE_W, h / TILE_H)];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(cx, h / 2, cz); mapRoot.add(m);
    addBox(cx, cz, w, d, h);
    if (rnd() < 0.5) { // Dachaufbau
      const a = new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2, d * .3), roofMat);
      a.position.set(cx + rr(-w / 4, w / 4), h + 1, cz + rr(-d / 4, d / 4)); mapRoot.add(a);
    }
  };
  const crateBody = new THREE.BoxGeometry(0.96, 0.96, 0.96), cratePost = new THREE.BoxGeometry(0.1, 1, 0.1);
  const addCrate = (x, z, s, c) => { // Optik: Holzkiste mit Brettern, Eckpfosten, Strebe, Nägeln. Kollision: unverändert (addBox)
    const h = hashXZ(x, z), g = new THREE.Group(), pm = cratePostMat(c);
    g.add(new THREE.Mesh(crateBody, crateMats(c, h & 1)));
    for (const px of [-1, 1]) for (const pz of [-1, 1]) { const p = new THREE.Mesh(cratePost, pm); p.position.set(px * 0.45, 0, pz * 0.45); g.add(p); }
    g.scale.set(s, s, s); g.position.set(x, s / 2, z); g.rotation.y = ((h >> 1) & 3) * Math.PI / 2; // 90°-Drehung: Quadrat -> Kollision identisch
    mapRoot.add(g); addBox(x, z, s, s, s);
  };

  // Bordstein: jeder Block (Gehweg + Grundstück) ist eine 15 cm hohe Platte; Spieler/Zombies steigen automatisch hinauf
  const curbMat = lambert(0xaaa89f), CH = SIDEWALK_H;
  for (const bx of MAP.blocks) for (const bz of MAP.blocks) {
    const t = groundTex.clone(); t.repeat.set(40 / MAP.size, 40 / MAP.size); t.offset.set((bx - 20 + HALF) / MAP.size, 1 - (bz + 20 + HALF) / MAP.size); t.needsUpdate = true;
    const top = new THREE.MeshLambertMaterial({ map: t });
    const m = new THREE.Mesh(new THREE.BoxGeometry(40, CH, 40), [curbMat, curbMat, top, curbMat, curbMat, curbMat]); m.position.set(bx, CH / 2, bz); mapRoot.add(m);
    boxes.push({ x0: bx - 20, x1: bx + 20, z0: bz - 20, z1: bz + 20, top: CH });
  }
  const liftN = mapRoot.children.length, liftB = boxes.length;
  for (const bx of MAP.blocks) for (const bz of MAP.blocks) {
    for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 2; iz++) {
      const cx = bx + (ix ? 10 : -10), cz = bz + (iz ? 10 : -10);
      if (Math.abs(cx) < 15 && Math.abs(cz) < 15) { // Park in der Mitte
        for (let k = 0; k < 5; k++) addTree(cx + rr(-6, 6), cz + rr(-6, 6));
        continue;
      }
      if (rnd() < 0.78) addBuilding(cx, cz, rr(12, 17), rr(12, 17), rr(8, 26), true);
      else { // Freifläche: Trümmer, Kisten
        for (let k = 0; k < 4; k++) addCrate(cx + rr(-6, 6), cz + rr(-6, 6), rr(0.8, 1.8), [0x6b5a3c, 0x4d5a3c, 0x555a60][k % 3]);
        addTree(cx + rr(-6, 6), cz + rr(-6, 6));
      }
    }
  }
  { // alles auf den Blöcken (Häuser, Bäume, Kisten) auf die Platte setzen
    const lift = new THREE.Group(); lift.position.y = CH; lift.add(...mapRoot.children.slice(liftN)); mapRoot.add(lift);
    for (let k = liftB; k < boxes.length; k++) { const b = boxes[k]; b.top += CH; if (b.y0) b.y0 += CH; }
  }
  // Außenrand: ein paar Ruinen & Bäume
  for (let i = 0; i < MAP.ring; i++) {
    const side = i % 4, t = rr(-(MAP.edge - 10), MAP.edge - 10), o = rr(MAP.edge - 10, MAP.edge);
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? -o : o;
    const z = side === 0 ? -o : side === 1 ? o : t;
    if (i % 3 === 0) addBuilding(x, z, rr(8, 12), rr(8, 12), rr(5, 10)); else addTree(x, z);
  }
  // Begrenzung: Kollisionsboxen wie bisher (unverändert); sichtbar ist die Randkulisse (Berge, Wald, Häuser, LKW)
  [[0, -HALF - 1, MAP.size + 4, 2], [0, HALF + 1, MAP.size + 4, 2], [-HALF - 1, 0, 2, MAP.size + 4], [HALF + 1, 0, 2, MAP.size + 4]].forEach(([x, z, w, d]) => addBox(x, z, w, d, 50));
  buildBackdrop();
  buildStreetProps();
  scatterTrash();
}

/* ---- Müll: Pappbecher, Dosen, Flaschen, Tüten, Papier, Pappe, Fast-Food-Boxen – nur Optik, KEINE Kollision (man läuft einfach drüber) ---- */
export function scatterTrash() { buildTrash({ mapRoot, MAP, HALF, boxes, interiorSpots, mkRng, groundH }); }
export function scatterTrashOld() {
  const r = mkRng(4711 + MAP.size), AF = (MAP.size / 250) ** 2, T = {};
  const bag = new THREE.IcosahedronGeometry(1, 1); { const p = bag.attributes.position, jr = mkRng(5), seen = new Map(); for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(2) + p.getY(i).toFixed(2) + p.getZ(i).toFixed(2); if (!seen.has(k)) seen.set(k, [0.75 + jr() * 0.5, jr() - 0.5]); const j = seen.get(k); p.setXYZ(i, p.getX(i) * j[0], p.getY(i) * (0.7 + j[1] * 0.8), p.getZ(i) * j[0]); } bag.computeVertexNormals(); }
  const defs = {
    cup:   { w: 0.22, geo: new THREE.CylinderGeometry(0.042, 0.03, 0.11, 8), cols: [0xf2f2ee, 0xf2f2ee, 0xb83232, 0x8a5a36, 0xe8d8b0] },
    can:   { w: 0.18, geo: new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8), cols: [0xc83030, 0xaab0b4, 0x2f5fa8, 0x3a8a4a, 0xd8a020] },
    bottle:{ w: 0.12, geo: new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), cols: [0x9ec8e0, 0xcfe4ea, 0x6aa86a, 0xd8e8f0] },
    bag:   { w: 0.14, geo: bag, cols: [0xe8e8e0, 0xcfd3d6, 0x5a6b8a, 0x222222, 0xb04040, 0xd8c8a0] },
    ball:  { w: 0.14, geo: new THREE.IcosahedronGeometry(0.06, 0), cols: [0xe6e2d4, 0xd8d0b0, 0xcfd2d6] },
    sheet: { w: 0.12, geo: new THREE.BoxGeometry(0.3, 0.004, 0.21), cols: [0xdedbd0, 0xc9c6b8, 0xd8c9a0, 0xb8c0c8] },
    card:  { w: 0.05, geo: new THREE.BoxGeometry(0.5, 0.025, 0.36), cols: [0x9c7a4c, 0x8a6a40, 0xa88a58] },
    food:  { w: 0.03, geo: new THREE.BoxGeometry(0.17, 0.06, 0.17), cols: [0xc83030, 0xe8c030, 0xeeeeee] },
  };
  const keys = Object.keys(defs); for (const k of keys) T[k] = [];
  const blocked = (x, z) => boxes.some((b) => !b.y0 && b.top > 0.3 && x > b.x0 - 0.15 && x < b.x1 + 0.15 && z > b.z0 - 0.15 && z < b.z1 + 0.15);
  const pickType = () => { let t = r(), acc = 0; for (const k of keys) { acc += defs[k].w; if (t < acc) return k; } return 'cup'; };
  const blockedH = groundH;
  const place = (cx, cz, n, spread, fy) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (r() + r() + r() - 1.5) * spread, z = cz + (r() + r() + r() - 1.5) * spread;
      if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1 || blocked(x, z)) continue;
      const k = pickType(), c = defs[k].cols[(r() * defs[k].cols.length) | 0], yaw = r() * 6.283, s = 0.85 + r() * 0.4;
      let y = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1;
      if (k === 'cup') { if (r() < 0.7) { rz = Math.PI / 2; y = 0.042; } else { y = 0.055; rx = (r() - 0.5) * 0.3; } }
      else if (k === 'can') { if (r() < 0.8) { rz = Math.PI / 2; y = 0.033; } else y = 0.06; }
      else if (k === 'bottle') { rz = Math.PI / 2; y = 0.04; }
      else if (k === 'bag') { sx = 0.22 * s * (1 + r()); sy = 0.05 + r() * 0.04; sz = 0.18 * s * (1 + r() * 0.8); y = sy * 0.5; }
      else if (k === 'ball') { sx = sy = sz = s; y = 0.05 * s; }
      else if (k === 'sheet') { y = 0.008; rx = (r() - 0.5) * 0.06; }
      else if (k === 'card') { y = 0.02; sx = s; sz = s; }
      else { y = 0.032; }
      T[k].push({ x, y: y + fy + (blockedH(x, z)), z, rx, ry: yaw, rz, sx, sy, sz, c });
    }
  };
  const nCl = (Math.round(95 * AF) + 4) * 10; // 10x Müll
  for (let i = 0; i < nCl; i++) { const x = (r() - 0.5) * 2 * (MAP.edge - 3), z = (r() - 0.5) * 2 * (MAP.edge - 3); place(x, z, 3 + ((r() * 7) | 0), 1.2, 0); }
  for (const sp of interiorSpots) for (let i = 0; i < 20; i++) place(sp.x + (r() - 0.5) * 6, sp.z + (r() - 0.5) * 6, 4 + ((r() * 4) | 0), 1.4, 0.04); // auch in den Häusern
  const d = new THREE.Object3D(), col = new THREE.Color();
  for (const k of keys) {
    const list = T[k]; if (!list.length) continue;
    const im = new THREE.InstancedMesh(defs[k].geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
    list.forEach((o, i) => { d.position.set(o.x, o.y, o.z); d.rotation.set(o.rx, o.ry, o.rz); d.scale.set(o.sx, o.sy, o.sz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.setHex(o.c)); });
    im.frustumCulled = false; mapRoot.add(im);
  }
}

