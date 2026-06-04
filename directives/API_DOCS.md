# API Documentation for PDF Report Generator

## Base URL

| Environment | URL |
|-------------|-----|
| **Production (VPS)** | `http://<YOUR_VPS_HOST>:<PORT>` |
| Local Development | `http://localhost:3000` |

---

## Endpoints

### Generate Report (Webhook)
**URL**: `{BASE_URL}/webhook/lovable`
**Method**: `POST`
**Headers**:
- `Content-Type: application/json`

### Generate Report (Alternative)
**URL**: `{BASE_URL}/generate-report`
**Method**: `POST`
**Headers**:
- `Content-Type: application/json`

> Both endpoints accept the same request body and return the same response format.

### Health Check
**URL**: `{BASE_URL}/health`
**Method**: `GET`
**Response**:
```json
{
  "status": "ok",
  "uptime": 54012,
  "memory": "70MB",
  "timestamp": "2026-03-31T07:37:35.755Z"
}
```

---

## Security

### Rate Limiting
- **Limit**: 1 request per 30 seconds per IP address
- Exceeding the limit returns HTTP 429 with `retryAfter` field

### CORS
- Configurable via `ALLOWED_ORIGINS` environment variable
- Defaults to `http://localhost:3000`
- Server-to-server requests (no Origin header) are allowed

### SSRF Protection
- All image URLs are validated before download
- Blocked: localhost, private IPs (10.x, 172.16-31.x, 192.168.x), cloud metadata endpoints
- Only HTTP/HTTPS protocols allowed

### Input Sanitization
- All text fields (brandName, footerText, reportMonth, reportYear) are stripped of HTML tags
- Numeric metrics are clamped to valid ranges (0-100% for rates, 0-5 for ratings)
- Template parameter is validated against allowed values

