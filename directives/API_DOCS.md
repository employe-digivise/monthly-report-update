# API Documentation for PDF Report Generator

## Endpoints

### Primary Endpoint (Ngrok - Active)
**URL**: `https://cfb7-182-10-97-197.ngrok-free.app/webhook/lovable`
**Method**: `POST`
**Headers**:
- `Content-Type: application/json`
**Status**: ✅ Active

### Alternative Endpoint (Manual Report Generation)
**URL**: `https://cfb7-182-10-97-197.ngrok-free.app/generate-report`
**Method**: `POST`
**Headers**:
- `Content-Type: application/json`

### Local Testing
**URL**: `http://localhost:3000/webhook/lovable`
**Method**: `POST`
**Headers**: 
- `Content-Type: application/json`

---

## Request Body Structure (JSON)

### Complete Example

```json
{
  "brandName": "AMK",
  "reportMonth": "JANUARY",
  "reportYear": "2026",
  "showLogo": true,
  "logoUrl": "https://example.com/logo.png", 
  "footerText": "CONFIDENTIAL - DIGIVISE REPORT 2026",
  "enabledChannels": {
    "shopee": true,
    "tiktok": false,
    "tokopedia": false,
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
    "komboHemat": true,
    "chatBroadcast": true
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
          "shopee": "Rp647M",
          "tiktok": "Rp49M",
          "tokopedia": "Rp0",
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
          "tokopedia": "Rp0",
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
          "shopee": "11.13%",
          "tiktok": "8.93%",
          "tokopedia": "0%",
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
          "shopee": "8.98x",
          "tiktok": "11.20x",
          "tokopedia": "0x",
          "lazada": "0x",
          "blibli": "0x"
        }
      }
    ],
    "summary": "This is a summary of the global performance.",
    "aiConclusion": []
  },
  "storePerformance": {
    "adSales": 0,
    "existingSales": 100,
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
    }
  ],
  "cpas_data": {
    "period": ["Dec 25", "Jan 26"],
    "awareness_nv": [
      { "metric": "Ads Spend", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" },
      { "metric": "Impression", "prev": "0", "current": "0", "growth": "0%" },
      { "metric": "Link Clicks", "prev": "0", "current": "0", "growth": "0%" },
      { "metric": "CTR (%)", "prev": "0%", "current": "0%", "growth": "0%" },
      { "metric": "CPC (Rp)", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" }
    ],
    "conversion_rm": [
      { "metric": "Ads Spend", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" },
      { "metric": "Frequency", "prev": "0", "current": "0", "growth": "0%" },
      { "metric": "Revenue", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" },
      { "metric": "Transaction", "prev": "0", "current": "0", "growth": "0%" },
      { "metric": "ROAS", "prev": "0", "current": "0", "growth": "0%" }
    ],
    "best_campaigns": {
      "nv": {
        "name": "Campaign NV Name",
        "impression": 1234567,
        "ctr": "3.5%",
        "spend": "Rp5M",
        "atc": 450,
        "c_atc": "Rp11,111",
        "images": ["https://example.com/nv1.jpg", "https://example.com/nv2.jpg"]
      },
      "rm": {
        "name": "Campaign RM Name",
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
      "summary": ["Summary point 1", "Summary point 2"]
    },
    "gmv_max_performance": {
      "period": ["Dec 2025", "Jan 2026"],
      "metrics": [
        { "metric": "Ads Spend", "prev": "Rp17M", "current": "Rp18M", "growth": "3.48%" },
        { "metric": "Gross Revenue", "prev": "Rp332M", "current": "Rp361M", "growth": "8.76%" }
      ]
    }
  },
  "actionPlan": []
}
```

---

## Field Requirements & Validation

### Required Fields
- `brandName` (string): Brand name for the report
- `reportMonth` (string): Month name in uppercase (e.g., "JANUARY")
- `reportYear` (string): Year (e.g., "2026")

### Optional Fields (with Fallbacks)
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

### Pie Chart Visualizations
The report includes pie charts on **Page 9** (Store Performance) and **Page 16** (TikTok Store Performance):

**Color Scheme:**
- **Primary Blue**: `#1e40af` - First segment (New Buyers / Video)
- **Medium Blue**: `#3b82f6` - Second segment (Live Streaming)
- **Light Blue**: `#60a5fa` - Third segment (Old Buyers / Product Card)

**Data Labels:**
- Percentages are displayed with 1 decimal precision (e.g., "32.0%")
- Labels are positioned outside the pie chart with connecting lines
- Revenue amounts are shown in the accompanying table below each chart


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

### Image Processing
- **All image URLs are automatically converted to Base64** during PDF generation
- Supports both **HTTP/HTTPS URLs** and local file paths
- Supported formats: JPG, PNG, WebP
- **Applies to all image fields:**
  - `logoUrl` - Brand/agency logo
  - `operationalScreenshots` - Operational performance screenshots (max 2)
  - `promotionScreenshots` - Promotion tool screenshots (max 2)
  - `topProducts[].image` - Product images (max 5 products)
  - `cpas_data.best_campaigns.nv.images` - NV campaign images (max 2)
  - `cpas_data.best_campaigns.rm.images` - RM campaign images (max 2)
- **External URLs from Lovable are fully supported** and will be embedded in the PDF
- Images must be publicly accessible
- Failed image downloads will be logged but won't stop PDF generation

### Top Products
- Maximum 5 products will be displayed
- If fewer than 5 products provided, remaining rows will be padded with empty cells
- Product images are processed and embedded as Base64

---

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "PDF generated successfully",
  "fileName": "Report_AMK_1770798712328.pdf",
  "downloadUrl": "http://localhost:3000/output/Report_AMK_1770798712328.pdf",
  "data": {
    "pdfUrl": "http://localhost:3000/output/Report_AMK_1770798712328.pdf"
  }
}
```

### Error Response (400 Bad Request)
```json
{
  "success": false,
  "message": "Invalid or empty JSON body."
}
```

### Error Response (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error generating PDF",
  "error": "Detailed error message"
}
```

---

## Important Notes

### Screenshot Requirements
⚠️ **CRITICAL**: The following fields MUST be included in the request for screenshots to appear:
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
- Timeout: 60 seconds

### Webhook Integration (Lovable)
- Use the `/webhook/lovable` endpoint for webhook integrations
- No authentication required (secured by ngrok URL obscurity)
- Supports concurrent requests
- PDF files are stored in `/output` directory with timestamp-based naming

---

## Testing

### Using cURL
```bash
curl -X POST https://cfb7-182-10-97-197.ngrok-free.app/webhook/lovable \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

### Using Postman
1. Method: POST
2. URL: `https://cfb7-182-10-97-197.ngrok-free.app/webhook/lovable`
3. Headers: `Content-Type: application/json`
4. Body: Raw JSON (paste the complete example above)

---

## Troubleshooting

### Issue: Screenshots Not Appearing
**Cause**: `operationalScreenshots` or `promotionScreenshots` fields are missing from request
**Solution**: Ensure both fields are included in the JSON payload with valid image URLs

### Issue: PDF Generation Timeout
**Cause**: Large images or slow network
**Solution**: Use optimized images (<500KB each) and ensure stable internet connection

### Issue: Chart Not Displaying
**Cause**: Invalid `chartData` structure
**Solution**: Verify `labels`, `revenueData`, and `adsSpentData` arrays have matching lengths

---

**Last Updated**: 2026-02-13 10:21 WIB  
**Active Endpoint**: `https://cfb7-182-10-97-197.ngrok-free.app/webhook/lovable`  
**Server Status**: ✅ Running on `localhost:3000`

