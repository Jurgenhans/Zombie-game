// Die Spielwelt: Boden, Himmel, Spielerfigur, Kamera, Steuerung.

import * as THREE from 'three';
import { MAP_SIZE, FIELD_SIZE, WALK_SPEED, RUN_SPEED, BIOME_NAMES } from './config.js';
import { createTerrain, createSky, SKY_HORIZON, FOG_NEAR, FOG_FAR } from './terrain.js';
import { fieldAtWorld, fieldCenter, fieldRowCol, fieldNumber } from './mapgen.js';
import { createActor } from './characters.js';

const EDGE = 1.5; // Abstand zum Kartenrand

export class Game {
  constructor(renderer, biomes, splat) {
    this.renderer = renderer;
    this.biomes = biomes;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.2, 9000);

    this.terrain = createTerrain({ biomes, splat, maxAniso: renderer.capabilities.getMaxAnisotropy() });
    this.scene.add(this.terrain.mesh);
    this.sky = createSky();
    this.scene.add(this.sky);

    // Boden außerhalb der Karte (dunkel = "Rand der Welt")
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x2f3b45 })
    );
    outer.position.set(MAP_SIZE / 2, -0.3, MAP_SIZE / 2);
    outer.material.fog = true;
    this.scene.add(outer);
    this.scene.fog = new THREE.Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR);

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b7a5a, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(40, 80, 30);
    this.scene.add(sun);

    // weicher Schatten unter dem Spieler
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
    );
    this.shadow.position.y = 0.03;
    this.scene.add(this.shadow);

    // Zustand
    this.mode = 'backdrop';            // 'backdrop' (Menühintergrund) | 'play'
    this.paused = false;
    this.player = { x: MAP_SIZE / 2, z: MAP_SIZE / 2, yaw: 0 };
    this.actor = null;
    this.actorId = null;
    this.activeField = -1;
    this.cam = { yaw: 0, pitch: 0.35, dist: 6.5 };
    this.keys = new Set();
    this.backdropT = 0;
    this.moving = false;
    this.backdropCenter = { x: MAP_SIZE / 2, z: MAP_SIZE / 2 };

    this._bindInput();
  }

  // ---- Menühintergrund: Kamera kreist über der Karte -------------------------------
  setBackdropCenter(x, z) { this.backdropCenter = { x, z }; }

  // ---- Spiel starten ---------------------------------------------------------------
  startPlay({ characterId, x, z, yaw = 0, activeField }) {
    if (this.actor) { this.scene.remove(this.actor.group); this.actor = null; }
    this.actor = createActor(characterId);
    this.actorId = characterId;
    this.scene.add(this.actor.group);
    this.actor.play('Idle_A');
    this.player = { x, z, yaw };
    this.cam.yaw = yaw + Math.PI;   // Kamera hinter die Figur
    this.mode = 'play';
    this.paused = false;
    this.shadow.visible = true;
    this.setActiveField(activeField ?? fieldAtWorld(x, z));
    this._syncActor();
  }

  stopPlay() {
    this.mode = 'backdrop';
    if (this.actor) { this.scene.remove(this.actor.group); this.actor = null; }
    this.shadow.visible = false;
    this.keys.clear();
  }

  setActiveField(idx) {
    this.activeField = idx;
    if (idx < 0) this.terrain.setActiveField(-1, -1);
    else { const { row, col } = fieldRowCol(idx); this.terrain.setActiveField(row, col); }
  }

  teleportToField(idx) {
    const c = fieldCenter(idx);
    this.player.x = c.x; this.player.z = c.z;
    this.setActiveField(idx);
    this._syncActor();
  }

  get currentField() { return fieldAtWorld(this.player.x, this.player.z); }
  get currentBiomeName() { return BIOME_NAMES[this.biomes[this.currentField]]; }
  get currentFieldNumber() { return fieldNumber(this.currentField); }

  toggleGrid() { this.terrain.setGrid(!this.terrain.gridOn); }

  saveData() {
    return { characterId: this.actorId, x: this.player.x, z: this.player.z, yaw: this.player.yaw, activeField: this.activeField };
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- Eingabe ---------------------------------------------------------------------
  _bindInput() {
    const el = this.renderer.domElement;
    let dragging = false;
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'play') return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && this.mode === 'play' && !this.paused) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'play') return;
      dragging = true; el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointerup', (e) => { dragging = false; el.releasePointerCapture?.(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!dragging || this.mode !== 'play' || this.paused) return;
      this.cam.yaw -= e.movementX * 0.005;
      this.cam.pitch = Math.min(1.35, Math.max(-0.1, this.cam.pitch + e.movementY * 0.004));
    });
    el.addEventListener('wheel', (e) => {
      if (this.mode !== 'play' || this.paused) return;
      this.cam.dist = Math.min(16, Math.max(2.5, this.cam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: true });
  }

  // ---- Update ----------------------------------------------------------------------
  update(dt) {
    if (this.mode === 'backdrop') { this._updateBackdrop(dt); return; }
    this._updatePlay(dt);
  }

  _updateBackdrop(dt) {
    this.backdropT += dt * 0.05;
    const { x, z } = this.backdropCenter;
    const R = 260;
    this.camera.position.set(x + Math.cos(this.backdropT) * R, 55, z + Math.sin(this.backdropT) * R);
    this.camera.lookAt(x, 6, z);
    this.sky.position.copy(this.camera.position);
  }

  _updatePlay(dt) {
    const k = this.keys;
    let ix = 0, iz = 0;
    if (!this.paused) {
      if (k.has('KeyW') || k.has('ArrowUp')) iz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) iz -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    }
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const len = Math.hypot(ix, iz);
    this.moving = len > 0;

    if (this.moving) {
      ix /= len; iz /= len;
      const s = Math.sin(this.cam.yaw), c = Math.cos(this.cam.yaw);
      // Kamerarichtung nach vorn = (-s, -c), rechts = (c, -s)
      const dx = -s * iz + c * ix;
      const dz = -c * iz - s * ix;
      const speed = run ? RUN_SPEED : WALK_SPEED;
      this.player.x = Math.min(MAP_SIZE - EDGE, Math.max(EDGE, this.player.x + dx * speed * dt));
      this.player.z = Math.min(MAP_SIZE - EDGE, Math.max(EDGE, this.player.z + dz * speed * dt));
      // Figur dreht sich weich in Laufrichtung (Modelle blicken nach +Z)
      const target = Math.atan2(dx, dz);
      let diff = target - this.player.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.player.yaw += diff * (1 - Math.exp(-dt * 14));
      this.actor.play(run ? 'Running_A' : 'Walking_B', { speed: 1 });
    } else {
      this.actor.play('Idle_A');
    }

    this.actor.update(dt);
    this._syncActor();
  }

  _syncActor() {
    if (!this.actor) return;
    const { x, z, yaw } = this.player;
    this.actor.group.position.set(x, 0, z);
    this.actor.group.rotation.y = yaw;
    this.shadow.position.x = x; this.shadow.position.z = z;

    // Kamera hinter dem Spieler
    const { yaw: cy, pitch, dist } = this.cam;
    const tx = x, ty = 1.5, tz = z;
    this.camera.position.set(
      tx + Math.sin(cy) * Math.cos(pitch) * dist,
      Math.max(0.5, ty + Math.sin(pitch) * dist),
      tz + Math.cos(cy) * Math.cos(pitch) * dist
    );
    this.camera.lookAt(tx, ty, tz);
    this.sky.position.copy(this.camera.position);
  }

  render() {
    this.terrain.setCamera(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
}

export { FIELD_SIZE };
