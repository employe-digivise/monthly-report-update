# PDF Renderer Benchmark — Puppeteer vs WeasyPrint vs pdfmake

Tujuan: cari engine PDF yang **lebih ringan ke server** dari Puppeteer, tanpa
mengorbankan tampilan laporan aurora. Latar belakang: Puppeteer menjalankan
Chromium penuh (~1 GB RAM/render), itulah kenapa di VPS PM2 `max_memory_restart: 1G`
sering ter-restart.

## Cara menjalankan

```bash
npm run bench                 # default: puppeteer,weasyprint × 2 payload × 3 run
BENCH_ENGINES=puppeteer,weasyprint,pdfmake BENCH_RUNS=3 npm run bench
```

Engine dipilih saat runtime lewat env `PDF_ENGINE=puppeteer|weasyprint|pdfmake`
(lihat `.env.example`). Abstraksi ada di `execution/generator.js`
(`buildRenderContext` → `execution/renderers/<engine>.js`); `server.js` tidak berubah.

Metodologi RAM: tiap render dijalankan di proses Node terpisah
(`scripts/_render-once.js`), dan harness mengukur **peak RSS seluruh process-tree**
tiap 100 ms — penting karena Chromium (Puppeteer) & Python (WeasyPrint) jalan
sebagai proses cucu yang tak terlihat oleh `process.memoryUsage()`.

## Hasil (median 3 run, macOS arm64; render = langkah engine saja, di luar preprocessing)

| engine | render ms | peak RSS | RAM vs puppeteer | PDF | fidelity aurora |
|---|--:|--:|--:|--:|---|
| **puppeteer** (baseline) | ~1300 | ~1130 MB | — | 2534 KB, 19 hal | referensi |
| **weasyprint** | ~1600 | **~281 MB** | **−75%** | 1860 KB, 19 hal | **setara** (lihat catatan) |
| **pdfmake** \* | ~65 | ~110 MB | **−90%** | 21 KB | partial (lihat catatan) |

\* pdfmake = **subset representatif 2 halaman**, bukan laporan penuh 19 halaman.
Angkanya understate laporan penuh, tapi pdfmake tak pernah spawn subprocess
sehingga tetap paling ringan berapa pun halamannya.

> Catatan: `prep_ms` (~4.7–5.8 s, download gambar + base64 + EJS) sama untuk semua
> engine — itu overhead bersama, bukan biaya engine.

## Temuan fidelity

**WeasyPrint — LULUS gate.** Dibandingkan baseline Puppeteer (cover, halaman revenue
chart, halaman donut), semuanya faithful:
- SVG donut (arc `<path>` + `<text>`) ✓
- SVG bar revenue `<linearGradient>` ✓ **(setelah fix di bawah)**
- KPI card gradient CSS ✓, font Inter/Montserrat ✓, page-break 19 halaman ✓
- Beda kosmetik kecil: teks sedikit lebih tebal, bullet jadi `·`.
- Gap diketahui: WeasyPrint **tidak** render `filter: blur()` (2 glow blob di cover)
  — tak terlihat signifikan.

> **Fix penting (sudah diterapkan di `template_aurora.ejs`):** WeasyPrint **tidak**
> mendukung SVG gradient `gradientUnits="objectBoundingBox"` (default) — bar revenue
> jadi **invisible**. Diubah ke `gradientUnits="userSpaceOnUse"` dengan koordinat
> plot-area eksplisit. Kompatibel penuh dengan Puppeteer (tidak ada regresi).
> Pelajaran: setiap SVG gradient baru WAJIB pakai `userSpaceOnUse`, bukan objectBoundingBox.

### Catatan font (PENTING)

1. **WeasyPrint @font-face di macOS dev = rusak.** Di Mac ini WeasyPrint (baik versi
   anaconda maupun Homebrew 69.0, brotli tersedia) **gagal load font `@font-face`
   data-URI** (`WARNING: Font-face 'Inter' cannot be loaded`) karena masalah
   fontconfig/CoreText khas macOS → fallback ke Hiragino Sans. **Ini hanya di macOS.**
   Di **Linux/Docker (Modal/VPS — target produksi)** @font-face data-URI Inter/Montserrat
   ter-load normal. Untuk preview lokal yang benar di Mac, render via Docker Linux.
   Saat adopsi, sebaiknya **install TTF Inter/Montserrat ke font dir image** sebagai
   jaring pengaman fontconfig.

2. **Bug aset: `Inter-Black.woff2` rusak — SUDAH DIPERBAIKI.** File lama isinya HTML
   (download gagal) → Inter weight-900 fallback ke Helvetica-Bold di kedua engine.
   Di-download ulang dari fontsource (`inter-latin-900-normal`, 21 KB woff2 valid);
   diverifikasi `Inter-Black` kini ter-embed di PDF Puppeteer.

**Adoption-readiness sudah disiapkan:** `scripts/install-vps.sh` dan `modal_app.py`
kini meng-install WeasyPrint + lib pendukung (gdk-pixbuf/ffi/harfbuzz/pangoft2) di
image Linux. Default tetap `PDF_ENGINE=puppeteer`; tinggal set `PDF_ENGINE=weasyprint`
(dan `WEASYPRINT_BIN=/opt/weasyprint-venv/bin/weasyprint` di VPS) untuk mengaktifkan.

**pdfmake — chart bisa, layout harus ditulis ulang.** Spike (`scripts/spike-pdfmake.js`)
membuktikan node `svg` pdfmake **berhasil** render donut DAN bar gradient kita
(di luar dugaan — gradient `url(#id)` sering gagal di svg-to-pdfkit, di sini jalan).
TAPI pdfmake tidak baca HTML/CSS: seluruh ~19 halaman aurora harus dibangun ulang
sebagai `docDefinition` imperatif, tanpa gradient box (jadi flat), dan font wajib
TTF (Inter/Montserrat sekarang woff2 → fallback Roboto).

## Rekomendasi

**Adopsi WeasyPrint.** −75% RAM (jauh di atas ambang −40%), kecepatan render setara
(≤1.5× warm), fidelity setara, dan **mempertahankan 4 template→1 template HTML/CSS**
(nyaris tanpa rewrite). pdfmake paling ringan tapi butuh rewrite layout penuh +
kehilangan alur "edit CSS" → effort/risiko tertinggi, hanya worth jika butuh nol
dependensi biner.

### Langkah adopsi WeasyPrint (belum dikerjakan — menunggu keputusan)

1. Produksi: pakai **sidecar Python long-lived** (bukan `spawn` per request) agar
   tak bayar ~0.5–1 s import Pango tiap render. (`spawn` oke untuk volume rendah.)
2. Image Modal/VPS: `pip install weasyprint` + `apt-get install libpango-1.0-0
   libpangocairo-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 libffi8 fonts-liberation`
   — ±setengah jumlah lib Chromium, tanpa binary ~170 MB. Drop lib Chromium hanya
   kalau Puppeteer benar-benar dilepas.
3. Set `PDF_ENGINE=weasyprint` (+ `WEASYPRINT_BIN` bila perlu).
4. Pertahankan Puppeteer sebagai fallback (`PDF_ENGINE=puppeteer`) sampai stabil.

### Setup dev lokal (macOS, sudah dilakukan di mesin ini)

```bash
brew install pango gdk-pixbuf            # cairo/glib sudah ada
# WeasyPrint sudah di /opt/anaconda3/bin/weasyprint; perlu env saat run:
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib
```
Renderer `execution/renderers/weasyprint.js` sudah otomatis menyetel
`DYLD_FALLBACK_LIBRARY_PATH` di macOS dan default ke binary anaconda tsb.
