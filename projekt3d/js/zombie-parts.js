// Hilfen für die Zombie-Modelle aus dem Set (assets/zombies/): Gerüst erkennen und Teile zusammenfassen.
// Alle Dateien sind gleich gebaut:  Figur -> [Becken (Mesh), Bein, Bein, Körper],  Körper -> [Arm, Arm, Kopf].

import * as THREE from 'three';

// Gerüst eines Modells erkennen. Gibt { fig, legs, bodyN, arms, headN } oder { error } zurück.
export function findParts(root) {
  let fig = root;
  while (fig.children.length === 1 && !fig.children[0].isMesh) fig = fig.children[0];
  const groups = fig.children.filter((c) => !c.isMesh);
  const legs = groups.filter((c) => Math.abs(c.position.x) > 0.05);
  const bodyN = groups.find((c) => Math.abs(c.position.x) <= 0.05);
  if (legs.length !== 2 || !bodyN) return { error: 'Körperbau nicht erkannt' };
  const sub = bodyN.children.filter((c) => !c.isMesh);
  const arms = sub.filter((c) => Math.abs(c.position.x) > 0.1);
  const headN = sub.find((c) => Math.abs(c.position.x) <= 0.1);
  if (arms.length !== 2 || !headN) return { error: 'Arme/Kopf nicht erkannt' };
  return { fig, legs, bodyN, arms, headN };
}

// Fasst die vielen kleinen Teile (ca. 67 je Zombie) pro Gelenk und Material zu einem Teil zusammen (ca. 24).
// Das spart sehr viele Zeichenaufrufe, die Zombies sehen genau gleich aus. Wird einmal je Modell beim Laden gemacht.
// Gibt { before, after } (Anzahl Teile) zurück, bei unbekanntem Aufbau null.
export function mergeZombieParts(root) {
  const parts = findParts(root);
  if (parts.error) return null;
  root.updateMatrixWorld(true);

  const owners = [parts.fig, ...parts.legs, parts.bodyN, ...parts.arms, parts.headN];
  const ownerSet = new Set(owners);
  const groups = new Map(owners.map((o) => [o, new Map()]));   // Gelenk -> Material -> Teile
  let before = 0;
  const collect = (node, owner) => {
    for (const c of node.children) {
      if (c.isMesh && !Array.isArray(c.material) && c.geometry?.attributes?.position && c.geometry.attributes.normal) {
        before++;
        const byMat = groups.get(owner);
        if (!byMat.has(c.material)) byMat.set(c.material, []);
        byMat.get(c.material).push(c);
      } else if (!c.isMesh) collect(c, ownerSet.has(c) ? c : owner);
    }
  };
  collect(parts.fig, parts.fig);

  let after = 0;
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const [owner, byMat] of groups) {
    inv.copy(owner.matrixWorld).invert();
    for (const [material, list] of byMat) {
      if (list.length < 2 || !list.every((m) => m.geometry.attributes.uv)) { after += list.length; continue; }
      let nv = 0, ni = 0;
      for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      for (const m of list) {
        const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count;
        rel.multiplyMatrices(inv, m.matrixWorld);
        const e = rel.elements;
        // Normalen: Inverse-Transponierte der oberen 3x3-Matrix (Kofaktoren geteilt durch die Determinante)
        const a = e[0], b = e[1], c = e[2], d = e[4], f = e[5], h = e[6], k = e[8], l = e[9], q = e[10];
        const C00 = f * q - l * h, C01 = -(b * q - l * c), C02 = b * h - f * c;
        const C10 = -(d * q - k * h), C11 = a * q - k * c, C12 = -(a * h - d * c);
        const C20 = d * l - k * f, C21 = -(a * l - k * b), C22 = a * f - d * b;
        const det = a * C00 + d * C01 + k * C02 || 1;
        for (let i = 0; i < n; i++) {
          const x = P.getX(i), y = P.getY(i), z = P.getZ(i), o = (vo + i) * 3;
          pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
          pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
          let tx = (C00 * nx + C10 * ny + C20 * nz) / det, ty = (C01 * nx + C11 * ny + C21 * nz) / det, tz = (C02 * nx + C12 * ny + C22 * nz) / det;
          const len = Math.hypot(tx, ty, tz) || 1;
          nor[o] = tx / len; nor[o + 1] = ty / len; nor[o + 2] = tz / len;
          uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i);
        }
        const cnt = g.index ? g.index.count : n, flip = det < 0;   // gespiegelte Teile: Dreiecke umdrehen
        for (let t = 0; t < cnt; t += 3) {
          const i0 = g.index ? g.index.getX(t) : t, i1 = g.index ? g.index.getX(t + 1) : t + 1, i2 = g.index ? g.index.getX(t + 2) : t + 2;
          idx[io++] = vo + i0; idx[io++] = vo + (flip ? i2 : i1); idx[io++] = vo + (flip ? i1 : i2);
        }
        vo += n;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.userData.keep = true;                       // gemeinsam genutzt: beim Entfernen von Zombies nicht freigeben
      owner.add(new THREE.Mesh(geo, material));
      for (const m of list) m.parent.remove(m);
      after++;
    }
  }
  return { before, after };
}
