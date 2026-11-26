import * as THREE from 'three';

/* ============================================================
   Waffenmodelle (Ego-Ansicht): abgerundete Hartflaechen-Bauteile (Extrude + Fase), Metall mit Reflexion,
   Polymer mit Noppen-Struktur, Holz mit Maserung, Visiere mit Leuchtpunkten.
   Hat keine Abhaengigkeit zum Rest des Spiels -> auch einzeln testbar.
   Einheiten: Meter, Waffe zeigt nach -z, Ursprung etwa am Griff/Abzug.
   ============================================================ */

const cv = (w, h, draw, rep = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
};

/* Materialien. mk(opts, k) erzeugt ein Material (das Spiel registriert es fuer die Nacht-Reflexion). */
export function gunMats(mk = (o) => new THREE.MeshStandardMaterial(o)) {
  const steelTex = cv(256, 256, (g, w, h) => { // gebuerstetes, leicht abgenutztes Metall
    g.fillStyle = '#9a9da2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const y = (i * 37) % h; g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${0.02 + (i % 7) * 0.006})`; g.fillRect((i * 91) % w, y, 30 + (i % 60), 1); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(200,200,205,.10)'; g.fillRect((i * 53) % w, (i * 71) % h, 2 + i % 6, 2); }
  });
  const stippleTex = cv(128, 128, (g, w, h) => { // Griff-Noppen
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) for (let x = (y / 6 % 2) * 3; x < w; x += 6) { g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(x + 3, y + 3, 1.7, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 1, y + 1, 1.4, 1.4); }
  });
  const woodTex = cv(256, 128, (g, w, h) => { // Holzmaserung entlang der Laenge
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7a4e2d'); gr.addColorStop(0.5, '#8a5a34'); gr.addColorStop(1, '#6c4326'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const y = (i * 23.7) % h; g.strokeStyle = `rgba(${i % 3 ? 45 : 140},${i % 3 ? 25 : 90},${i % 3 ? 10 : 50},${0.12 + (i % 5) * 0.05})`; g.lineWidth = 0.8 + (i % 3) * 0.6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.04 + i) * 2.2); g.stroke(); }
  });
  const checkerTex = cv(64, 64, (g, w, h) => { g.fillStyle = '#8a5a34'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,15,5,.6)'; g.lineWidth = 1; for (let i = -h; i < w + h; i += 5) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } });
  [steelTex, stippleTex, woodTex, checkerTex].forEach((t) => t.repeat.set(1, 1));
  return {
    steel: mk({ color: 0x5b5f66, map: steelTex, metalness: 0.9, roughness: 0.34 }, 1),
    dark: mk({ color: 0x25272a, map: steelTex, metalness: 0.85, roughness: 0.42 }, 1),
    poly: mk({ color: 0x1d1e20, metalness: 0.05, roughness: 0.72 }, 0.35),
    grip: mk({ color: 0x242527, map: stippleTex, metalness: 0.05, roughness: 0.85 }, 0.2),
    wood: mk({ color: 0xffffff, map: woodTex, metalness: 0.0, roughness: 0.5 }, 0.5),
    woodGrip: mk({ color: 0xffffff, map: checkerTex, metalness: 0.0, roughness: 0.6 }, 0.4),
    rubber: mk({ color: 0x151515, metalness: 0, roughness: 0.95 }, 0.1),
    brass: mk({ color: 0xc79a3a, metalness: 1, roughness: 0.28 }, 1),
    black: new THREE.MeshBasicMaterial({ color: 0x050506 }),
    dotW: new THREE.MeshBasicMaterial({ color: 0xf4f4e8 }),
    dotG: new THREE.MeshBasicMaterial({ color: 0x7dff9a }),
    red: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    shell: mk({ color: 0xb02a22, metalness: 0.1, roughness: 0.55 }, 0.4),
    glass: mk({ color: 0x182830, metalness: 0.2, roughness: 0.08 }, 1.3),
  };
}

