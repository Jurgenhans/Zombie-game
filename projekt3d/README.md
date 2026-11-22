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

## Android / Touch
Auf Touch-Geräten (oder am PC mit `?touch=1` hinter der Adresse) erscheint automatisch die Handy-Oberfläche:
links Joystick (erscheint unter dem Daumen, Vollausschlag = Rennen) · rechts Wischen = Kamera, zwei Finger = Zoom ·
unten Mitte 5 Slots (Tränke/Booster) · rechts 5 Slots (Fertigkeiten) · oben rechts Menü ☰ und Gitter ▦ · Karte per Tipp auf die Minimap.
Die Slots sind nur Oberfläche; beim Antippen sendet `touch.js` das Ereignis `slotuse` ({bar, index}), daran lässt sich später die Funktion hängen.
Einstellungen (Totzone, Empfindlichkeit, Joystick-Bereich): `TOUCH` in `js/config.js`. "Vollbild" gibt es im Hauptmenü und im Pausenmenü.

## Inventar und Kampf
- **Inventar** (🎒-Knopf oben rechts oder Taste **I**): rechts der Rucksack (10 x 6 Felder, einstellbar mit `INV_COLS`/`INV_ROWS` in `config.js`), links die Ausrüstung: Helm, Waffe, Rüstung, Handschuhe, Schuhe, 2 x Implantat.
  Bedienung: Gegenstand antippen = auswählen, dann leeres/anderes Feld = verschieben/tauschen, Ausrüstungsfeld oder Knopf "Ausrüsten"/"Ablegen" = anlegen/ablegen.
- **Zuschlagen** (roter Knopf oder Taste **F**): mit Waffe wird sie benutzt, sonst Faustschlag. **Gedrückt halten = Dauerangriff**, loslassen = Ende (`attackHeld` in `js/game.js`). Beim Schlag wird das Ereignis `playerattack` ({weapon, damage}) gesendet.
- Testwaffen im Rucksack: Schwert, Axt, Bogen (linke Hand), Magierstab, Armbrust. Neue Gegenstände: `js/items.js` (Daten), Waffenmodelle und Schlag-Haltung in `js/weapons.js`. Das Inventar steht im Spielstand (`js/inventory.js`).
- Nahkampf und Faust nutzen die Animation "Throw" (das Paket hat keine Nahkampf-Animationen). Bogen, Armbrust und Stab nutzen die zweite Animation "Use_Item"; sie wird pro Waffe in `js/items.js` mit `anim` gesetzt, der Schuss-Zeitpunkt mit `releaseAt` (0..1).

