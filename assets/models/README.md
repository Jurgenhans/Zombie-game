# 3D-Modelle

Lege hier ab (Binär-**.glb**, nicht als .txt hochladen!):

- `player.glb` – Spielermodell (Mensch_005)
- `zombie.glb` – Zombiemodell (Zombie_003)

Beim Start versucht das Spiel beide zu laden. Fehlen sie oder sind sie defekt, wird automatisch ein
prozedurales Humanoid-Modell (gleiche Hautfarben/Kleidung wie in den GLB-`extras.spec`) verwendet.
Modelle werden automatisch auf 1,8 m Höhe skaliert und auf den Boden gestellt.
