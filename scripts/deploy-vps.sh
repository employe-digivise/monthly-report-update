#!/usr/bin/env bash
# Deploy latest code to the VPS and reload PM2.
# Assumes: install-vps.sh already ran AND repo is cloned at $REMOTE_DIR.
#
# Usage: bash scripts/deploy-vps.sh <ssh-host>
#   e.g. bash scripts/deploy-vps.sh root@31.97.222.83
#
# Override defaults via env:
#   REMOTE_DIR=/root/monthly-report-update
#   GIT_REMOTE=origin
#   GIT_BRANCH=main

set -euo pipefail

SSH_HOST="${1:-}"
if [[ -z "$SSH_HOST" ]]; then
  echo "Usage: $0 <ssh-host>   (e.g. root@31.97.222.83)" >&2
  exit 1
fi

REMOTE_DIR="${REMOTE_DIR:-/root/monthly-report-update}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"

ssh "$SSH_HOST" \
  REMOTE_DIR="$REMOTE_DIR" \
  GIT_REMOTE="$GIT_REMOTE" \
  GIT_BRANCH="$GIT_BRANCH" \
  bash -s <<'REMOTE'
set -euo pipefail

cd "$REMOTE_DIR"

if [[ ! -d .git ]]; then
  echo "ERROR: $REMOTE_DIR is not a git repo. Clone the repo first:" >&2
  echo "  git clone https://github.com/employe-digivise/monthly-report-update.git $REMOTE_DIR" >&2
  exit 1
fi

echo "==> Fetch & reset to $GIT_REMOTE/$GIT_BRANCH"
git fetch --prune "$GIT_REMOTE"
git checkout "$GIT_BRANCH"
git reset --hard "$GIT_REMOTE/$GIT_BRANCH"

echo "==> npm ci (production)"
npm ci --omit=dev

echo "==> pm2 reload (or start if first run)"
if pm2 describe monthly-report >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
  pm2 save
fi

pm2 status monthly-report
echo "==> Deploy complete."
REMOTE