### Security Headers
All responses include: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`

### Authentication
Currently no API key authentication is required. Access is controlled via CORS origins and network-level security (VPS firewall rules). For production deployments, consider adding API key or token-based authentication.

---

## AI-Generated Insights (Auto-fill)

Insight/summary fields below are **optional** in the request body. If the field is empty (`""`, `[]`), missing, or contains a placeholder (`"test"`, `"TODO"`), the server auto-fills it using Claude (`claude-haiku-4-5`) based on the surrounding data. User-provided non-placeholder content is preserved as-is.

| Field path | Type | Section |
|---|---|---|
| `metrics.summary` | string | Operational Performance |
| `globalRevenue.summary` | string | Global Revenue |
| `globalPerformanceDetail.aiConclusion` | string[] | Global Performance |
| `storePerformance.notes` | string | Shopee Store Performance |
| `shopeeAdsSummary` | string | Shopee Ads |
| `tiktok_data.store_performance.summary` | string[] | TikTok Store Performance |

**Env vars** (server-side):
- `ANTHROPIC_API_KEY` — required to enable enrichment. If missing, slots stay empty (template fallbacks still apply).
- `INSIGHT_AI_MODEL` — defaults to `claude-haiku-4-5-20251001`.
- `INSIGHT_AI_DISABLED=1` — disables enrichment (used in tests).

Failures per slot are logged but do not abort the request.

---

## Request Body Structure (JSON)

### Complete Example

```json
{
  "brandName": "AMK",
  "reportMonth": "JANUARY",
  "reportYear": "2026",
  "template": "aurora",
  "showLogo": true,
  "logoUrl": "https://example.com/logo.png",
  "footerText": "CONFIDENTIAL - DIGIVISE REPORT 2026",

  "enabledChannels": {
    "shopee": true,
    "tiktok": true,
    "tokopedia": true,
    "lazada": false,
    "blibli": false,
    "cpas": true
  },

  "metrics": {
    "unfulfilledOrders": 0,
    "lateShipment": 0,
    "chatResponseRate": 98.5,
    "overallRating": 4.8,
    "summary": "Performa toko bulan ini menunjukkan peningkatan signifikan."
  },

  "operationalScreenshots": [
    "https://example.com/screenshot1.png",
    "https://example.com/screenshot2.png"
  ],

  "promotionTools": {
    "paketDiskon": true,
    "gratisOngkirXTRA": true,
    "voucherIkutiToko": true,
    "voucherTokoSaya": true,
    "flashSaleTokoSaya": true,
    "komboHemat": true,
    "chatBroadcast": true,
    "shopeeLive": true
  },

  "promotionScreenshots": [
    "https://example.com/promo1.png",
    "https://example.com/promo2.png"
  ],

  "globalRevenue": {
    "totalRevenue": 695436115,
    "totalOrders": 4636,
    "chartData": {
      "labels": ["Jan 25", "Feb 25", "Mar 25", "Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26"],
      "revenueData": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 437747260, 695436115],
      "adsSpentData": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 56805175, 79927013]
    },
    "summary": "Revenue meningkat 58.87% dibanding bulan lalu."
  },

  "globalPerformanceDetail": {
    "comparisonData": [
      {
        "metric": "Revenue",
        "thisMonth": "Rp695M",
        "lastMonth": "Rp438M",
        "growth": "+58.87%",
        "channels": {
          "shopee": "Rp597M",
          "tiktok": "Rp49M",
          "tokopedia": "Rp50M",
          "lazada": "Rp0",
          "blibli": "Rp0"
        }
      },
      {
        "metric": "Cost Spend",
        "thisMonth": "Rp80M",
        "lastMonth": "Rp57M",
        "growth": "+40.70%",
        "channels": {
          "shopee": "Rp72M",
          "tiktok": "Rp4M",
          "tokopedia": "Rp4M",
          "lazada": "Rp0",
          "blibli": "Rp0"
        }
      },
      {
        "metric": "CIR",
        "thisMonth": "11.49%",
        "lastMonth": "12.98%",
        "growth": "-11.43%",
        "channels": {
          "shopee": "12.06%",
          "tiktok": "8.93%",
          "tokopedia": "8.00%",
          "lazada": "0%",
          "blibli": "0%"
        }
      },
      {
        "metric": "ROAS",
        "thisMonth": "8.70x",
        "lastMonth": "7.71x",
        "growth": "+12.91%",
        "channels": {
          "shopee": "8.29x",
          "tiktok": "11.20x",
          "tokopedia": "12.50x",
          "lazada": "0x",
          "blibli": "0x"
        }
      }
    ],
    "summary": "Revenue keseluruhan meningkat 58.87% MoM. Shopee tetap kontributor utama, TikTok dan Tokopedia menunjukkan pertumbuhan positif.",
    "aiConclusion": [
      "Shopee masih mendominasi 86% total revenue.",
      "TikTok ROAS tertinggi di 11.20x, efisiensi ads paling baik.",
      "Tokopedia mulai berkontribusi dengan ROAS 12.50x."
    ]
  },

  "storePerformance": {
    "newBuyers": 60,
    "oldBuyers": 40,
    "adSalesRevenue": 417261669,
    "existingRevenue": 278174446,
    "totalRevenue": 695436115,
    "notes": ""
  },

  "shopeeAdsMetrics": {
    "dilihat": 2845336,
    "ctr": "4.82%",
    "klik": 137233,
    "cpc": "Rp 186",
    "penjualan": "Rp 246M",
    "biaya": "Rp 25M"
  },

  "shopeeAdsSummary": "Performa iklan Shopee bulan ini stabil dengan CTR 4.82% dan CPC Rp186. Total penjualan dari ads mencapai Rp246M.",

  "adsChartUrl": "https://example.com/ads-performance-chart.png",

  "topProducts": [
    {
      "name": "AMK Kemeja Koko Pria Lengan Pendek KK HADDID S/S Brown",
      "image": "https://cf.shopee.co.id/file/id-11134207-7r98y-lshzk9cy3bzxf1",
      "soldPercent": "26.20%",
      "qty": 109,
      "revenue": 13898611
    },
    {
      "name": "AMK Kemeja Koko Pria Printing Lengan Panjang KK NIZAM L/S NAVY BLUE",
      "image": "https://cf.shopee.co.id/file/id-11134207-7rbk9-m760ooqrnpd668",
      "soldPercent": "19.95%",
      "qty": 83,
      "revenue": 11015167
    },
    {
      "name": "AMK Kemeja Koko Pria Lengan Panjang KK ARZAN L/S Black",
      "image": "https://example.com/product3.jpg",
      "soldPercent": "15.30%",
      "qty": 64,
      "revenue": 8960000
    },
    {
      "name": "AMK Kemeja Koko Pria Lengan Pendek KK FAHRI S/S White",
      "image": "https://example.com/product4.jpg",
      "soldPercent": "12.10%",
      "qty": 50,
      "revenue": 7250000
    },
    {
      "name": "AMK Kemeja Koko Pria Premium KK RIZAL L/S Navy",
      "image": "https://example.com/product5.jpg",
      "soldPercent": "8.45%",
      "qty": 35,
      "revenue": 5425000
    },
    {
      "name": "AMK Kemeja Koko Pria Lengan Pendek KK DANISH S/S Grey",
      "image": "https://example.com/product6.jpg",
      "soldPercent": "5.20%",
      "qty": 22,
      "revenue": 3080000
    },
    {
      "name": "AMK Kemeja Koko Pria Lengan Panjang KK ZAIN L/S Olive",
      "image": "https://example.com/product7.jpg",
      "soldPercent": "4.10%",
      "qty": 17,
      "revenue": 2465000
    },
    {
      "name": "AMK Kemeja Koko Pria Printing KK AARIZ S/S Cream",
      "image": "https://example.com/product8.jpg",
      "soldPercent": "3.50%",
      "qty": 15,
      "revenue": 2100000
    },
    {
      "name": "AMK Kemeja Koko Pria Lengan Pendek KK BILAL S/S Black",
      "image": "https://example.com/product9.jpg",
      "soldPercent": "2.80%",
      "qty": 12,
      "revenue": 1680000
    },
    {
      "name": "AMK Kemeja Koko Pria Premium KK IDRIS L/S Maroon",
      "image": "https://example.com/product10.jpg",
      "soldPercent": "2.10%",
      "qty": 9,
      "revenue": 1350000
    }
  ],

  "cpas_data": {
    "period": ["Dec 25", "Jan 26"],
    "awareness_nv": [
      { "metric": "Ads Spend", "prev": "Rp 5.000.000", "current": "Rp 7.500.000", "growth": "+50%" },
      { "metric": "Impression", "prev": "1.200.000", "current": "1.800.000", "growth": "+50%" },
      { "metric": "Link Clicks", "prev": "24.000", "current": "36.000", "growth": "+50%" },
      { "metric": "CTR (%)", "prev": "2.0%", "current": "2.0%", "growth": "0%" },
      { "metric": "CPC (Rp)", "prev": "Rp 208", "current": "Rp 208", "growth": "0%" }
    ],
    "conversion_rm": [
      { "metric": "Ads Spend", "prev": "Rp 8.000.000", "current": "Rp 10.000.000", "growth": "+25%" },
      { "metric": "Frequency", "prev": "2.3", "current": "2.5", "growth": "+8.7%" },
      { "metric": "Revenue", "prev": "Rp 56.000.000", "current": "Rp 64.000.000", "growth": "+14.3%" },
      { "metric": "Transaction", "prev": "980", "current": "1.200", "growth": "+22.4%" },
      { "metric": "ROAS", "prev": "7.0x", "current": "6.4x", "growth": "-8.6%" }
    ],
    "best_campaigns": {
      "nv": {
        "name": "AMK - Awareness Jan 2026",
        "impression": 1234567,
        "ctr": "3.5%",
        "spend": "Rp5M",
        "atc": 450,
        "c_atc": "Rp11,111",
        "images": ["https://example.com/nv1.jpg", "https://example.com/nv2.jpg"]
      },
      "rm": {
        "name": "AMK - Retargeting Jan 2026",
        "frequency": 2.5,
        "spend": "Rp8M",
        "revenue": "Rp64M",
        "qty": 1200,
        "roas": "8.0x",
        "images": ["https://example.com/rm1.jpg", "https://example.com/rm2.jpg"]
      }
    }
  },

  "tiktok_data": {
    "store_performance": {
      "total_revenue": 79298108,
      "composition": {
        "video": { "revenue": 25369058, "percentage": 32.0 },
        "live_streaming": { "revenue": 10280229, "percentage": 13.0 },
        "product_card": { "revenue": 43648821, "percentage": 55.0 }
      },
      "summary": [
        "Revenue TikTok Shop meningkat 15% MoM mencapai Rp79.3jt.",
        "Product Card mendominasi 55% dari total revenue.",
        "Live streaming masih perlu ditingkatkan, hanya 13% kontribusi."
      ]
    },
    "gmv_max_performance": {
      "period": ["Dec 2025", "Jan 2026"],
      "metrics": [
        { "metric": "Ads Spend", "prev": "Rp17M", "current": "Rp18M", "growth": "+3.48%" },
        { "metric": "Gross Revenue", "prev": "Rp332M", "current": "Rp361M", "growth": "+8.76%" },
        { "metric": "ROAS", "prev": "19.5x", "current": "20.1x", "growth": "+3.08%" },
        { "metric": "CPA", "prev": "Rp12.500", "current": "Rp11.800", "growth": "-5.6%" },
        { "metric": "Impression", "prev": "2.500.000", "current": "2.800.000", "growth": "+12%" },
        { "metric": "CTR", "prev": "3.2%", "current": "3.5%", "growth": "+9.38%" }
      ]
    }
  },

  "tokopedia_data": {
    "total_revenue": 50000000,
    "ads_performance": {
      "period": ["Dec 2025", "Jan 2026"],
      "metrics": [
        { "metric": "Ads Spend", "prev": "Rp 1.000.000", "current": "Rp 1.500.000", "growth": "+50%" },
        { "metric": "Impression", "prev": "500.000", "current": "750.000", "growth": "+50%" },
        { "metric": "Click", "prev": "10.000", "current": "15.000", "growth": "+50%" },
        { "metric": "CTR (%)", "prev": "2.0%", "current": "2.0%", "growth": "0%" },
        { "metric": "Revenue", "prev": "Rp 10.000.000", "current": "Rp 12.500.000", "growth": "+25%" },
        { "metric": "ROAS", "prev": "10.0x", "current": "8.3x", "growth": "-17%" }
      ]
    }
  },

  "actionPlan": [
    {
      "priority": "High",
      "problem": "Live streaming TikTok hanya kontribusi 13% revenue",
      "solution": "Tingkatkan frekuensi live menjadi 5x/minggu dengan host dedicated dan promo exclusive live",
      "pic": "Tim Content",
      "deadline": "Feb 2026"
    },
    {
      "priority": "High",
      "problem": "CPC Shopee Ads masih tinggi di Rp186",
      "solution": "Optimasi keyword bidding, fokus ke long-tail keyword dengan CPC lebih rendah",
      "pic": "Tim Ads",
      "deadline": "Feb 2026"
    },
    {
      "priority": "Medium",
      "problem": "Tokopedia affiliate masih 15%, belum maksimal",
      "solution": "Rekrut 10 affiliate baru dan buat program komisi bertingkat",
      "pic": "Tim Partnership",
      "deadline": "Mar 2026"
    },
    {
      "priority": "Medium",
      "problem": "CPAS ROAS menurun dari 7.0x ke 6.4x",
      "solution": "Review audience targeting, exclude non-converting segments, refresh creative assets",
      "pic": "Tim Ads",
      "deadline": "Feb 2026"
    },
    {
      "priority": "Low",
      "problem": "Chat response rate perlu dipertahankan di atas 95%",
      "solution": "Setup auto-reply untuk FAQ dan monitoring respons di luar jam kerja",
      "pic": "Tim CS",
      "deadline": "Feb 2026"
    }
  ]
}
```

---

## Field Requirements & Validation

### Required Fields
- `brandName` (string, max 100 chars): Brand name for the report
- `reportMonth` (string, max 50 chars): Month name in uppercase (e.g., "JANUARY")
- `reportYear` (string/number): Year between 2020-2030 (e.g., "2026")

### Template Selection
- `template` (string, optional): Report visual style. Only `"aurora"` is supported.
  Any value (or omitting the field) renders the **Aurora** template (purple & orange theme).

### Optional Fields (with Fallbacks)
- `showLogo` (boolean): Whether to show agency logo. Default: `true`
- `logoUrl` (string): URL or local path to logo image. Falls back to built-in logo
- `footerText` (string, max 200 chars): Cover page footer text. Default: `"CONFIDENTIAL"`
  - When `showLogo=false`, "DIGIVISE" is automatically removed from footer text

- `operationalScreenshots` (array): URLs of operational screenshots (max 2)
  - **If missing**: Placeholder boxes will be shown
  - **Format**: Array of public image URLs

- `promotionScreenshots` (array): URLs of promotion screenshots (max 2)
  - **If missing**: Placeholder boxes will be shown
  - **Format**: Array of public image URLs

- `cpas_data` (object): CPAS performance data
  - **If missing**: CPAS section will be skipped
  - **Default**: `null`

- `tiktok_data` (object): TikTok performance data
  - **If missing**: TikTok section will be skipped
  - **Default**: `null`

- `tokopedia_data` (object): Tokopedia performance data
  - **If missing**: Tokopedia section will be skipped
  - **Default**: `null`

- `shopeeAdsSummary` (string): Summary text for Shopee Ads performance section
  - **If missing**: Summary box will not be shown
  - **Default**: `""`

- `actionPlan` (array): Action plan items (max 5 rows)
  - Each item: `{ priority, problem, solution, pic, deadline }`
  - **If missing**: Action plan table will be empty

### Metrics Validation
Numeric metrics are clamped to valid ranges:
- `unfulfilledOrders`: 0-100 (%)
- `lateShipment`: 0-100 (%)
- `chatResponseRate`: 0-100 (%)
- `overallRating`: 0-5

### Store Performance (Page 9) — Donut Chart
The donut chart visualizes **New Buyers vs Old Buyers** ratio.

**`storePerformance` fields:**
| Field | Type | Keterangan |
|-------|------|------------|
| `newBuyers` | number (0-100) | Persentase new buyers. Ditampilkan di **donut chart**. |
| `oldBuyers` | number (0-100) | Persentase old buyers. Ditampilkan di **donut chart**. |
| `adSalesRevenue` | number | Revenue dari ad sales (Rupiah). Ditampilkan di **tabel**. |
| `existingRevenue` | number | Revenue dari existing buyers (Rupiah). Ditampilkan di **tabel**. |
| `totalRevenue` | number | Total revenue (Rupiah). Ditampilkan di KPI box atas. |
| `notes` | string | Catatan/analisis di bawah tabel. |

> Persentase `newBuyers`/`oldBuyers` di-clamp ke 0-100 dan dinormalisasi agar total = 100%.

**Color Scheme (Aurora):**
- **Aurora**: Primary `#6C2BD9`, Accent `#FF6B2C`, Tertiary `#A855F7`

