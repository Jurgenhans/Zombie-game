// Dorf in Feld 35 (Avramania Free Collection, CC0): 6 Häuser an einer Dorfstraße, Dorfplatz mit Brunnen und Marktständen,
// Hühnerstall mit Zaun, Gemüsegarten mit Vogelscheuche, Bienenstöcke, Apfelbäume und viel Zubehör.
// Die Straße liegt auf derselben Linie (x = 1350) wie der Weg durch den Wald in Feld 45 und führt von dessen Nordrand ins Dorf.
// Modelle: assets/village/. Alle Modelle sind Meter-groß, Ursprung am Boden, Haustür/Vorderseite zeigt nach +Z.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIELD_SIZE, GRID } from './config.js';

export const VILLAGE_FIELD = 35;                                  // Feldnummer (1..100)
const vRow = Math.floor((VILLAGE_FIELD - 1) / GRID), vCol = (VILLAGE_FIELD - 1) % GRID;
const X0 = vCol * FIELD_SIZE, Z0 = vRow * FIELD_SIZE;             // Ecke von Feld 35
const CX = X0 + FIELD_SIZE / 2;                                   // Mitte der Dorfstraße (x = 1350)
const Z_END = Z0 + FIELD_SIZE;                                    // Südrand von Feld 35 = Nordrand von Feld 45
const PLAZA = { x: CX, z: Z0 + 175, r: 11 };                      // Dorfplatz (z = 1075)
const STREET_W = 6;
// Startpunkt des Spielers (neues Spiel und Wiederbeleben nach dem Tod): auf der Dorfstraße direkt vor dem Dorfplatz,
// Blick nach Norden zu Brunnen und Händler. Frei von Häusern und Zubehör.
export const VILLAGE_START = { x: CX, z: PLAZA.z + 13, yaw: Math.PI };
// Standort des Händlers: am Dorfplatz, blickt zur Straße (Süden) und zum Brunnen
export const MERCHANT_SPOT = { x: CX + 6, z: PLAZA.z - 3, yaw: Math.atan2(-6, 11) };

const NAMES = [
  'village_cottage_01', 'village_well_01', 'village_stall_01',
  'farm_haystack_02', 'farm_hay_bale_01', 'farm_chicken_coop_01', 'farm_scarecrow_01', 'farm_beehive_01', 'farm_apple_tree_01',
  'farm_feed_trough_01', 'farm_furrow_01', 'farm_cabbage_stage_01', 'farm_cabbage_stage_02', 'farm_cabbage_stage_03', 'farm_milking_stool_01',
  'props_fence_wood_01', 'props_fence_wood_end_01', 'props_crate_01', 'props_barrel_01', 'props_cart_wheel_01', 'props_public_bench_01',
  'props_signpost_01', 'props_wheelbarrow_01', 'props_water_trough_01', 'props_sack_01', 'props_basket_01',
  'interiors_woodpile_01', 'nature_bush_01', 'nature_flowers_01',
  'food_produce_crate_01', 'food_grain_sack_01', 'food_cask_01',
];

const loader = new GLTFLoader();

export async function loadVillage() {
  const models = {};
  await Promise.all(NAMES.map(async (n) => {
    const gltf = await loader.loadAsync(`assets/village/${n}.glb`);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.map) { m.map.magFilter = m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; }   // Palette: scharfe Farben
    });
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    models[n] = { scene: gltf.scene, w: size.x, d: size.z, h: size.y, cx: c.x, cz: c.z };   // cx/cz: Mitte des Modells (zum Drehen um die Mitte)
  }));
  return models;
}

