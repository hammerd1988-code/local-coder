#!/usr/bin/env bash
# Local Code - Linux desktop launcher
# Starts the app if needed (via the systemd user service when installed,
# otherwise directly), waits until it is healthy, then opens the browser.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${LOCAL_CODER_PORT:-4000}"
URL="http://localhost:${PORT}/"
HEALTH_URL="http://localhost:${PORT}/api/health"
LOG_DIR="$ROOT/data"
LOG_FILE="$LOG_DIR/launcher.log"
SERVICE_NAME="local-coder.service"

mkdir -p "$LOG_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S')  $*" >> "$LOG_FILE"
}

notify() {
  # Best-effort GUI notification; falls back to stderr.
  if command -v notify-send >/dev/null 2>&1; then
    notify-send "Local Code" "$1"
  fi
  echo "Local Code: $1" >&2
}

is_healthy() {
  curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1
}

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  else
    notify "Open $URL in your browser."
  fi
}

if is_healthy; then
  log "App already running - opening browser"
  open_browser
  exit 0
fi

log "Starting Local Code..."

start_via_systemd() {
  local service_node
  command -v systemctl >/dev/null 2>&1 || return 1
  # A user manager must actually be reachable (list-unit-files alone would
  # succeed by reading unit files from disk even without a user session).
  systemctl --user show-environment >/dev/null 2>&1 || return 1
  systemctl --user list-unit-files "$SERVICE_NAME" --no-legend 2>/dev/null \
    | grep -q "$SERVICE_NAME" || return 1
  service_node="$(
    systemctl --user show "$SERVICE_NAME" --property=ExecStart --value 2>/dev/null \
      | sed -n 's/.*path=\([^ ;}]*\).*/\1/p'
  )"
  if [ ! -x "$service_node" ] || ! "$service_node" "$ROOT/scripts/check-node-version.mjs" >> "$LOG_FILE" 2>&1; then
    notify "The installed service uses an unsupported Node runtime. Run: npm run app:linux:install"
    log "Installed service runtime is missing or unsupported (${service_node:-unknown})"
    return 2
  fi
  systemctl --user start "$SERVICE_NAME"
}

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

start_via_systemd
systemd_result=$?
if [ "$systemd_result" -eq 0 ]; then
  log "Starting via systemd user service"
elif [ "$systemd_result" -eq 2 ]; then
  exit 1
else
  command -v node >/dev/null 2>&1 || {
    notify "Node.js was not found. Install Node.js 22.12 or newer."
    log "Missing Node.js runtime - aborting"
    exit 1
  }
  if ! node "$ROOT/scripts/check-node-version.mjs" >> "$LOG_FILE" 2>&1; then
    notify "Local Code requires Node.js 22.12 or newer. See data/launcher.log"
    exit 1
  fi
  ENTRY="$(find_server_entry)" || {
    notify "Local Code is not built yet. Run: npm run build (in $ROOT)"
    log "Missing production build - aborting"
    exit 1
  }
  log "Starting directly with node ($ENTRY)"
  (
    cd "$ROOT/dist" \
      && NODE_ENV=production PORT="$PORT" DATA_DIRECTORY="$ROOT/data" \
        nohup node "$ENTRY" >> "$LOG_DIR/app-stdout.log" 2>> "$LOG_DIR/app-stderr.log" &
  )
fi

deadline=$((SECONDS + 90))
while [ "$SECONDS" -lt "$deadline" ]; do
  if is_healthy; then
    log "Ready - opening browser"
    open_browser
    exit 0
  fi
  sleep 0.5
done

log "Timed out waiting for server"
notify "Local Code is taking too long to start. Try opening $URL in a moment. See data/launcher.log"
open_browser
exit 1
