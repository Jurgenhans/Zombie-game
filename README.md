# DEAD CITY – 3D Zombie Shooter (Android)

Ego-Shooter in Three.js, per Capacitor als Android-APK verpackt (GitHub Actions: *Projekt3D APK bauen* → Artifact `Projekt3D-APK`).

- Zwei Maps zur Auswahl beim Start: Kleine Map (120 × 120 m) und Große Map (250 × 250 m), verlassene Stadt (Straßen, Häuser, Autos, Barrieren, Park), frei begehbar, Kollision, auf Autos/Kisten springen
- Touch: Joystick links (weit ziehen = Sprint), rechts wischen = Umsehen, Buttons: Feuer (ziehen = zielen), Nachladen, Sprung, Sprint, Waffenwechsel
- 4 Waffen (Pistole, MP, Sturmgewehr, Schrotflinte) mit Schaden, Magazin/Reserve, Nachladen, Rückstoß, Mündungsfeuer, Tracer, Einschussspuren, Blut, Kopfschuss ×2,5
- Zombies: Leben, KI (Wandern, Hören/Sehen, Verfolgen, Hindernis-Ausweichen, Nahkampf), Sterbeanimation
- HUD: Welle, verbleibende Zombies, Leben, Munition/Waffe, Kills · Game-Over mit Neustart
- Pickups: Munition, Medipacks
- PC-Test: WASD, Maus, Leertaste, Shift, R, 1–4

## Wellen & Zombie-Modelle (später)
In `game.js` → `CONFIG.wavesEnabled = true` aktiviert das fertige Wellensystem. Bis dahin stehen `trainingZombies` als Übungsziele auf der Map (`0` = keine).
Zombies kommen aus dem eingebauten Generator 2 (`zombiegen.js`, 300 Varianten, zur Laufzeit erzeugt). Kopf, Arme und Beine lassen sich abschießen (`js/gore.js`: fliegende Teile, Blut, Lachen). Fallbacks: `assets/models/zombie.glb`, dann prozedurales Modell.

## Code-Struktur

`game.js` ist nur der Einstieg (lädt Modelle, startet die Schleife). Der Rest liegt in `js/`:

| Datei | Inhalt |
|---|---|
| `config.js` | CONFIG, WEAPONS, Einstellungen (settings) |
| `core.js` | Renderer, Szene, Kamera, Zufall, Hilfsfunktionen |
| `state.js` | `player` und geteilter Spielzustand `S` |
| `mapdata.js`, `world.js` | Karten, Boden, Bordstein, Stadt aufbauen |
| `buildings.js` | Fassaden, begehbare Häuser, Neon-Vordächer |
| `props.js`, `lamps.js`, `backdrop.js` | Autos, Kisten, Fässer, Bäume, Laternen, Randkulisse |
| `physics.js` | Kollision und Strahlen |
| `audio.js`, `effects.js` | Sounds, Partikel, Einschusslöcher |
| `models.js` | Humanoid/Zombie-Modelle laden |
| `weapons.js` | Waffenmodelle, Schießen, Nachladen |
| `zombies.js`, `pickups.js` | Zombie-Logik, Wellen, Aufsammelobjekte |
| `input.js`, `hud.js`, `options.js` | Steuerung, Anzeige, Optionen-Menü |
| `environment.js`, `shader.js` | Himmel/Tag-Nacht, Shader |
| `flow.js` | Spielablauf (Start, Update, Hauptschleife) |

Außerdem im Hauptordner: `zombiegen.js` (Zombie-Generator), `trash.js` (Müll).

## Minigun, Gold & Munitionsautomat
- Jeder besiegte Zombie gibt 5 Gold. Am gelben Automaten (nahe Start, Taste E oder Button KAUFEN) gibt es 50 Schuss für 50 Gold für die aktuelle Waffe.
- Zu Beginn von Welle 5 fällt die Minigun (200 Schuss, gelber Lichtstrahl) in der Nähe vom Spieler ab.

## Zombie-LOD
Ab 20 m werden Zombies mit 50 % der Dreiecke gezeichnet, ab 30 m mit 20 % (`js/lod.js`).