export function createVillage(models) {
  const group = new THREE.Group();
  const boxes = [], circles = [];   // Kollision: Rechtecke (Häuser, Zäune, Stände) und Kreise (Brunnen, Fässer, Bäume ...)

  // x, z = Mitte des Modells am Boden, yaw = Drehung (Vorderseite zeigt bei yaw 0 nach +Z, bei PI/2 nach +X)
  // solid: 'box' | 'circle' | undefined
  const put = (name, x, z, yaw = 0, { solid, s = 1 } = {}) => {
    const m = models[name];
    const inner = m.scene.clone(true);
    inner.position.set(-m.cx, 0, -m.cz);
    const pivot = new THREE.Group();
    pivot.add(inner);
    pivot.position.set(x, 0, z);
    pivot.rotation.y = yaw;
    pivot.scale.setScalar(s);
    group.add(pivot);
    const w = m.w * s, d = m.d * s, cs = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
    if (solid === 'box') {
      const hx = (cs * w + sn * d) / 2, hz = (sn * w + cs * d) / 2;
      boxes.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
    } else if (solid === 'circle') {
      circles.push({ x, z, r: Math.max(w, d) * 0.45 });
    }
    return pivot;
  };

  // Zaun: Strecke entlang x oder z, Lücken (Tore) als [von, bis] Meter entlang der Strecke
  const fenceLine = (x0, z0, x1, z1, gaps = []) => {
    const alongX = z0 === z1, len = Math.abs(alongX ? x1 - x0 : z1 - z0), sgn = Math.sign(alongX ? x1 - x0 : z1 - z0);
    for (let i = 0; i < len; i++) {
      if (gaps.some(([a, b]) => i + 0.5 > a && i + 0.5 < b)) continue;
      const px = alongX ? x0 + sgn * (i + 0.5) : x0, pz = alongX ? z0 : z0 + sgn * (i + 0.5);
      put('props_fence_wood_01', px, pz, alongX ? 0 : Math.PI / 2);
      boxes.push(alongX ? { x0: px - 0.5, x1: px + 0.5, z0: pz - 0.2, z1: pz + 0.2 } : { x0: px - 0.2, x1: px + 0.2, z0: pz - 0.5, z1: pz + 0.5 });
    }
    put('props_fence_wood_end_01', x0, z0);
    put('props_fence_wood_end_01', x1, z1);
  };
  const fenceRect = (xa, za, xb, zb, gaps = {}) => {
    fenceLine(xa, za, xb, za, gaps.n); fenceLine(xa, zb, xb, zb, gaps.s);
    fenceLine(xa, za, xa, zb, gaps.w); fenceLine(xb, za, xb, zb, gaps.e);
  };

  // ---- Boden: Dorfstraße (Erde) und gepflasterter Dorfplatz ------------------------------------------------------
  const flat = (geo, color, y) => {
    const mesh = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.position.y = y; return mesh;
  };
  const streetLen = Z_END - PLAZA.z;
  const street = flat(new THREE.PlaneGeometry(STREET_W, streetLen), 0x8a6c4a, 0.02);
  street.position.x = CX; street.position.z = PLAZA.z + streetLen / 2;
  const plaza = flat(new THREE.CircleGeometry(PLAZA.r, 40), 0x98948a, 0.03);
  plaza.position.x = PLAZA.x; plaza.position.z = PLAZA.z;
  group.add(street, plaza);

  // ---- 6 Häuser: je 3 links und rechts der Straße, Haustür zur Straße ----------------------------------------------
  const HX = 12;
  const houses = [
    [CX - HX, Z_END - 50, Math.PI / 2], [CX - HX, Z_END - 74, Math.PI / 2], [CX - HX - 1, Z_END - 98, Math.PI / 2],
    [CX + HX, Z_END - 44, -Math.PI / 2], [CX + HX, Z_END - 68, -Math.PI / 2], [CX + HX + 1, Z_END - 92, -Math.PI / 2],
  ];
  for (const [x, z, yaw] of houses) put('village_cottage_01', x, z, yaw, { solid: 'box' });

  // Zubehör an den Häusern (links x ≈ 1338, rechts x ≈ 1362; z zählt nach Süden)
  const zs = (dz) => Z_END - dz;
  // Zäune zur Straße hin zwischen den Häusern (Vorgärten)
  fenceLine(CX - 4, zs(56.5), CX - 4, zs(67.5)); fenceLine(CX - 4, zs(80.5), CX - 4, zs(91.5));
  fenceLine(CX + 4, zs(50.5), CX + 4, zs(61.5)); fenceLine(CX + 4, zs(74.5), CX + 4, zs(85.5));
  // links
  put('interiors_woodpile_01', CX - 15, zs(62), Math.PI / 2, { solid: 'circle' });
  put('props_barrel_01', CX - 8, zs(60), 0, { solid: 'circle' }); put('props_crate_01', CX - 8.2, zs(62.6), 0.3, { solid: 'circle' });
  put('props_wheelbarrow_01', CX - 13, zs(86), 0.5, { solid: 'circle' }); put('props_cart_wheel_01', CX - 9, zs(86.5), 1.2);
  put('props_sack_01', CX - 8.3, zs(88), 0.4); put('props_basket_01', CX - 9.4, zs(89.2), 0);
  put('props_crate_01', CX - 14.5, zs(100), 0.2, { solid: 'circle' });
  // rechts
  put('interiors_woodpile_01', CX + 15, zs(56), -Math.PI / 2, { solid: 'circle' });
  put('props_barrel_01', CX + 8, zs(54), 0, { solid: 'circle' }); put('props_barrel_01', CX + 8.9, zs(55.2), 0, { solid: 'circle' });
  put('props_crate_01', CX + 8.2, zs(80), 0.3, { solid: 'circle' }); put('props_sack_01', CX + 9.2, zs(81), 0.6);
  put('farm_haystack_02', CX + 15, zs(80), 0, { solid: 'circle' }); put('farm_hay_bale_01', CX + 12.5, zs(80.8), 0.5); put('farm_hay_bale_01', CX + 14, zs(77.5), 1.1);
  put('farm_beehive_01', CX + 17, zs(100), 0.3, { solid: 'circle' }); put('farm_beehive_01', CX + 19, zs(101), -0.2, { solid: 'circle' });
  // Büsche und Blumen vor den Häusern
  for (const [x, z] of [[CX - 8.5, zs(44)], [CX - 8.5, zs(55)], [CX - 8.5, zs(68)], [CX - 8.5, zs(80)], [CX - 8.5, zs(92)], [CX + 8.5, zs(38)], [CX + 8.5, zs(49)], [CX + 8.5, zs(62)], [CX + 8.5, zs(73)], [CX + 8.5, zs(86)]]) {
    put('nature_bush_01', x, z, x * 7, { s: 1.1 });
  }
  for (const [x, z] of [[CX - 7.2, zs(49.5)], [CX - 7.2, zs(73.5)], [CX - 7.5, zs(97)], [CX + 7.2, zs(43.5)], [CX + 7.2, zs(67.5)], [CX + 7.5, zs(91)], [CX - 10, zs(104)], [CX + 10, zs(96)]]) {
    put('nature_flowers_01', x, z, x * 3, { s: 1.6 }); put('nature_flowers_01', x + 0.7, z + 0.5, x, { s: 1.4 });
  }
  // Apfelbäume hinter den Häusern
  for (const [x, z] of [[CX - 26, zs(60)], [CX - 28, zs(90)], [CX + 27, zs(50)], [CX + 28, zs(82)], [CX - 22, zs(112)]]) put('farm_apple_tree_01', x, z, x, { solid: 'circle', s: 1.1 });

  // ---- Dorfplatz: Brunnen, Marktstände mit Waren, Bänke, Trog, Wegweiser --------------------------------------------
  const { x: px, z: pz } = PLAZA;
  put('village_well_01', px, pz, 0, { solid: 'circle' });
  put('props_water_trough_01', px + 3.6, pz + 3.2, 0.4, { solid: 'box' });
  put('village_stall_01', px - 8, pz + 3, Math.PI / 2, { solid: 'box' });
  put('village_stall_01', px + 8, pz + 3, -Math.PI / 2, { solid: 'box' });
  put('village_stall_01', px, pz - 8, 0, { solid: 'box' });
  // Waren: neben den Ständen
  put('food_produce_crate_01', px - 9.8, pz + 6.5, 0.2, { solid: 'circle' }); put('food_grain_sack_01', px - 9.8, pz + 7.7, 0.5);
  put('props_basket_01', px - 7.2, pz - 0.8, 0); put('props_crate_01', px - 9.9, pz - 0.6, 0.4, { solid: 'circle' });
  put('food_cask_01', px + 9.8, pz + 6.4, 0, { solid: 'circle' }); put('props_barrel_01', px + 9.7, pz + 7.6, 0, { solid: 'circle' });
  put('props_sack_01', px + 9.6, pz - 0.5, 0.3); put('food_produce_crate_01', px + 7.2, pz - 0.7, 0.1, { solid: 'circle' });
  put('food_grain_sack_01', px - 3.6, pz - 9.4, 0.2); put('food_produce_crate_01', px + 3.4, pz - 9.4, 0, { solid: 'circle' });
  put('props_basket_01', px + 5.2, pz - 8.6, 0.7);
  put('props_public_bench_01', px - 5.5, pz + 6, Math.PI / 2, { solid: 'box' });
  put('props_public_bench_01', px + 5.5, pz + 6, -Math.PI / 2, { solid: 'box' });
  put('props_wheelbarrow_01', px + 4, pz - 5.2, -0.6, { solid: 'circle' });
  put('props_signpost_01', CX + 4.2, Z_END - 6, -0.5, { solid: 'circle' });      // Wegweiser am Dorfeingang (Süden)
  put('props_signpost_01', px - 4.2, pz + 9, 0.4, { solid: 'circle' });         // Wegweiser am Dorfplatz
  for (let i = 0; i < 7; i++) {                                                  // Büsche um den Platz
    const a = Math.PI * (1.12 + i * 0.13) ;
    put('nature_bush_01', px + Math.cos(a) * 14.5, pz + Math.sin(a) * 14.5, i, { s: 1.2 });
  }

  // ---- Hühnerhof (Nordwest): Zaun mit Tor zur Straße, Hühnerstall, Trog, Heu ----------------------------------------
  const penX = CX - 34, penZ = PLAZA.z - 29;
  fenceRect(penX, penZ, penX + 14, penZ + 14, { e: [[5, 8]] });
  put('farm_chicken_coop_01', penX + 4, penZ + 3.5, 0.3, { solid: 'circle' });
  put('farm_feed_trough_01', penX + 8, penZ + 10, 0, { solid: 'box' });
  put('farm_hay_bale_01', penX + 2, penZ + 11, 0.4, { solid: 'circle' }); put('farm_hay_bale_01', penX + 3.2, penZ + 12, 1.1, { solid: 'circle' });
  put('farm_milking_stool_01', penX + 11, penZ + 3, 0);
  put('farm_haystack_02', penX - 4, penZ + 6, 0.5, { solid: 'circle' });

  // ---- Gemüsegarten (Nordost): Beete mit Kohl, Vogelscheuche, Zaun mit Tor ------------------------------------------
  const gX = CX + 20, gZ = PLAZA.z - 30;
  fenceRect(gX - 1.5, gZ - 1.5, gX + 12.5, gZ + 11.5, { w: [[4, 7]] });
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 10; i++) {
      put('farm_furrow_01', gX + 1.5 + i, gZ + 1.5 + r * 2.6 - 0.5, 0);
      if (i % 2 === 0) put(`farm_cabbage_stage_0${1 + ((i + r) % 3)}`, gX + 2 + i, gZ + 1 + r * 2.6, i * 1.7);
    }
  }
  put('farm_scarecrow_01', gX + 6, gZ + 10, 0.2, { solid: 'circle' });
  put('props_barrel_01', gX + 11.5, gZ + 10.2, 0, { solid: 'circle' });
  put('props_basket_01', gX + 10.2, gZ + 10.6, 0.5);

  // ---- Dorfmauer ------------------------------------------------------------------------------------------------------
  // Es gibt kein Mauer- oder Tormodell, deshalb besteht die Mauer aus dem Holzzaun in doppelter Größe (2 m lang, 2,5 m hoch).
  // Rechteck 90 m x 168 m um das Dorf, Eingang (10 m breit) in der Mitte der Südseite, auf der Dorfstraße Richtung Feld 45.
  const WS = 2;                                                    // Maßstab des Zaunteils
  const WX0 = CX - 45, WX1 = CX + 45, WZ0 = Z0 + 130, WZ1 = Z_END - 2;
  const GATE = 5;                                                  // halbe Breite des Eingangs (Meter)
  const wallRun = (x0, z0, x1, z1, gate = false) => {
    const alongX = z0 === z1, len = Math.abs(alongX ? x1 - x0 : z1 - z0), sgn = Math.sign(alongX ? x1 - x0 : z1 - z0);
    for (let i = 0; i < len / WS; i++) {
      const t = (i + 0.5) * WS, px = alongX ? x0 + sgn * t : x0, pz = alongX ? z0 : z0 + sgn * t;
      if (gate && Math.abs(px - CX) < GATE) continue;
      put('props_fence_wood_01', px, pz, alongX ? 0 : Math.PI / 2, { solid: 'box', s: WS });
    }
  };
  wallRun(WX0, WZ0, WX1, WZ0);                                     // Nord
  wallRun(WX0, WZ1, WX1, WZ1, true);                               // Süd, mit Eingang
  wallRun(WX0, WZ0, WX0, WZ1);                                     // West
  wallRun(WX1, WZ0, WX1, WZ1);                                     // Ost
  for (const [x, z] of [[WX0, WZ0], [WX1, WZ0], [WX0, WZ1], [WX1, WZ1], [CX - GATE, WZ1], [CX + GATE, WZ1]]) put('props_fence_wood_end_01', x, z, 0, { s: WS });   // Eckpfosten und Torpfosten

  // ---- Kollision --------------------------------------------------------------------------------------------------
  const MINX = X0 + 20, MAXX = X0 + FIELD_SIZE - 20;   // grober Schnelltest: nur im Dorfbereich prüfen
  return {
    group,
    // Schiebt einen Kreis (x, z, r) aus Häusern, Ständen, Zäunen und Zubehör heraus; gibt die neue Position zurück
    collide(x, z, r = 0.45) {
      if (x < MINX || x > MAXX || z < Z0 + 20 || z > Z_END + 2) return { x, z };
      for (const b of boxes) {
        if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue;
        const nx = Math.max(b.x0, Math.min(x, b.x1)), nz = Math.max(b.z0, Math.min(z, b.z1));
        const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
        else {   // Mittelpunkt liegt im Rechteck: zur nächsten Kante hinausschieben
          const l = x - b.x0, rr = b.x1 - x, t = z - b.z0, bt = b.z1 - z, m = Math.min(l, rr, t, bt);
          if (m === l) x = b.x0 - r; else if (m === rr) x = b.x1 + r; else if (m === t) z = b.z0 - r; else z = b.z1 + r;
        }
      }
      for (const c of circles) {
        const dx = x - c.x, dz = z - c.z, min = c.r + r, d2 = dx * dx + dz * dz;
        if (d2 < min * min) { const d = Math.sqrt(d2) || 0.0001; x = c.x + (dx / d) * min; z = c.z + (dz / d) * min; }
      }
      return { x, z };
    },
  };
}
