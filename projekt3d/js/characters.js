// Lädt die KayKit-Charaktere (GLB) und die Animationen und baut daraus spielbare Figuren.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CHARACTERS } from './config.js';

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

  return { group, root, mixer, play, update: (dt) => mixer.update(dt) };
}
