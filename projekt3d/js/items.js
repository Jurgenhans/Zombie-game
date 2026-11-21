// Gegenstände und Ausrüstungs-Slots. Neue Items einfach hier eintragen.
// type: helmet | weapon | armor | gloves | boots | implant   (muss zum Slot passen)

export const SLOTS = {
  helmet:   { label: 'Helm' },
  weapon:   { label: 'Waffe' },
  armor:    { label: 'Rüstung' },
  gloves:   { label: 'Handschuhe' },
  boots:    { label: 'Schuhe' },
  implant1: { label: 'Implantat 1', type: 'implant' },
  implant2: { label: 'Implantat 2', type: 'implant' },
};
export const SLOT_KEYS = Object.keys(SLOTS);
// Anordnung im Inventar (2 Spalten, null = Lücke)
export const SLOT_LAYOUT = ['helmet', 'weapon', 'armor', 'gloves', 'boots', null, 'implant1', 'implant2'];

export const TYPE_NAMES = { helmet: 'Helm', weapon: 'Waffe', armor: 'Rüstung', gloves: 'Handschuhe', boots: 'Schuhe', implant: 'Implantat' };

export const ITEMS = {
  sword_test: {
    id: 'sword_test', name: 'Testschwert', type: 'weapon', icon: '🗡️', damage: 10,
    desc: 'Ein einfaches Eisenschwert zum Testen.',
  },
};
