// Zentrale Einstellungen. Hier ändert man Map-Größe, Verteilung und Charaktere.

export const MAP_SIZE = 3000;            // Meter (3 km x 3 km)
export const GRID = 10;                  // 10 x 10 Felder
export const FIELD_SIZE = MAP_SIZE / GRID; // 300 m pro Feld
export const FIELD_COUNT = GRID * GRID;  // 100 Felder (Nummer 1 bis 100)

// Fester Seed: die Map sieht immer gleich aus, damit man Feld für Feld daran weiterbauen kann.
export const MAP_SEED = 20261121;

export const BIOME = { GRASS: 0, ROCK: 1, SNOW: 2 };
export const BIOME_NAMES = ['Gras', 'Fels', 'Schnee'];

// Anteile in Prozent (ergibt bei 100 Feldern genau 70 / 20 / 10 Felder)
export const BIOME_SHARE = { grass: 70, rock: 20, snow: 10 };

// Farben für Minimap / große Karte (RGB)
export const BIOME_MAP_COLORS = [
  [92, 156, 66],    // Gras
  [128, 122, 116],  // Fels
  [238, 244, 251],  // Schnee
];

export const SAVE_KEY = 'projekt3d_savegame_v1';

export const CHARACTERS = [
  { id: 'Knight',        name: 'Ritter',            desc: 'Schwer gepanzert und standhaft. Ein klassischer Frontkämpfer.' },
  { id: 'Barbarian',     name: 'Barbar',            desc: 'Rohe Kraft und wilder Mut. Schlägt zuerst, fragt später.' },
  { id: 'Mage',          name: 'Magier',            desc: 'Meister der arkanen Künste mit Wissen aus uralten Büchern.' },
  { id: 'Ranger',        name: 'Waldläufer',        desc: 'Leise, schnell und treffsicher. Zu Hause in der Wildnis.' },
  { id: 'Rogue',         name: 'Schurke',           desc: 'Flink und listig. Findet jeden Weg und jede Schwachstelle.' },
  { id: 'Rogue_Hooded',  name: 'Schurke (Kapuze)',  desc: 'Der Schatten unter den Abenteurern. Man sieht ihn nie kommen.' },
];

// Zombie-Set: 150 fertige 3D-Modelle (GLB) in assets/zombies/. Ids: set001 ... set150
export const ZOMBIE_SET = Array.from({ length: 150 }, (_, i) => {
  const n = String(i + 1).padStart(3, '0');
  return { id: `set${n}`, name: `Zombie ${i + 1}`, url: `assets/zombies/Zombie_${n}.glb` };
});

// So viele Zombies gibt es: ein Haufen am Start und dazu welche verteilt auf der Karte (je Feld höchstens einer, also höchstens 99)
export const HORDE_COUNT = 23;
export const MAP_ZOMBIES = 60;
// Bei jedem Spielstart eine andere Auswahl aus dem Set (jedes Modell höchstens einmal): zuerst der Haufen, dann die verteilten.
// Nur diese Modelle werden geladen (spart Ladezeit und Speicher).
export const ZOMBIE_PICK = (() => {
  const ids = ZOMBIE_SET.map((z) => z.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, Math.min(ids.length, HORDE_COUNT + MAP_ZOMBIES));
})();

// Spielergeschwindigkeit (Meter pro Sekunde)
export const WALK_SPEED = 5;
export const RUN_SPEED = 14;

// Angriffstempo für alle Waffen und die Faust (1 = Grundtempo, 1.5 = 50 % schneller)
export const ATTACK_SPEED_MULT = 1.5;

// Touch-Steuerung (Android)
export const TOUCH = {
  JOY_ZONE: 0.45,   // linke 45 % des Bildschirms: Joystick, der Rest: Kamera
  DEADZONE: 0.12,   // Joystick-Totzone (0..1)
  RUN_AT: 0.85,     // ab so viel Ausschlag wird gerannt, darunter gegangen
  LOOK_X: 0.006,    // Kamera-Empfindlichkeit waagerecht
  LOOK_Y: 0.005,    // Kamera-Empfindlichkeit senkrecht
};

// Level und Lebenspunkte: Level n hat HP_PER_LEVEL * n HP; Aufstieg von Level n braucht KILLS_PER_LEVEL * n Kills.
export const MAX_LEVEL = 10;
export const HP_PER_LEVEL = 100;
export const KILLS_PER_LEVEL = 100;

// Skills (Schaden, HP, Verteidigung, Resistenz): alle SKILL_KILLS Kills gibt es 1 Skillpunkt.
// Jeder Punkt gibt in einem Skill +SKILL_STEP (1 %), jeder Skill hat höchstens SKILL_MAX Level (= 15 %).
export const SKILL_MAX = 15;
export const SKILL_KILLS = 100;
export const SKILL_STEP = 0.01;

// Inventar: Anzahl Felder (Spalten x Reihen). Im Querformat am Handy passen 10 x 6 am besten.
export const INV_COLS = 10;
export const INV_ROWS = 6;
