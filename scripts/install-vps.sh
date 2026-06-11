#!/usr/bin/env bash
# Provision a fresh VPS to run the monthly-report PDF generator.
# Installs Node.js 20 and PM2. Idempotent: safe to re-run.
#
# PDF engine is pdfmake (native, in-process): it needs NO browser libraries —
# sharp ships its own prebuilt libvips and the report fonts (Inter/Montserrat
# TTF) live inside execution/assets/fonts/ttf. The legacy HTML engines
# (PDF_ENGINE=puppeteer|weasyprint) are NOT provisioned here anymore; set
# INSTALL_HTML_ENGINES=1 to provision their system deps (puppeteer itself is a
# devDependency, so the deploy must also run `npm ci` without --omit=dev).
#
# Usage: bash scripts/install-vps.sh <ssh-host>
#   e.g. bash scripts/install-vps.sh root@31.97.222.83

set -euo pipefail

SSH_HOST="${1:-}"
if [[ -z "$SSH_HOST" ]]; then
  echo "Usage: $0 <ssh-host>   (e.g. root@31.97.222.83)" >&2
  exit 1
fi

REMOTE_DIR="${REMOTE_DIR:-/root/monthly-report-update}"
INSTALL_HTML_ENGINES="${INSTALL_HTML_ENGINES:-0}"

ssh "$SSH_HOST" REMOTE_DIR="$REMOTE_DIR" INSTALL_HTML_ENGINES="$INSTALL_HTML_ENGINES" bash -s <<'REMOTE'
set -euo pipefail

echo "==> apt update"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl

echo "==> Install Node.js 20 (NodeSource)"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

if [[ "$INSTALL_HTML_ENGINES" == "1" ]]; then
  echo "==> [optional] Install Chromium runtime libs (PDF_ENGINE=puppeteer fallback)"
  apt-get install -y \
    fonts-liberation fonts-noto fonts-noto-color-emoji \
    libasound2t64 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 libgbm1 \
    libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
    libxshmfence1 libxss1 libxtst6 wget xdg-utils \
    || apt-get install -y \
         fonts-liberation fonts-noto fonts-noto-color-emoji \
         libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
         libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 libgbm1 \
         libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
         libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
         libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
         libxshmfence1 libxss1 libxtst6 wget xdg-utils

  echo "==> [optional] Install WeasyPrint (PDF_ENGINE=weasyprint fallback)"
  apt-get install -y python3 python3-pip python3-venv \
    libgdk-pixbuf-2.0-0 libffi8 libharfbuzz0b fonts-dejavu-core \
    || apt-get install -y python3 python3-pip python3-venv libgdk-pixbuf2.0-0 libffi7 libharfbuzz0b fonts-dejavu-core || true
  python3 -m venv /opt/weasyprint-venv 2>/dev/null || true
  /opt/weasyprint-venv/bin/pip install --quiet --upgrade pip weasyprint brotli || true
  ln -sf /opt/weasyprint-venv/bin/weasyprint /usr/local/bin/weasyprint 2>/dev/null || true
  /opt/weasyprint-venv/bin/weasyprint --info >/dev/null 2>&1 && echo "   weasyprint OK" || echo "   weasyprint install skipped/failed"
fi

echo "==> Install pm2 globally"
npm install -g pm2

echo "==> Prepare app dir: $REMOTE_DIR"
mkdir -p "$REMOTE_DIR" "$REMOTE_DIR/output"

echo "==> pm2 startup (so service survives reboot)"
pm2 startup systemd -u root --hp /root || true

echo "==> DONE. Run scripts/deploy-vps.sh <ssh-host> to deploy code."
REMOTE
