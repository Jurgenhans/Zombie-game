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
    desc: 'Ein einfaches Eisenschwert zum Testen.', attackSpeed: 1.7, kind: 'melee', range: 2.7,
  },
  axe_test: {
    id: 'axe_test', name: 'Testaxt', type: 'weapon', icon: '🪓', damage: 14,
    desc: 'Eine schwere Streitaxt. Langsam, aber kräftig.', attackSpeed: 1.4, kind: 'melee', range: 2.9,
  },
  bow_test: {
    id: 'bow_test', name: 'Testbogen', type: 'weapon', icon: '🏹', damage: 8,
    desc: 'Ein leichter Jagdbogen für Fernkampf.', attackSpeed: 1.8, kind: 'ranged', projectile: 'arrow', speed: 45,
    anim: 'Use_Item', releaseAt: 0.6,
  },
  staff_test: {
    id: 'staff_test', name: 'Magierstab', type: 'weapon', icon: '🪄', damage: 12,
    desc: 'Ein Stab mit leuchtendem Kristall.', attackSpeed: 1.6, kind: 'magic', projectile: 'orb', speed: 28,
    anim: 'Use_Item', releaseAt: 0.55,
  },
  crossbow_test: {
    id: 'crossbow_test', name: 'Testarmbrust', type: 'weapon', damage: 11,
    icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="#e8d8b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V6"/><path d="M3 9Q12 2 21 9"/><path d="M3 9L12 15L21 9"/><path d="M12 6l-2 2M12 6l2 2"/></svg>',
    desc: 'Eine Armbrust mit hoher Durchschlagskraft.', attackSpeed: 1.3, kind: 'ranged', projectile: 'bolt', speed: 70,
    anim: 'Use_Item', releaseAt: 0.5,
  },
};

// Startgegenstände zum Testen (liegen am Anfang im Rucksack)
export const STARTER_ITEMS = ['sword_test', 'axe_test', 'bow_test', 'staff_test', 'crossbow_test'];
