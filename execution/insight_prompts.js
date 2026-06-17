/**
 * Prompt templates per insight slot.
 *
 * Each spec exports:
 *   - shape: 'string' | 'array'  (output type expected by template)
 *   - extract(data): subset of payload to send to the LLM (keep tokens small)
 *   - build(ctx): { systemPrompt, userPrompt }
 *
 * Output is structured JSON ({ "result": "..." } or { "result": ["...","..."] })
 * so parsing is deterministic. The caller in insight_ai.js writes the parsed
 * result back into the canonical field path.
 */

const SHARED_SYSTEM = [
    'Kamu analis e-commerce senior yang menulis insight untuk laporan bulanan brand Indonesia.',
    'Bahasa: mix Indonesia/English natural, mayoritas Indonesia. Profesional, tajam, ringkas.',
    '',
    'ATURAN PALING PENTING — JANGAN MENDESKRIPSIKAN DATA:',
    'Dilarang sekadar menyebut ulang angka yang sudah ada di tabel/chart. Setiap kalimat WAJIB punya "nilai tambah" minimal salah satu dari: interpretasi (apa artinya), perbandingan/tren, implikasi bisnis, atau rekomendasi aksi. Angka hanya dipakai sebagai BUKTI pendukung insight, bukan sebagai isi utama.',
    '',
    'Contoh BURUK (DILARANG, ini cuma mendaftar angka):',
    '"Video Rp3jt, Live Streaming Rp6jt, Product Card Rp18jt, total Rp27jt."',
    'Contoh BAIK (insight):',
    '"Product Card mendominasi 66% revenue dan jadi mesin utama penjualan, sementara Video baru 12% — kanal video paling underutilized dan jadi peluang growth terbesar bulan depan."',
    '',
    'Aturan lain: WAJIB pakai angka aktual dari data (Rp/%/x), jangan mengarang angka di luar yang diberikan; kalau data tipis, gali insight dari yang ada (jangan memaksa). Hindari jargon kosong ("sinergi", "leverage strategis"). Output HARUS JSON valid sesuai schema — tanpa teks lain di luar JSON.',
].join('\n');

