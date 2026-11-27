

export const CONFIG = {
  mapSize: 250,
  wavesEnabled: true,       // Zombie-Wellen: Welle n = 10·n Zombies (Welle 30 = alle 300 Varianten)
  maxWave: 30,
  soundVoices: 5,           // nur die nächsten N Zombies machen Schritt-/Stöhn-Geräusche
  soundRange: 40,           // Hörweite in Metern
  maxAlive: 9999,           // gleichzeitig lebende Zombies (bei Leistungsproblemen z.B. auf 40 setzen)
  spawnInterval: 0.12,      // Sekunden zwischen Spawns (verteilt das Erzeugen der Zombies)
  trainingZombies: 6,       // Übungsziele solange keine Wellen aktiv sind (0 = keine)
  playerModelUrl: 'assets/models/player.glb',
  zombieModelUrls: ['assets/models/zombie.glb'], // später: weitere Zombie-Modelle hier eintragen (zufällige Auswahl)
  walkSpeed: 3.8, sprintSpeed: 6.4, jumpSpeed: 7.4, gravity: 22,
  eyeHeight: 1.7, playerRadius: 0.4, playerMaxHp: 100,
  lookSensitivity: 0.0042,
};

export const WEAPONS = [
  { name: 'PISTOLE', dmg: 28, pellets: 1, spread: 0.004, rate: 0.28, auto: false, mag: 12, reserve: 72, reload: 1.3, recoil: 0.016, range: 90, color: 0x2a2a2e, len: 0.28, snd: 0 },
  { name: 'MP',      dmg: 17, pellets: 1, spread: 0.014, rate: 0.085, auto: true,  mag: 32, reserve: 160, reload: 1.8, recoil: 0.008, range: 70, color: 0x303036, len: 0.42, snd: 1 },
  { name: 'STURMGEWEHR', dmg: 34, pellets: 1, spread: 0.008, rate: 0.12, auto: true, mag: 30, reserve: 120, reload: 2.2, recoil: 0.012, range: 140, color: 0x3a3d33, len: 0.7, snd: 2 },
  { name: 'SCHROTFLINTE', dmg: 13, pellets: 9, spread: 0.055, rate: 0.9, auto: false, mag: 6, reserve: 30, reload: 2.5, recoil: 0.07, range: 30, color: 0x4a3a2a, len: 0.75, snd: 3 },
  { name: 'MINIGUN', dmg: 16, pellets: 1, spread: 0.03, rate: 0.04, auto: true, mag: 200, reserve: 0, reload: 4.5, recoil: 0.003, range: 90, color: 0x303030, len: 0.8, snd: 1 }, // fällt in Welle 5
];

/* ---------------- Optionen: Steuerung, Grafik, Shader ---------------- */
export const SETTINGS_KEY = 'deadcity_settings_v1';
export const settings = { sound: true, volume: 80, night: false, fps: 60, showFps: false, res: 1, shader: 'off', gloss: 100, sens: 100, btnScale: 100, layout: {} };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* ignorieren */ }
export const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignorieren */ } };


