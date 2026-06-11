# Monthly Report PDF Generator

Sistem generasi laporan PDF bulanan untuk brand e-commerce. Menghasilkan laporan multi-halaman berkualitas agensi dengan visualisasi data, dukungan multi-channel (Shopee, TikTok, Tokopedia, Lazada, Blibli, CPAS), dan empat pilihan template.

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Node.js |
| Web Framework | Express.js v5 |
| PDF Engine | pdfmake (native, in-process — tanpa browser) |
| Image Processing | sharp (konversi webp/avif/svg → PNG) |
| Templating | EJS (hanya untuk engine fallback puppeteer/weasyprint) |
| HTTP Client | Axios |
| Logging | Morgan |
| Deployment | Modal (serverless, custom Node container) |

## Struktur Project

```
├── execution/
│   ├── server.js              # Express server & routing
│   ├── generator.js           # Preprocessing payload + pemilihan engine (PDF_ENGINE)
│   ├── sample_data.json       # Contoh payload untuk testing
│   ├── assets/fonts/ttf/      # Inter & Montserrat TTF (di-embed pdfmake)
│   ├── renderers/
│   │   ├── pdfmake/           # ENGINE DEFAULT — laporan aurora penuh sebagai docDefinition
│   │   │   ├── index.js       #   assembler (urutan section, centering 2-pass, footer)
│   │   │   ├── theme.js       #   warna/font/format helper (mirror styles_aurora.css)
│   │   │   └── sections/      #   satu modul per section laporan (13 modul)
│   │   ├── puppeteer.js       # fallback HTML→PDF via Chromium (perlu devDependencies)
│   │   └── weasyprint.js      # fallback HTML→PDF via WeasyPrint
│   └── templates/
│       ├── template_aurora.ejs     # Template HTML aurora (dipakai engine fallback; juga
│       └── styles_aurora.css       #   spec visual yang di-mirror renderer pdfmake)
├── directives/
│   ├── API_DOCS.md            # Referensi API lengkap
│   ├── RENDERER_BENCHMARK.md  # Benchmark & keputusan engine PDF
│   └── generate_pdf_report.md # SOP generasi PDF
├── output/                    # Direktori output PDF (lokal saja)
├── modal_app.py               # Modal deployment (Node container + web_server)
├── package.json
└── .env                       # Environment variables (lokal saja)
```

## Arsitektur

Sistem menggunakan arsitektur 3 layer:

1. **Directive Layer** (`directives/`) — SOP dan dokumentasi
2. **Orchestration Layer** (`server.js`) — Routing, validasi, rate limiting
3. **Execution Layer** (`generator.js`) — Logika generasi PDF

## Instalasi

```bash
# Clone & masuk ke direktori
cd monthly-report-update

# Install dependencies
npm install
```

### Prasyarat

- Node.js >= 18 — itu saja. Engine default (pdfmake) berjalan in-process tanpa
  browser; font TTF sudah dibundel di repo dan sharp membawa libvips prebuilt.
- Opsional: `npm install` penuh (dengan devDependencies) memasang Puppeteer
  untuk engine fallback `PDF_ENGINE=puppeteer` dan benchmark.

## Menjalankan Server

```bash
npm start
```

Server berjalan di `http://localhost:3000`.

### Health Check

```bash
curl http://localhost:3000/health
```

## API Endpoints

### `POST /webhook/lovable`

Endpoint utama untuk generate laporan PDF.

### `POST /generate-report`

Endpoint alternatif (fungsi sama).

### Request

**Content-Type:** `application/json`
**Max Payload:** 50 MB

#### Field Wajib

| Field | Tipe | Contoh |
|-------|------|--------|
| `brandName` | string | `"ELVICTO"` |
| `reportMonth` | string | `"JANUARY"` |
| `reportYear` | string | `"2026"` |

#### Field Opsional

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `template` | string | Hanya `"aurora"` yang didukung (nilai lain otomatis jadi aurora) |
| `logoUrl` | string | URL logo brand |
| `enabledChannels` | object | Channel aktif: `{ shopee, tiktok, tokopedia, lazada, blibli, cpas }` |
| `metrics` | object | Metrik performa (revenue, orders, visitors, dll.) |
| `promotionTools` | object | Data promotion tools per channel |
| `topProducts` | array | Produk terlaris (maks 10 item) |
| `operationalScreenshots` | array | Screenshot operasional (maks 2 URL) |
| `promotionScreenshots` | array | Screenshot promosi (maks 2 URL) |
| `globalRevenue` | object | Data revenue global |
| `shopeeAdsMetrics` | object | Metrik iklan Shopee |
| `tiktok_data` | object | Data TikTok terperinci |
| `cpas_data` | object | Data CPAS terperinci |
| `actionPlan` | array | Rencana aksi `[{ problem, solution, pic }]` (maks 5) |

### Contoh Request

```bash
curl -X POST http://localhost:3000/webhook/lovable \
  -H "Content-Type: application/json" \
  -d '{
    "brandName": "ELVICTO",
    "reportMonth": "JANUARY",
    "reportYear": "2026",
    "template": "aurora",
    "enabledChannels": {
      "shopee": true,
      "tiktok": true,
      "tokopedia": false,
      "lazada": false,
      "blibli": false,
      "cpas": false
    },
    "metrics": {
      "totalRevenue": "Rp 150,000,000",
      "totalOrders": "1,250",
      "averageOrderValue": "Rp 120,000"
    }
  }'
```

