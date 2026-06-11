// Native pdfmake renderer — FULL aurora report, no browser / no subprocess.
//
// Replaces the HTML→PDF pipeline (Puppeteer/WeasyPrint) with an in-process
// docDefinition that mirrors templates/template_aurora.ejs page-for-page.
// Resource profile from the benchmark: ~110 MB peak RSS (−90% vs Chromium).
//
// Architecture:
//   theme.js          shared colors/fonts/format helpers
//   sections/*.js     one module per report section; each exports
//                     build(ctx, H[, opts]) → Array<PageSpec>
//   PageSpec        = { content: [pdfmake nodes], footer: 'light'|'dark'|'cover' }
// The assembler (this file) owns section ordering, page numbering and footers —
// sections never deal with page numbers.
//
// Rendering is TWO-PASS:
//   pass 1 measures each logical page's content height via invisible marker
//   nodes + the pageBreakBefore hook;
//   pass 2 inserts a centering top spacer on content pages (the HTML template
//   uses .page{justify-content:center}) and renders footers through the
//   `footer` callback, so 'Page N' always matches the PHYSICAL page — even if
//   some oversized payload makes a section spill (HTML clips instead; we warn).
//
// Images: pdfkit only decodes JPEG/PNG. normalizeImages() converts every other
// data URI (webp/avif/gif, svg+xml — svg-to-pdfkit has no <style> support —
// and corrupt/mislabeled "png/jpeg" payloads, sniffed by magic bytes) to PNG
// via sharp before sections run. Failures degrade to '' + a warning, never a
// crashed render.
const pdfmake = require('pdfmake');
const H = require('./theme');

const sections = {
    cover: require('./sections/cover'),
    divider: require('./sections/divider'),
    operational: require('./sections/operational'),
    promotion: require('./sections/promotion'),
    globalRevenue: require('./sections/globalRevenue'),
    globalPerformance: require('./sections/globalPerformance'),
    shopeeStore: require('./sections/shopeeStore'),
    shopeeAds: require('./sections/shopeeAds'),
    topProducts: require('./sections/topProducts'),
    cpas: require('./sections/cpas'),
    tiktok: require('./sections/tiktok'),
    tokopedia: require('./sections/tokopedia'),
    actionPlan: require('./sections/actionPlan'),
};

// ---------------------------------------------------------------------------
// Image normalization
// ---------------------------------------------------------------------------
const PASSTHROUGH_MIME = /^data:image\/(png|jpe?g);/i;

// pdfkit trusts the bytes, not the MIME — sniff so a webp served with a jpeg
// content-type (or a truncated download) can never crash the measure phase.
function sniffPngJpeg(dataUri) {
    try {
        const b64 = dataUri.slice(dataUri.indexOf(',') + 1, dataUri.indexOf(',') + 33);
        const buf = Buffer.from(b64, 'base64');
        if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
        if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
        return null;
    } catch (e) {
        return null;
    }
}

async function toPng(dataUri, warnings, label) {
    let sharp;
    try {
        sharp = require('sharp');
    } catch (e) {
        warnings.push(`sharp not installed — dropped unsupported image (${label})`);
        return '';
    }
    try {
        const payload = dataUri.slice(dataUri.indexOf(',') + 1);
        const buf = Buffer.from(payload, 'base64');
        // density only affects vector input (svg); harmless for rasters
        const png = await sharp(buf, { density: 192 }).png().toBuffer();
        return 'data:image/png;base64,' + png.toString('base64');
    } catch (e) {
        warnings.push(`Image conversion failed (${label}): ${e.message}`);
        return '';
    }
}

// Magic bytes can match on a truncated/corrupt file (e.g. "/9j/AAAA..."),
// which pdfkit only discovers mid-render as an uncatchable per-image throw.
// Cheap header parse via sharp.metadata(); on failure fall through to a full
// conversion attempt (which degrades to '' + warning if the data is garbage).
async function validateOrConvert(obj, key, warnings, label) {
    let sharp;
    try {
        sharp = require('sharp');
    } catch (e) {
        return; // no sharp → keep as-is, magic sniff is the best we have
    }
    const v = obj[key];
    try {
        const buf = Buffer.from(v.slice(v.indexOf(',') + 1), 'base64');
        await sharp(buf).metadata();
    } catch (e) {
        obj[key] = await toPng(v, warnings, label);
    }
}

