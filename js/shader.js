import * as THREE from 'three';
import { settings } from './config.js';
import { canvas, renderer, scene } from './core.js';

/* Shader: Glanz-Materialien + Farbfilter */
export const SHADERS = {
  off:    { phong: false, shin: 0,   spec: 0,        filter: '' },
  gloss:  { phong: true,  shin: 70,  spec: 0x666666, filter: 'contrast(1.05) saturate(1.1)' },
  wet:    { phong: true,  shin: 140, spec: 0xaabbcc, filter: 'contrast(1.1) saturate(1.05) brightness(.97)' },
  cinema: { phong: true,  shin: 45,  spec: 0x3a3a3a, filter: 'contrast(1.2) saturate(1.35) sepia(.15)' },
  horror: { phong: false, shin: 0,   spec: 0,        filter: 'grayscale(.6) contrast(1.3) brightness(.9)' },
};
export const phongCache = new Map();
export function phongOf(m) {
  let p = phongCache.get(m);
  if (!p) { p = new THREE.MeshPhongMaterial({ color: m.color, map: m.map, alphaTest: m.alphaTest, vertexColors: m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits, emissive: m.emissive, emissiveMap: m.emissiveMap }); p.userData.orig = m; phongCache.set(m, p); }
  return p;
}
export function applyShaderTo(root) {
  const cfg = SHADERS[settings.shader] || SHADERS.off;
  const swap = (m) => {
    if (m.isMeshPhongMaterial && m.userData.orig) { if (!cfg.phong) return m.userData.orig; m.shininess = cfg.shin; m.specular.setHex(cfg.spec).multiplyScalar(settings.gloss / 100); return m; }
    if (m.isMeshLambertMaterial && cfg.phong) { const p = phongOf(m); p.shininess = cfg.shin; p.specular.setHex(cfg.spec).multiplyScalar(settings.gloss / 100); return p; }
    return m;
  };
  root.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material); });
}
export function applyShader() { applyShaderTo(scene); canvas.style.filter = (SHADERS[settings.shader] || SHADERS.off).filter; }

export function applyRes() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.res)); renderer.setSize(window.innerWidth, window.innerHeight); }
