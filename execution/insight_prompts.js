/**
 * Prompt templates per insight slot.
 *
 * Each spec exports:
 *   - shape: 'string' | 'array'  (output type expected by template)
 *   - extract(data): subset of payload to send to Claude (keep tokens small)
 *   - build(ctx): { systemPrompt, userPrompt }
 *
 * Output is structured JSON ({ "result": "..." } or { "result": ["...","..."] })
 * so parsing is deterministic. The caller in insight_ai.js writes the parsed
 * result back into the canonical field path.
 */

const SHARED_SYSTEM = [
    'Kamu adalah analis e-commerce senior untuk laporan bulanan brand Indonesia.',
    'Tulis insight ringkas, data-driven, profesional. Bahasa boleh mix Indonesia/English natural — sebagian besar Indonesia.',
    'WAJIB sebut angka aktual dari data (Rp, %, x, jumlah). Jangan mengarang angka di luar yang diberikan.',
    'Jangan pakai jargon kosong ("sinergi", "leverage strategis"). Langsung ke insight yang actionable.',
    'Output harus JSON valid sesuai schema yang diminta — tidak boleh ada teks lain di luar JSON.',
].join(' ');

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
                'Buat 1 paragraf summary (2-3 kalimat, max ~50 kata) tentang performa operasional toko Shopee.',
                'Fokus: unfulfilled orders, late shipment, chat response rate, overall rating.',
                'Kalau metric bagus → puji + rekomendasi pertahankan. Kalau jelek → flag + saran perbaikan.',
                '',
                'Data:',
                JSON.stringify(ctx.metrics, null, 2),
                '',
                'Format output (JSON saja, tanpa markdown):',
                '{"result": "<paragraf summary>"}',
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
                'Buat 1-2 kalimat insight (max ~45 kata) tentang tren revenue & ads spent bulan ini vs bulan lalu.',
                'Sebut % growth, total revenue bulan ini, dan kalau ada pola menarik dari time-series chart.',
                '',
                'Data revenue & ads spent (12 bulan terakhir + bulan ini):',
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
                'Buat 3-5 bullet conclusion tentang performa global cross-channel berdasarkan tabel di bawah.',
                'Tiap bullet: 1 kalimat ringkas (max ~30 kata), wajib sebut angka spesifik.',
                'Cover hal-hal seperti: channel dominan, growth revenue, efisiensi ads (CIR/ROAS), perbandingan antar channel.',
                'Skip channel yang revenue/cost-nya 0 (tidak aktif).',
                '',
                `Channel aktif: ${Object.keys(ctx.enabledChannels).filter(k => ctx.enabledChannels[k]).join(', ')}`,
                '',
                'Comparison data (Revenue, Cost Spend, CIR, ROAS — this vs last month, breakdown per channel):',
                JSON.stringify(ctx.comparisonData, null, 2),
                '',
                'Format output (JSON saja):',
                '{"result": ["<bullet 1>", "<bullet 2>", "<bullet 3>"]}',
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
            const adPct = sp.totalRevenue ? ((sp.adSales / sp.totalRevenue) * 100).toFixed(1) : 'N/A';
            return {
                systemPrompt: SHARED_SYSTEM,
                userPrompt: [
                    `Brand: ${ctx.brandName}`,
                    'Buat 1-2 kalimat (max ~40 kata) tentang komposisi revenue toko Shopee: berapa dari ads sales vs existing/organic sales.',
                    'Beri interpretasi singkat (bukan deskriptif): apakah toko terlalu bergantung pada ads, atau organic-nya kuat, dst.',
                    '',
                    `Data: ad sales = Rp${sp.adSales}, existing sales = Rp${sp.existingSales}, total revenue = Rp${sp.totalRevenue}, ad share ≈ ${adPct}%.`,
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
                'Buat 1 paragraf summary (2-3 kalimat, max ~55 kata) tentang performa Shopee Ads bulan ini.',
                'Sebut angka aktual: dilihat, klik, CTR, CPC, penjualan, biaya. Beri penilaian kualitatif (CTR sehat? CPC efisien?).',
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
                'Buat 3-4 bullet insight tentang performa TikTok Shop, breakdown per channel (Video, Live Streaming, Product Card).',
                'Tiap bullet 1 kalimat ringkas (max ~30 kata) dengan angka spesifik.',
                '',
                `Total revenue TikTok: Rp${ctx.totalRevenue}`,
                'Detail store performance:',
                JSON.stringify(ctx.storePerformance, null, 2),
                '',
                'Format output (JSON saja):',
                '{"result": ["<bullet 1>", "<bullet 2>", "<bullet 3>"]}',
            ].join('\n'),
        }),
    },
};

module.exports = { SPECS };
