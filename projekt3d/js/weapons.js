// 3D-Modelle der Waffen (aus einfachen Formen gebaut). Ursprung = Griff, Klinge zeigt nach +Y.

import * as THREE from 'three';

function mat(color, metal = 0.6, rough = 0.4) { return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }); }

function buildSword() {
  const g = new THREE.Group();
  const add = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10), mat(0x5a3a1e, 0, 0.9), 0);                 // Griff
  add(new THREE.SphereGeometry(0.045, 10, 8), mat(0xd9a521, 0.8, 0.3), -0.14);                      // Knauf
  add(new THREE.BoxGeometry(0.3, 0.05, 0.07), mat(0xd9a521, 0.8, 0.3), 0.15);                       // Parierstange
  add(new THREE.BoxGeometry(0.085, 0.8, 0.022), mat(0xdfe5ea, 0.9, 0.2), 0.58);                     // Klinge
  const tip = add(new THREE.ConeGeometry(0.0605, 0.16, 4), mat(0xdfe5ea, 0.9, 0.2), 1.06);          // Spitze
  tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.26);
  return g;
}

export function createWeaponMesh(id) {
  if (id === 'sword_test') return buildSword();
  return null;
}
