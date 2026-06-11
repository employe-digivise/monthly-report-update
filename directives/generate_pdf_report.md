# Directive: Generate PDF Report (The Iron Frame)

## Goal
Generate a premium, agency-grade A4 PDF report from structured JSON data while maintaining strict layout locking ("The Iron Frame").

## Architecture
- **Layer 1 (Directive)**: This document.
- **Layer 2 (Orchestration)**: AI Agent / Express Server.
- **Layer 3 (Execution)**: `execution/generator.js` (preprocessing + engine
  selection via `PDF_ENGINE`) → `execution/renderers/pdfmake/` (default native
  engine; puppeteer/weasyprint remain as HTML fallbacks).

## Input Specification
- **brandName**: String (e.g., "ATRIA PREMIUM")
- **logoUrl**: String (URL, local path, or Base64) - Optional, used if showLogo is true
- **reportMonth**: String (e.g., "January 2026")
- **enabledChannels**: Object (e.g., `{ "Shopee": true }`)
- **metrics**: Object (Summary and channel-specific metrics)
- **promotionTools**: Object (6 boolean fields: paketDiskon, gratisOngkirXTRA, voucherIkutiToko, voucherTokoSaya, komboHemat, chatBroadcast)
- **topProducts**: Array of objects (Product details, capped at 5 items in Execution Layer)
- **tiktok_data**: Object (Optional, required if `enabledChannels.tiktok` is true)

## Tools & Scripts
- **Tool**: `execution/generator.js`
- **Logic**: 
    - Data Slicing: Forces array limits (Top Products: 5, Performance: 7).
    - Chart Logic: Renders Page 6 Global Revenue as SVG (Combo Chart: Bar + Line) with dynamic month window (filters out months where both Revenue and Ads Spent are 0).
    - Global Performance Table (Page 7): Dynamically generates table columns based on `enabledChannels`. Columns appear in order: shopee → tiktok → tokopedia → lazada → blibli. Only enabled channels get columns. Column widths auto-calculate to fit all enabled channels.
    - Best Campaign: Split into Page 14 (NV) and Page 15 (RM), each supporting 2 images displayed side-by-side.
    - Image Processing: Converts ALL image URLs (HTTP/HTTPS and local paths) to Base64 for embedding in PDF. Applies to: logo, operational screenshots, promotion screenshots, product images, and best campaign images.
    - PDF Rendering: Default engine `pdfmake` builds the report natively
      (A4, in-process, ~0.3-0.5s, ~200MB peak RAM). `PDF_ENGINE=puppeteer`
      (A4, 0mm margins, needs devDependencies) and `PDF_ENGINE=weasyprint`
      render the same report via the HTML template instead.
    - Dynamic Page Numbering: Adjusts page count based on enabled channels (e.g. TikTok adds 3 pages).

## Outputs
- **Deliverable**: `.pdf` file in `output/` directory (root).

## Edge Cases & Fail-safes
- **Empty Data**: Uses EJS conditionals to prevent empty layout blocks.
- **Long Text**: CSS `text-overflow: ellipsis` handles overflow in most tables, with specific wrapping enabled for critical product details (Page 11) and Action Plan (Page 18).
- **Large Payloads**: Server handles up to 50MB.

## Self-Annealing Notes
- If PDF generation fails, check `execution/assets/` for missing logos.
- If layout breaks, verify `.page` dimensions in `execution/templates/styles_atria.css`.
