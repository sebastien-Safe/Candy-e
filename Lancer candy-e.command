#!/bin/bash
PORT=3000
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
URL="http://localhost:$PORT/public/login.html"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║      [ candy-e ] — Démarrage         ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Libérer le port si déjà occupé
lsof -ti :$PORT | xargs kill -9 2>/dev/null
sleep 0.5

echo "  URL : $URL"
echo "  Ctrl+C pour arrêter."
echo ""

cd "$FRONTEND_DIR"

# Ouvre le navigateur après 1.5s (laisse le temps au serveur de démarrer)
# ?fresh=1 force une déconnexion propre à chaque démarrage
(sleep 1.5 && open "${URL}?fresh=1") &

# Serveur HTTP via npx serve (HTTP/1.1, MIME types corrects)
npx serve --listen $PORT --no-clipboard 2>&1