## Zombies
- Ein dichter Haufen Zombies steht in Feld 45, seine Mitte liegt 50 m vom Startpunkt (Mitte von Feld 45) entfernt (geradeaus nach Norden, also in Blickrichtung beim Start). Die Zombies sind 2,4 m groß (`ZOMBIE_SCALE` in `js/zombies.js`), Modelle und Anzahl siehe unten.
- Zombies haben **Lebenspunkte** (`hp` in `js/zombies.js`: 20). Jeder Treffer zieht den Schaden der Waffe ab (Schwert 10, Axt 14, Bogen 8, Stab 12, Armbrust 11, Faust 2, dazu der Schaden-Skill). Wer mindestens so viel Schaden macht wie der Zombie HP hat, besiegt ihn mit **einem** Treffer.
- Verhalten und Treffer: `js/enemies.js` (bemerken dich ab 18 m, verfolgen dich, gehen zurück, wenn du weit weg bist; besiegte stehen nach 20 s wieder auf).
- Nahkampf (Schwert, Axt, Faust) trifft in Reichweite vor dir, Bogen/Armbrust/Magierstab verschießen Pfeil/Bolzen/Zauberkugel. Beim Schlag dreht sich die Figur automatisch zum nächsten Zombie im Blickfeld.
- **Zombie-Set:** Alle Zombies im Spiel sind fertige GLB-Modelle aus `assets/zombies/` (`Zombie_001.glb` bis `Zombie_150.glb`, Typen `set001` bis `set150`). Alle haben dieselben Werte (20 HP, 4 Schaden, gleiche Geschwindigkeit und Größe wie der frühere Schlurfer, gleiches Verhalten).
  - **Haufen am Start:** 23 Zombies (`HORDE_COUNT` in `js/config.js`), dazu stehen **60 Zombies verteilt auf der Karte** (`MAP_ZOMBIES`; je Feld höchstens einer, nie im Startfeld, feste Plätze).
  - **Auswahl:** Bei jedem Spielstart werden 83 der 150 Modelle zufällig ausgewählt (jedes höchstens einmal, `ZOMBIE_PICK` in `js/config.js`). Nur diese werden geladen, das spart Ladezeit und Speicher.
  - Weit entfernte, ruhende Zombies werden nicht gezeichnet (`VIEW_DIST` in `js/enemies.js`).
  - Die Modelle haben keine Skelette. Beine, Arme, Kopf und Körper werden an der Struktur der Datei erkannt (`createSetZombie` in `js/zombies.js`) und per Code bewegt, als Ausschlag um die Haltung im Modell. Ein neues Modell im selben Aufbau legt man in `assets/zombies/` und trägt es in `ZOMBIE_SET` (`js/config.js`) ein.
  - Jedes Modell hat ca. 11 000 Dreiecke und 64 Teile. Wenn es auf einem schwachen Handy ruckelt, helfen weniger Zombies (`MAP_ZOMBIES`, `HORDE_COUNT`) oder eine kleinere `VIEW_DIST`.
  - Die früheren selbstgebauten Würfel-Zombies (Schlurfer, Brocken, Soldat, Doktor, Bauarbeiter) werden nicht mehr verwendet. Der Schlurfer bleibt nur im Code als Ersatz, falls eine Datei fehlt.
- Anzahl, Abstand und Richtung des Haufens: `spawnHorde(...)` in `js/game.js`.

## Level und Lebensbalken
- Oben in der Mitte: Level, Lebensbalken (HP) und Kills bis zum nächsten Level.
- Level 1 hat 100 HP, Level 2 hat 200 HP ... Level 10 hat 1000 HP (`HP_PER_LEVEL`, `MAX_LEVEL` in `js/config.js`).
- Aufstieg von Level n auf n+1 braucht `KILLS_PER_LEVEL * n` Kills in diesem Level: 100, 200, 300 ... 900 (zusammen 4500 Kills bis Level 10). Beim Aufstieg ist man wieder voll geheilt.
- Die Werte stehen in `js/stats.js` (`PlayerStats`, mit `damage()`/`heal()` für später) und im Spielstand.
- **Zombies schlagen zu**, wenn sie nah genug sind: alle 1,4 s, 4 Schaden (`damage` in `js/zombies.js`, `HIT_INTERVAL` in `js/enemies.js`). Rotes Aufblitzen am Bildrand bei Treffern.
- **0 HP**: Du landest voll geheilt am Startpunkt, der Zombie-Haufen steht wieder an seinem Platz. Level, Kills und Skills bleiben.

## Skills (Taste **K** oder ⭐-Knopf)
- Du wählst einen von 4 Skills aus: **Schaden, Lebenspunkte, Verteidigung, Resistenz**. Ab dann zählt jeder Kill für den gewählten Skill: alle 100 Kills steigt er um 1 Level (+1 %), höchstens Level 15 (= 15 %). Jeder Skill merkt sich seinen eigenen Fortschritt, beim Wechseln geht nichts verloren. Ist ein Skill voll, wählst du den nächsten.
- Der gewählte Skill mit Fortschritt steht unter dem Lebensbalken.
- Einstellungen: `SKILL_KILLS`, `SKILL_STEP`, `SKILL_MAX` in `js/config.js`; Logik in `js/stats.js` (`select`, `addKill`, `bonus`).
- Wirkung: Lebenspunkte erhöhen die maximalen HP, Verteidigung senkt Zombie-Schaden, Schaden wird auf den Waffenschaden aufgeschlagen. **Resistenz** hat noch keine Wirkung, weil es noch keine Magie- oder Gift-Angriffe gibt.
