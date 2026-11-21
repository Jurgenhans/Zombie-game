// Lädt die KayKit-Charaktere (GLB) und die Animationen und baut daraus spielbare Figuren.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CHARACTERS } from './config.js';
import { createWeaponMesh } from './weapons.js';

const loader = new GLTFLoader();
export const assets = { models: {}, clips: {} };

export async function loadAssets(onProgress) {
  const jobs = [
    ...CHARACTERS.map((c) => ({ kind: 'char', id: c.id, url: `assets/characters/${c.id}.glb` })),
    { kind: 'anim', url: 'assets/animations/Rig_Medium_General.glb' },
    { kind: 'anim', url: 'assets/animations/Rig_Medium_MovementBasic.glb' },
  ];
  let done = 0;
  await Promise.all(jobs.map(async (job) => {
    const gltf = await loader.loadAsync(job.url);
    if (job.kind === 'char') {
      assets.models[job.id] = gltf.scene;
    } else {
      for (const clip of gltf.animations) if (clip.name !== 'T-Pose') assets.clips[clip.name] = clip;
    }
    onProgress?.(++done / jobs.length);
  }));
}

// Eine spielbare Figur mit eigenem AnimationMixer.
export function createActor(characterId) {
  const root = cloneSkinned(assets.models[characterId]);
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  const group = new THREE.Group();
  group.add(root);

  const mixer = new THREE.AnimationMixer(root);
  const cache = {};
  let current = null;

  function action(name) {
    if (!(name in cache)) {
      const clip = assets.clips[name];
      cache[name] = clip ? mixer.clipAction(clip) : null;
    }
    return cache[name];
  }

  function play(name, { fade = 0.2, speed = 1 } = {}) {
    const next = action(name);
    if (!next) return;
    if (next === current) { next.timeScale = speed; return; }
    next.reset();
    next.timeScale = speed;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = next;
  }

  // Einmal abspielen (z. B. Schlag). Gibt die Dauer in Sekunden zurück.
  function playOnce(name, { fade = 0.08, speed = 1 } = {}) {
    const next = action(name);
    if (!next) return 0.5;
    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.timeScale = speed;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.fadeIn(fade).play();
    if (current && current !== next) current.fadeOut(fade);
    current = next;
    return next.getClip().duration / speed;
  }

  // Waffe in der rechten Hand. Die Ausrichtung der Waffe wird hier selbst berechnet,
  // sie folgt nur der Handposition (Schwung: swing 0..1, -1 = Ruhehaltung).
  const hand = root.getObjectByName('handslot.r');
  let weapon = null, weaponId = null;
  const inv = new THREE.Matrix4();
  function setWeapon(id) {
    if (id === weaponId) return;
    if (weapon) group.remove(weapon);
    weapon = id ? createWeaponMesh(id) : null;
    weaponId = weapon ? id : null;
    if (weapon) group.add(weapon);
  }
  const KEYS = [[0, 0.6], [0.3, -1.0], [0.6, 2.2], [1, 0.6]];   // Neigung der Klinge (rad): Ruhe, Ausholen, Schlag, zurück
  const ease = (t) => t * t * (3 - 2 * t);
  function swingAngle(u) {
    for (let i = 1; i < KEYS.length; i++) {
      if (u <= KEYS[i][0]) { const [t0, a0] = KEYS[i - 1], [t1, a1] = KEYS[i]; return a0 + (a1 - a0) * ease((u - t0) / (t1 - t0)); }
    }
    return KEYS[0][1];
  }
  function updateWeapon(swing) {
    if (!weapon || !hand) return;
    root.updateMatrixWorld(true);
    inv.copy(group.matrixWorld).invert().multiply(hand.matrixWorld);
    weapon.position.setFromMatrixPosition(inv);
    weapon.rotation.set(swing < 0 ? KEYS[0][1] : swingAngle(Math.min(1, swing)), 0, 0);
  }

  return { group, root, mixer, play, playOnce, setWeapon, update: (dt, swing = -1) => { mixer.update(dt); updateWeapon(swing); } };
}
