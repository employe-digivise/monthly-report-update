"""
Modal deployment for the monthly-report PDF generator.

Wraps the existing Node.js / Express / Puppeteer app in a Modal custom image
and exposes it via `@modal.web_server` so frontend / Edge Function can hit
https://<workspace>--monthly-report-web.modal.run/... without code rewrite.

Deploy:
    modal deploy modal_app.py

Iterate locally with hot-reload:
    modal serve modal_app.py
"""
import modal

APP_NAME = "monthly-report"
NODE_PORT = 3000  # what execution/server.js binds to (see PORT env below)

# ---------------------------------------------------------------------------
# Image: Debian slim + Node.js 20 + Chromium runtime libs for Puppeteer.
# Mirrors the apt-get list from scripts/install-vps.sh.
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates", "gnupg")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    .apt_install(
        # Fonts
        "fonts-liberation", "fonts-noto", "fonts-noto-color-emoji",
        # Chromium shared libs
        "libasound2", "libatk-bridge2.0-0", "libatk1.0-0", "libatspi2.0-0",
        "libcairo2", "libcups2", "libdbus-1-3", "libdrm2", "libexpat1",
        "libgbm1", "libglib2.0-0", "libgtk-3-0", "libnspr4", "libnss3",
        "libpango-1.0-0", "libpangocairo-1.0-0", "libx11-6", "libx11-xcb1",
        "libxcb1", "libxcomposite1", "libxdamage1", "libxext6", "libxfixes3",
        "libxkbcommon0", "libxrandr2", "libxshmfence1", "libxss1", "libxtst6",
        "wget", "xdg-utils",
    )
    # WeasyPrint (optional PDF engine: PDF_ENGINE=weasyprint, ~-75% RAM vs Chromium).
    # pango/cairo already present above; add gdk-pixbuf/ffi/harfbuzz/pangoft2 + the lib.
    # Report fonts are embedded via @font-face data-URIs (WeasyPrint loads them on Linux),
    # so no extra font files are needed.
    .apt_install(
        "libgdk-pixbuf-2.0-0", "libffi8", "libharfbuzz0b", "libpangoft2-1.0-0",
    )
    # Non-fatal: a WeasyPrint install hiccup must never break the puppeteer (default)
    # deploy. If it fails, PDF_ENGINE=weasyprint won't work but puppeteer is unaffected.
    .run_commands("python -m pip install weasyprint brotli || echo 'WARN: weasyprint install skipped'")
    # Copy package manifests first → maximize Docker layer cache for npm ci
    .add_local_file("package.json", "/app/package.json", copy=True)
    .add_local_file("package-lock.json", "/app/package-lock.json", copy=True)
    .workdir("/app")
    .run_commands(
        # Puppeteer downloads Chromium during npm ci; cache it inside the image
        "npm ci --omit=dev",
    )
    .env({
        "NODE_ENV": "production",
        "PORT": str(NODE_PORT),
        # Bind to all interfaces so Modal's web_server proxy can reach it
        "HOST": "0.0.0.0",
        # Insight auto-fill (Claude Haiku) disabled in this deploy.
        # Switch to "0" + attach `anthropic-api-key` secret to enable.
        "INSIGHT_AI_DISABLED": "1",
        # PDF engine: puppeteer (Chromium). WeasyPrint saves RAM but is CPU-bound and
        # renders this report in ~13s on Modal's 2 vCPU -> exceeded the caller's timeout
        # (502). Puppeteer's Chromium renders in ~1.5s on the same CPU, so total is ~3-5s.
        # Set to "weasyprint" only on a higher-vCPU host or with async generation.
        "PDF_ENGINE": "puppeteer",
    })
    # Add the rest of the app *after* deps so code changes don't bust the
    # npm-ci layer.
    .add_local_dir(
        "execution",
        "/app/execution",
        copy=True,
    )
    .add_local_dir(
        "directives",
        "/app/directives",
        copy=True,
        ignore=["*.bak*", "*.backup"],
    )
)

app = modal.App(APP_NAME, image=image)

# ---------------------------------------------------------------------------
# Web server: spawn `node execution/server.js` and let Modal proxy NODE_PORT.
# ---------------------------------------------------------------------------
@app.function(
    # No secrets attached — INSIGHT_AI_DISABLED=1 in image env, so
    # insight_ai.js short-circuits before touching ANTHROPIC_API_KEY.
    # To enable Claude auto-fill later:
    #   1) modal secret create anthropic-api-key ANTHROPIC_API_KEY=sk-ant-...
    #   2) add `secrets=[modal.Secret.from_name("anthropic-api-key")]` here
    #   3) flip INSIGHT_AI_DISABLED to "0" in the .env({...}) block above
    cpu=2.0,
    memory=2048,
    timeout=300,           # generous: PDF gen ~5-10s, plus image pulls
    min_containers=1,      # keep 1 warm → eliminate cold-start for first request
    max_containers=5,      # cap fan-out so we don't surprise-bill
    scaledown_window=300,  # 5 min idle before scale to zero (beyond the warm one)
)
@modal.concurrent(max_inputs=1)  # 1 Puppeteer render per container (~1GB) fits the 2GB
                                 # limit and gets the full 2 vCPU; Modal scales out to
                                 # max_containers for concurrency.
@modal.web_server(port=NODE_PORT, startup_timeout=60)
def web():
    import subprocess
    subprocess.Popen(
        ["node", "execution/server.js"],
        cwd="/app",
    )
