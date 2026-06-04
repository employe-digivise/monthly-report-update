// Benchmark PDF renderers fairly across engines.
//
// For each (engine, payload, run) it spawns scripts/_render-once.js in its own
// Node process and samples the peak RSS of the WHOLE process subtree every 100ms.
// This is the key to fairness: puppeteer's Chromium and weasyprint's Python run
// as grandchild processes whose memory is invisible to process.memoryUsage();
// only a process-tree sampler captures it. pdfmake runs in-process and is captured
// by the same sampler. Render time is measured inside the child, separate from
// the shared preprocessing step.
//
// Env knobs:
//   BENCH_ENGINES   default "puppeteer,weasyprint"
//   BENCH_PAYLOADS  default "test_payload.json,goods_a_footwear_payload.json"
//   BENCH_RUNS      default 3
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const ENGINES = (process.env.BENCH_ENGINES || 'puppeteer,weasyprint').split(',').map((s) => s.trim()).filter(Boolean);
const PAYLOADS = (process.env.BENCH_PAYLOADS || 'test_payload.json,goods_a_footwear_payload.json').split(',').map((s) => s.trim()).filter(Boolean);
const RUNS = parseInt(process.env.BENCH_RUNS, 10) || 3;
const OUTDIR = path.join(ROOT, 'bench-output');

// Sample peak RSS (MB) of the process subtree rooted at rootPid.
function makeTreeSampler(rootPid, intervalMs = 100) {
    let peakKb = 0;
    const tick = () => {
        let out;
        try { out = execSync('ps -axo pid=,ppid=,rss=', { encoding: 'utf8' }); } catch (_) { return; }
        const kids = {}, rss = {};
        for (const line of out.split('\n')) {
            const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/);
            if (!m) continue;
            const pid = +m[1], ppid = +m[2], r = +m[3];
            rss[pid] = r;
            (kids[ppid] || (kids[ppid] = [])).push(pid);
        }
        let sum = 0; const stack = [rootPid]; const seen = new Set();
        while (stack.length) {
            const p = stack.pop();
            if (seen.has(p)) continue;
            seen.add(p);
            if (rss[p] != null) sum += rss[p];
            (kids[p] || []).forEach((c) => stack.push(c));
        }
        if (sum > peakKb) peakKb = sum;
    };
    const timer = setInterval(tick, intervalMs);
    tick();
    return { stop: () => { clearInterval(timer); return Math.round(peakKb / 1024); } };
}

function runOnce(engine, payload, outPath) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(__dirname, '_render-once.js'), engine, payload, outPath], {
            cwd: ROOT, env: process.env
        });
        const sampler = makeTreeSampler(child.pid);
        let stdout = '', stderr = '';
        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
            const peakMb = sampler.stop();
            let metrics = null;
            const line = stdout.split('\n').find((l) => l.startsWith('__BENCH__'));
            if (line) { try { metrics = JSON.parse(line.slice('__BENCH__'.length)); } catch (_) {} }
            resolve({ engine, payload, code, peakMb, metrics, err: code !== 0 ? (stderr.trim().split('\n').pop() || 'exit ' + code) : null });
        });
    });
}

const median = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

async function main() {
    fs.mkdirSync(OUTDIR, { recursive: true });
    console.log(`Benchmark: engines=[${ENGINES}] payloads=[${PAYLOADS}] runs=${RUNS}\n`);
    const results = [];

    for (const payload of PAYLOADS) {
        const payloadName = path.basename(payload, '.json');
        const dir = path.join(OUTDIR, payloadName);
        fs.mkdirSync(dir, { recursive: true });
        for (const engine of ENGINES) {
            const runMetrics = [];
            let lastErr = null;
            for (let i = 0; i < RUNS; i++) {
                const outPath = path.join(dir, `${engine}.pdf`); // keep last successful PDF for visual diff
                process.stdout.write(`  ${payloadName} / ${engine} run ${i + 1}/${RUNS} ... `);
                const r = await runOnce(engine, payload, outPath);
                if (r.code === 0 && r.metrics) {
                    runMetrics.push({ ...r.metrics, peakMb: r.peakMb });
                    console.log(`render ${r.metrics.render_ms}ms, peakRSS ${r.peakMb}MB`);
                } else {
                    lastErr = r.err;
                    console.log(`FAILED (${r.err})`);
                }
            }
            const agg = {
                engine, payload: payloadName, ok: runMetrics.length,
                render_ms: median(runMetrics.map((m) => m.render_ms)),
                prep_ms: median(runMetrics.map((m) => m.prep_ms)),
                peak_rss_mb: median(runMetrics.map((m) => m.peakMb)),
                node_rss_mb: median(runMetrics.map((m) => m.node_rss_mb)),
                pdf_kb: runMetrics.length ? Math.round(runMetrics[runMetrics.length - 1].pdf_bytes / 1024) : null,
                error: runMetrics.length ? null : lastErr
            };
            results.push(agg);
        }
    }

    // Comparison table (baseline = puppeteer per payload)
    console.log('\n## Renderer comparison (median of ' + RUNS + ' runs)\n');
    console.log('| payload | engine | render ms | prep ms | peak RSS (MB) | RAM vs puppeteer | PDF KB |');
    console.log('|---|---|--:|--:|--:|--:|--:|');
    for (const payload of PAYLOADS) {
        const pn = path.basename(payload, '.json');
        const base = results.find((r) => r.payload === pn && r.engine === 'puppeteer' && r.ok);
        for (const engine of ENGINES) {
            const r = results.find((x) => x.payload === pn && x.engine === engine);
            if (!r) continue;
            if (!r.ok) { console.log(`| ${pn} | ${engine} | — | — | — | — | FAILED: ${r.error} |`); continue; }
            let ramCmp = '—';
            if (base && r.engine !== 'puppeteer') {
                const pct = Math.round((1 - r.peak_rss_mb / base.peak_rss_mb) * 100);
                ramCmp = (pct >= 0 ? '-' : '+') + Math.abs(pct) + '%';
            } else if (r.engine === 'puppeteer') {
                ramCmp = 'baseline';
            }
            console.log(`| ${pn} | ${engine} | ${r.render_ms} | ${r.prep_ms} | ${r.peak_rss_mb} | ${ramCmp} | ${r.pdf_kb} |`);
        }
    }

    fs.writeFileSync(path.join(OUTDIR, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`\nPDFs saved under ${path.relative(ROOT, OUTDIR)}/<payload>/<engine>.pdf`);
    console.log(`Raw results: ${path.relative(ROOT, path.join(OUTDIR, 'results.json'))}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
