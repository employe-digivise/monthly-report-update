// Single-render benchmark wrapper.
// Usage: node scripts/_render-once.js <engine> <payloadPath> <outPath>
//
// Reuses the shared preprocessing (buildRenderContext) so every engine starts
// from the identical render context, then times the render-only step separately
// from preprocessing. Emits one machine-readable line: __BENCH__{...json}.
const path = require('path');
const fs = require('fs');

async function main() {
    const [, , engine, payloadPath, outPath] = process.argv;
    if (!engine || !payloadPath || !outPath) {
        console.error('Usage: _render-once.js <engine> <payloadPath> <outPath>');
        process.exit(2);
    }

    const { buildRenderContext } = require(path.join(__dirname, '..', 'execution', 'generator'));
    const renderer = require(path.join(__dirname, '..', 'execution', 'renderers', engine));
    const payload = JSON.parse(fs.readFileSync(path.resolve(payloadPath), 'utf8'));

    const ms = (a, b) => Number(b - a) / 1e6;

    const t0 = process.hrtime.bigint();
    const ctx = await buildRenderContext(payload);   // shared preprocessing (network, base64, EJS)
    const t1 = process.hrtime.bigint();
    const res = await renderer.render(ctx, path.resolve(outPath)); // engine-specific render
    const t2 = process.hrtime.bigint();

    const bytes = fs.existsSync(res.pdfPath) ? fs.statSync(res.pdfPath).size : 0;
    console.log('__BENCH__' + JSON.stringify({
        engine,
        prep_ms: Math.round(ms(t0, t1)),
        render_ms: Math.round(ms(t1, t2)),
        total_ms: Math.round(ms(t0, t2)),
        pdf_bytes: bytes,
        node_rss_mb: Math.round(process.memoryUsage().rss / 1048576),
        warnings: (res.warnings || []).length
    }));
}

main().catch((err) => {
    console.error('RENDER_ERROR:', err && err.message ? err.message : err);
    process.exit(1);
});