### Pie Chart (Page 16) — TikTok Store Performance
The TikTok donut chart shows Video / Live Streaming / Product Card composition.

**Data Labels:**
- Percentages are displayed with 1 decimal precision (e.g., "32.0%")
- Labels are positioned outside the pie chart
- Revenue amounts are shown in the accompanying table below each chart

### Tokopedia Performance
Tokopedia section shows a **Total Revenue card** and **Ads Performance table** (no store performance/donut chart).

**`tokopedia_data` fields:**
| Field | Type | Keterangan |
|-------|------|------------|
| `total_revenue` | number | Total revenue Tokopedia (Rupiah). Ditampilkan di card atas. |
| `ads_performance.period` | array [2] | Periode perbandingan (e.g., ["Dec 2025", "Jan 2026"]) |
| `ads_performance.metrics` | array | Array of metric rows with `metric`, `prev`, `current`, `growth` |


### Global Performance Table (Page 7) - Dynamic Columns
The Global Performance table on **Page 7** dynamically adjusts its columns based on `enabledChannels`:

**Behavior:**
- **Channel columns are added dynamically** for each enabled channel
- **Column order**: `shopee` → `tiktok` → `tokopedia` → `lazada` → `blibli`
- **If a channel is `false`**: Its column is NOT displayed
- **If a channel is `true`**: Its column appears in the table

**Column Width Calculation:**
- Metriks column: Fixed 20%
- Fixed columns (THIS MONTH, LAST MONTH, GROWTH): 45% total (15% each)
- Channel columns: Remaining 35% divided equally among enabled channels

**Examples:**

1. **Only Shopee enabled:**
   ```
   | Metriks (20%) | SHOPEE (35%) | THIS MONTH (15%) | LAST MONTH (15%) | GROWTH (15%) |
   ```

2. **Shopee + TikTok enabled:**
   ```
   | Metriks (20%) | SHOPEE (17.5%) | TIKTOK (17.5%) | THIS MONTH (15%) | LAST MONTH (15%) | GROWTH (15%) |
   ```

3. **All channels enabled:**
   ```
   | Metriks (20%) | SHOPEE (7%) | TIKTOK (7%) | TOKOPEDIA (7%) | LAZADA (7%) | BLIBLI (7%) | THIS MONTH (15%) | LAST MONTH (15%) | GROWTH (15%) |
   ```

### Action Plan (Page 18)
- Text fields `problem`, `solution`, and `pic` are **NOT truncated** and will wrap to fit the cell width.
- Limit: 5 rows per page.

**Data Requirements:**
- Each metric row in `comparisonData` must include a `channels` object
- The `channels` object should contain values for ALL possible channels (shopee, tiktok, tokopedia, lazada, blibli)
- Use `"-"` or `"Rp0"` or `"0%"` for channels with no data
- Missing channel values will display as `"-"`

