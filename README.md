# Monthly Report PDF Generator

Sistem generasi laporan PDF bulanan untuk brand e-commerce. Menghasilkan laporan multi-halaman berkualitas agensi dengan visualisasi data, dukungan multi-channel (Shopee, TikTok, Tokopedia, Lazada, Blibli, CPAS), dan empat pilihan template.

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Node.js |
| Web Framework | Express.js v5 |
| PDF Engine | Puppeteer (Headless Chrome) |
| Templating | EJS |
| HTTP Client | Axios |
| Logging | Morgan |
| Deployment | Modal (serverless, custom Node container) |

## Struktur Project

```
├── execution/
│   ├── server.js              # Express server & routing
│   ├── generator.js           # Core PDF generation engine
│   ├── sample_data.json       # Contoh payload untuk testing
│   ├── assets/                # Logo & font files
│   └── templates/
│       ├── template_aurora.ejs     # Template Aurora — satu-satunya template (tema ungu & oranye)
│       └── styles_aurora.css       # Styling Aurora
├── directives/
│   ├── API_DOCS.md            # Referensi API lengkap
│   └── generate_pdf_report.md # SOP generasi PDF
├── output/                    # Direktori output PDF (lokal saja)
├── modal_app.py               # Modal deployment (Node container + web_server)
├── .modalignore               # File yang dikecualikan dari Modal upload
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

- Node.js >= 18
- Chromium/Chrome (diinstall otomatis oleh Puppeteer)

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

### Modal (Production)

Sistem berjalan sebagai Modal Function dengan custom Node.js container yang
membungkus `execution/server.js`. Tujuannya: lepas Puppeteer dari VPS shared
(masalah resource bentrok dengan project lain) dan dapat auto-scale.

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
- 2 vCPU, 2 GB memory
- `min_containers=1` — satu container always-warm, hilangkan cold start
- `max_containers=5` — cap fan-out
- `max_inputs=3` — match `MAX_CONCURRENT` di generator.js

**Health check:**

```bash
curl https://<workspace>--monthly-report-web.modal.run/health
```

## Performa

- Waktu generasi: **4-7 detik** per PDF
- Format output: **A4**
- Mendukung payload hingga **50 MB**

## Referensi Lanjutan

- [API Documentation](directives/API_DOCS.md) — Referensi API lengkap dengan contoh dan troubleshooting
- [Generation SOP](directives/generate_pdf_report.md) — Standard Operating Procedure generasi PDF
