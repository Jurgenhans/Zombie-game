import * as THREE from 'three';
import { scene } from './core.js';


/* ---------------- World / Map ---------------- */
export const MAPS = {
  big:   { name: 'GROSSE MAP', size: 250, blocks: [-75, -25, 25, 75], roads: [-100, -50, 0, 50, 100], edge: 120, ring: 18 },
  small: { name: 'KLEINE MAP', size: 120, blocks: [-25, 25], roads: [-50, 0, 50], edge: 55, ring: 0 },
};
export let MAP = MAPS.big, HALF = MAP.size / 2, mapId = null;
export const mapRoot = new THREE.Group(); scene.add(mapRoot);
export const boxes = []; // Kollision: {x0,x1,z0,z1,top}
export function addBox(cx, cz, w, d, top) { boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top }); }

export const SIDEWALK_H = 0.15;
export function groundH(x, z) { for (const bx of MAP.blocks) if (Math.abs(x - bx) < 20) for (const bz of MAP.blocks) if (Math.abs(z - bz) < 20) return SIDEWALK_H; return 0; }
export const interiorSpots = [];
export function setMap(id) { MAP = MAPS[id]; HALF = MAP.size / 2; mapId = id; }
