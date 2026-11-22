// IM SPIEL sind nur noch die 150 fertigen GLB-Modelle des Zombie-Sets (assets/zombies/) zu sehen (siehe createSetZombie).
// Die selbstgebauten Würfel-Modelle unten werden nicht mehr verwendet; der Schlurfer bleibt nur als Ersatz, falls eine Datei fehlt.
//
// Lowpoly-Zombie-Modelle, komplett aus Würfeln gebaut (flach schattiert, mit Gelenken zum Animieren).
//  - walker: "Schlurfer" (normal groß, blaues zerrissenes Hemd)
//  - brute:  "Brocken"  (groß, breit, gebückt, Weste mit sichtbaren Rippen)
// Drei weitere, etwas genauere Modelle (Ohren, Nase, Brauen, Finger, Gürtel, Sohlen), gleiche Größe wie der Schlurfer:
//  - soldier: "Soldat" (Feldjacke, Helm, Gürtel mit Taschen)
//  - doctor:  "Doktor" (Kittel mit Blutflecken, Mundschutz, Brille)
//  - worker:  "Bauarbeiter" (Warnweste, gelber Helm, Arbeitshandschuhe)
// Zusätzlich das Zombie-Set aus 10 fertigen GLB-Modellen (assets/zombies/): gleiche Größe und Werte wie der Schlurfer.
// Figur blickt nach +Z, Füße bei y = 0.

import * as THREE from 'three';
import { ZOMBIE_SET } from './config.js';
import { assets } from './characters.js';

export const ZOMBIE_SCALE = 1.3;   // Größe der Zombies (1.3 = 30 % größer)

// hp = Lebenspunkte des Zombies. Jeder Treffer zieht den Schaden der Waffe ab (inkl. Schaden-Skill).
export const ZOMBIE_TYPES = {
  walker: { name: 'Schlurfer', hp: 20, speed: 1.6, height: 1.85 * ZOMBIE_SCALE, radius: 0.55 * ZOMBIE_SCALE, lean: 0.12, damage: 4 },
  brute:  { name: 'Brocken',   hp: 40, speed: 1.1, height: 1.95 * ZOMBIE_SCALE, radius: 0.75 * ZOMBIE_SCALE, lean: 0.32, damage: 7 },
  // Die drei neuen haben dieselben Werte wie der Schlurfer (gleiche Regeln, gleiche Größe)
  soldier: { name: 'Soldat',      hp: 20, speed: 1.6, height: 1.85 * ZOMBIE_SCALE, radius: 0.55 * ZOMBIE_SCALE, lean: 0.12, damage: 4 },
  doctor:  { name: 'Doktor',      hp: 20, speed: 1.6, height: 1.85 * ZOMBIE_SCALE, radius: 0.55 * ZOMBIE_SCALE, lean: 0.12, damage: 4 },
  worker:  { name: 'Bauarbeiter', hp: 20, speed: 1.6, height: 1.85 * ZOMBIE_SCALE, radius: 0.55 * ZOMBIE_SCALE, lean: 0.12, damage: 4 },
};

// Zombie-Set (GLB, 150 Modelle): dieselben Werte wie der Schlurfer. rest = Arme/Beine sind im Modell schon in Pose (Animation nur als Ausschlag).
for (const z of ZOMBIE_SET) {
  ZOMBIE_TYPES[z.id] = { name: z.name, hp: 20, speed: 1.6, height: 1.85 * ZOMBIE_SCALE, radius: 0.55 * ZOMBIE_SCALE, lean: 0, damage: 4, glb: true, rest: true };
}

