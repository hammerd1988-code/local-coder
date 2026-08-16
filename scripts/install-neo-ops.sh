#!/usr/bin/env bash
#
# install-neo-ops.sh — one-shot installer for the NEO//OPS server control deck.
#
# Installs Node.js + build tools, clones/builds this repo, writes an environment
# file and a systemd service, and starts it. Run once per Ubuntu node.
#
# The service binds to 127.0.0.1 only. Reach the dashboard by SSH-tunneling to
# the node:  ssh -L 4000:localhost:4000 user@node   then open http://localhost:4000/ops
#
# For a rack, install this on every node. Pick ONE node as your "hub" and add
# the others to it (either with --peer flags here, or later from the dashboard's
# node switcher). The hub opens its own SSH tunnels to each peer, so only the
# hub needs SSH access to the others and nothing is exposed on the LAN.
#
# Usage (run as root):
#   sudo bash install-neo-ops.sh [options]
#
# Options:
#   --repo URL         Git repo to clone            (default: origin of this checkout, else GitHub)
#   --branch NAME      Branch to build              (default: main)
#   --dir PATH         Install directory            (default: /opt/neo-ops)
#   --port N           Port the service listens on  (default: 4000)
#   --data PATH        Data directory (db, config)  (default: /var/lib/neo-ops)
#   --name NAME        This node's display name      (default: hostname)
#   --peer "k=v,..."   Add a remote node to this node's registry (repeatable).
#                      Keys: name, host (required), user, port, remotePort, key
#   --no-build         Skip npm ci + build (for config-only re-runs)
#   -h, --help         Show this help
#
# Every option can also be given as an environment variable, which avoids
# typing "--" on devices that autocorrect it into a dash character:
#   NEO_OPS_REPO  NEO_OPS_BRANCH  NEO_OPS_DIR  NEO_OPS_PORT  NEO_OPS_DATA
#   NEO_OPS_NAME  NEO_OPS_NO_BUILD
# e.g.  sudo NEO_OPS_BRANCH=my-branch bash install-neo-ops.sh
#
set -euo pipefail

REPO_URL="${NEO_OPS_REPO:-}"
BRANCH="${NEO_OPS_BRANCH:-main}"
INSTALL_DIR="${NEO_OPS_DIR:-/opt/neo-ops}"
PORT="${NEO_OPS_PORT:-4000}"
DATA_DIR="${NEO_OPS_DATA:-/var/lib/neo-ops}"
NODE_NAME="${NEO_OPS_NAME:-$(hostname)}"
DO_BUILD=1
[[ -n "${NEO_OPS_NO_BUILD:-}" ]] && DO_BUILD=0
PEERS=()

log()  { printf '\033[1;36m[neo-ops]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[neo-ops]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[neo-ops] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# Phone keyboards and rich-text editors silently rewrite a leading "--" as an
# em/en dash, which then arrives here as an unparseable option. Fold it back.
if [[ $# -gt 0 ]]; then
  NORMALIZED=()
  for arg in "$@"; do
    case "$arg" in
      —*) arg="--${arg#—}" ;;
      –*) arg="--${arg#–}" ;;
      ―*) arg="--${arg#―}" ;;
      −*) arg="--${arg#−}" ;;
    esac
    NORMALIZED+=("$arg")
  done
  set -- "${NORMALIZED[@]}"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)     REPO_URL="$2"; shift 2 ;;
    --branch)   BRANCH="$2"; shift 2 ;;
    --dir)      INSTALL_DIR="$2"; shift 2 ;;
    --port)     PORT="$2"; shift 2 ;;
    --data)     DATA_DIR="$2"; shift 2 ;;
    --name)     NODE_NAME="$2"; shift 2 ;;
    --peer)     PEERS+=("$2"); shift 2 ;;
    --no-build) DO_BUILD=0; shift ;;
    -h|--help)  sed -n '2,40p' "$0"; exit 0 ;;
    *)          die "Unknown option: $1" ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || die "Please run as root (sudo)."

# Infer repo URL from this checkout if not provided.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "$REPO_URL" ]]; then
  if git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    REPO_URL="$(git -C "$SCRIPT_DIR" config --get remote.origin.url || true)"
  fi
  REPO_URL="${REPO_URL:-https://github.com/hammerd1988-code/local-coder.git}"
fi