**Example comparisonData row:**
```json
{
  "metric": "Revenue",
  "thisMonth": "Rp695M",
  "lastMonth": "Rp438M",
  "growth": "+58.87%",
  "channels": {
    "shopee": "Rp647M",
    "tiktok": "Rp49M",
    "tokopedia": "Rp0",
    "lazada": "Rp0",
    "blibli": "Rp0"
  }
}
```

### Image Processing
- **All image URLs are automatically converted to Base64** during PDF generation
- Supports both **HTTP/HTTPS URLs** and local file paths
- Supported formats: JPG, PNG, WebP
- **Applies to all image fields:**
  - `logoUrl` - Brand/agency logo
  - `operationalScreenshots` - Operational performance screenshots (max 2)
  - `promotionScreenshots` - Promotion tool screenshots (max 2)
  - `topProducts[].image` - Product images (max 10 products)
  - `cpas_data.best_campaigns.nv.images` - NV campaign images (max 2)
  - `cpas_data.best_campaigns.rm.images` - RM campaign images (max 2)
- **External URLs from Lovable are fully supported** and will be embedded in the PDF
- Images must be publicly accessible
- Failed image downloads are logged and reported in the `warnings` array of the response

### Top Products
- Supports up to **10 products** (default 5)
- Products are **automatically sorted by revenue** (highest first) before rendering
- **1-5 products**: displayed on a single page
- **6-10 products**: split across 2 pages — "Top Products" (1-5) and "Top Products (Lanjutan)" (6-10)
- No empty rows are rendered — only actual products are shown
- Product images are processed and embedded as Base64

