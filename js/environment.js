import * as THREE from 'three';
import { applyBackdropNight } from './backdrop.js';
import { applyFacadeNight } from './buildings.js';
import { settings } from './config.js';
import { camera, hemi, rnd, scene, sun } from './core.js';
import { applyLampNight } from './lamps.js';
import { applyCarNight } from './props.js';

/* Himmel: Farbverlauf-Kuppel, Sterne, Mond/Sonne */
export const skyGeo = new THREE.SphereGeometry(200, 24, 14);
skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
export const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -2; sky.frustumCulled = false; scene.add(sky);
export const starGeo = new THREE.BufferGeometry(), SN = 1500, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
for (let i = 0; i < SN; i++) {
  const u = rnd() * 6.2832, v = Math.pow(rnd(), 0.8) * 0.98 + 0.02, r = Math.sqrt(1 - v * v), b = 0.45 + rnd() * 0.55, tint = rnd();
  sp.set([Math.cos(u) * r * 190, v * 190, Math.sin(u) * r * 190], i * 3);
  sc.set([b * (tint < 0.2 ? 1 : 0.85), b * (tint < 0.2 ? 0.85 : 0.92), b * (tint > 0.8 ? 1 : 0.9) ], i * 3);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
export const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false }));
stars.renderOrder = -1; stars.frustumCulled = false; scene.add(stars);
export const orb = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide, depthWrite: false }));
export const orbGlow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
orb.renderOrder = orbGlow.renderOrder = -1; orb.frustumCulled = orbGlow.frustumCulled = false; sky.add(orb); sky.add(orbGlow);
export const torch = new THREE.SpotLight(0xfff0d0, 0, 55, 0.5, 0.5, 1.4); // Taschenlampe (nachts)
torch.position.set(0.15, -0.15, 0); torch.target.position.set(0, 0, -6); camera.add(torch); camera.add(torch.target);

export function paintSky(horizon, zenith) {
  const pos = skyGeo.attributes.position, col = skyGeo.attributes.color, h = new THREE.Color(horizon), z = new THREE.Color(zenith), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const t = Math.pow(Math.max(0, pos.getY(i) / 200), 0.6); c.copy(h).lerp(z, t); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true;
}
export function applyTime() {
  const n = settings.night;
  if (n) {
    scene.fog.color.setHex(0x070b14); scene.fog.near = 4; scene.fog.far = 85; scene.background.setHex(0x070b14);
    hemi.color.setHex(0x34487a); hemi.groundColor.setHex(0x0c0c14); hemi.intensity = 0.85;
    sun.color.setHex(0x8aa4ff); sun.intensity = 0.5; paintSky(0x0a1224, 0x01020a);
    orb.material.color.setHex(0xe6edff); orb.scale.setScalar(9); orb.position.set(-50, 95, -150); orbGlow.material.color.setHex(0x8aa4ff); orbGlow.scale.setScalar(9); orbGlow.position.copy(orb.position);
    torch.intensity = 70;
  } else {
    scene.fog.color.setHex(0x7d8893); scene.fog.near = 25; scene.fog.far = 130; scene.background.setHex(0x7d8893);
    hemi.color.setHex(0xb8c4d4); hemi.groundColor.setHex(0x3a3630); hemi.intensity = 1.25;
    sun.color.setHex(0xffe2b8); sun.intensity = 1.1; paintSky(0x8d98a3, 0x4f7096);
    orb.material.color.setHex(0xfff2c8); orb.scale.setScalar(13); orb.position.set(60, 100, -150); orbGlow.material.color.setHex(0xffe0a0); orbGlow.scale.setScalar(13); orbGlow.position.copy(orb.position);
    torch.intensity = 0;
  }
  stars.visible = n;
  applyLampNight(n);
  applyFacadeNight(n);
  applyCarNight(n);
  applyBackdropNight(n);
}

