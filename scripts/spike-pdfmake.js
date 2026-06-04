// Phase-0 pdfmake spike.
// Goal: decide whether pdfmake can reproduce the aurora design WITHOUT a near-total
// rewrite. The two make-or-break features are (1) our generated SVG charts (donut
// uses <path> arcs + <text>; revenue uses <linearGradient> bars) and (2) CSS-style
// gradient fills. This script feeds real chart SVGs into pdfmake's `svg` node and
// also probes a gradient bar, then writes a PDF + perf numbers for inspection.
const path = require('path');
const fs = require('fs');
// pdfmake 0.3 exposes a singleton instance: addFonts() + createPdf() + .write().
const pdfmake = require('pdfmake');

const FONT_DIR = path.join(__dirname, '..', 'node_modules', 'pdfmake', 'fonts', 'Roboto');
const fonts = {
    Roboto: {
        normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
        bold: path.join(FONT_DIR, 'Roboto-Medium.ttf'),
        italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
        bolditalics: path.join(FONT_DIR, 'Roboto-MediumItalic.ttf')
    }
};

// A minimal revenue-style SVG with a <linearGradient> bar — the exact feature that
// most often breaks in svg-to-pdfkit (gradient referenced by url(#id)).
const gradientBarSvg = `<svg viewBox="0 0 300 160" width="300" height="160">
  <defs>
    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#A855F7"/>
      <stop offset="100%" stop-color="#6C2BD9"/>
    </linearGradient>
  </defs>
  <rect x="40" y="30" width="60" height="110" fill="url(#barGrad)" rx="4"/>
  <rect x="130" y="70" width="60" height="70" fill="url(#barGrad)" rx="4"/>
  <rect x="220" y="50" width="60" height="90" fill="url(#barGrad)" rx="4"/>
  <text x="70" y="155" font-size="9" text-anchor="middle" fill="#333">Jan</text>
  <text x="160" y="155" font-size="9" text-anchor="middle" fill="#333">Feb</text>
  <text x="250" y="155" font-size="9" text-anchor="middle" fill="#333">Mar</text>
</svg>`;

async function main() {
    const t0 = process.hrtime.bigint();
    const { buildRenderContext } = require(path.join(__dirname, '..', 'execution', 'generator'));
    const payload = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test_payload.json'), 'utf8'));
    const ctx = await buildRenderContext(payload);          // gives us the real donut SVG
    const donutSvg = ctx.charts.shopeeDonutSvg;
    const t1 = process.hrtime.bigint();

    pdfmake.addFonts(fonts);
    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40],
        content: [
            { text: 'pdfmake spike — aurora chart fidelity probe', bold: true, fontSize: 16, margin: [0, 0, 0, 12] },

            // pdfmake has NO gradient fill: the closest is a flat fill color.
            {
                text: 'KPI box (flat color — pdfmake cannot do CSS gradients):',
                fontSize: 9, color: '#666', margin: [0, 0, 0, 4]
            },
            {
                table: { widths: ['*'], body: [[{ text: 'Rp 725.97jt', color: 'white', bold: true, fontSize: 18, fillColor: '#6C2BD9', margin: [10, 12, 10, 12] }]] },
                layout: 'noBorders', margin: [0, 0, 0, 16]
            },

            { text: 'Real donut SVG (buildDonutChartSVG) via pdfmake svg node:', fontSize: 9, color: '#666', margin: [0, 0, 0, 4] },
            { svg: donutSvg, width: 240, margin: [0, 0, 0, 16] },

            { text: 'Gradient-bar SVG (linearGradient url(#id)) — revenue-chart risk:', fontSize: 9, color: '#666', margin: [0, 0, 0, 4] },
            { svg: gradientBarSvg, width: 300 }
        ],
        defaultStyle: { font: 'Roboto' }
    };

    const outPath = path.join(__dirname, '..', 'bench-output', 'pdfmake_spike.pdf');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await pdfmake.createPdf(docDefinition).write(outPath);
    const t2 = process.hrtime.bigint();

    const ms = (a, b) => Math.round(Number(b - a) / 1e6);
    console.log(JSON.stringify({
        spike: 'pdfmake',
        prep_ms: ms(t0, t1),
        render_ms: ms(t1, t2),
        node_rss_mb: Math.round(process.memoryUsage().rss / 1048576),
        pdf_kb: Math.round(fs.statSync(outPath).size / 1024),
        out: path.relative(path.join(__dirname, '..'), outPath)
    }, null, 2));
}

main().catch((e) => { console.error('SPIKE_ERROR:', e && e.stack ? e.stack : e); process.exit(1); });