---

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "PDF generated successfully",
  "fileName": "Report_AMK_1770798712328.pdf",
  "downloadUrl": "http://<YOUR_VPS_HOST>:<PORT>/output/Report_AMK_1770798712328.pdf",
  "requestId": "a1b2c3d4e5f6g7h8",
  "data": {
    "pdfUrl": "http://<YOUR_VPS_HOST>:<PORT>/output/Report_AMK_1770798712328.pdf",
    "pdfBase64": "<base64-encoded-pdf-string>"
  }
}
```

### Response Fields

| Field | Type | Keterangan |
|-------|------|------------|
| `data.pdfBase64` | string | **PDF dalam format base64** — gunakan ini untuk download di browser. Tidak kena block ad-blocker/CORS. |
| `data.pdfUrl` | string | URL langsung ke file PDF di server. Bisa diblock browser karena raw IP. |
| `downloadUrl` | string | Sama dengan `data.pdfUrl` (backward compatibility). |

> **PENTING**: Gunakan `data.pdfBase64` untuk download di frontend. Field `pdfUrl`/`downloadUrl` tetap tersedia sebagai fallback atau untuk akses server-to-server.

### Success with Warnings (200 OK)
When some images fail to download, the response includes a `warnings` array:
```json
{
  "success": true,
  "message": "PDF generated successfully",
  "fileName": "Report_AMK_1770798712328.pdf",
  "downloadUrl": "http://<YOUR_VPS_HOST>:<PORT>/output/Report_AMK_1770798712328.pdf",
  "requestId": "a1b2c3d4e5f6g7h8",
  "warnings": [
    "Failed to download image: https://example.com/broken-image.png"
  ],
  "data": {
    "pdfUrl": "http://<YOUR_VPS_HOST>:<PORT>/output/Report_AMK_1770798712328.pdf",
    "pdfBase64": "<base64-encoded-pdf-string>"
  }
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | Bad Request | Invalid/empty JSON body, missing required fields, invalid template |
| 413 | Payload Too Large | Request body exceeds 50MB limit |
| 429 | Too Many Requests | Rate limit exceeded (1 request per 30 seconds per IP) |
| 500 | Internal Server Error | PDF generation failure |

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Invalid data format. brandName is required and must be a string.",
  "requestId": "a1b2c3d4e5f6g7h8"
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "message": "Please wait 25 seconds before generating another report.",
  "retryAfter": 25
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Internal server error",
  "requestId": "a1b2c3d4e5f6g7h8"
}
```

---

## Lovable Integration

### Webhook URL Configuration

Lovable harus set environment variable:
```
REPORT_GENERATOR_WEBHOOK_URL=http://<YOUR_VPS_HOST>:<PORT>
```

Lovable akan otomatis append `/webhook/lovable` ke base URL tersebut:
```
finalWebhookUrl = REPORT_GENERATOR_WEBHOOK_URL + "/webhook/lovable"
```

### Request Headers
```
Content-Type: application/json
```

### Override via Body
Lovable dapat override target URL dengan menambahkan `target_url` di request body.

### Perubahan yang Diperlukan di Frontend (Lovable)

Saat menerima response dari webhook, frontend harus menggunakan `data.pdfBase64` untuk membuat download link, **bukan** `data.pdfUrl` (yang bisa diblock browser karena raw IP).

**Kode untuk download PDF dari base64:**
```typescript
// Setelah menerima response dari webhook
const { data } = response;

