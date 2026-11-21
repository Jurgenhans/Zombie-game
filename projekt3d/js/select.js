// Charakterwahl: alle Modelle stehen nebeneinander, der gewählte dreht sich.

import * as THREE from 'three';
import { CHARACTERS } from './config.js';
import { createActor } from './characters.js';

const SPACING = 2.4;

export class CharacterSelect {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14110d);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.index = 0;
    this.slots = [];
    this.camX = 0;
    this.time = 0;
    this.onChange = null;

    this.scene.add(new THREE.HemisphereLight(0xfff0d6, 0x2a2318, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 6, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc880, 1.2);
    rim.position.set(-4, 3, -5);
    this.scene.add(rim);

    // Boden
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 20),
      new THREE.MeshStandardMaterial({ color: 0x1f1a14, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.01, 0);
    this.scene.add(floor);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    CHARACTERS.forEach((def, i) => {
      const actor = createActor(def.id);
      const holder = new THREE.Group();
      holder.position.x = i * SPACING;
      holder.add(actor.group);

      const pedMat = new THREE.MeshStandardMaterial({ color: 0x3a3024, roughness: 0.8, metalness: 0.1 });
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.14, 40), pedMat);
      pedestal.position.y = -0.07;
      holder.add(pedestal);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.03, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xffc83c })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.01;
      holder.add(ring);

      // unsichtbare Klickfläche
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 2.3, 1.2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 1.1;
      hit.userData.index = i;
      holder.add(hit);

      actor.play(i % 2 ? 'Idle_B' : 'Idle_A');
      actor.mixer.update(Math.random() * 2); // nicht alle im Gleichschritt
      this.scene.add(holder);
      this.slots.push({ def, actor, holder, ring, pedMat, hit, spin: 0 });
    });
  }

  get selected() { return CHARACTERS[this.index]; }

  select(i) {
    const n = CHARACTERS.length;
    this.index = ((i % n) + n) % n;
    this.onChange?.(this.selected, this.index);
  }
  next() { this.select(this.index + 1); }
  prev() { this.select(this.index - 1); }

  enter(index = 0) {
    this.select(index);
    this.camX = this.index * SPACING;
    this.resize();
  }

  resize() {
    const w = this.renderer.domElement.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    // schmale Fenster: weiter wegrücken, damit die Figur passt
    this.camDist = this.camera.aspect < 1 ? 9.5 : 7.2;
    this.camera.updateProjectionMatrix();
  }

  pick(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.slots.map((s) => s.hit), false);
    if (hits.length) { this.select(hits[0].object.userData.index); return true; }
    return false;
  }

  update(dt) {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 6);
    this.camX += (this.index * SPACING - this.camX) * k;
    this.camera.position.set(this.camX, 1.9, this.camDist || 7.2);
    this.camera.lookAt(this.camX, 1.0, 0);

    this.slots.forEach((s, i) => {
      s.actor.update(dt);
      const sel = i === this.index;
      const targetScale = sel ? 1.12 : 0.92;
      const sc = s.holder.scale.x + (targetScale - s.holder.scale.x) * k;
      s.holder.scale.setScalar(sc);
      if (sel) s.spin += dt * 0.8;
      else s.spin += (Math.round(s.spin / (Math.PI * 2)) * Math.PI * 2 - s.spin) * k; // zurück nach vorne drehen
      s.actor.group.rotation.y = s.spin;
      s.ring.visible = sel;
      s.pedMat.color.setHex(sel ? 0x5a4630 : 0x3a3024);
    });
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
