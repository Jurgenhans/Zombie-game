# DEAD CITY – 3D Zombie Shooter (Android)

Ego-Shooter in Three.js, per Capacitor als Android-APK verpackt (GitHub Actions: *Projekt3D APK bauen* → Artifact `Projekt3D-APK`).

- 250 × 250 m verlassene Stadt (Straßen, Häuser, Autos, Barrieren, Park), frei begehbar, Kollision, auf Autos/Kisten springen
- Touch: Joystick links (weit ziehen = Sprint), rechts wischen = Umsehen, Buttons: Feuer (ziehen = zielen), Nachladen, Sprung, Sprint, Waffenwechsel
- 4 Waffen (Pistole, MP, Sturmgewehr, Schrotflinte) mit Schaden, Magazin/Reserve, Nachladen, Rückstoß, Mündungsfeuer, Tracer, Einschussspuren, Blut, Kopfschuss ×2,5
- Zombies: Leben, KI (Wandern, Hören/Sehen, Verfolgen, Hindernis-Ausweichen, Nahkampf), Sterbeanimation
- HUD: Welle, verbleibende Zombies, Leben, Munition/Waffe, Kills · Game-Over mit Neustart
- Pickups: Munition, Medipacks
- PC-Test: WASD, Maus, Leertaste, Shift, R, 1–4

## Wellen & Zombie-Modelle (später)
In `game.js` → `CONFIG.wavesEnabled = true` aktiviert das fertige Wellensystem. Bis dahin stehen `trainingZombies` als Übungsziele auf der Map (`0` = keine).
Zombie-/Spielermodell: `assets/models/zombie.glb` / `player.glb` (siehe dortige README).
