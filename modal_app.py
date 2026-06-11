"""
Modal deployment for the monthly-report PDF generator.

Wraps the Node.js / Express app in a Modal custom image and exposes it via
`@modal.web_server` so frontend / Edge Function can hit
https://<workspace>--monthly-report-web.modal.run/... without code rewrite.

PDF engine: pdfmake (native, in-process). No Chromium, no WeasyPrint — the
image needs only Node 20 + npm deps (sharp ships its own prebuilt libvips).
Benchmark: ~110 MB peak RSS per render vs ~1.1 GB with Puppeteer (−90%).
Fonts (Inter/Montserrat TTF) are bundled in execution/assets/fonts/ttf.

Deploy:
    modal deploy modal_app.py

Iterate locally with hot-reload:
    modal serve modal_app.py
"""
import modal

APP_NAME = "monthly-report"
NODE_PORT = 3000  # what execution/server.js binds to (see PORT env below)

# ---------------------------------------------------------------------------
# Image: Debian slim + Node.js 20. `npm ci --omit=dev` skips puppeteer (a
# devDependency now), so no Chromium download and no browser shared libs.
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates", "gnupg")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    # Copy package manifests first → maximize Docker layer cache for npm ci
    .add_local_file("package.json", "/app/package.json", copy=True)
    .add_local_file("package-lock.json", "/app/package-lock.json", copy=True)
    .workdir("/app")
    .run_commands(
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
        # Native in-process engine (default). HTML fallbacks (puppeteer /
        # weasyprint) are NOT installed in this image — to use one, restore
        # the browser libs + deps from git history first.
        "PDF_ENGINE": "pdfmake",
        # Frontend calls this API directly from the browser → allow any origin.
        # (server.js CORS defaults to localhost only, which 500s the preflight.)
        "ALLOWED_ORIGINS": "*",
    })
    # Add the rest of the app *after* deps so code changes don't bust the
    # npm-ci layer.
    # NOTE: .modalignore is NOT honored by modal>=1.x — exclusions must be
    # passed explicitly. sample_data.json contains real brand/client data and
    # must never ship into the image.
    .add_local_dir(
        "execution",
        "/app/execution",
        copy=True,
        ignore=["**/sample_data.json", "**/*.bak*", "**/*.backup", "**/.DS_Store"],
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
    cpu=1.0,               # pdfmake render is sub-second; downloads are I/O-bound
    memory=1024,           # ~110 MB/render peak + headroom for parallel image buffers
    timeout=300,           # generous: PDF gen ~2-5s incl. image pulls
    min_containers=1,      # keep 1 warm → eliminate cold-start for first request
    max_containers=5,      # cap fan-out so we don't surprise-bill
    scaledown_window=300,  # 5 min idle before scale to zero (beyond the warm one)
)
@modal.concurrent(max_inputs=3)  # matches generator.js MAX_CONCURRENT=3; pdfmake
                                 # renders in-process (~110 MB each) so 3 fit easily.
@modal.web_server(port=NODE_PORT, startup_timeout=60)
def web():
    import subprocess
    subprocess.Popen(
        ["node", "execution/server.js"],
        cwd="/app",
    )
