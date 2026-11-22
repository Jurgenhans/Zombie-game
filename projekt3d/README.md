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
  - **Haufen am Start:** Alle 150 Zombies stehen als Haufen (ca. 16 m Radius) am Start, jedes Modell einmal, in zufälliger Anordnung (`HORDE_COUNT` in `js/config.js`). Zusätzlich auf der Karte verteilte Zombies gibt es derzeit keine (`MAP_ZOMBIES = 0`; ein Wert bis 99 stellt sie wieder ein, je Feld höchstens einer, nie im Startfeld).
  - **Auswahl:** `ZOMBIE_PICK` in `js/config.js` wählt bei jedem Spielstart aus den 150 Modellen aus. Stellt man `HORDE_COUNT`/`MAP_ZOMBIES` kleiner, werden zufällig weniger Modelle gewählt und nur diese geladen (spart Ladezeit und Speicher).
  - Weit entfernte, ruhende Zombies werden nicht gezeichnet (`VIEW_DIST` in `js/enemies.js`).
  - Die Modelle haben keine Skelette. Beine, Arme, Kopf und Körper werden an der Struktur der Datei erkannt (`createSetZombie` in `js/zombies.js`) und per Code bewegt, als Ausschlag um die Haltung im Modell. Ein neues Modell im selben Aufbau legt man in `assets/zombies/` und trägt es in `ZOMBIE_SET` (`js/config.js`) ein.
  - Jedes Modell hat ca. 11 000 Dreiecke. Beim Laden werden die ca. 67 kleinen Teile je Zombie zu ca. 24 zusammengefasst (`mergeZombieParts` in `js/zombie-parts.js`, sieht genau gleich aus), das spart viele Zeichenaufrufe. Trotzdem sind 150 Zombies zusammen ca. 3 800 Zeichenaufrufe und 1,6 Mio. Dreiecke: Wenn es auf einem schwachen Rechner oder Handy ruckelt, hilft ein kleineres `HORDE_COUNT`.
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

## Wald (Feld 45)
- `js/forest.js`: Nur Feld 45 ist ein dichter Wald (ca. 2700 Bäume, Raster 5 m, davon 20 % weggelassen: `TREE_SKIP`) mit viel Gras (16000 Büschel). Modelle: `assets/forest/` (Free Forest Nature Pack).
- Ein 9 m breiter Weg führt quer durch Feld 45 von Feld 35 (Norden) nach Feld 55 (Süden), siehe `paths` in `createForest`.
- Vom Startpunkt führt ein 9 m breiter Weg (fast ohne Gras) 50 m nach Norden zu einer runden Lichtung (19 m Radius) mit dem Zombie-Haufen (für die 150 Zombies), links und rechts davon ist Wald (`createForest`-Aufruf in `main.js`: `pathW`, `startR`, `hordeR`). Dichte und Menge einstellbar oben in `forest.js` (`TREE_SPACING`, `GRASS_COUNT`, `GRASS_VIEW`).
- Baumstämme sind für den Spieler fest (`collide`). Gezeichnet wird per InstancedMesh in Blöcken, Gras nur im Umkreis von 100 m.

## Dorf (Feld 35)
- `js/village.js`: Dorf mit 6 Häusern (je 3 links und rechts einer Erdstraße), Dorfplatz mit Brunnen, 3 Marktständen, Bänken und Waren, Hühnerhof mit Zaun, Gemüsegarten mit Vogelscheuche, Bienenstöcke, Apfelbäume, Holzstapel, Fässer, Kisten usw. Modelle: `assets/village/` (Avramania Free Collection, CC0).
- Die Dorfstraße liegt auf x = 1350, also genau auf der Linie des Wegs durch den Wald in Feld 45: Weg Feld 55 -> Feld 45 -> Feld 35 -> Dorfplatz.
- Häuser, Stände, Zäune und größeres Zubehör sind für den Spieler fest (`collide`). Hausposition und Zubehör stehen als Liste in `createVillage` (Koordinaten in Metern).

## Credits, Tränke und Händler
- **Credits** stehen oben links im HUD. Jeder besiegte Zombie lässt **2 bis 5 Credits** fallen (`CREDITS_DROP_MIN/MAX` in `config.js`), sie werden automatisch eingesammelt (grünes "+3" neben der Zahl). Credits und Tränke stehen im Spielstand (`stats.js`).
- **Händler** (`js/npc.js`): ein Zombie ohne Rot/Blut (`assets/npc/Zombie_NPC.glb`, Grundlage Zombie_135) am Dorfplatz in Feld 35 (Standort `MERCHANT_SPOT` in `village.js`). Er greift nicht an und ist für den Spieler fest.
- **Ansprechen:** nah herangehen (3,5 m), dann erscheint "E Händler ansprechen" (am Handy antippen) oder Taste **E**. Im Fenster: **Kaufen** und **Verkaufen**, Menge in Paketen zu 100 (+ / − / Max).
  - Kaufen: **100 rote Tränke = 50 Credits** (`POTION_PACK`, `POTION_BUY_PRICE`).
  - Verkaufen: 100 Tränke = 25 Credits (halber Preis, `POTION_SELL_PRICE`).
- **Trank trinken:** Taste **1**, Klick auf die Trank-Anzeige oben links oder (Handy) Trank-Slot 1. Ein Trank heilt 30 % der max. HP, mindestens 30 (`POTION_HEAL_PCT`). Bei vollen HP wird keiner verbraucht.