const PARAMS = {
  walker: {
    skin: 0x7fa35a, shirt: 0x3b5f8c, pants: 0x4a3b2c, hair: 0x2a1d12, style: 'shirt', pantsFrac: 0.7,
    legLen: 0.82, legW: 0.17, hipX: 0.12, tw: 0.46, th: 0.62, td: 0.25, shX: 0.31, armLen: 0.66, armW: 0.13,
    hw: 0.3, hh: 0.32, hd: 0.3, sleeveFrac: 0.45,
  },
  brute: {
    skin: 0x9a9f78, shirt: 0x6a2a2a, pants: 0x2f2f3a, hair: 0x2a1d12, style: 'vest', pantsFrac: 0.4,
    legLen: 0.82, legW: 0.24, hipX: 0.18, tw: 0.72, th: 0.7, td: 0.38, shX: 0.5, armLen: 0.8, armW: 0.21,
    hw: 0.3, hh: 0.29, hd: 0.3, sleeveFrac: 0,
  },
  soldier: {
    skin: 0x8a9a74, shirt: 0x4f5a3a, pants: 0x3a3f2a, hair: 0x3d4630, style: 'soldier', pantsFrac: 0.62, detail: true,
    legLen: 0.82, legW: 0.17, hipX: 0.12, tw: 0.5, th: 0.62, td: 0.27, shX: 0.33, armLen: 0.66, armW: 0.13,
    hw: 0.3, hh: 0.32, hd: 0.3, sleeveFrac: 0.7,
  },
  doctor: {
    skin: 0x9fb08a, shirt: 0xd9d6c8, pants: 0x3f6f86, hair: 0x8a8a8a, style: 'doctor', pantsFrac: 0.75, detail: true,
    legLen: 0.82, legW: 0.17, hipX: 0.12, tw: 0.46, th: 0.62, td: 0.25, shX: 0.31, armLen: 0.66, armW: 0.13,
    hw: 0.3, hh: 0.32, hd: 0.3, sleeveFrac: 0.8,
  },
  worker: {
    skin: 0x8fa56a, shirt: 0x555a60, pants: 0x3a4a6a, hair: 0x2a1d12, style: 'worker', pantsFrac: 0.8, detail: true, glove: 0x6a4a28,
    legLen: 0.82, legW: 0.17, hipX: 0.12, tw: 0.5, th: 0.62, td: 0.27, shX: 0.33, armLen: 0.66, armW: 0.13,
    hw: 0.3, hh: 0.32, hd: 0.3, sleeveFrac: 0.5,
  },
};

const darker = (c, f) => ((((c >> 16) & 255) * f | 0) << 16) | ((((c >> 8) & 255) * f | 0) << 8) | ((c & 255) * f | 0);

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...extra });
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  return o;
}

// Ein Zombie aus dem GLB-Set. Das Gerüst (Beine, Arme, Kopf, Körper) wird an der Struktur erkannt:
//   Figur -> [Becken (Mesh), Bein, Bein, Körper], Körper -> [Arm, Arm, Kopf]  (alle 10 Dateien sind so gebaut).
// Jedes Gelenk bekommt einen eigenen Drehpunkt (Gruppe) an der Gelenkposition. Dreht man den Drehpunkt auf 0,
// steht das Glied wie im Modell, dadurch wirkt die Animation als Ausschlag um die mitgelieferte Haltung.
function createSetZombie(typeId) {
  const src = assets.zombies[typeId];
  const fail = (why) => { console.warn(`Zombie ${typeId}: ${why}, nehme den Schlurfer`); return null; };
  if (!src) return fail('Modell nicht geladen');

  const root = src.clone(true);
  let fig = root;
  while (fig.children.length === 1 && !fig.children[0].isMesh) fig = fig.children[0];
  const groups = fig.children.filter((c) => !c.isMesh);
  const legs = groups.filter((c) => Math.abs(c.position.x) > 0.05);
  const bodyN = groups.find((c) => Math.abs(c.position.x) <= 0.05);
  if (legs.length !== 2 || !bodyN) return fail('Körperbau nicht erkannt');
  const sub = bodyN.children.filter((c) => !c.isMesh);
  const arms = sub.filter((c) => Math.abs(c.position.x) > 0.1);
  const headN = sub.find((c) => Math.abs(c.position.x) <= 0.1);
  if (arms.length !== 2 || !headN) return fail('Arme/Kopf nicht erkannt');

  // Eigene Materialien je Zombie (für den Treffer-Blitz); Texturen bleiben gemeinsam
  // (Teile mit demselben Material teilen sich auch das Klon-Material: ca. 15 statt 60 Materialien je Zombie)
  const mats = [], copies = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    let m = copies.get(o.material);
    if (!m) {
      m = o.material.clone();
      copies.set(o.material, m);
      if (m.emissive) { m.userData.e0 = m.emissive.getHex(); m.userData.i0 = m.emissiveIntensity; mats.push(m); }
    }
    o.material = m;
  });

  const pivot = (node) => {
    const w = new THREE.Group();
    w.position.copy(node.position);
    node.position.set(0, 0, 0);
    node.parent.add(w);
    w.add(node);
    return w;
  };
  const byX = (a) => a.sort((m, n) => m.position.x - n.position.x);
  const [legL, legR] = byX(legs).map(pivot), [armL, armR] = byX(arms).map(pivot);
  const head = pivot(headN), body = pivot(bodyN);

  // Größe: wie der Schlurfer, Füße auf dem Boden
  const inner = new THREE.Group();
  inner.add(root);
  const g = new THREE.Group();
  g.add(inner);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const h = box.max.y - box.min.y;
  if (!(h > 0.5 && h < 10)) return fail('Größe nicht lesbar');
  inner.position.y = -box.min.y;
  g.scale.setScalar(ZOMBIE_TYPES[typeId].height / h);

  return { group: g, rig: { body, legL, legR, armL, armR, head, baseY: body.position.y }, mats };
}

