#!/usr/bin/env bash
# Deploys mcp-waggle to the Raspberry Pi and restarts the systemd service.
#
# The Pi (default pi@raspberrypi.local) runs the checked-out repo at
# /home/pi/mcp-waggle as mcp-waggle.service (config in /etc/mcp-waggle.env),
# deploying whatever is on origin/main — so commit and push first; the script
# refuses to run from a dirty or unpushed tree.
#
# Usage:            ./scripts/deploy-pi.sh
# Overrides (env):  PI_HOST, PI_DIR, SERVICE, BRANCH, PUBLIC_URL, SKIP_TESTS=1
set -euo pipefail

PI_HOST="${PI_HOST:-pi@raspberrypi.local}"
PI_DIR="${PI_DIR:-/home/pi/mcp-waggle}"
SERVICE="${SERVICE:-mcp-waggle}"
BRANCH="${BRANCH:-main}"
PUBLIC_URL="${PUBLIC_URL:-https://waggle.heycasper.uk}"

say() { printf '\n\033[36m▸ %s\033[0m\n' "$*"; }

cd "$(dirname "$0")/.."

say "Preflight: clean and pushed?"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty — commit (or stash) before deploying." >&2
  exit 1
fi
git fetch origin "$BRANCH" --quiet
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "origin/$BRANCH")"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "HEAD (${LOCAL_HEAD:0:7}) differs from origin/$BRANCH (${REMOTE_HEAD:0:7})." >&2
  echo "The Pi deploys from GitHub — push (or pull) first." >&2
  exit 1
fi

if [[ "${SKIP_TESTS:-}" != "1" ]]; then
  say "Preflight: test suite"
  npm test
fi

say "Deploying ${REMOTE_HEAD:0:7} to $PI_HOST:$PI_DIR"
ssh -o BatchMode=yes "$PI_HOST" bash -s -- "$PI_DIR" "$SERVICE" "$BRANCH" <<'REMOTE'
set -euo pipefail
dir="$1" service="$2" branch="$3"
cd "$dir"

echo "→ syncing to origin/$branch"
git fetch origin "$branch"
git reset --hard "origin/$branch"

echo "→ installing dependencies"
npm ci --no-audit --no-fund

echo "→ building"
npm run build

# Migrations run automatically on service startup (openDatabase), against the
# DB_PATH from /etc/<service>.env — no separate migrate step needed here.
echo "→ restarting $service"
sudo systemctl restart "$service"

port="$(sudo grep -oE '^WAGGLE_HTTP_PORT=[0-9]+' "/etc/${service}.env" | cut -d= -f2 || true)"
port="${port:-3203}"
# The Host-header allowlist (DNS-rebinding protection) 403s plain
# 127.0.0.1 requests, so present the first allowed host.
allowed_host="$(sudo grep -oE '^WAGGLE_HTTP_ALLOWED_HOSTS=[^,]+' "/etc/${service}.env" | cut -d= -f2 || true)"

echo "→ waiting for $service on port $port"
for i in $(seq 1 20); do
  if ! sudo systemctl is-active --quiet "$service"; then
    echo "✗ $service failed to start; recent log:" >&2
    sudo journalctl -u "$service" -n 30 --no-pager >&2
    exit 1
  fi
  if curl -fsS ${allowed_host:+-H "Host: $allowed_host"} \
      "http://127.0.0.1:${port}/.well-known/oauth-authorization-server" > /dev/null 2>&1; then
    echo "✓ $service active at $(git rev-parse --short HEAD), local health OK"
    exit 0
  fi
  sleep 1
done
echo "✗ $service is active but not answering on port $port after 20s; recent log:" >&2
sudo journalctl -u "$service" -n 30 --no-pager >&2
exit 1
REMOTE

say "Public health check ($PUBLIC_URL)"
curl -fsS "$PUBLIC_URL/.well-known/oauth-authorization-server" > /dev/null
echo "✓ $PUBLIC_URL is serving"

say "Deployed ${REMOTE_HEAD:0:7}."
