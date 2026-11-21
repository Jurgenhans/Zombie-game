// Der Boden: eine einzige Fläche 3000 x 3000 m. Ein Shader mischt pro Pixel
// Gras-, Fels- und Schnee-Textur anhand der Splat-Map. Dazu Feldgitter und
// Hervorhebung des aktiven Feldes.

import * as THREE from 'three';
import { MAP_SIZE, FIELD_SIZE } from './config.js';
import { buildSplat } from './mapgen.js';
import { createGroundTextures } from './textures.js';

export const SKY_HORIZON = 0xbfdcf2;
export const SKY_ZENITH = 0x5f9ee0;
export const FOG_NEAR = 250;
export const FOG_FAR = 2200;

const vertexShader = /* glsl */`
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D tSplat, tGrass, tRock, tSnow;
  uniform vec3 uSun, uFog;
  uniform float uFogNear, uFogFar, uMapSize, uField, uGrid;
  uniform vec3 uActive;      // x = min x, y = min z, z = Größe; z <= 0 => kein aktives Feld
  uniform vec3 uCam;         // Kameraposition (Entfernung wird pro Pixel berechnet,
                             // nicht im Vertex-Shader: die Fläche hat nur 4 Eckpunkte!)
  varying vec2 vWorld;

  // Drei verschieden große, gedrehte Abtastungen mischen, damit man keine Kachelwiederholung sieht
  vec3 sampleTiled(sampler2D t, vec2 p, float scale) {
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    vec3 a = texture2D(t, p / scale).rgb;
    vec3 b = texture2D(t, rot * p / (scale * 2.7) + vec2(0.37, 0.11)).rgb;
    float c = texture2D(t, rot * rot * p / (scale * 9.3) + vec2(0.61, 0.83)).g;
    return mix(a, b, 0.45) * (0.78 + 0.45 * c);
  }

  void main() {
    float vDist = length(vec3(vWorld.x, 0.0, vWorld.y) - uCam);
    vec3 w = texture2D(tSplat, vWorld / uMapSize).rgb;
    w /= max(w.r + w.g + w.b, 0.0001);

    // immer alle drei lesen (keine Verzweigung vor texture2D, sonst Mipmap-Fehler)
    vec3 col = w.r * sampleTiled(tGrass, vWorld, 9.0)
             + w.g * sampleTiled(tRock,  vWorld, 12.0)
             + w.b * sampleTiled(tSnow,  vWorld, 14.0);

    // einfaches Licht: Boden ist flach, Normale zeigt nach oben
    float diffuse = max(uSun.y, 0.0);
    col *= 0.55 + 0.55 * diffuse;

    // Feldgitter (Linienbreite wächst mit der Entfernung, damit es immer sichtbar bleibt)
    if (uGrid > 0.5) {
      vec2 f = mod(vWorld, uField);
      float d = min(min(f.x, uField - f.x), min(f.y, uField - f.y));
      float lw = 0.12 + vDist * 0.0035;
      float line = 1.0 - smoothstep(lw, lw * 1.8, d);
      col = mix(col, vec3(0.05, 0.07, 0.1), line * 0.45);
    }

    // aktives Feld: leichter Goldton + goldener Rand
    if (uActive.z > 0.0) {
      vec2 q = vWorld - uActive.xy;
      if (q.x >= 0.0 && q.y >= 0.0 && q.x <= uActive.z && q.y <= uActive.z) {
        float d = min(min(q.x, uActive.z - q.x), min(q.y, uActive.z - q.y));
        float lw = 0.35 + vDist * 0.006;
        float edge = 1.0 - smoothstep(lw, lw * 1.6, d);
        col = mix(col, vec3(1.0, 0.82, 0.25), 0.12);
        col = mix(col, vec3(1.0, 0.78, 0.15), edge * 0.9);
      }
    }

    float fogT = smoothstep(uFogNear, uFogFar, vDist);
    col = mix(col, uFog, fogT);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function dataTexture(data, size) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export function createTerrain({ biomes, splat, maxAniso }) {
  const SPLAT_SIZE = 512;
  const tex = createGroundTextures(maxAniso);
  const splatData = splat || buildSplat(biomes, undefined, SPLAT_SIZE);

  const uniforms = {
    tSplat: { value: dataTexture(splatData, SPLAT_SIZE) },
    tGrass: { value: tex.grass },
    tRock: { value: tex.rock },
    tSnow: { value: tex.snow },
    uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uFog: { value: new THREE.Color(SKY_HORIZON) },
    uFogNear: { value: FOG_NEAR },
    uFogFar: { value: FOG_FAR },
    uMapSize: { value: MAP_SIZE },
    uField: { value: FIELD_SIZE },
    uGrid: { value: 1 },
    uActive: { value: new THREE.Vector3(0, 0, -1) },
    uCam: { value: new THREE.Vector3(0, 10, 0) },
  };

  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(MAP_SIZE / 2, 0, MAP_SIZE / 2);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }));
  mesh.frustumCulled = false;

  return {
    mesh,
    splatData,
    setCamera(p) { uniforms.uCam.value.copy(p); },
    setGrid(on) { uniforms.uGrid.value = on ? 1 : 0; },
    get gridOn() { return uniforms.uGrid.value > 0.5; },
    setActiveField(row, col) {
      if (row < 0) uniforms.uActive.value.set(0, 0, -1);
      else uniforms.uActive.value.set(col * FIELD_SIZE, row * FIELD_SIZE, FIELD_SIZE);
    },
  };
}

// Himmel mit Farbverlauf, folgt der Kamera.
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(SKY_HORIZON) },
      uZenith: { value: new THREE.Color(SKY_ZENITH) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uHorizon, uZenith;
      varying vec3 vDir;
      void main() {
        float t = pow(clamp(vDir.y, 0.0, 1.0), 0.55);
        vec3 col = mix(uHorizon, uZenith, t);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
