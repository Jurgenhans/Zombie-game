// Händler-NPC: ein Zombie aus dem Zombie-Set, bei dem alles Rote (Blut) aus Texturen und Materialien entfernt wurde
// (assets/npc/Zombie_NPC.glb, Grundlage: Zombie_135). Er steht im Dorf (Feld 35) und verkauft rote HP-Tränke.
// Er greift nicht an, bewegt sich nicht (nur leichtes Atmen und Kopfdrehen) und ist für den Spieler fest.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assets } from './characters.js';
import { ZOMBIE_TYPES, createZombieModel } from './zombies.js';

const NPC_HEIGHT = 2.0;   // etwas kleiner als die normalen Zombies (2,4 m)

export async function loadNpc() {
  const gltf = await new GLTFLoader().loadAsync('assets/npc/Zombie_NPC.glb');
  gltf.scene.traverse((o) => { if (o.isMesh) o.geometry.userData.keep = true; });
  assets.zombies.npc = gltf.scene;
  ZOMBIE_TYPES.npc = { name: 'Händler', hp: 1, speed: 0, height: NPC_HEIGHT, radius: 0.6, lean: 0, damage: 0, glb: true, rest: true };
}

// Namensschild über dem Kopf
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(18,14,9,0.82)'; g.strokeStyle = '#ffc83c'; g.lineWidth = 3;
  g.beginPath(); if (g.roundRect) g.roundRect(4, 6, 248, 52, 14); else g.rect(4, 6, 248, 52); g.fill(); g.stroke();
  g.fillStyle = '#ffc83c'; g.font = '700 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(2.2, 0.55, 1);
  return sp;
}

export function createNpc({ x, z, yaw = 0 }) {
  const m = createZombieModel('npc');
  const group = new THREE.Group();
  group.add(m.group);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  const label = makeLabel('Händler');
  label.position.set(0, NPC_HEIGHT + 0.55, 0);
  group.add(label);
  label.rotation.y = -yaw;

  const R = 0.7;   // Kollisionsradius
  let t = Math.random() * 10;
  return {
    group, x, z,
    dist: (px, pz) => Math.hypot(px - x, pz - z),
    // ruhige Leerlauf-Bewegung: atmen und den Kopf langsam hin und her drehen
    update(dt) {
      t += dt;
      const r = m.rig;
      if (!r) return;
      r.body.position.y = r.baseY + Math.sin(t * 1.7) * 0.012;
      r.head.rotation.y = Math.sin(t * 0.45) * 0.4;
      r.head.rotation.x = Math.sin(t * 0.9) * 0.04;
    },
    // Schiebt einen Kreis (px, pz, r) aus dem Händler heraus
    collide(px, pz, r = 0.45) {
      const dx = px - x, dz = pz - z, min = R + r, d2 = dx * dx + dz * dz;
      if (d2 >= min * min) return { x: px, z: pz };
      const d = Math.sqrt(d2) || 0.0001;
      return { x: x + (dx / d) * min, z: z + (dz / d) * min };
    },
  };
}
