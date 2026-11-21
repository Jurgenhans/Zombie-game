#!/bin/sh
# Startet einen kleinen lokalen Webserver. Danach im Browser öffnen: http://localhost:8000
cd "$(dirname "$0")"
echo "Projekt 3D läuft auf http://localhost:8000  (Beenden mit Strg+C)"
python3 -m http.server 8000
