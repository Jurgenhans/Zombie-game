// 3D-Modelle der Waffen (aus einfachen Formen gebaut).
// Ursprung = Griff, Hauptachse zeigt nach +Y. Die Figur blickt nach +Z (vorn).
// WEAPON_STYLE: in welcher Hand die Waffe sitzt und wie sie beim Schlag geneigt wird
// (keys: [Zeitpunkt 0..1, Neigung in rad]; positiv = Spitze nach vorn; erster Wert = Ruhehaltung).

import * as THREE from 'three';

const mat = (color, metal = 0.6, rough = 0.4, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
const STEEL = () => mat(0xdfe5ea, 0.9, 0.2);
const GOLD = () => mat(0xd9a521, 0.8, 0.3);
const WOOD = () => mat(0x6b4423, 0.05, 0.85);
const DARK_WOOD = () => mat(0x3f2814, 0.05, 0.85);
const LEATHER = () => mat(0x4a2d18, 0, 0.9);

function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; }

// Stab zwischen zwei Punkten
function rod(a, b, r, m) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
  o.position.copy(A).add(B).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
  return o;
}

function buildSword() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10), LEATHER()));              // Griff
  g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), GOLD(), 0, -0.14, 0));              // Knauf
  g.add(mesh(new THREE.BoxGeometry(0.07, 0.05, 0.3), GOLD(), 0, 0.15, 0));               // Parierstange
  g.add(mesh(new THREE.BoxGeometry(0.022, 0.8, 0.085), STEEL(), 0, 0.58, 0));            // Klinge (Schneide nach vorn)
  const tip = mesh(new THREE.ConeGeometry(0.0425, 0.16, 4), STEEL(), 0, 1.06, 0);
  tip.scale.set(0.26, 1, 1);
  g.add(tip);
  return g;
}

function buildAxe() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.0, 10), WOOD(), 0, 0.35, 0));     // Schaft
  g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), GOLD(), 0, -0.15, 0));
  const s = new THREE.Shape();
  s.moveTo(0.03, 0.56); s.lineTo(0.14, 0.5); s.lineTo(0.28, 0.4); s.lineTo(0.31, 0.7);
  s.lineTo(0.28, 1.0); s.lineTo(0.14, 0.9); s.lineTo(0.03, 0.84); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  geo.translate(0, 0, -0.025);
  geo.rotateY(-Math.PI / 2);                                                             // Schneide zeigt nach +Z (vorn)
  g.add(new THREE.Mesh(geo, STEEL()));
  g.add(mesh(new THREE.ConeGeometry(0.035, 0.18, 6), STEEL(), 0, 0.97, 0));              // Spitze oben
  g.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.06, 8), GOLD(), 0, 0.5, 0));
  return g;
}

function buildBow() {
  const g = new THREE.Group();
  const h = 0.65, bulge = 0.22, n = 14, pts = [];
  for (let i = -n; i <= n; i++) {
    const y = (i / n) * h;
    pts.push(new THREE.Vector3(0, y, bulge * (1 - (y / h) ** 2) - bulge));               // Griff (Mitte) liegt im Ursprung
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.022, 6), WOOD()));
  g.add(rod([0, -h, -bulge], [0, h, -bulge], 0.004, mat(0xf2ead0, 0, 0.9)));              // Sehne (zum Schützen hin)
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), LEATHER()));                // Griffwicklung
  for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), GOLD(), 0, s * h, -bulge));
  return g;
}

function buildStaff() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.75, 8), DARK_WOOD(), 0, 0.3, 0)); // Schaft
  g.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.22, 8), LEATHER(), 0, 0, 0));    // Griffwicklung
  g.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 8), GOLD(), 0, -0.6, 0).rotateX(Math.PI)); // Fußspitze
  const ring = mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), GOLD(), 0, 1.22, 0);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
  const ring2 = ring.clone(); ring2.rotation.y = 0; g.add(ring2);
  g.add(mesh(new THREE.SphereGeometry(0.07, 14, 12),
    mat(0x66ccff, 0.1, 0.2, { emissive: 0x2aa8ff, emissiveIntensity: 1.6 }), 0, 1.22, 0)); // leuchtender Kristall
  return g;
}

function buildCrossbow() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.75, 0.07), DARK_WOOD(), 0, 0.12, 0));         // Schaft
  g.add(mesh(new THREE.BoxGeometry(0.025, 0.08, 0.03), STEEL(), 0, 0.0, 0.05));          // Abzug (Unterseite)
  const pts = [];
  for (let i = -8; i <= 8; i++) { const x = (i / 8) * 0.32; pts.push(new THREE.Vector3(x, 0.4 + 0.1 * (x / 0.32) ** 2, 0)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.02, 6), WOOD())); // Bogenarme
  const sm = mat(0xf2ead0, 0, 0.9);
  g.add(rod([-0.32, 0.5, 0], [0, 0.22, 0], 0.005, sm));
  g.add(rod([0.32, 0.5, 0], [0, 0.22, 0], 0.005, sm));
  g.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.5, 6), STEEL(), 0, 0.46, -0.05)); // Bolzen (Oberseite)
  g.add(mesh(new THREE.ConeGeometry(0.02, 0.07, 6), STEEL(), 0, 0.74, -0.05));
  return g;
}

const BUILDERS = { sword_test: buildSword, axe_test: buildAxe, bow_test: buildBow, staff_test: buildStaff, crossbow_test: buildCrossbow };

export const WEAPON_STYLE = {
  sword_test:    { hand: 'r', keys: [[0, 0.6], [0.3, -1.0], [0.6, 2.2], [1, 0.6]] },     // Hieb
  axe_test:      { hand: 'r', keys: [[0, 0.5], [0.35, -1.2], [0.65, 2.3], [1, 0.5]] },   // schwerer Hieb
  staff_test:    { hand: 'r', keys: [[0, 0.1], [0.35, -0.5], [0.6, 1.3], [1, 0.1]] },    // Zauber: Stab nach vorn
  bow_test:      { hand: 'l', keys: [[0, 0.1], [0.4, 0.3], [0.6, 0.1], [1, 0.1]] },      // Bogen in der linken Hand
  crossbow_test: { hand: 'r', keys: [[0, 1.35], [0.3, 1.5], [0.5, 1.2], [1, 1.35]] },    // Armbrust nach vorn gehalten
};

export function createWeaponMesh(id) {
  const b = BUILDERS[id];
  return b ? b() : null;
}
