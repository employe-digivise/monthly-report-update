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

3. **Bug font Montserrat — SUDAH DIPERBAIKI.** `Montserrat-SemiBold/Bold/Black.woff2`
   ternyata subset rusak (semua tepat 21288 byte) yang **gagal di-load WeasyPrint** (silent,
   tanpa warning) → weight 600/700/900 Montserrat fallback ke Noto, termasuk judul cover
   "MONTHLY REPORT" (Montserrat Black). Diganti dengan file fontsource bersih. Diverifikasi
   di Modal (Linux): semua 8 weight Inter+Montserrat ter-embed; judul cover kini Montserrat
   Black asli. (Noto tetap muncul sebagai jaring pengaman per-glyph untuk simbol langka — normal.)

**STATUS (terbaru): pdfmake kini DEFAULT — laporan aurora PENUH dibangun native.**
Rewrite layout yang dulu jadi blocker pdfmake **sudah dikerjakan**:
`execution/renderers/pdfmake/` membangun seluruh laporan (16-22 halaman, semua
section + conditional channel) sebagai docDefinition imperatif yang me-mirror
`template_aurora.ejs`/`styles_aurora.css`, diverifikasi visual halaman-per-halaman
vs baseline Puppeteer. Font TTF Inter/Montserrat dibundel di
`execution/assets/fonts/ttf/` (pdfkit tidak bisa baca woff2). `modal_app.py` set
`PDF_ENGINE=pdfmake`; image Modal tanpa lib Chromium & tanpa WeasyPrint.

Hasil laporan PENUH (bukan subset, median 3 run, macOS arm64):

| payload | render ms | peak RSS | RAM vs puppeteer |
|---|--:|--:|--:|
| test_payload (16 hal) | ~320 | ~209 MB | **−82%** |
| goods_a_footwear (16 hal) | ~363 | ~196 MB | **−82%** |

Render 2-pass (pass pengukuran untuk vertical centering + nomor halaman fisik)
sudah termasuk di angka di atas. Gambar payload non-PNG/JPEG (webp/avif/svg,
termasuk yang korup/mislabeled) dinormalisasi ke PNG via sharp sebelum render.

Catatan implementasi penting (pelajaran untuk pengembangan section berikutnya):
- **rowSpan pdfmake bocor garis**: hLine tetap digambar menembus filler cell
  rowSpan (border flags filler diabaikan) dan fill span tersegmentasi per baris.
  Solusi di cpas/tiktok/tokopedia: header 2-baris diratakan jadi 1 baris dengan
  cell ber-stack (PERIODE di atas dua tanggal), kolom objective pakai sel riil
  per baris (fill sama, label di baris tengah, `border:[false×4]`).
- **`widths` tabel = lebar KONTEN**: padding + garis grid ditambahkan di atasnya.
  Kolom yang dijumlahkan ke `H.PAGE.CW` akan meluber ~50-90pt; kurangi
  `(nKolom+1)×0.75` + padding per kolom dulu.
- **Vertical centering** (`.page{justify-content:center}` di HTML) ditangani
  global oleh assembler (pass 1 ukur tinggi konten via marker + pageBreakBefore;
  marker WAJIB `text:' '` — node `text:''` difilter pdfmake). Section tidak
  boleh menambah spacer sendiri.
- `createPdf()` MEMUTASI docDefinition (image data-URI → kunci `$$pdfmake$$N`)
  → pass pengukuran harus pakai deep-clone.

**Fallback**: `PDF_ENGINE=puppeteer` (butuh `npm install` dengan devDependencies —
puppeteer bukan dependency production lagi) atau `PDF_ENGINE=weasyprint` (butuh
binary weasyprint; `WEASYPRINT_BIN` bila perlu). Keduanya tetap berfungsi via
jalur HTML/EJS yang dipertahankan.

## Rekomendasi (riwayat)

Rekomendasi sebelumnya — adopsi WeasyPrint (−75% RAM, tanpa rewrite) — sudah
digantikan oleh keputusan rewrite penuh ke pdfmake (−82% RAM, nol dependensi
biner browser, render <0.5 s). Trade-off yang diterima: kehilangan alur
"edit CSS" (perubahan layout kini di modul section JS), tanpa rounded corner
pada tabel, header tabel flat (bukan gradient), tanpa blur/shadow.

### Setup dev lokal (macOS, sudah dilakukan di mesin ini)

```bash
brew install pango gdk-pixbuf            # cairo/glib sudah ada
# WeasyPrint sudah di /opt/anaconda3/bin/weasyprint; perlu env saat run:
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib
```
Renderer `execution/renderers/weasyprint.js` sudah otomatis menyetel
`DYLD_FALLBACK_LIBRARY_PATH` di macOS dan default ke binary anaconda tsb.