// Convert every image the sections consume to verified PNG/JPEG, in place.
async function normalizeImages(data, warnings) {
    const tasks = [];
    const queue = (obj, key, label) => {
        const v = obj && obj[key];
        if (typeof v !== 'string' || !v.startsWith('data:')) return;
        if (PASSTHROUGH_MIME.test(v) && sniffPngJpeg(v)) {
            tasks.push(validateOrConvert(obj, key, warnings, label));
            return;
        }
        tasks.push(toPng(v, warnings, label).then((png) => { obj[key] = png; }));
    };

    queue(data, 'logoUrl', 'logo');
    queue(data, 'adsChartUrl', 'ads chart');
    (data.topProducts || []).forEach((p, i) => queue(p, 'image', `product #${i + 1}`));
    ['operationalScreenshots', 'promotionScreenshots'].forEach((k) => {
        (data[k] || []).forEach((_, i) => queue(data[k], i, `${k}[${i}]`));
    });
    if (data.cpas_data && data.cpas_data.best_campaigns) {
        for (const type of ['nv', 'rm']) {
            const bc = data.cpas_data.best_campaigns[type];
            if (bc && Array.isArray(bc.images)) {
                bc.images.forEach((_, i) => queue(bc.images, i, `cpas ${type} image[${i}]`));
            }
        }
    }
    await Promise.all(tasks);
}

// Donut SVGs from buildRenderContext() have <text> without font-family;
// pin them to Inter so svg-to-pdfkit never falls through to a missing font.
function pinSvgFont(svg) {
    return String(svg || '').replace(/<text(?![^>]*font-family)/g, '<text font-family="Inter"');
}

// ---------------------------------------------------------------------------
// Two-pass assembly: measure → center → render with physical-page footers
// ---------------------------------------------------------------------------
function baseDocDefinition(data) {
    return {
        pageSize: 'A4',
        pageMargins: [H.PAGE.MX, H.PAGE.MT, H.PAGE.MX, H.PAGE.MB],
        defaultStyle: { font: 'Inter', fontSize: H.px(12), color: H.C.textDark },
        info: {
            title: `${data.brandName || ''} - Monthly Report`,
            creator: 'monthly-report-generator (pdfmake)',
        },
    };
}

// Deep-clone content nodes for the measuring pass. structuredClone() can't be
// used: table layout objects carry functions — share those by reference (they
// are pure), copy everything else so pass-1 mutations can't leak into pass 2.
function cloneNode(v) {
    if (Array.isArray(v)) return v.map(cloneNode);
    if (v && typeof v === 'object') {
        const o = {};
        for (const k of Object.keys(v)) o[k] = cloneNode(v[k]);
        return o;
    }
    return v;
}

function buildStacks(pages, spacers) {
    return pages.map((p, i) => ({
        stack: [
            // invisible measurement markers; the top one doubles as the
            // vertical-centering spacer in pass 2. NOTE: text must be a
            // non-empty space — LayoutBuilder filters text:'' nodes out of the
            // pageBreakBefore callback (hasRenderableContent).
            { text: ' ', fontSize: 1, id: `__pgb_${i}`, margin: [0, (spacers && spacers[i]) || 0, 0, 0] },
            ...(p.content || []),
            { text: ' ', fontSize: 1, id: `__pge_${i}` },
        ],
        pageBreak: i < pages.length - 1 ? 'after' : undefined,
    }));
}

/**
 * Render an array of PageSpecs to a PDF file. Exported for the section test
 * harness so dev renders go through the exact production pipeline.
 */