export function createZombieModel(typeId) {
  if (ZOMBIE_TYPES[typeId]?.glb) { const m = createSetZombie(typeId); if (m) return m; typeId = 'walker'; }
  const p = PARAMS[typeId];
  const mats = [];
  const M = (c, extra) => { const m = flat(c, extra); m.userData.e0 = m.emissive.getHex(); m.userData.i0 = m.emissiveIntensity; mats.push(m); return m; };
  const skin = M(p.skin), shirt = M(p.shirt), pants = M(p.pants), hair = M(p.hair), dark = M(0x1d1712), bone = M(0xe6dcc0);
  const eye = M(0xfff07a, { emissive: 0xffd23a, emissiveIntensity: 1.3 });
  const shoe = M(0x24201c);

  const g = new THREE.Group();
  g.scale.setScalar(ZOMBIE_SCALE);
  const body = new THREE.Group();            // Oberkörper: Drehpunkt an der Hüfte
  body.position.y = p.legLen;
  g.add(body);

  // Beine
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * p.hipX, p.legLen, 0);
    const up = p.legLen * p.pantsFrac, low = p.legLen - up;
    pivot.add(box(p.legW, up, p.legW + 0.02, pants, 0, -up / 2, 0));
    pivot.add(box(p.legW * 0.9, low, p.legW, skin, 0, -up - low / 2, 0));
    pivot.add(box(p.legW + 0.03, 0.09, p.legW + 0.12, shoe, 0, -p.legLen + 0.045, 0.04));
    if (p.detail) {
      pivot.add(box(p.legW + 0.05, 0.03, p.legW + 0.15, dark, 0, -p.legLen + 0.015, 0.04));                 // Sohle
      pivot.add(box(p.legW * 0.8, 0.03, 0.03, bone, 0, -p.legLen + 0.1, 0.1));                               // Schnürung
      if (typeId === 'soldier') pivot.add(box(p.legW + 0.03, 0.1, p.legW + 0.05, M(0x2b2f1e), 0, -up, 0));   // Knieschoner
    }
    g.add(pivot);
    legs.push(pivot);
  }

  // Rumpf
  const { tw, th, td } = p;
  body.add(box(tw, th, td, skin, 0, th / 2, 0));
  if (p.style === 'shirt') {
    body.add(box(tw * 1.07, th * 0.78, td * 1.1, shirt, 0, th - th * 0.39, 0));
    [[-0.15, 0.12], [0.0, 0.16], [0.14, 0.1]].forEach(([x, h]) => body.add(box(0.1, h, 0.02, shirt, x, th * 0.22, td * 0.55 + 0.01))); // Fetzen
  } else if (p.style === 'vest') {
    body.add(box(tw * 1.04, th * 0.85, 0.08, shirt, 0, th * 0.5, -td / 2 - 0.02));              // Weste hinten
    for (const s of [-1, 1]) body.add(box(0.12, th * 0.85, td * 1.1, shirt, s * (tw / 2 - 0.02), th * 0.5, 0)); // Seiten
    [0.18, 0.34, 0.5].forEach((f) => body.add(box(tw * 0.55, 0.035, 0.03, bone, 0, th * f + 0.1, td / 2 + 0.012))); // Rippen
  } else if (p.style === 'soldier') {
    const olive = M(0x39421f), leather = M(0x5a4a30), beltM = M(0x2b2218);
    body.add(box(tw * 1.08, th * 0.82, td * 1.1, shirt, 0, th * 0.59, 0));                                  // Feldjacke
    body.add(box(tw * 0.5, 0.06, td * 0.95, shirt, 0, th + 0.0, 0));                                        // Kragen
    body.add(box(tw * 1.1, 0.07, td * 1.12, beltM, 0, th * 0.2, 0));                                         // Gürtel
    body.add(box(0.07, 0.07, 0.02, M(0xc9a227), 0, th * 0.2, td * 0.56 + 0.01));                             // Schnalle
    for (const x of [-0.15, 0.15]) body.add(box(0.1, 0.12, 0.07, leather, x, th * 0.2 - 0.02, td * 0.55 + 0.03)); // Patronentaschen
    for (const x of [-0.1, 0.1]) body.add(box(0.1, 0.09, 0.02, olive, x, th * 0.62, td * 0.55 + 0.012));     // Brusttaschen
    [[-0.13, 0.44, 0.09, 0.07], [0.12, 0.3, 0.1, 0.06], [0.0, 0.5, 0.07, 0.08]].forEach(([x, f, w, h]) => body.add(box(w, h, 0.02, olive, x, th * f, td * 0.55 + 0.012))); // Tarnflecken
  } else if (p.style === 'doctor') {
    const stain = M(0x7a1c18), dirty = M(0xb9b4a2), scrubs = M(p.pants);
    body.add(box(tw * 1.1, th * 0.95, td * 1.12, shirt, 0, th * 0.52, 0));                                   // Kittel
    body.add(box(0.12, th * 0.9, 0.02, scrubs, 0, th * 0.52, td * 0.56 + 0.012));                            // OP-Kleidung im offenen Kittel
    body.add(box(tw * 1.12, 0.36, td * 1.14, shirt, 0, -0.12, 0));                                           // langer Kittelsaum
    body.add(box(tw * 0.62, 0.07, td * 0.95, shirt, 0, th - 0.01, -0.02));                                   // Kragen
    for (const x of [-0.16, 0.16]) body.add(box(0.1, 0.1, 0.02, dirty, x, th * 0.3, td * 0.56 + 0.012));     // Taschen
    body.add(box(0.14, 0.15, 0.02, stain, -0.11, th * 0.52, td * 0.56 + 0.02));                              // Blutflecken
    body.add(box(0.07, 0.08, 0.02, stain, 0.15, th * 0.36, td * 0.56 + 0.02));
    body.add(box(0.06, 0.13, 0.02, stain, -0.05, -0.1, td * 0.57 + 0.02));
    for (const s of [-1, 1]) { const o = box(0.02, 0.2, 0.02, dark, s * 0.07, th * 0.74, td * 0.56 + 0.025); o.rotation.z = -s * 0.35; body.add(o); } // Stethoskop
    body.add(box(0.06, 0.06, 0.03, M(0x9aa0a4), 0, th * 0.6, td * 0.56 + 0.03));
  } else if (p.style === 'worker') {
    const vest = M(0xe0801c), refl = M(0xe8e8c0, { emissive: 0x555540, emissiveIntensity: 0.4 }), beltM = M(0x4a3420);
    body.add(box(tw * 1.06, th * 0.78, td * 1.08, shirt, 0, th * 0.61, 0));                                  // graues Hemd
    for (const s of [-1, 1]) body.add(box(tw * 0.36, th * 0.78, 0.03, vest, s * tw * 0.27, th * 0.61, td * 0.54 + 0.012)); // Warnweste vorn
    body.add(box(tw * 1.04, th * 0.78, 0.03, vest, 0, th * 0.61, -td * 0.54 - 0.012));                       // Warnweste hinten
    for (const f of [0.4, 0.66]) {                                                                           // Reflexstreifen
      body.add(box(tw * 1.0, 0.045, 0.02, refl, 0, th * f, td * 0.54 + 0.03));
      body.add(box(tw * 1.0, 0.045, 0.02, refl, 0, th * f, -td * 0.54 - 0.03));
    }
    for (const s of [-1, 1]) body.add(box(0.07, 0.1, td * 1.12, vest, s * tw * 0.3, th * 0.96, 0));          // Träger über den Schultern
    body.add(box(tw * 1.1, 0.07, td * 1.12, beltM, 0, th * 0.2, 0));                                          // Werkzeuggürtel
    body.add(box(0.025, 0.2, 0.025, M(0x6b4423), tw * 0.5, th * 0.2 - 0.08, 0.02));                           // Hammerstiel
    body.add(box(0.11, 0.045, 0.045, M(0xbfc5ca), tw * 0.5, th * 0.2 + 0.03, 0.02));                          // Hammerkopf
    body.add(box(0.1, 0.11, 0.07, M(0x5a4a30), -0.14, th * 0.2 - 0.02, td * 0.55 + 0.03));                    // Werkzeugtasche
  }

  // Arme (Drehpunkt an der Schulter)
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * p.shX, th - 0.07, 0);
    const up = p.armLen * p.sleeveFrac, low = p.armLen - up;
    if (up > 0) pivot.add(box(p.armW * 1.1, up, p.armW * 1.1, shirt, 0, -up / 2, 0));
    pivot.add(box(p.armW, low, p.armW, skin, 0, -up - low / 2, 0));
    if (p.detail) {
      const handM = p.glove ? M(p.glove) : skin;
      pivot.add(box(p.armW * 1.25, p.armW * 0.9, p.armW * 1.3, handM, 0, -p.armLen - 0.02, 0.01));         // Handfläche
      for (const f of [-1, 0, 1]) pivot.add(box(0.032, 0.09, 0.04, handM, f * 0.04, -p.armLen - 0.1, 0.02)); // Finger
      pivot.add(box(p.armW * 1.15, 0.05, p.armW * 1.15, p.glove ? handM : dark, 0, -p.armLen + 0.05, 0));       // Manschette am Handgelenk
      if (typeId === 'soldier') pivot.add(box(p.armW * 1.7, 0.07, p.armW * 1.7, M(0x2b2f1e), 0, 0.02, 0));     // Schulterpolster
    } else {
      pivot.add(box(p.armW * 1.25, p.armW * 1.1, p.armW * 1.3, skin, 0, -p.armLen - 0.02, 0.01));   // Hand
    }
    body.add(pivot);
    arms.push(pivot);
  }

  // Kopf
  const head = new THREE.Group();
  head.position.set(0, th + 0.02, 0.0);
  head.add(box(0.1, 0.08, 0.1, skin, 0, 0.0, 0));
  const { hw, hh, hd } = p;
  head.add(box(hw, hh, hd, skin, 0, 0.04 + hh / 2, 0.02));
  if (typeId === 'walker') {
    head.add(box(hw * 1.05, 0.07, hd * 1.05, hair, 0, 0.04 + hh + 0.01, 0.02));
    head.add(box(hw * 1.05, hh * 0.5, 0.06, hair, 0, 0.04 + hh * 0.65, -hd / 2 + 0.0));
    head.add(box(0.05, 0.05, 0.05, eye, -0.07, 0.04 + hh * 0.62, hd / 2 + 0.025));
    head.add(box(0.05, 0.05, 0.05, eye, 0.07, 0.04 + hh * 0.62, hd / 2 + 0.025));
  } else if (typeId === 'brute') {
    head.add(box(0.05, 0.07, 0.03, dark, 0.07, 0.04 + hh * 0.62, hd / 2 + 0.03));            // leere Augenhöhle
    head.add(box(0.06, 0.06, 0.05, eye, -0.07, 0.04 + hh * 0.62, hd / 2 + 0.03));
    head.add(box(0.03, hh * 0.5, 0.03, M(0x7a2a24), 0.12, 0.04 + hh * 0.55, hd / 2 + 0.01)); // Narbe
    head.add(box(hw * 1.02, 0.04, hd * 1.02, M(0x6b6f55), 0, 0.04 + hh * 0.98, 0.02));
  } else {
    // die drei genaueren Modelle: Ohren, Nase, Brauen und Augen
    const skinDark = M(darker(p.skin, 0.8));
    for (const s of [-1, 1]) {
      head.add(box(0.04, 0.09, 0.05, skin, s * (hw / 2 + 0.02), 0.04 + hh * 0.5, 0.02));                      // Ohren
      head.add(box(0.09, 0.02, 0.02, dark, s * 0.07, 0.04 + hh * 0.77, hd / 2 + 0.03));                        // Brauen
      head.add(box(0.05, 0.05, 0.05, eye, s * 0.07, 0.04 + hh * 0.62, hd / 2 + 0.025));                        // Augen
    }
    if (typeId !== 'doctor') head.add(box(0.05, 0.08, 0.05, skinDark, 0, 0.04 + hh * 0.42, hd / 2 + 0.04));   // Nase
    if (typeId === 'soldier') {
      head.add(box(hw * 1.18, hh * 0.4, hd * 1.2, hair, 0, 0.04 + hh * 1.0, 0.02));                           // Helm
      head.add(box(hw * 1.18, 0.03, 0.09, hair, 0, 0.04 + hh * 0.82, hd / 2 + 0.07));                         // Helmschirm
      head.add(box(hw * 1.18, hh * 0.45, 0.05, hair, 0, 0.04 + hh * 0.66, -hd / 2 - 0.02));                   // Nackenschutz
      for (const s of [-1, 1]) head.add(box(0.02, hh * 0.55, 0.02, dark, s * hw * 0.55, 0.04 + hh * 0.5, hd * 0.12)); // Kinnriemen
    } else if (typeId === 'doctor') {
      const mask = M(0x7fb7c9);
      head.add(box(hw * 1.05, 0.05, hd * 1.05, hair, 0, 0.04 + hh + 0.005, 0.02));                            // graue Haare
      head.add(box(hw * 1.05, hh * 0.55, 0.06, hair, 0, 0.04 + hh * 0.62, -hd / 2));
      for (const s of [-1, 1]) head.add(box(0.04, hh * 0.4, hd * 0.6, hair, s * hw / 2, 0.04 + hh * 0.6, 0));
      head.add(box(hw * 0.95, hh * 0.42, 0.05, mask, 0, 0.04 + hh * 0.28, hd / 2 + 0.035));                    // Mundschutz
      for (const s of [-1, 1]) head.add(box(0.115, 0.1, 0.02, dark, s * 0.075, 0.04 + hh * 0.62, hd / 2 + 0.025)); // Brillenrahmen
      head.add(box(0.04, 0.02, 0.02, dark, 0, 0.04 + hh * 0.66, hd / 2 + 0.03));                              // Brillensteg
    } else if (typeId === 'worker') {
      const hat = M(0xe8c020);
      head.add(box(hw * 1.15, hh * 0.4, hd * 1.18, hat, 0, 0.04 + hh * 1.0, 0.02));                           // Schutzhelm
      head.add(box(0.06, 0.03, hd * 1.2, hat, 0, 0.04 + hh * 1.22, 0.02));                                    // Helmkamm
      head.add(box(hw * 1.15, 0.025, 0.1, hat, 0, 0.04 + hh * 0.82, hd / 2 + 0.08));                          // Schirm
      head.add(box(hw * 0.9, hh * 0.3, 0.05, hair, 0, 0.04 + hh * 0.6, -hd / 2 - 0.01));                      // Haare im Nacken
      head.add(box(hw * 0.9, hh * 0.18, 0.04, hair, 0, 0.04 + hh * 0.12, hd / 2 + 0.015));                    // Bartstoppeln
    }
  }
  head.add(box(hw * 0.55, 0.045, 0.03, dark, 0, 0.04 + hh * 0.22, hd / 2 + 0.035));         // Mund
  [-0.05, 0.05].forEach((x) => head.add(box(0.025, 0.03, 0.02, bone, x, 0.04 + hh * 0.27, hd / 2 + 0.045))); // Zähne
  body.add(head);

  const rig = { body, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], head, baseY: p.legLen };
  return { group: g, rig, mats };
}
