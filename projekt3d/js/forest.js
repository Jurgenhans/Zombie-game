// Wald in Feld 45: viele Bäume dicht an dicht und viel Gras (Modelle aus assets/forest/, "Free Forest Nature Pack").
// Alles wird als InstancedMesh in Blöcken (Chunks) gezeichnet: wenige Zeichenaufrufe, Blöcke außerhalb der Sicht
// bzw. das Gras weit weg werden nicht gezeichnet.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIELD_SIZE, GRID, MAP_SEED } from './config.js';

export const FOREST_FIELD = 45;                       // Feldnummer (1..100)
const row = Math.floor((FOREST_FIELD - 1) / GRID), col = (FOREST_FIELD - 1) % GRID;
const X0 = col * FIELD_SIZE, Z0 = row * FIELD_SIZE;  // Ecke des Feldes (Meter)

const TREE_SPACING = 5.0;   // Meter zwischen den Bäumen (kleiner = dichter)
const TREE_SKIP = 0.2;      // Anteil Bäume, der weggelassen wird (0.2 = 20 % weniger)
const GRASS_COUNT = 16000;  // Grasbüschel im ganzen Feld
const TRUNK_R = 0.6;        // Stamm-Radius für die Kollision
const TREE_CHUNK = 60, GRASS_CHUNK = 40;
const GRASS_VIEW = 100;     // Gras weiter weg wird nicht gezeichnet
const EDGE_MARGIN = 2;      // Abstand der Bäume zum Feldrand

const DIR = 'assets/forest/';
// [Datei, Gewicht] – nur die sparsamen (wenige Dreiecke) Modelle, damit es auch am Handy läuft
const TREES = [
  ['Flat_Tree_Spruce_medium', 3], ['Flat_Tree_Spruce_small', 2],
  ['Flat_Tree_Cypress_large', 1], ['Flat_Tree_Cypress_medium', 1],
  ['Flat_Tree_Oak_small_green', 2], ['Flat_Tree_Oak_medium_green', 1],
  ['Flat_Tree_Park_medium_green', 2], ['Flat_Tree_Simple_small', 2],
  ['Flat_Tree_Birch_small_green', 1], ['Flat_Tree_Maple_red', 1],
];
const GRASS = [['Flat_Grass_small', 5], ['Flat_Grass_medium', 3], ['Flat_Grass_large', 2]];

const loader = new GLTFLoader();

// Modell laden und in Teile (Geometrie + Material) zerlegen, Knoten-Transformation fest eingebaut
async function loadParts(name, doubleSide) {
  const gltf = await loader.loadAsync(`${DIR}${name}.glb`);
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const mat = o.material.clone();
    if (doubleSide) mat.side = THREE.DoubleSide;
    parts.push({ geo, mat });
  });
  return parts;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pickWeighted(list, r) {
  const sum = list.reduce((a, b) => a + b[1], 0);
  let v = r * sum;
  for (let i = 0; i < list.length; i++) { v -= list[i][1]; if (v <= 0) return i; }
  return list.length - 1;
}

export async function loadForest() {
  const [trees, grass] = await Promise.all([
    Promise.all(TREES.map(([n]) => loadParts(n, false))),
    Promise.all(GRASS.map(([n]) => loadParts(n, true))),
  ]);
  return { trees, grass };
}

