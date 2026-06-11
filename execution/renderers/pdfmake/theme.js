// Shared theme + helpers for the native pdfmake renderer.
//
// Mirrors templates/styles_aurora.css. All sizes here are in PDF points;
// convert CSS px values with px() (1 CSS px = 0.75 pt @96dpi) and mm with mm().
// pdfmake has no HTML/CSS: gradients, rounded boxes and decorative shapes are
// drawn as inline SVG (svg-to-pdfkit DOES support linear/radial gradients —
// always with gradientUnits="userSpaceOnUse"); tables use layout objects.
const path = require('path');

// ---------------------------------------------------------------------------
// Page geometry (A4)
// ---------------------------------------------------------------------------
const PAGE = {
    W: 595.28,
    H: 841.89,
    MX: 68,          // 24mm side padding, same as .content pages
    MT: 36,          // top margin (content-header has its own breathing room)
    MB: 64,          // bottom margin — keeps flow content off the footer zone
};
PAGE.CW = PAGE.W - PAGE.MX * 2;          // usable content width (~459pt)
PAGE.CH = PAGE.H - PAGE.MT - PAGE.MB;    // usable content height (~742pt)

const px = (n) => n * 0.75;
const mm = (n) => n * 2.83465;

// ---------------------------------------------------------------------------
// Colors — from styles_aurora.css :root
// ---------------------------------------------------------------------------
const C = {
    primary: '#6C2BD9',
    primaryDeep: '#4A1B96',
    primaryLight: '#EDE5FB',
    primaryPale: '#F5F0FF',
    accent: '#FF6B2C',
    accentLight: '#FFF0E8',
    tertiary: '#A855F7',
    textDark: '#1E1B3A',
    textBody: '#3D3856',
    textMuted: '#8C86A5',
    bgPage: '#FAFAFE',
    bgLight: '#F5F0FF',
    border: '#E2DAF2',
    tableLine: '#B7A4DA',
    green: '#16A34A',
    red: '#DC2626',
    white: '#FFFFFF',
    // gradient stop sets
    coverGrad: ['#6C2BD9', '#3D1196', '#2A0A6E', '#1A0545'],   // 160deg 0/40/70/100%
    dividerLeftGrad: ['#2A0A6E', '#1A0545'],                   // 180deg
    dividerRightGrad: ['#FF6B2C', '#FF8F5C', '#FFB088'],       // 160deg 0/50/100%
    accentGrad: ['#FF6B2C', '#FF8F5C'],                        // 135deg
    purpleGrad: ['#6C2BD9', '#4A1B96'],                        // 135deg
    barGrad: ['#A855F7', '#6C2BD9'],                           // chart bars, top→bottom
    lineGrad: ['#6C2BD9', '#FF6B2C'],                          // --gradient-bar 90deg
};

// ---------------------------------------------------------------------------
// Fonts — TTF files (pdfkit cannot read our woff2 set).
// CSS weight map: 400→<Family>, 600→<Family>SemiBold, 700→<Family> bold:true,
// 800/900→<Family>Black. 'Roboto' is aliased to Inter as a safety net for any
// SVG <text> without an explicit font-family.
// ---------------------------------------------------------------------------
const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts', 'ttf');
const f = (file) => path.join(FONT_DIR, file);
const FONTS = {
    Inter: { normal: f('Inter-Regular.ttf'), bold: f('Inter-Bold.ttf'), italics: f('Inter-Regular.ttf'), bolditalics: f('Inter-Bold.ttf') },
    InterSemiBold: { normal: f('Inter-SemiBold.ttf'), bold: f('Inter-Bold.ttf'), italics: f('Inter-SemiBold.ttf'), bolditalics: f('Inter-Bold.ttf') },
    InterBlack: { normal: f('Inter-Black.ttf'), bold: f('Inter-Black.ttf'), italics: f('Inter-Black.ttf'), bolditalics: f('Inter-Black.ttf') },
    Montserrat: { normal: f('Montserrat-Regular.ttf'), bold: f('Montserrat-Bold.ttf'), italics: f('Montserrat-Regular.ttf'), bolditalics: f('Montserrat-Bold.ttf') },
    MontserratSemiBold: { normal: f('Montserrat-SemiBold.ttf'), bold: f('Montserrat-Bold.ttf'), italics: f('Montserrat-SemiBold.ttf'), bolditalics: f('Montserrat-Bold.ttf') },
    MontserratBlack: { normal: f('Montserrat-Black.ttf'), bold: f('Montserrat-Black.ttf'), italics: f('Montserrat-Black.ttf'), bolditalics: f('Montserrat-Black.ttf') },
    Roboto: { normal: f('Inter-Regular.ttf'), bold: f('Inter-Bold.ttf'), italics: f('Inter-Regular.ttf'), bolditalics: f('Inter-Bold.ttf') },
};

