# Projekt 3D

3D-Spiel im Browser (Three.js) mit den KayKit-Adventurers-Charakteren (CC0).

## Starten
1. **Windows:** `start.bat` doppelklicken. **Mac/Linux:** `./start.sh`
2. Im Browser **http://localhost:8000** öffnen (Internet nötig: Three.js kommt von jsDelivr).

Die Datei `index.html` nicht direkt per Doppelklick öffnen, Browser blockieren dann die Modelle.
Offline: three@0.160.0 nach `vendor/three/` legen und die Adressen im `importmap` in `index.html` anpassen.

## Stand (Teil 1)
- Hauptmenü: Neues Spiel / Spiel laden
- Neues Spiel -> Sicherheitsfrage -> Charakterwahl mit 3D-Modellen (6 Charaktere)
- Map 3 km x 3 km = 10 x 10 Felder à 300 m, nur flacher Boden: 70 Gras / 20 Fels / 10 Schnee (je Feld, exakt)
- Minimap unten rechts; Klick öffnet die große Karte mit den Feldern 1-100
- Aktives Feld (gold): das Feld, an dem gerade gearbeitet wird. Auf der großen Karte wählbar.
- Speichern/Laden im Browser (localStorage)

## Steuerung
WASD bewegen · Shift rennen · Maus ziehen Kamera · Mausrad Zoom · M Karte · G Feldgitter · Esc Menü

## Feldnummern
1 = oben links (Nordwesten), zeilenweise nach rechts bis 100 = unten rechts.
Feld = Reihe * 10 + Spalte + 1. Beispiel: Feld 37 = Reihe 4, Spalte 7, Mitte x 1950 / z 1050 m.

## Code-Übersicht (js/)
- `config.js`  Größe, Anteile, Charakterliste, Geschwindigkeiten
- `mapgen.js`  Biome pro Feld + Misch-Karte (Splat), Feld-Hilfsfunktionen
- `terrain.js` Boden-Shader, Himmel · `textures.js` Gras/Fels/Schnee-Texturen (prozedural)
- `minimap.js` Karte zeichnen · `game.js` Welt, Spieler, Kamera · `select.js` Charakterwahl
- `characters.js` Modelle/Animationen laden · `save.js` Spielstand · `main.js` Menüs und Ablauf

Der Map-Seed (`MAP_SEED` in config.js) ist fest, die Karte sieht immer gleich aus.
Modelle: Kay Lousberg, CC0 (assets/LICENSE_KayKit.txt).
