@echo off
cd /d "%~dp0"
echo Projekt 3D laeuft auf http://localhost:8000  (Beenden mit Strg+C)
start http://localhost:8000
python -m http.server 8000
