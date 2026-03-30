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
| Serverless (alt) | Modal + Playwright (Python) |

## Struktur Project

```
├── execution/
│   ├── server.js              # Express server & routing
│   ├── generator.js           # Core PDF generation engine
│   ├── sample_data.json       # Contoh payload untuk testing
│   ├── assets/                # Logo & font files
│   └── templates/
│       ├── template_aurora.ejs     # Template Aurora — DEFAULT (tema ungu & oranye)
│       ├── template_atria.ejs      # Template Atria (tema biru)
│       ├── template_corporate.ejs  # Template Corporate (tema ungu)
│       ├── template_dashboard.ejs  # Template Dashboard (tema abu-abu)
│       ├── styles_aurora.css       # Styling Aurora — DEFAULT
│       ├── styles_atria.css        # Styling Atria
│       ├── styles_corporate.css    # Styling Corporate
│       └── styles_dashboard.css    # Styling Dashboard
├── directives/
│   ├── API_DOCS.md            # Referensi API lengkap
│   └── generate_pdf_report.md # SOP generasi PDF
├── output/                    # Direktori output PDF
├── monthly_report_generator.py # Versi serverless (Modal)
├── package.json
└── .env                       # Environment variables
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
| `template` | string | `"aurora"` (default), `"default"`, `"corporate"`, `"dashboard"` |
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

### Aurora (Default)
- Tema warna ungu & oranye
- Desain modern dan kreatif dengan aurora gradient cover
- Section divider split layout, KPI cards gradient border
- Cocok untuk presentasi klien premium

### Default (Atria)
- Tema warna biru
- Layout modern dengan gradien
- Cocok untuk presentasi klien

### Corporate
- Tema warna ungu
- Desain formal dan terstruktur
- Cocok untuk laporan internal perusahaan

### Dashboard
- Tema warna abu-abu
- Card-based layout
- Cocok untuk reporting analitik

Pilih template via field `template` pada request (`"aurora"`, `"default"`, `"corporate"`, `"dashboard"`).

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

### Modal (Serverless)

```bash
# Setup Modal
pip install modal
modal token set

# Deploy
modal deploy monthly_report_generator.py
```

## Performa

- Waktu generasi: **4-7 detik** per PDF
- Format output: **A4**
- Mendukung payload hingga **50 MB**

## Referensi Lanjutan

- [API Documentation](directives/API_DOCS.md) — Referensi API lengkap dengan contoh dan troubleshooting
- [Generation SOP](directives/generate_pdf_report.md) — Standard Operating Procedure generasi PDF