### Response Sukses

```json
{
  "success": true,
  "message": "PDF generated successfully",
  "fileName": "Report_ELVICTO_1774522007330.pdf",
  "downloadUrl": "http://localhost:3000/output/Report_ELVICTO_1774522007330.pdf",
  "requestId": "abc123def456"
}
```

### Response Error

```json
{
  "success": false,
  "error": "Missing required field: brandName",
  "requestId": "abc123def456"
}
```

## Template

### Aurora
- Tema warna ungu & oranye
- Desain modern dan kreatif dengan aurora gradient cover
- Section divider split layout, KPI cards gradient border
- Cocok untuk presentasi klien premium

Aurora adalah satu-satunya template. Field `template` pada request bersifat opsional —
nilai apa pun (termasuk legacy `"corporate"`/`"default"`/`"dashboard"`) otomatis dirender sebagai aurora.

## Fitur Teknis

| Fitur | Detail |
|-------|--------|
| **Rate Limiting** | 1 request per 30 detik per IP |
| **Concurrent Limit** | Maks 3 generasi PDF simultan |
| **Auto Cleanup** | PDF lebih dari 24 jam dihapus otomatis (cek tiap jam) |
| **SSRF Protection** | Blokir akses ke IP private & metadata endpoints |
| **Font Embedding** | Font di-embed sebagai base64 (Inter, Montserrat) |
| **Image Processing** | Konversi URL gambar ke base64 dengan retry logic |
| **Request Tracing** | Setiap request memiliki ID unik untuk tracking |
| **Graceful Shutdown** | Server shutdown dengan bersih saat SIGTERM/SIGINT |

## Testing

Gunakan sample data yang tersedia:

```bash
curl -X POST http://localhost:3000/webhook/lovable \
  -H "Content-Type: application/json" \
  -d @execution/sample_data.json
```

## Deployment

### Lokal dengan ngrok

```bash
# Jalankan server
npm start

# Di terminal lain, buat tunnel
ngrok http 3000
```

### VPS (Production)

Sejak 2026-06-11 backend berjalan di VPS Digivise (31.97.222.83) di bawah PM2
— engine pdfmake native cukup ringan (~200 MB peak) sehingga aman berdampingan
dengan service lain di VPS shared (alasan lama pindah ke Modal adalah Chromium
~1 GB/render; itu sudah tidak relevan).

```bash
# provisioning sekali (Node 20 + PM2):
bash scripts/install-vps.sh root@31.97.222.83
# deploy/update (git reset ke origin/main + npm ci --omit=dev + pm2 reload):
bash scripts/deploy-vps.sh root@31.97.222.83
```

- Endpoint publik: `http://31.97.222.83:3000` (port 3000 dibuka via ufw)
- Frontend memanggil lewat Supabase Edge Function `report-generator-webhook`
  (repo vivid-monitor) yang default-nya menunjuk ke endpoint di atas —
  override via secret `REPORT_GENERATOR_WEBHOOK_URL`
- Env produksi diatur di `ecosystem.config.js` (PORT, ALLOWED_ORIGINS,
  INSIGHT_AI_DISABLED)

### Modal (alternatif — saat ini DIHENTIKAN)

App Modal `monthly-report` di-stop saat migrasi ke VPS (`modal app stop
monthly-report`); `modal_app.py` dipertahankan bila perlu kembali auto-scale.

**Prasyarat satu kali:**

```bash
# Install Modal CLI
pip install modal

# Authenticate
modal token new

# Pastikan secret `anthropic-api-key` sudah ada di workspace Modal
# (export var: ANTHROPIC_API_KEY). Buat lewat dashboard atau:
modal secret create anthropic-api-key ANTHROPIC_API_KEY=sk-ant-xxx
```

**Deploy:**

```bash
modal deploy modal_app.py
```

Setelah deploy, Modal akan print public URL:
`https://<workspace>--monthly-report-web.modal.run`

**Edge Function frontend** harus diupdate ke URL itu:

```
POST https://<workspace>--monthly-report-web.modal.run/webhook/lovable
```

**Iterasi lokal (hot-reload):**

```bash
modal serve modal_app.py
```

**Konfigurasi container** (lihat `modal_app.py`):
- 1 vCPU, 1 GB memory (engine pdfmake ~200 MB peak per render — turun dari
  2 vCPU / 2 GB era Puppeteer)
- `min_containers=1` — satu container always-warm, hilangkan cold start
- `max_containers=5` — cap fan-out
- `max_inputs=3` — match `MAX_CONCURRENT` di generator.js
- Secret `anthropic-api-key` TIDAK wajib: `INSIGHT_AI_DISABLED=1` di image
  (lihat komentar di modal_app.py untuk mengaktifkan kembali auto-insight)

**Health check:**

```bash
curl https://<workspace>--monthly-report-web.modal.run/health
```

## Performa

- Render engine (pdfmake, laporan 16-22 halaman): **~0.3-0.5 detik**; total
  termasuk download gambar payload biasanya **1-3 detik**
- Peak RAM per render: **~200 MB** (vs ~1.1 GB Puppeteer; lihat
  `directives/RENDERER_BENCHMARK.md`)
- Format output: **A4**
- Mendukung payload hingga **50 MB**

## Referensi Lanjutan

- [API Documentation](directives/API_DOCS.md) — Referensi API lengkap dengan contoh dan troubleshooting
- [Generation SOP](directives/generate_pdf_report.md) — Standard Operating Procedure generasi PDF