if (data.pdfBase64) {
  // Decode base64 ke binary
  const byteCharacters = atob(data.pdfBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });

  // Buat download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response.fileName || 'report.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
```

**Atau untuk preview PDF di browser:**
```typescript
// Buat URL untuk iframe/embed
const blob = new Blob([byteArray], { type: 'application/pdf' });
const previewUrl = URL.createObjectURL(blob);
// Gunakan previewUrl di <iframe src={previewUrl} /> atau window.open(previewUrl)
```

**Ringkasan perubahan frontend:**
1. Ganti logic download yang sebelumnya pakai `pdfUrl` (direct URL) → pakai `pdfBase64` (base64 decode)
2. Tidak perlu lagi fetch/redirect ke URL VPS untuk download
3. Field `pdfUrl` tetap ada sebagai fallback jika `pdfBase64` kosong

---

## Important Notes

### Screenshot Requirements
**CRITICAL**: The following fields MUST be included in the request for screenshots to appear:
- `operationalScreenshots`: Array of 2 image URLs
- `promotionScreenshots`: Array of 2 image URLs

If these fields are missing or empty, placeholder boxes will be displayed in the PDF.

### Chart Data
- Months with both `revenueData: 0` AND `adsSpentData: 0` will be hidden from the chart
- Chart automatically scales based on maximum values
- Supports up to 13 data points (months)

### CPAS Best Campaigns
- Each campaign (NV and RM) supports 2 images displayed side-by-side
- Images are specified in the `images` array within each campaign object

### Performance
- Average generation time: 4-7 seconds
- PDF file size: ~2-3 MB
- Timeout: 120 seconds
- Max concurrent generations: 3

### File Management
- PDF files are stored in `/output` directory with timestamp-based naming
- PDFs older than 24 hours are automatically cleaned up

---

## Testing

### Using cURL
```bash
curl -X POST http://<YOUR_VPS_HOST>:<PORT>/webhook/lovable \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

### Using Postman
1. Method: POST
2. URL: `http://<YOUR_VPS_HOST>:<PORT>/webhook/lovable`
3. Headers: `Content-Type: application/json`
4. Body: Raw JSON (paste the complete example above)

---

## Troubleshooting

### Issue: Webhook Failed 404
**Cause**: `REPORT_GENERATOR_WEBHOOK_URL` tidak di-set atau salah di Lovable
**Solution**: Set environment variable ke `http://<YOUR_VPS_HOST>:<PORT>`

### Issue: PDF Download Blocked by Browser (ERR_BLOCKED_BY_CLIENT)
**Cause**: Browser/ad-blocker memblokir download dari raw IP address
**Solution**: Gunakan `data.pdfBase64` dari response untuk membuat download link di frontend (lihat bagian Lovable Integration)

### Issue: Screenshots Not Appearing
**Cause**: `operationalScreenshots` or `promotionScreenshots` fields are missing from request
**Solution**: Ensure both fields are included in the JSON payload with valid image URLs

### Issue: PDF Generation Timeout
**Cause**: Large images or slow network
**Solution**: Use optimized images (<500KB each) and ensure stable internet connection

### Issue: Chart Not Displaying
**Cause**: Invalid `chartData` structure
**Solution**: Verify `labels`, `revenueData`, and `adsSpentData` arrays have matching lengths

### Issue: Rate Limited (429)
**Cause**: Sending requests faster than 1 per 30 seconds
**Solution**: Wait for the `retryAfter` seconds indicated in the response

---

**Last Updated**: 2026-04-02
**Server Status**: Deployed on VPS `<YOUR_VPS_HOST>:<PORT>` (PM2: `monthly-report`)
