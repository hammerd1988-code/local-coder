#!/usr/bin/env bash
# Local Code - Linux desktop install
#
# Installs:
#   - a systemd user service (local-coder.service) that starts the app at login
#   - an application menu / desktop launcher (.desktop entry)
#   - the app icon
#
# Usage:
#   ./scripts/install-linux-desktop.sh            install (builds first if needed)
#   ./scripts/install-linux-desktop.sh --uninstall
#
# Everything is installed per-user (no sudo required).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${LOCAL_CODER_PORT:-4000}"

SERVICE_NAME="local-coder.service"
SERVICE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_FILE="$SERVICE_DIR/$SERVICE_NAME"

APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_FILE="$APPS_DIR/local-coder.desktop"

ICON_SRC="$ROOT/client/public/android-chrome-512x512.png"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"
ICON_FILE="$ICON_DIR/local-coder.png"

user_systemd_available() {
  command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1
}

refresh_desktop_database() {
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APPS_DIR" 2>/dev/null || true
  fi
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q "${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor" 2>/dev/null || true
  fi
}

uninstall() {
  echo "Uninstalling Local Code desktop integration..."
  if user_systemd_available; then
    systemctl --user disable --now "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$SERVICE_FILE"
    systemctl --user daemon-reload
  else
    rm -f "$SERVICE_FILE"
  fi
  rm -f "$DESKTOP_FILE" "$ICON_FILE"
  refresh_desktop_database
  echo "Done. The repository itself was not removed."
}

if [ "${1:-}" = "--uninstall" ]; then
  uninstall
  exit 0
fi

command -v node >/dev/null 2>&1 || { echo "Error: node not found. Install Node.js 20+ first (https://nodejs.org)." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm not found. Install Node.js 20+ first (https://nodejs.org)." >&2; exit 1; }
NODE_BIN="$(command -v node)"

# The compiled entry lives at dist/server/server/index.js because the server
# build includes the repo-root package.json (imported by server/metrics.ts).
find_server_entry() {
  local p
  for p in "$ROOT/dist/server/server/index.js" "$ROOT/dist/server/index.js"; do
    if [ -f "$p" ]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

# Build the production bundle if it does not exist yet.
if ! find_server_entry >/dev/null || [ ! -f "$ROOT/dist/public/index.html" ]; then
  echo "Production build not found - building..."
  if [ ! -d "$ROOT/node_modules" ]; then
    (cd "$ROOT" && npm install)
  fi
  (cd "$ROOT" && npm run build)
fi
SERVER_ENTRY="$(find_server_entry)" || { echo "Error: build did not produce a server entry under dist/." >&2; exit 1; }

mkdir -p "$ROOT/data"

# --- systemd user service -------------------------------------------------
mkdir -p "$SERVICE_DIR"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Local Code - local AI code editor
After=network.target

[Service]
Type=simple
# cwd must be dist/ so the server finds its static files in dist/public
WorkingDirectory=$ROOT/dist
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=DATA_DIRECTORY=$ROOT/data
ExecStart=$NODE_BIN $SERVER_ENTRY
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
echo "Installed: $SERVICE_FILE"

if user_systemd_available; then
  systemctl --user daemon-reload
  systemctl --user enable --now "$SERVICE_NAME"
  echo "Service enabled and started (starts automatically when you log in)."
else
  echo "Note: no systemd user session detected; service file installed but not started."
  echo "The desktop launcher will start the app directly instead."
fi

# --- icon -------------------------------------------------------------------
mkdir -p "$ICON_DIR"
cp "$ICON_SRC" "$ICON_FILE"
echo "Installed: $ICON_FILE"

# --- .desktop entry ---------------------------------------------------------
chmod +x "$ROOT/scripts/local-coder-launch.sh"
mkdir -p "$APPS_DIR"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Local Code
Comment=Launch Local Code - local AI code editor
Exec=$ROOT/scripts/local-coder-launch.sh
Icon=local-coder
Terminal=false
Categories=Development;IDE;
Keywords=code;editor;ide;
EOF
chmod +x "$DESKTOP_FILE"
echo "Installed: $DESKTOP_FILE"

refresh_desktop_database

echo
echo "Done. Find \"Local Code\" in your application menu, or open http://localhost:$PORT/"
