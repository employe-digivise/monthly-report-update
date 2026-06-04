// pdfmake renderer — REPRESENTATIVE subset (benchmark / proof-of-concept).
//
// IMPORTANT: pdfmake does not consume HTML/CSS. A production adoption would need
// every one of the ~19 aurora pages rebuilt as an imperative docDefinition. This
// renderer intentionally builds only a representative slice (cover, KPI, donut,
// revenue bars, table, summary) so the benchmark can measure pdfmake's real
// resource profile and so the Phase-0 SVG fidelity finding is reproducible. It is
// NOT a drop-in replacement for the full report.
//
// Findings baked in from the spike:
//  - pdfmake's `svg` node renders our donut (<path> arcs + <text>) correctly.
//  - It also renders <linearGradient url(#id)> bars (the revenue-chart risk) correctly.
//  - It has NO CSS gradient fills, so gradient boxes become flat colors.
//  - Fonts must be TTF; we fall back to bundled Roboto (Inter/Montserrat are woff2).
const path = require('path');
const pdfmake = require('pdfmake');

const FONT_DIR = path.join(__dirname, '..', '..', 'node_modules', 'pdfmake', 'fonts', 'Roboto');
let fontsRegistered = false;
function ensureFonts() {
    if (fontsRegistered) return;
    pdfmake.addFonts({
        Roboto: {
            normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
            bold: path.join(FONT_DIR, 'Roboto-Medium.ttf'),
            italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
            bolditalics: path.join(FONT_DIR, 'Roboto-MediumItalic.ttf')
        }
    });
    fontsRegistered = true;
}

const COLORS = { primary: '#6C2BD9', accent: '#FF6B2C', light: '#A855F7' };
const rp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

// Build a revenue bar SVG from chartData, mirroring the aurora linearGradient bars.
function buildRevenueBarSvg(chartData) {
    const labels = (chartData && chartData.labels) || [];
    const rev = (chartData && chartData.revenueData) || [];
    const w = 480, h = 200, pad = 30;
    const max = Math.max(1, ...rev.map(Number)) * 1.2;
    const n = Math.max(labels.length, 1);
    const slot = (w - pad * 2) / n;
    const barW = Math.min(46, slot * 0.6);
    let bars = '';
    labels.forEach((label, i) => {
        const val = Number(rev[i]) || 0;
        const bh = ((h - pad * 2) * val) / max;
        const x = pad + i * slot + (slot - barW) / 2;
        const y = (h - pad) - bh;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="url(#barGrad)" rx="4"/>`;
        bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${h - pad + 14}" font-size="9" text-anchor="middle" fill="#666">${label}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${COLORS.light}"/><stop offset="100%" stop-color="${COLORS.primary}"/>
        </linearGradient></defs>${bars}</svg>`;
}

function kpiBox(label, value, fill) {
    return {
        table: { widths: ['*'], body: [[{
            stack: [
                { text: label, color: 'white', fontSize: 8, opacity: 0.85 },
                { text: value, color: 'white', bold: true, fontSize: 16 }
            ],
            fillColor: fill, margin: [12, 10, 12, 10]
        }]] },
        layout: 'noBorders'
    };
}

/**
 * @param {object} ctx        render context from buildRenderContext()
 * @param {string} outputPath where to write the PDF
 * @returns {Promise<{pdfPath: string, warnings: string[]}>}
 */
async function render(ctx, outputPath) {
    ensureFonts();
    const data = ctx.data || {};
    const sp = data.storePerformance || {};
    const gr = (data.globalRevenue && data.globalRevenue.chartData) || { labels: [], revenueData: [], adsSpentData: [] };
    const lastRev = (gr.revenueData && gr.revenueData[gr.revenueData.length - 1]) || 0;
    const lastAds = (gr.adsSpentData && gr.adsSpentData[gr.adsSpentData.length - 1]) || 0;

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40],
        content: [
            // Cover (flat color — pdfmake has no CSS gradient)
            {
                table: { widths: ['*'], heights: [220], body: [[{
                    stack: [
                        { text: 'MONTHLY PERFORMANCE REPORT', color: 'white', fontSize: 9, opacity: 0.8, alignment: 'center', margin: [0, 70, 0, 6] },
                        { text: 'MONTHLY REPORT', color: 'white', bold: true, fontSize: 30, alignment: 'center' },
                        { text: (data.brandName || ''), color: COLORS.accent, bold: true, fontSize: 16, alignment: 'center', margin: [0, 10, 0, 0] },
                        { text: `${data.reportMonth || ''} — ${data.reportYear || ''}`, color: 'white', fontSize: 10, alignment: 'center' }
                    ],
                    fillColor: COLORS.primary, margin: [0, 0, 0, 0]
                }]] },
                layout: 'noBorders', margin: [0, 0, 0, 20]
            },

            { text: 'Global Revenue', bold: true, fontSize: 16, color: '#1a1a1a', margin: [0, 0, 0, 8] },
            { columns: [kpiBox('REVENUE', rp(lastRev), COLORS.primary), { width: 12, text: '' }, kpiBox('ADS SPENT', rp(lastAds), COLORS.accent)], margin: [0, 0, 0, 12] },
            { svg: buildRevenueBarSvg(gr), width: 480, margin: [0, 0, 0, 4] },
            data.globalRevenue && data.globalRevenue.summary
                ? { text: data.globalRevenue.summary, fontSize: 9, color: '#444', margin: [0, 6, 0, 16] }
                : { text: '', margin: [0, 0, 0, 16] },

            { text: 'Store Performance', bold: true, fontSize: 16, color: '#1a1a1a', margin: [0, 8, 0, 8], pageBreak: 'before' },
            kpiBox('TOTAL REVENUE', rp(sp.totalRevenue), COLORS.primary),
            { svg: ctx.charts.shopeeDonutSvg, width: 220, alignment: 'center', margin: [0, 16, 0, 16] },
            {
                table: {
                    widths: ['*', '*'],
                    body: [
                        [{ text: 'Ad Sales', color: 'white', bold: true, fillColor: COLORS.primary, margin: [6, 6, 6, 6] }, { text: 'Existing', color: 'white', bold: true, fillColor: COLORS.light, margin: [6, 6, 6, 6] }],
                        [{ text: rp(sp.adSalesRevenue), alignment: 'center', margin: [6, 6, 6, 6] }, { text: rp(sp.existingRevenue), alignment: 'center', margin: [6, 6, 6, 6] }]
                    ]
                },
                layout: 'noBorders'
            },
            sp.notes ? { text: sp.notes, fontSize: 9, color: '#444', margin: [0, 10, 0, 0] } : { text: '' }
        ],
        defaultStyle: { font: 'Roboto' }
    };

    await pdfmake.createPdf(docDefinition).write(outputPath);
    console.log(`PDF Generated Successfully (pdfmake, representative subset): ${outputPath}`);
    return { pdfPath: outputPath, warnings: ctx.warnings || [] };
}

module.exports = { name: 'pdfmake', consumes: 'data', render };
