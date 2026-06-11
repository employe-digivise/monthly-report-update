#!/usr/bin/env node
// Render ONE section in isolation for development/self-testing.
//
//   node execution/renderers/pdfmake/_section_test.js <section> [payloadPath]
//
// <section> = file name in sections/ without .js (e.g. operational, cpas).
// divider gets demo opts. Writes /tmp/pdfmake_section_<name>.pdf, exits non-0
// on any error. Uses the real buildRenderContext() so ctx.data matches prod.
process.env.INSIGHT_AI_DISABLED = '1';
process.env.PDF_ENGINE = 'pdfmake';

const path = require('path');
const H = require('./theme');
const { renderPages, normalizeImages, pinSvgFont } = require('./index');

async function main() {
    const name = process.argv[2];
    if (!name) { console.error('usage: _section_test.js <section> [payloadPath]'); process.exit(2); }
    const payloadPath = process.argv[3] || path.join(__dirname, '..', '..', 'sample_data.json');

    const { buildRenderContext } = require('../../generator');
    const data = JSON.parse(require('fs').readFileSync(payloadPath, 'utf8'));
    const ctx = await buildRenderContext(data);

    // same image pipeline as production render()
    await normalizeImages(ctx.data, ctx.warnings || []);

    const section = require('./sections/' + name);
    const sctx = {
        data: ctx.data,
        charts: {
            shopeeDonutSvg: pinSvgFont(ctx.charts && ctx.charts.shopeeDonutSvg),
            tiktokDonutSvg: pinSvgFont(ctx.charts && ctx.charts.tiktokDonutSvg),
        },
        warnings: ctx.warnings || [],
    };

    const opts = name === 'divider' ? { number: '03', title: ['Shopee', 'Performance'] } : undefined;
    const pages = section.build(sctx, H, opts) || [];
    if (!pages.length) { console.error('section returned no pages'); process.exit(1); }

    const out = `/tmp/pdfmake_section_${name}.pdf`;
    await renderPages(pages, ctx.data, out, sctx.warnings);
    console.log(`OK ${pages.length} page(s) -> ${out}`);
}

main().catch((e) => { console.error('SECTION TEST FAILED:', e); process.exit(1); });
