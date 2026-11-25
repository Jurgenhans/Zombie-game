import * as THREE from 'three';

/* ---------------- Renderer / Scene ---------------- */
export const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
export const scene = new THREE.Scene();
export const SKY = 0x6f7a86;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 25, 130);
export const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);
export const hemi = new THREE.HemisphereLight(0xb8c4d4, 0x3a3630, 1.25);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffe2b8, 1.1);
sun.position.set(-60, 90, 40);
scene.add(sun);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------------- Utilities ---------------- */
export let seed = 1337;
export const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const rr = (a, b) => a + (b - a) * rnd();
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const $ = (id) => document.getElementById(id);
export const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 2;
  return t;
}

export function mkRng(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hashXZ = (x, z) => Math.floor(x * 131.7 + z * 71.3) & 0x7fffffff;
export const c8 = (v) => Math.max(0, Math.min(255, v | 0));
export const shade = (rgb, k, a = 1) => `rgba(${c8(rgb[0] * k)},${c8(rgb[1] * k)},${c8(rgb[2] * k)},${a})`;
export function resetSeed() { seed = 1337; }