// Baut den Wald. `clear` beschreibt die freien Flächen: Weg (Breite pathW) vom Start zur Lichtung mit dem Zombie-Haufen,
// dazu ein kleiner freier Platz am Start (startR) und die runde Lichtung (hordeR). Überall sonst steht Wald.
export function createForest({ trees, grass }, clear) {
  const group = new THREE.Group();
  const rnd = rng(MAP_SEED ^ 0x5f3759df);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  const { start: S, horde: H } = clear;
  // Wege als Strecken {a, b, w}: Startweg zur Lichtung und der Durchgangsweg von Feld 35 (Norden) nach Feld 55 (Süden)
  const cx = X0 + FIELD_SIZE / 2;
  const paths = [
    { a: S, b: H, w: clear.pathW },
    { a: { x: cx, z: Z0 }, b: { x: cx, z: Z0 + FIELD_SIZE }, w: clear.pathW },
  ];
  const segDist = (p, x, z) => {
    const dx = p.b.x - p.a.x, dz = p.b.z - p.a.z;
    const t = Math.max(0, Math.min(1, ((x - p.a.x) * dx + (z - p.a.z) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - (p.a.x + dx * t), z - (p.a.z + dz * t));
  };
  // 0 = Wald, 1 = Weg, 2 = Lichtung/Startplatz (Bäume stehen nur im Wald)
  const zoneAt = (x, z) => {
    if (Math.hypot(x - H.x, z - H.z) < clear.hordeR || Math.hypot(x - S.x, z - S.z) < clear.startR) return 2;
    return paths.some((p) => segDist(p, x, z) < p.w / 2) ? 1 : 0;
  };

  // 1) Positionen: Bäume auf verschobenem Gitter, Gras zufällig
  const treeList = [];
  const n = Math.floor((FIELD_SIZE - 2 * EDGE_MARGIN) / TREE_SPACING);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = X0 + EDGE_MARGIN + (i + 0.5 + (rnd() - 0.5) * 0.7) * TREE_SPACING;
    const z = Z0 + EDGE_MARGIN + (j + 0.5 + (rnd() - 0.5) * 0.7) * TREE_SPACING;
    if (zoneAt(x, z) !== 0 || rnd() < TREE_SKIP) continue;   // TREE_SKIP: lichterer Wald
    treeList.push({ x, z, type: pickWeighted(TREES, rnd()), yaw: rnd() * Math.PI * 2, s: 0.8 + rnd() * 0.45 });
  }
  const grassList = [];
  for (let i = 0; i < GRASS_COUNT; i++) {
    const x = X0 + rnd() * FIELD_SIZE, z = Z0 + rnd() * FIELD_SIZE;
    const zone = zoneAt(x, z);
    if (zone === 1 && rnd() < 0.9) continue;   // Weg: fast kein Gras (ausgetretener Pfad)
    if (zone === 2 && rnd() < 0.5) continue;   // Lichtung: etwas weniger Gras
    grassList.push({ x, z, type: pickWeighted(GRASS, rnd()), yaw: rnd() * Math.PI * 2, s: 0.8 + rnd() * 0.6 });
  }

  // 2) Je Chunk und Modell ein InstancedMesh pro Modellteil
  const build = (list, models, chunkSize, tag) => {
    const chunks = new Map();
    for (const p of list) {
      const k = `${Math.floor((p.x - X0) / chunkSize)},${Math.floor((p.z - Z0) / chunkSize)}`;
      if (!chunks.has(k)) chunks.set(k, []);
      chunks.get(k).push(p);
    }
    const out = [];
    for (const items of chunks.values()) {
      const holder = new THREE.Group();
      let cx = 0, cz = 0;
      for (const p of items) { cx += p.x; cz += p.z; }
      holder.userData = { cx: cx / items.length, cz: cz / items.length, size: chunkSize, tag };
      models.forEach((parts, t) => {
        const of = items.filter((p) => p.type === t);
        if (!of.length) return;
        for (const { geo, mat } of parts) {
          const im = new THREE.InstancedMesh(geo, mat, of.length);
          of.forEach((p, i) => {
            q.setFromAxisAngle(up, p.yaw); pos.set(p.x, 0, p.z); sc.setScalar(p.s);
            im.setMatrixAt(i, m.compose(pos, q, sc));
          });
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          holder.add(im);
        }
      });
      group.add(holder);
      out.push(holder);
    }
    return out;
  };
  build(treeList, trees, TREE_CHUNK, 'tree');
  const grassChunks = build(grassList, grass, GRASS_CHUNK, 'grass');

  // 3) Kollision: Stämme in einem Raster (10 m), damit die Abfrage schnell ist
  const CELL = 10, cells = new Map();
  for (const t of treeList) {
    const k = Math.floor(t.x / CELL) * 1000 + Math.floor(t.z / CELL);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(t);
  }

  return {
    group,
    count: { trees: treeList.length, grass: grassList.length },
    // Gras nur in der Nähe des Spielers zeichnen
    update(px, pz) {
      for (const g of grassChunks) {
        const d = g.userData;
        g.visible = Math.hypot(px - d.cx, pz - d.cz) < GRASS_VIEW + d.size;
      }
    },
    // Schiebt einen Kreis (x, z, r) aus den Baumstämmen heraus; gibt die neue Position zurück
    collide(x, z, r = 0.45) {
      const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
      for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) {
        const list = cells.get(a * 1000 + b);
        if (!list) continue;
        for (const t of list) {
          const dx = x - t.x, dz = z - t.z, min = TRUNK_R * t.s + r, d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.0001;
            x = t.x + (dx / d) * min; z = t.z + (dz / d) * min;
          }
        }
      }
      return { x, z };
    },
  };
}