const SPECS = {
    // 1. Operational performance summary (string)
    'metrics.summary': {
        shape: 'string',
        extract: (data) => ({
            metrics: data.metrics || {},
            brandName: data.brandName,
            reportMonth: data.reportMonth,
            reportYear: data.reportYear,
        }),
        build: (ctx) => ({
            systemPrompt: SHARED_SYSTEM,
            userPrompt: [
                `Brand: ${ctx.brandName} — Periode: ${ctx.reportMonth} ${ctx.reportYear}`,
                'Buat 1 paragraf (2-3 kalimat, maks ~55 kata) yang MENILAI kesehatan operasional toko Shopee — bukan mendaftar metrik.',
                'Metrik: unfulfilled orders, late shipment, chat response rate, overall rating.',
                'Tugas: simpulkan kondisinya (sehat/berisiko) dan KENAPA, soroti metrik yang paling berpengaruh, lalu beri 1 rekomendasi konkret (pertahankan apa / perbaiki apa). Sebut angka hanya sebagai bukti.',
                '',
                'Data:',
                JSON.stringify(ctx.metrics, null, 2),
                '',
                'Format output (JSON saja, tanpa markdown):',
                '{"result": "<paragraf insight>"}',
            ].join('\n'),
        }),
    },

    // 2. Global revenue summary (string)
    'globalRevenue.summary': {
        shape: 'string',
        extract: (data) => ({
            globalRevenue: data.globalRevenue || {},
            brandName: data.brandName,
            reportMonth: data.reportMonth,
            reportYear: data.reportYear,
        }),
        build: (ctx) => ({
            systemPrompt: SHARED_SYSTEM,
            userPrompt: [
                `Brand: ${ctx.brandName} — Periode: ${ctx.reportMonth} ${ctx.reportYear}`,
                'Buat 1-2 kalimat (maks ~50 kata) yang MENGINTERPRETASI tren revenue & ads spent dari time-series, bukan sekadar menyebut total.',
                'Tugas: jelaskan arah & momentum (naik/turun, akselerasi/melambat), apakah pertumbuhan revenue sehat relatif terhadap kenaikan ads spent (efisiensi), dan apa implikasinya. Sebut % growth & angka kunci sebagai bukti. Kalau tidak ada data pembanding bulan lalu, katakan singkat dan fokus ke level/komposisi saat ini.',
                '',
                'Data revenue & ads spent (time-series):',
                JSON.stringify(ctx.globalRevenue, null, 2),
                '',
                'Format output (JSON saja):',
                '{"result": "<insight>"}',
            ].join('\n'),
        }),
    },

    // 3. Global performance detail conclusion (array of bullet points)
    'globalPerformanceDetail.aiConclusion': {
        shape: 'array',
        extract: (data) => ({
            comparisonData: data.globalPerformanceDetail?.comparisonData || [],
            enabledChannels: data.enabledChannels || {},
            brandName: data.brandName,
            reportMonth: data.reportMonth,
            reportYear: data.reportYear,
        }),
        build: (ctx) => ({
            systemPrompt: SHARED_SYSTEM,
            userPrompt: [
                `Brand: ${ctx.brandName} — Periode: ${ctx.reportMonth} ${ctx.reportYear}`,
                'Buat 3-5 bullet KESIMPULAN STRATEGIS cross-channel dari tabel — setiap bullet sebuah insight, bukan baris data.',
                'Tiap bullet (maks ~28 kata) harus mengandung makna: mis. channel mana yang menggerakkan pertumbuhan & kenapa, channel mana paling efisien (CIR/ROAS) vs paling boros, ketimpangan/risiko ketergantungan, atau peluang. Sertakan MINIMAL 1 bullet rekomendasi aksi.',
                'Skip channel yang revenue/cost-nya 0 (tidak aktif). Angka = bukti, bukan isi utama.',
                '',
                `Channel aktif: ${Object.keys(ctx.enabledChannels).filter(k => ctx.enabledChannels[k]).join(', ')}`,
                '',
                'Comparison data (Revenue, Cost Spend, CIR, ROAS — this vs last month, per channel):',
                JSON.stringify(ctx.comparisonData, null, 2),
                '',
                'Format output (JSON saja):',
                '{"result": ["<insight 1>", "<insight 2>", "<insight 3>"]}',
            ].join('\n'),
        }),
    },

    // 4. Shopee store performance notes (string)
    'storePerformance.notes': {
        shape: 'string',
        extract: (data) => ({
            storePerformance: data.storePerformance || {},
            brandName: data.brandName,
        }),
        build: (ctx) => {
            const sp = ctx.storePerformance;
            const adPct = sp.totalRevenue ? ((sp.adSalesRevenue / sp.totalRevenue) * 100).toFixed(1) : 'N/A';
            return {
                systemPrompt: SHARED_SYSTEM,
                userPrompt: [
                    `Brand: ${ctx.brandName}`,
                    'Buat 1-2 kalimat (maks ~45 kata) yang MENGINTERPRETASI komposisi revenue toko Shopee (ads sales vs organic/existing) — bukan mendeskripsikan angkanya.',
                    `Tugas: nilai apakah toko terlalu bergantung pada ads atau organic-nya kuat, apa risikonya, dan 1 implikasi/rekomendasi. Ad share ≈ ${adPct}% (ads Rp${sp.adSalesRevenue} dari total Rp${sp.totalRevenue}). Patokan kasar: ad share >60% = ketergantungan tinggi, <40% = organic kuat.`,
                    '',
                    'Format output (JSON saja):',
                    '{"result": "<insight>"}',
                ].join('\n'),
            };
        },
    },

    // 5. Shopee ads summary (string)
    'shopeeAdsSummary': {
        shape: 'string',
        extract: (data) => ({
            shopeeAdsMetrics: data.shopeeAdsMetrics || {},
            brandName: data.brandName,
            reportMonth: data.reportMonth,
        }),
        build: (ctx) => ({
            systemPrompt: SHARED_SYSTEM,
            userPrompt: [
                `Brand: ${ctx.brandName} — Bulan: ${ctx.reportMonth}`,
                'Buat 1 paragraf (2-3 kalimat, maks ~55 kata) yang MENILAI efisiensi Shopee Ads — bukan mendaftar metrik.',
                'Tugas: vonis sehat/tidaknya funnel (CTR menunjukkan relevansi materi, CPC menunjukkan efisiensi biaya, rasio penjualan vs biaya menunjukkan ROAS), sebut metrik mana yang jadi kekuatan/kelemahan, lalu 1 rekomendasi optimasi. Angka = bukti pendukung.',
                '',
                'Data:',
                JSON.stringify(ctx.shopeeAdsMetrics, null, 2),
                '',
                'Format output (JSON saja):',
                '{"result": "<summary>"}',
            ].join('\n'),
        }),
    },

    // 6. TikTok store performance summary (array of bullets)
    'tiktok_data.store_performance.summary': {
        shape: 'array',
        extract: (data) => ({
            storePerformance: data.tiktok_data?.store_performance || {},
            totalRevenue: data.tiktok_data?.total_revenue,
            brandName: data.brandName,
            reportMonth: data.reportMonth,
        }),
        build: (ctx) => ({
            systemPrompt: SHARED_SYSTEM,
            userPrompt: [
                `Brand: ${ctx.brandName} — Bulan: ${ctx.reportMonth}`,
                'Buat 3-4 bullet ANALISIS performa TikTok Shop dari komposisi revenue (Video, Live Streaming, Product Card) — setiap bullet insight, BUKAN daftar angka.',
                'Tiap bullet (maks ~25 kata) harus bermakna: kanal mana dominan/produktif & kenapa penting, kanal mana underutilized, ketimpangan komposisi, dan MINIMAL 1 bullet rekomendasi (kanal yang perlu digenjot). Pakai persentase/angka hanya sebagai bukti.',
                'DILARANG bikin bullet yang isinya cuma "<kanal>: Rp<angka>".',
                '',
                `Total revenue TikTok: Rp${ctx.totalRevenue}`,
                'Detail komposisi:',
                JSON.stringify(ctx.storePerformance, null, 2),
                '',
                'Format output (JSON saja):',
                '{"result": ["<insight 1>", "<insight 2>", "<insight 3>"]}',
            ].join('\n'),
        }),
    },
};

module.exports = { SPECS };