/* ---- Bauteile ---- */
const rrShape = (w, h, r) => {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
};
const _rb = {};
/* abgerundete Box: Querschnitt w x h (abgerundet mit r), Laenge d entlang z */
export function rbox(w, h, d, r, m, bev = 0.0022) {
  const key = [w, h, d, r, bev].join();
  let g = _rb[key];
  if (!g) {
    g = _rb[key] = new THREE.ExtrudeGeometry(rrShape(Math.max(0.001, w - 2 * bev), Math.max(0.001, h - 2 * bev), r), { depth: Math.max(0.001, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * bev) / 2);
  }
  return new THREE.Mesh(g, m);
}
/* Zylinder entlang z: rRear hinten (+z), rFront vorne (-z) */
export function cz(rRear, rFront, len, m, seg = 18) {
  const g = new THREE.CylinderGeometry(rRear, rFront, len, seg); g.rotateX(Math.PI / 2); return new THREE.Mesh(g, m);
}
const put = (grp, mesh, x, y, z, rx = 0, ry = 0, rz = 0) => { mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); grp.add(mesh); return mesh; };
/* gebogenes Magazin: n Segmente, jedes um 'curve' weitergedreht (nach vorn gekruemmt) */
function curvedMag(grp, m, w, d, h, n, curve, x, y, z, lipM) {
  const seg = h / n; let cy = y, cz2 = z, a = 0;
  for (let i = 0; i < n; i++) {
    const b = rbox(w, seg * 1.04, d, 0.005, m);
    put(grp, b, x, cy - seg / 2 * Math.cos(a), cz2 - seg / 2 * Math.sin(a) * -1, a, 0, 0); // a>0: unteres Ende nach vorn
    cy -= seg * Math.cos(a); cz2 += seg * Math.sin(a) * -1; a += curve;
  }
  if (lipM) put(grp, rbox(w + 0.002, 0.008, d + 0.002, 0.003, lipM), x, cy - 0.003, cz2, a, 0, 0); // Bodenplatte
}
const guard = (grp, M, x, y, z, len, hgt, sideM) => { // Abzugsbuegel (Schleife) + Abzug
  put(grp, rbox(0.006, 0.006, len, 0.002, sideM || M.dark), x, y - hgt, z - len * 0.0);
  put(grp, rbox(0.006, hgt, 0.006, 0.002, sideM || M.dark), x, y - hgt / 2, z - len / 2 + 0.003);
  put(grp, rbox(0.006, hgt * 0.8, 0.006, 0.002, sideM || M.dark), x, y - hgt * 0.4, z + len / 2 - 0.003);
  put(grp, rbox(0.006, 0.022, 0.008, 0.002, M.dark), x, y - 0.006, z + len * 0.12, -0.35, 0, 0); // Abzug
};
const dotSight = (grp, M, x, y, z, w, m) => { put(grp, rbox(w, 0.01, 0.009, 0.0015, M.dark), x, y, z); put(grp, cz(0.0016, 0.0016, 0.001, m || M.dotW, 8), x, y + 0.001, z - 0.0052); };