let fontsRegistered = false;
function ensureFonts(pdfmake) {
    if (fontsRegistered) return;
    pdfmake.addFonts(FONTS);
    fontsRegistered = true;
}

// ---------------------------------------------------------------------------
// Text / number formatting — EXACT ports of the EJS template helpers
// ---------------------------------------------------------------------------
const idN = (v) => Number(v || 0).toLocaleString('id-ID');

// template _fmtRp (KPI boxes): "Rp 1.23M" / "Rp 4.56jt" / "Rp 789rb"
function fmtRpShort(v) {
    v = Number(v) || 0;
    if (v >= 1000000000) return 'Rp ' + (v / 1000000000).toFixed(2) + 'M';
    if (v >= 1000000) return 'Rp ' + (v / 1000000).toFixed(2) + 'jt';
    if (v >= 1000) return 'Rp ' + (v / 1000).toFixed(0) + 'rb';
    return 'Rp ' + v;
}
// template formatCurrency (chart Y axis): "Rp1.2M" / "Rp45jt" / "Rp1.000"
function fmtAxis(v) {
    v = Number(v) || 0;
    if (v >= 1000000000) return 'Rp' + (v / 1000000000).toFixed(1) + 'M';
    if (v >= 1000000) return 'Rp' + (v / 1000000).toFixed(0) + 'jt';
    return 'Rp' + v.toLocaleString('id-ID');
}
// template formatFullCurrency (chart value labels): "Rp1.234.567"
const fmtFull = (v) => 'Rp' + (Number(v) || 0).toLocaleString('id-ID');

// Bullet-point splitter used by every summary box in the template
function splitPoints(text) {
    return String(text || '').split(/(?:^|\s)(?:\d+[\.\)]\s*|- )/).map((s) => s.trim()).filter(Boolean);
}
// CPAS summary uses a looser variant (also splits on newlines / "- ")
function splitPointsLoose(text) {
    return String(text || '').split(/(?:^|\s)(?:\d+[\.\)]\s*|-\s+|\n+)/).map((s) => s.trim()).filter(Boolean);
}

// XML-escape for text injected into SVG strings
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// SVG fragment helpers
// ---------------------------------------------------------------------------
let gradSeq = 0;
const gid = (p) => `${p}${++gradSeq}`;

