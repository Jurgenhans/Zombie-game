// Zwei Lowpoly-Zombie-Modelle, komplett aus Würfeln gebaut (flach schattiert, mit Gelenken zum Animieren).
//  - walker: "Schlurfer" (normal groß, blaues zerrissenes Hemd)
//  - brute:  "Brocken"  (groß, breit, gebückt, Weste mit sichtbaren Rippen)
// Figur blickt nach +Z, Füße bei y = 0.

import * as THREE from 'three';

export const ZOMBIE_SCALE = 1.3;   // Größe der Zombies (1.3 = 30 % größer)

// hp = Lebenspunkte des Zombies. Jeder Treffer zieht den Schaden der Waffe ab (inkl. Schaden-Skill).
export const ZOMBIE_TYPES = {
  walker: { name: 'Schlurfer', hp: 20, speed: 1.6, height: 1.85 * ZOMBIE_SCALE, radius: 0.55 * ZOMBIE_SCALE, lean: 0.12, damage: 4 },
  brute:  { name: 'Brocken',   hp: 40, speed: 1.1, height: 1.95 * ZOMBIE_SCALE, radius: 0.75 * ZOMBIE_SCALE, lean: 0.32, damage: 7 },
};

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
};

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...extra });
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  return o;
}

export function createZombieModel(typeId) {
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
    g.add(pivot);
    legs.push(pivot);
  }

  // Rumpf
  const { tw, th, td } = p;
  body.add(box(tw, th, td, skin, 0, th / 2, 0));
  if (p.style === 'shirt') {
    body.add(box(tw * 1.07, th * 0.78, td * 1.1, shirt, 0, th - th * 0.39, 0));
    [[-0.15, 0.12], [0.0, 0.16], [0.14, 0.1]].forEach(([x, h]) => body.add(box(0.1, h, 0.02, shirt, x, th * 0.22, td * 0.55 + 0.01))); // Fetzen
  } else {
    body.add(box(tw * 1.04, th * 0.85, 0.08, shirt, 0, th * 0.5, -td / 2 - 0.02));              // Weste hinten
    for (const s of [-1, 1]) body.add(box(0.12, th * 0.85, td * 1.1, shirt, s * (tw / 2 - 0.02), th * 0.5, 0)); // Seiten
    [0.18, 0.34, 0.5].forEach((f) => body.add(box(tw * 0.55, 0.035, 0.03, bone, 0, th * f + 0.1, td / 2 + 0.012))); // Rippen
  }

  // Arme (Drehpunkt an der Schulter)
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * p.shX, th - 0.07, 0);
    const up = p.armLen * p.sleeveFrac, low = p.armLen - up;
    if (up > 0) pivot.add(box(p.armW * 1.1, up, p.armW * 1.1, shirt, 0, -up / 2, 0));
    pivot.add(box(p.armW, low, p.armW, skin, 0, -up - low / 2, 0));
    pivot.add(box(p.armW * 1.25, p.armW * 1.1, p.armW * 1.3, skin, 0, -p.armLen - 0.02, 0.01));   // Hand
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
  } else {
    head.add(box(0.05, 0.07, 0.03, dark, 0.07, 0.04 + hh * 0.62, hd / 2 + 0.03));            // leere Augenhöhle
    head.add(box(0.06, 0.06, 0.05, eye, -0.07, 0.04 + hh * 0.62, hd / 2 + 0.03));
    head.add(box(0.03, hh * 0.5, 0.03, M(0x7a2a24), 0.12, 0.04 + hh * 0.55, hd / 2 + 0.01)); // Narbe
    head.add(box(hw * 1.02, 0.04, hd * 1.02, M(0x6b6f55), 0, 0.04 + hh * 0.98, 0.02));
  }
  head.add(box(hw * 0.55, 0.045, 0.03, dark, 0, 0.04 + hh * 0.22, hd / 2 + 0.035));         // Mund
  [-0.05, 0.05].forEach((x) => head.add(box(0.025, 0.03, 0.02, bone, x, 0.04 + hh * 0.27, hd / 2 + 0.045))); // Zähne
  body.add(head);

  const rig = { body, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], head, baseY: p.legLen };
  return { group: g, rig, mats };
}