/* Gibt { group, muzzle(z), rh, lh } zurueck. i: 0 Pistole, 1 MP, 2 Sturmgewehr, 3 Schrotflinte */
export function buildGunBody(i, M) {
  const g = new THREE.Group(), parts = {};
  const part = (name) => { const q = new THREE.Group(); g.add(q); parts[name] = q; return q; }; // bewegliche Teile (Animation)
  let muzzle, rh, lh, lhMag, S = 1;
  if (i === 0) { // ------- Pistole
    S = 1.25; const slide = part('slide'), mag = part('mag');
    put(slide, rbox(0.031, 0.033, 0.19, 0.009, M.steel), 0, 0.03, -0.095);                                            // Schlitten
    for (let k = 0; k < 6; k++) put(slide, rbox(0.0335, 0.028, 0.0035, 0.002, M.dark), 0, 0.031, -0.012 - k * 0.0075);  // Rillen hinten
    for (let k = 0; k < 3; k++) put(slide, rbox(0.0335, 0.028, 0.0035, 0.002, M.dark), 0, 0.031, -0.15 - k * 0.0075);  // Rillen vorn
    put(slide, rbox(0.004, 0.012, 0.05, 0.001, M.black), 0.0155, 0.038, -0.082);                                        // Auswurffenster
    put(g, rbox(0.029, 0.026, 0.165, 0.006, M.poly), 0, 0.0, -0.088);                                               // Rahmen
    put(g, rbox(0.027, 0.006, 0.03, 0.002, M.poly), 0, 0.012, -0.172);                                              // Schienenansatz
    put(g, rbox(0.03, 0.098, 0.056, 0.01, M.grip), 0, -0.058, -0.016, -0.2);                                        // Griff mit Noppen
    put(mag, rbox(0.027, 0.006, 0.054, 0.002, M.dark), 0, -0.111, 0.0, -0.2); put(mag, rbox(0.024, 0.09, 0.044, 0.005, M.dark), 0, -0.06, -0.016, -0.2);                                         // Magazinboden
    put(g, rbox(0.004, 0.003, 0.03, 0.001, M.dark), 0.0155, 0.018, -0.07);                                          // Slide-Stop
    put(g, cz(0.0068, 0.0068, 0.012, M.dark, 14), 0, 0.03, -0.192);                                                 // Lauf-Muendung
    put(g, cz(0.0038, 0.0038, 0.014, M.black, 10), 0, 0.03, -0.198);
    dotSight(slide, M, 0, 0.0525, -0.178, 0.006); for (const sx of [-1, 1]) dotSight(slide, M, sx * 0.0065, 0.0525, -0.012, 0.006);
    put(slide, rbox(0.005, 0.014, 0.01, 0.002, M.dark), 0, 0.028, 0.006, 0.4);                                         // Hammer/Sporn
    guard(g, M, 0, -0.012, -0.062, 0.06, 0.03, M.poly);
    muzzle = -0.205; rh = [0.014, -0.06, -0.02]; lh = [-0.026, -0.072, -0.034]; lhMag = [-0.012, -0.115, -0.012];
  } else if (i === 1) { // ------- MP (MP5-artig)
    const mag = part('mag'), bolt = part('bolt');
    put(g, rbox(0.046, 0.05, 0.3, 0.012, M.steel), 0, 0.012, -0.17);                                                // Gehaeuse
    put(g, rbox(0.018, 0.012, 0.27, 0.004, M.dark), 0, 0.042, -0.17);                                               // Oberseite
    for (let k = 0; k < 4; k++) put(g, rbox(0.048, 0.006, 0.004, 0.001, M.black), 0, 0.012, -0.08 - k * 0.012);      // Kuehlrillen
    put(g, rbox(0.004, 0.012, 0.06, 0.001, M.black), 0.0235, 0.02, -0.1);                                           // Auswurffenster
    put(g, rbox(0.054, 0.056, 0.17, 0.016, M.poly), 0, 0.006, -0.35);                                               // Handschutz
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) put(g, rbox(0.002, 0.01, 0.022, 0.001, M.black), sx * 0.0272, 0.012, -0.30 - k * 0.032); // Schlitze
    put(g, cz(0.0075, 0.0075, 0.13, M.dark, 14), 0, 0.016, -0.505);                                                 // Lauf
    put(g, cz(0.012, 0.012, 0.045, M.dark, 14), 0, 0.016, -0.575); for (let k = 0; k < 4; k++) put(g, rbox(0.003, 0.014, 0.025, 0.001, M.black), 0, 0.016, -0.575, 0, 0, k * Math.PI / 4); // Muendungsfeuerdaempfer
    put(g, cz(0.013, 0.013, 0.016, M.dark, 16), 0, 0.054, -0.4); put(g, rbox(0.004, 0.016, 0.004, 0.001, M.dark), 0, 0.042, -0.4); // Korn im Ring
    put(g, cz(0.013, 0.013, 0.035, M.dark, 16), 0, 0.058, -0.045); put(g, rbox(0.01, 0.006, 0.01, 0.002, M.black), 0, 0.071, -0.045); // Dioptervisier
    curvedMag(mag, M.dark, 0.026, 0.044, 0.19, 5, 0.1, 0, -0.012, -0.235, M.poly);                                     // gebogenes Magazin
    put(g, rbox(0.032, 0.095, 0.048, 0.01, M.grip), 0, -0.065, -0.026, -0.28);                                       // Pistolengriff
    put(g, rbox(0.044, 0.04, 0.05, 0.01, M.poly), 0, -0.012, -0.045);                                               // Abzugsgehaeuse
    guard(g, M, 0, -0.03, -0.075, 0.07, 0.026);
    put(bolt, cz(0.006, 0.006, 0.02, M.dark, 10), -0.03, 0.03, -0.12, 0, 0, Math.PI / 2); put(bolt, rbox(0.01, 0.012, 0.035, 0.002, M.steel), 0.0225, 0.02, -0.1);                                // Ladehebel links
    for (const sx of [-1, 1]) put(g, rbox(0.007, 0.007, 0.22, 0.002, M.dark), sx * 0.02, 0.0, 0.085);                  // Schulterstuetze (Draht)
    put(g, rbox(0.036, 0.07, 0.014, 0.006, M.rubber), 0, 0.0, 0.205);
    muzzle = -0.6; rh = [0.017, -0.06, -0.04]; lh = [0.0, -0.075, -0.36]; lhMag = [0.0, -0.14, -0.245];
  } else if (i === 2) { // ------- Sturmgewehr
    const mag = part('mag'), bolt = part('bolt');
    put(g, rbox(0.05, 0.066, 0.28, 0.01, M.steel), 0, 0.006, -0.14);                                                // Gehaeuse
    put(g, rbox(0.004, 0.014, 0.05, 0.001, M.black), 0.0255, 0.018, -0.12);                                         // Auswurffenster
    put(g, rbox(0.022, 0.014, 0.3, 0.003, M.dark), 0, 0.048, -0.17);                                                // Montageschiene
    for (let k = 0; k < 12; k++) put(g, rbox(0.024, 0.004, 0.006, 0.001, M.black), 0, 0.052, -0.04 - k * 0.022);     // Schienenschlitze
    put(g, rbox(0.032, 0.036, 0.11, 0.009, M.poly), 0, 0.078, -0.13);                                               // Visier
    put(g, cz(0.0125, 0.0125, 0.004, M.glass, 16), 0, 0.078, -0.187); put(g, cz(0.0095, 0.0095, 0.004, M.glass, 16), 0, 0.078, -0.073);
    put(g, rbox(0.003, 0.006, 0.002, 0.0005, M.red), 0, 0.078, -0.19);                                              // Leuchtpunkt
    put(g, rbox(0.058, 0.064, 0.27, 0.016, M.poly), 0, 0.004, -0.41);                                               // Handschutz
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) put(g, rbox(0.002, 0.034, 0.012, 0.001, M.black), sx * 0.0295, 0.004, -0.31 - k * 0.04); // Luftschlitze
    for (let k = 0; k < 8; k++) put(g, rbox(0.026, 0.004, 0.006, 0.001, M.black), 0, 0.038, -0.3 - k * 0.025);       // obere Schiene
    put(g, cz(0.0085, 0.0085, 0.24, M.dark, 14), 0, 0.034, -0.43);                                                  // Gasrohr
    put(g, cz(0.0095, 0.0095, 0.2, M.steel, 16), 0, 0.012, -0.69);                                                  // Lauf
    put(g, rbox(0.014, 0.042, 0.016, 0.003, M.dark), 0, 0.03, -0.76);                                               // Korn-Block
    put(g, rbox(0.003, 0.016, 0.003, 0.001, M.dotG), 0, 0.058, -0.76);
    put(g, cz(0.0135, 0.0135, 0.065, M.dark, 16), 0, 0.012, -0.835); for (let k = 0; k < 4; k++) put(g, rbox(0.003, 0.03, 0.035, 0.001, M.black), 0, 0.012, -0.84, 0, 0, k * Math.PI / 4); // Muendungsfeuerdaempfer
    curvedMag(mag, M.poly, 0.032, 0.072, 0.2, 6, 0.11, 0, -0.025, -0.27, M.dark);                                       // gebogenes Magazin
    put(g, rbox(0.036, 0.1, 0.05, 0.012, M.grip), 0, -0.08, -0.03, -0.35);                                          // Pistolengriff
    put(g, rbox(0.046, 0.04, 0.07, 0.01, M.poly), 0, -0.016, -0.05);
    guard(g, M, 0, -0.035, -0.1, 0.08, 0.028);
    put(g, rbox(0.04, 0.082, 0.27, 0.014, M.poly), 0, -0.006, 0.135); put(g, rbox(0.042, 0.092, 0.024, 0.008, M.rubber), 0, -0.006, 0.28); // Schaft + Schulterpolster
    put(bolt, cz(0.007, 0.007, 0.03, M.dark, 10), 0.03, 0.03, -0.1, 0, 0, Math.PI / 2); put(bolt, rbox(0.01, 0.014, 0.04, 0.002, M.steel), 0.0245, 0.018, -0.115);                                  // Ladehebel
    put(g, rbox(0.004, 0.02, 0.006, 0.001, M.dark), 0.0265, 0.0, -0.06, 0.4);                                        // Feuerwahl
    muzzle = -0.875; rh = [0.019, -0.065, -0.05]; lh = [0.0, -0.06, -0.42]; lhMag = [0.0, -0.15, -0.28];
  } else { // ------- Schrotflinte (Pump Action)
    const pump = part('pump'), shells = part('shells');
    put(g, rbox(0.046, 0.078, 0.22, 0.01, M.steel), 0, 0.003, -0.1);                                                 // Gehaeuse
    put(g, rbox(0.004, 0.02, 0.07, 0.001, M.black), 0.0235, 0.018, -0.1);                                            // Auswurffenster
    put(g, rbox(0.026, 0.004, 0.06, 0.001, M.black), 0, -0.037, -0.09);                                              // Ladeoeffnung unten
    put(g, cz(0.0158, 0.0158, 0.64, M.dark, 20), 0, 0.03, -0.54);                                                    // Lauf
    put(g, rbox(0.01, 0.006, 0.58, 0.002, M.steel), 0, 0.048, -0.52);                                                // Laufschiene
    put(g, cz(0.0125, 0.0125, 0.5, M.steel, 16), 0, -0.014, -0.5);                                                   // Magazinrohr
    for (const zc of [-0.36, -0.62]) put(g, cz(0.0195, 0.0195, 0.012, M.dark, 16), 0, 0.008, zc);                    // Rohrschellen
    put(g, cz(0.0145, 0.0145, 0.024, M.dark, 16), 0, -0.014, -0.76);                                                 // Rohr-Kappe
    put(g, new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 6), M.brass), 0, 0.054, -0.83);                         // Perlkorn
    put(pump, rbox(0.054, 0.048, 0.21, 0.018, M.wood), 0, -0.018, -0.43);                                               // Vorderschaft
    for (let k = 0; k < 6; k++) put(pump, rbox(0.0565, 0.03, 0.004, 0.001, M.dark), 0, -0.018, -0.35 - k * 0.026);       // Rillen
    put(g, rbox(0.038, 0.094, 0.38, 0.014, M.wood), 0, -0.02, 0.2, 0.06);                                           // Schaft
    put(g, rbox(0.04, 0.1, 0.02, 0.01, M.rubber), 0, -0.036, 0.395, 0.06);                                             // Schaftkappe
    put(g, rbox(0.034, 0.09, 0.052, 0.012, M.woodGrip), 0, -0.066, -0.02, -0.3);                                      // Pistolengriff
    guard(g, M, 0, -0.04, -0.075, 0.07, 0.028);
    for (let k = 0; k < 2; k++) { put(shells, cz(0.0092, 0.0092, 0.036, M.shell, 12), 0.0245, -0.002 - k * 0.0, -0.045 - k * 0.0 - k * 0.022, 0, 0, 0); put(shells, cz(0.0094, 0.0094, 0.01, M.brass, 12), 0.0245, -0.002, -0.027 - k * 0.022); } // Patronen an der Seite
    muzzle = -0.865; rh = [0.019, -0.062, -0.02]; lh = [0.0, -0.045, -0.43]; lhMag = [0.01, -0.05, -0.1];
  }
  g.scale.setScalar(S);
  return { group: g, parts, muzzle: muzzle * S, rh: rh.map((v) => v * S), lh: lh.map((v) => v * S), lhMag: lhMag.map((v) => v * S), S };
}