// linearGradient def with userSpaceOnUse coords (objectBoundingBox is banned
// project-wide — see RENDERER_BENCHMARK.md)
function linGrad(id, stops, x1, y1, x2, y2) {
    const stopEls = stops.map((s, i) => {
        const off = stops.length === 1 ? 0 : (i / (stops.length - 1)) * 100;
        return `<stop offset="${off}%" stop-color="${s}"/>`;
    }).join('');
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stopEls}</linearGradient>`;
}

// Full-page node from an SVG string sized PAGE.W × PAGE.H
function fullPageSvg(svgString) {
    return { svg: svgString, width: PAGE.W, height: PAGE.H, absolutePosition: { x: 0, y: 0 } };
}

// Dashed placeholder box ("[Screenshot 1 Placeholder]" etc.)
function placeholder(label, w, h) {
    const svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
        + `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="7.5" fill="${C.primaryPale}" stroke="${C.border}" stroke-width="1.5" stroke-dasharray="4 3"/>`
        + `<text x="${w / 2}" y="${h / 2 + 2.5}" text-anchor="middle" font-family="Inter" font-size="${px(10)}" fill="${C.textMuted}">${esc(label)}</text>`
        + `</svg>`;
    return { svg, width: w };
}

// Gradient "revenue accent" box (rounded, centered label+value). Mirrors
// .revenue-accent-box / the orange Ads Spent twin. Returns {node, w, h}.
function gradBox(label, value, stops, opts = {}) {
    const w = opts.w || 180;
    const valSize = opts.valSize != null ? opts.valSize : px(26);
    const labSize = px(10);
    const padY = px(18);
    const h = opts.h || Math.round(padY * 2 + labSize * 1.3 + px(4) + valSize * 1.15);
    const id = gid('gb');
    const labY = padY + labSize;
    const valY = labY + px(4) + valSize;
    const svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
        + `<defs>${linGrad(id, stops, 0, 0, w, h)}</defs>`
        + `<rect width="${w}" height="${h}" rx="10.5" fill="url(#${id})"/>`
        + `<text x="${w / 2}" y="${labY}" text-anchor="middle" font-family="InterSemiBold" font-size="${labSize}" fill="#FFFFFF" fill-opacity="0.7" letter-spacing="1.1">${esc(String(label).toUpperCase())}</text>`
        + `<text x="${w / 2}" y="${valY}" text-anchor="middle" font-family="MontserratBlack" font-size="${valSize}" fill="#FFFFFF">${esc(value)}</text>`
        + `</svg>`;
    return { svg, width: w };
}

// ---------------------------------------------------------------------------
// Content-page building blocks
// ---------------------------------------------------------------------------

// .content-header — Montserrat 800 22px + 48×3px orange gradient underline
function contentHeader(title) {
    const id = gid('hg');
    return {
        stack: [
            { text: title, font: 'Montserrat', bold: true, fontSize: px(22), color: C.textDark },
            {
                svg: `<svg width="36" height="2.25" viewBox="0 0 36 2.25"><defs>${linGrad(id, C.accentGrad, 0, 0, 36, 0)}</defs><rect width="36" height="2.25" rx="1.1" fill="url(#${id})"/></svg>`,
                margin: [0, px(10), 0, 0],
            },
        ],
        margin: [0, px(14), 0, px(16)],
    };
}

// .summary-box — pale bg, purple left bar, uppercase title, bullets if the
// text splits into >1 points (same behavior as the template).
function summaryBox(title, textOrPoints, opts = {}) {
    const split = opts.loose ? splitPointsLoose : splitPoints;
    const points = Array.isArray(textOrPoints)
        ? textOrPoints.map((s) => String(s)).filter(Boolean)
        : split(textOrPoints);
    let body;
    if (points.length > 1) {
        body = {
            ul: points.map((p) => ({ text: p, fontSize: px(10), color: C.textBody, lineHeight: 1.35 })),
            markerColor: C.textBody,
        };
    } else {
        const t = points[0] != null ? points[0] : String(textOrPoints || '');
        body = { text: t, fontSize: px(11), color: C.textBody, lineHeight: 1.4 };
    }
    return {
        table: {
            widths: ['*'],
            body: [[{
                stack: [
                    { text: String(title).toUpperCase(), fontSize: px(10), bold: true, color: C.primary, characterSpacing: 0.4, margin: [0, 0, 0, px(6)] },
                    body,
                ],
                fillColor: C.primaryPale,
                margin: [px(14), px(12), px(14), px(12)],
            }]],
        },
        layout: {
            hLineWidth: () => 0,
            vLineWidth: (i) => (i === 0 ? 3 : 0),
            vLineColor: () => C.primary,
            paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
    };
}

// Standard table layout: #B7A4DA grid + zebra body rows (pale), matching the
// "TABLE GRID LINES" CSS block. Header cells must set their own fillColor.
function gridLayout(opts = {}) {
    const headerRows = opts.headerRows != null ? opts.headerRows : 1;
    const zebra = opts.zebra !== false;
    const padX = opts.padX != null ? opts.padX : 8;   // CSS px
    const padY = opts.padY != null ? opts.padY : 10;  // CSS px
    return {
        hLineWidth: () => 0.75,
        vLineWidth: () => 0.75,
        hLineColor: () => C.tableLine,
        vLineColor: () => C.tableLine,
        fillColor: (rowIndex) => {
            if (rowIndex < headerRows || !zebra) return null;
            return ((rowIndex - headerRows) % 2 === 1) ? C.primaryPale : null;
        },
        paddingLeft: () => px(padX), paddingRight: () => px(padX),
        paddingTop: () => px(padY), paddingBottom: () => px(padY),
    };
}

// Header / body cell shorthands. NOTE: CSS table headers are uppercase — pass
// already-uppercased text or use thU().
function th(text, opts = {}) {
    return Object.assign({ text, fillColor: C.primary, color: C.white, bold: true, fontSize: px(9), alignment: 'center', characterSpacing: 0.3 }, opts);
}
const thU = (text, opts = {}) => th(String(text).toUpperCase(), opts);
function td(text, opts = {}) {
    return Object.assign({ text: text == null || text === '' ? '-' : text, fontSize: px(10), color: C.textBody, alignment: 'center' }, opts);
}

// pdfmake image/svg node from a base64 data URI ('' → null). Anything that is
// not png/jpeg/svg must have been normalized upstream (index.js, via sharp).
function imageNode(src, opts = {}) {
    if (!src || typeof src !== 'string' || !src.startsWith('data:')) return null;
    if (/^data:image\/svg\+xml/i.test(src)) {
        try {
            const payload = src.slice(src.indexOf(',') + 1);
            const xml = /;base64/i.test(src.slice(0, src.indexOf(',')))
                ? Buffer.from(payload, 'base64').toString('utf8')
                : decodeURIComponent(payload);
            return Object.assign({ svg: xml }, opts);
        } catch (e) { return null; }
    }
    if (/^data:image\/(png|jpe?g)/i.test(src)) return Object.assign({ image: src }, opts);
    return null;
}

// ---------------------------------------------------------------------------
// Page footer — drawn as one SVG so left/right text and the gradient line
// position exactly, independent of pdfmake margins.
// style: 'light' (content pages) | 'dark' (section dividers) | 'cover'
// mode:  'absolute' → absolutely-positioned flow node (section test harness)
//        'footer'   → node for the docDefinition `footer` callback (renders
//                     inside the bottom margin area; page numbers then always
//                     match the PHYSICAL page even if content ever spills)
// ---------------------------------------------------------------------------
function footerNode(style, pageNo, data, mode = 'absolute') {
    const W = PAGE.W, FH = 40, mx = PAGE.MX;
    let left;
    if (style === 'cover') {
        const ft = data.footerText;
        left = ft ? (data.showLogo ? ft : String(ft).replace('DIGIVISE ', '')) : 'CONFIDENTIAL';
    } else {
        left = `${data.brandName || ''} | ${data.reportMonth || ''}`;
    }
    const dark = style === 'cover' || style === 'dark';
    const color = dark ? '#FFFFFF' : C.textMuted;
    const opacity = dark ? 0.5 : 1;
    const id = gid('fl');
    const svg = `<svg width="${W}" height="${FH}" viewBox="0 0 ${W} ${FH}">`
        + `<defs>${linGrad(id, C.lineGrad, mx, 0, W - mx, 0)}</defs>`
        + `<rect x="${mx}" y="${FH - 22.5}" width="${W - mx * 2}" height="1.5" rx="0.75" fill="url(#${id})" opacity="0.4"/>`
        + `<text x="${mx}" y="${FH - 5}" font-family="Inter" font-size="6" fill="${color}" fill-opacity="${opacity}">${esc(left)}</text>`
        + `<text x="${W - mx}" y="${FH - 5}" text-anchor="end" font-family="Inter" font-size="6" fill="${color}" fill-opacity="${opacity}">Page ${pageNo}</text>`
        + `</svg>`;
    if (mode === 'footer') {
        // footer area spans PAGE.H-MB .. PAGE.H → push the svg so its bottom
        // edge lands exactly on the page bottom.
        return { svg, width: W, margin: [0, PAGE.MB - FH, 0, 0] };
    }
    return { svg, width: W, absolutePosition: { x: 0, y: PAGE.H - FH } };
}

// Wrap one PageSpec ({content:[], footer:'light'|'dark'|'cover'}) into a
// pdfmake node with footer + explicit page break. Used by the test harness;
// the production assembler (index.js renderPages) uses the footer callback.
function assemblePage(spec, pageNo, data, isLast) {
    const nodes = [...(spec.content || [])];
    nodes.push(footerNode(spec.footer || 'light', pageNo, data));
    const page = { stack: nodes };
    if (!isLast) page.pageBreak = 'after';
    return page;
}

module.exports = {
    PAGE, C, FONTS, ensureFonts, px, mm,
    idN, fmtRpShort, fmtAxis, fmtFull, splitPoints, splitPointsLoose, esc,
    linGrad, gid, fullPageSvg, placeholder, gradBox,
    contentHeader, summaryBox, gridLayout, th, thU, td, imageNode,
    footerNode, assemblePage,
};