log "Installing system prerequisites…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential python3 ca-certificates openssh-client

# Node.js 20+ (NodeSource 22 LTS) if missing or too old.
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [[ "$MAJOR" -ge 20 ]] && NEED_NODE=0
fi
if [[ "$NEED_NODE" -eq 1 ]]; then
  log "Installing Node.js 22 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
log "node $(node -v) / npm $(npm -v)"

# Fetch / update the source.
if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating existing checkout in $INSTALL_DIR…"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
else
  log "Cloning $REPO_URL ($BRANCH) into $INSTALL_DIR…"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

if [[ "$DO_BUILD" -eq 1 ]]; then
  log "Installing dependencies and building (this compiles node-pty & better-sqlite3)…"
  ( cd "$INSTALL_DIR" && npm ci --legacy-peer-deps && npm run build )
else
  warn "Skipping build (--no-build)."
fi

mkdir -p "$DATA_DIR"

# Environment file consumed by the systemd unit.
ENV_FILE="$INSTALL_DIR/neo-ops.env"
log "Writing $ENV_FILE"
cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$PORT
HOST=127.0.0.1
DATA_DIRECTORY=$DATA_DIR
OPS_NODE_NAME=$NODE_NAME
EOF
chmod 600 "$ENV_FILE"

# Optional: seed the remote-node registry from --peer flags.
if [[ "${#PEERS[@]}" -gt 0 ]]; then
  NODES_JSON="$DATA_DIR/nodes.json"
  log "Writing rack registry $NODES_JSON (${#PEERS[@]} peer(s))"
  {
    echo '{'
    echo '  "nodes": ['
    first=1
    for spec in "${PEERS[@]}"; do
      name=""; host=""; user="root"; sport="22"; rport="4000"; key=""
      IFS=',' read -ra KV <<< "$spec"
      for pair in "${KV[@]}"; do
        k="${pair%%=*}"; v="${pair#*=}"
        case "$k" in
          name) name="$v" ;; host) host="$v" ;; user) user="$v" ;;
          port) sport="$v" ;; remotePort) rport="$v" ;; key|identityFile) key="$v" ;;
        esac
      done
      [[ -n "$host" ]] || die "--peer entry missing host: $spec"
      [[ -n "$name" ]] || name="$host"
      [[ "$first" -eq 1 ]] || echo '    ,'
      first=0
      printf '    { "name": "%s", "host": "%s", "user": "%s", "port": %s, "remotePort": %s' "$name" "$host" "$user" "$sport" "$rport"
      [[ -n "$key" ]] && printf ', "identityFile": "%s"' "$key"
      printf ' }\n'
    done
    echo '  ]'
    echo '}'
  } > "$NODES_JSON"
fi

# Install the systemd unit from the template.
UNIT_SRC="$INSTALL_DIR/scripts/neo-ops.service"
UNIT_DST="/etc/systemd/system/neo-ops.service"
[[ -f "$UNIT_SRC" ]] || die "Service template not found at $UNIT_SRC"
log "Installing systemd unit $UNIT_DST"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$UNIT_SRC" > "$UNIT_DST"

systemctl daemon-reload
systemctl enable neo-ops >/dev/null 2>&1 || true
systemctl restart neo-ops

sleep 2
log "Service status:"
systemctl --no-pager --lines=0 status neo-ops || true

cat <<EOF

\033[1;32m════════════════════════════════════════════════════════════════\033[0m
 NEO//OPS is installed and running on \033[1;36m$NODE_NAME\033[0m (127.0.0.1:$PORT)

 Reach the dashboard from your workstation via an SSH tunnel:
   \033[1;36mssh -L $PORT:localhost:$PORT $(logname 2>/dev/null || echo user)@$(hostname -I 2>/dev/null | awk '{print $1}')\033[0m
 then open  \033[1;36mhttp://localhost:$PORT/ops\033[0m

 Manage the service:
   systemctl {status|restart|stop} neo-ops
   journalctl -u neo-ops -f

 Add more rack nodes later: use the node switcher (top-right of the
 dashboard) → "+", or re-run with --peer "name=NODE-02,host=10.0.0.12,user=ubuntu".
 (The hub needs SSH key access to each peer: ssh-copy-id user@peer.)
\033[1;32m════════════════════════════════════════════════════════════════\033[0m
EOF
