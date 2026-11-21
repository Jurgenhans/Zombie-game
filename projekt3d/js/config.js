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

// Spielergeschwindigkeit (Meter pro Sekunde)
export const WALK_SPEED = 5;
export const RUN_SPEED = 14;