async function renderPages(pages, data, outputPath, warnings) {
    H.ensureFonts(pdfmake);
    warnings = warnings || [];

    // PASS 1 — measure: where does each logical page start/end?
    // createPdf MUTATES its docDefinition (data-URI images are swapped for
    // per-invocation '$$pdfmake$$N' virtual keys), so the measuring pass must
    // run on a deep clone — pass 2 needs the original nodes intact.
    const marks = {};
    const dd1 = Object.assign(baseDocDefinition(data), {
        content: buildStacks(cloneNode(pages), null),
        pageBreakBefore: (node) => {
            if (node.id && node.startPosition && /^__pg[be]_\d+$/.test(node.id)) {
                marks[node.id] = { page: node.startPosition.pageNumber, top: node.startPosition.top };
            }
            return false;
        },
    });
    await pdfmake.createPdf(dd1).getBuffer();

    const physStart = [];
    const spacers = [];
    pages.forEach((p, i) => {
        const b = marks[`__pgb_${i}`];
        const e = marks[`__pge_${i}`];
        physStart[i] = b ? b.page : (i + 1);
        let spacer = 0;
        if (b && e) {
            if (e.page > b.page) {
                warnings.push(`Logical page ${i + 1} overflowed onto ${e.page - b.page} extra page(s) — input larger than the layout budget`);
            } else if ((p.footer || 'light') === 'light') {
                // .page{justify-content:center}: split the free space below the
                // content in half (small guard so rounding can never spill)
                spacer = Math.max(0, (H.PAGE.H - H.PAGE.MB - e.top) / 2 - 2);
            }
        }
        spacers[i] = spacer;
    });

    // PASS 2 — real render: centered content + physical-page footers
    const dd2 = Object.assign(baseDocDefinition(data), {
        content: buildStacks(pages, spacers),
        footer: (currentPage) => {
            let idx = 0;
            for (let i = 0; i < physStart.length; i++) {
                if (physStart[i] <= currentPage) idx = i; else break;
            }
            const style = (pages[idx] && pages[idx].footer) || 'light';
            return H.footerNode(style, currentPage, data, 'footer');
        },
    });
    await pdfmake.createPdf(dd2).write(outputPath);
    return pages.length;
}

/**
 * @param {object} ctx        render context from buildRenderContext()
 * @param {string} outputPath where to write the PDF
 * @returns {Promise<{pdfPath: string, warnings: string[]}>}
 */
async function render(ctx, outputPath) {
    const data = ctx.data || {};
    const warnings = ctx.warnings || [];
    await normalizeImages(data, warnings);
    const charts = {
        shopeeDonutSvg: pinSvgFont(ctx.charts && ctx.charts.shopeeDonutSvg),
        tiktokDonutSvg: pinSvgFont(ctx.charts && ctx.charts.tiktokDonutSvg),
    };
    const sctx = { data, charts, warnings };

    // Page order — must match template_aurora.ejs exactly (incl. conditionals)
    const pages = [];
    const push = (specs) => { (specs || []).forEach((s) => { if (s) pages.push(s); }); };

    push(sections.cover.build(sctx, H));
    push(sections.divider.build(sctx, H, { number: '01', title: ['Performance', 'Overview'] }));
    push(sections.operational.build(sctx, H));
    push(sections.promotion.build(sctx, H));
    push(sections.divider.build(sctx, H, { number: '02', title: ['Global', 'Performance'] }));
    push(sections.globalRevenue.build(sctx, H));
    push(sections.globalPerformance.build(sctx, H));

    const ec = data.enabledChannels || {};
    if (ec.shopee) {
        push(sections.divider.build(sctx, H, { number: '03', title: ['Shopee', 'Performance'] }));
        push(sections.shopeeStore.build(sctx, H));
        push(sections.shopeeAds.build(sctx, H));
        push(sections.topProducts.build(sctx, H));
    }
    if (ec.cpas && data.cpas_data) {
        push(sections.divider.build(sctx, H, { number: '04', title: ['CPAS', 'Performance'] }));
        push(sections.cpas.build(sctx, H));
    }
    if (ec.tiktok && data.tiktok_data) {
        push(sections.divider.build(sctx, H, { number: '05', title: ['TikTok', 'Performance'] }));
        push(sections.tiktok.build(sctx, H));
    }
    if (ec.tokopedia && data.tokopedia_data) {
        push(sections.divider.build(sctx, H, { number: '06', title: ['Tokopedia', 'Performance'] }));
        push(sections.tokopedia.build(sctx, H));
    }
    push(sections.actionPlan.build(sctx, H));

    const n = await renderPages(pages, data, outputPath, warnings);
    console.log(`PDF Generated Successfully (pdfmake, ${n} pages): ${outputPath}`);
    return { pdfPath: outputPath, warnings };
}

module.exports = { name: 'pdfmake', consumes: 'data', render, renderPages, normalizeImages, pinSvgFont };
