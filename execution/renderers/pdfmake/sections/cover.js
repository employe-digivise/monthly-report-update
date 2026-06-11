// Section 1 — COVER PAGE (template_aurora.ejs lines 15-43, styles_aurora.css
// .cover-page block lines 72-188).
//
// One full-bleed page drawn as a single page-sized SVG (background 160deg
// gradient, two radial glow blobs, decorative circle group, centered text
// column) + the agency logo as a raster image on top (absolutePosition).
'use strict';

// --- tiny PNG/JPEG dimension sniffer (logo centering under fit:[w,h]) -------
// pdfmake anchors a fitted image at its top-left, so to center the logo we
// need the real fitted width. Returns {w,h} or null (then we assume the full
// fit box and accept a small offset).
function imageDims(dataUri) {
    try {
        const comma = dataUri.indexOf(',');
        const meta = dataUri.slice(0, comma);
        if (!/;base64/i.test(meta)) return null;
        const buf = Buffer.from(dataUri.slice(comma + 1), 'base64');
        // PNG: 8-byte signature, IHDR width/height at byte 16/20 (big-endian)
        if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
            return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
        }
        // JPEG: walk markers until an SOFn frame header
        if (buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
            let off = 2;
            while (off + 9 < buf.length) {
                if (buf[off] !== 0xFF) { off++; continue; }
                const marker = buf[off + 1];
                if (marker === 0xFF) { off++; continue; }
                if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                    return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
                }
                if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) { off += 2; continue; }
                off += 2 + buf.readUInt16BE(off + 2);
            }
        }
    } catch (e) { /* fall through */ }
    return null;
}

module.exports = {
    build(ctx, H) {
        const data = ctx.data || {};
        const W = H.PAGE.W, PH = H.PAGE.H;
        const cx = W / 2;
        const esc = H.esc;

        // EJS would throw on missing brandName/reportMonth/reportYear — safe '' here.
        const brandName = data.brandName != null ? String(data.brandName) : '';
        const reportMonth = data.reportMonth != null ? String(data.reportMonth) : '';
        const reportYear = data.reportYear != null ? String(data.reportYear) : '';

        const parts = [];

        // -------------------------------------------------------------------
        // 1. Background — linear-gradient(160deg, #6C2BD9 0%, #3D1196 40%,
        //    #2A0A6E 70%, #1A0545 100%). H.linGrad spaces stops evenly, so the
        //    def is written manually with explicit offsets. CSS angle 160deg =
        //    direction (sin160, -cos160) ≈ (0.342, 0.940) in screen coords;
        //    gradient line through page center, CSS length |W·sin|+|H·cos|.
        // -------------------------------------------------------------------
        const dirX = Math.sin(160 * Math.PI / 180);          //  0.342
        const dirY = -Math.cos(160 * Math.PI / 180);         //  0.940 (y down)
        const half = (Math.abs(W * dirX) + Math.abs(PH * dirY)) / 2;
        const gx1 = (cx - dirX * half).toFixed(1), gy1 = (PH / 2 - dirY * half).toFixed(1);
        const gx2 = (cx + dirX * half).toFixed(1), gy2 = (PH / 2 + dirY * half).toFixed(1);
        const bgId = H.gid('cvbg');
        const stops = H.C.coverGrad; // ['#6C2BD9','#3D1196','#2A0A6E','#1A0545']
        const bgGrad = `<linearGradient id="${bgId}" x1="${gx1}" y1="${gy1}" x2="${gx2}" y2="${gy2}" gradientUnits="userSpaceOnUse">`
            + `<stop offset="0%" stop-color="${stops[0]}"/>`
            + `<stop offset="40%" stop-color="${stops[1]}"/>`
            + `<stop offset="70%" stop-color="${stops[2]}"/>`
            + `<stop offset="100%" stop-color="${stops[3]}"/>`
            + `</linearGradient>`;

        // -------------------------------------------------------------------
        // 2. Radial glow blobs (::before / ::after). Approximated as circular
        //    radial gradients (CSS uses blurred ellipses; accepted tradeoff).
        //    ::before — top:-20% right:-15%, 70%x70%, orange 0.2 → transparent 70%
        //    ::after  — bottom:-10% left:-10%, 60%x50%, tertiary 0.25 → transparent 70%
        // -------------------------------------------------------------------
        const b1w = 0.70 * W, b1h = 0.70 * PH;
        const b1cx = (W + 0.15 * W) - b1w / 2;               // right:-15%
        const b1cy = -0.20 * PH + b1h / 2;                   // top:-20%
        const b1r = (b1w / 2 + b1h / 2) / 2;
        const b2w = 0.60 * W, b2h = 0.50 * PH;
        const b2cx = -0.10 * W + b2w / 2;                    // left:-10%
        const b2cy = (PH + 0.10 * PH) - b2h / 2;             // bottom:-10%
        const b2r = (b2w / 2 + b2h / 2) / 2;
        const blob1Id = H.gid('cvb1'), blob2Id = H.gid('cvb2');
        const blobGrad = (id, bx, by, r, color, op) =>
            `<radialGradient id="${id}" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" gradientUnits="userSpaceOnUse">`
            + `<stop offset="0%" stop-color="${color}" stop-opacity="${op}"/>`
            + `<stop offset="70%" stop-color="${color}" stop-opacity="0"/>`
            + `<stop offset="100%" stop-color="${color}" stop-opacity="0"/>`
            + `</radialGradient>`;
        const blobDefs = blobGrad(blob1Id, b1cx, b1cy, b1r, H.C.accent, 0.2)
            + blobGrad(blob2Id, b2cx, b2cy, b2r, H.C.tertiary, 0.25);

        parts.push(`<defs>${bgGrad}${blobDefs}</defs>`);
        parts.push(`<rect x="0" y="0" width="${W}" height="${PH}" fill="url(#${bgId})"/>`);
        parts.push(`<rect x="0" y="0" width="${W}" height="${PH}" fill="url(#${blob1Id})"/>`);
        parts.push(`<rect x="0" y="0" width="${W}" height="${PH}" fill="url(#${blob2Id})"/>`);

        // -------------------------------------------------------------------
        // 3. Decorative circle group (.cover-aurora-shape): 300x300 CSS px box
        //    (=225pt) at top:10% / right:5%, group opacity 0.12. Opacities are
        //    pre-multiplied per element (×0.12) instead of relying on group
        //    opacity compositing in svg-to-pdfkit.
        // -------------------------------------------------------------------
        const shapeSize = H.px(300);                          // 225pt
        const shapeX = (W - 0.05 * W - shapeSize).toFixed(1); // right:5%
        const shapeY = (0.10 * PH).toFixed(1);                // top:10%
        const sc = shapeSize / 300;                           // viewBox 0 0 300 300
        parts.push(
            `<g transform="translate(${shapeX} ${shapeY}) scale(${sc})">`
            + `<circle cx="150" cy="150" r="140" stroke="${H.C.accent}" stroke-opacity="${(0.3 * 0.12).toFixed(3)}" stroke-width="1" fill="none"/>`
            + `<circle cx="150" cy="150" r="110" stroke="${H.C.accent}" stroke-opacity="${(0.2 * 0.12).toFixed(3)}" stroke-width="1" fill="none"/>`
            + `<circle cx="150" cy="150" r="80" stroke="${H.C.accent}" stroke-opacity="${(0.15 * 0.12).toFixed(3)}" stroke-width="1" fill="none"/>`
            + `<path d="M50 150 Q150 50 250 150 Q150 250 50 150Z" fill="${H.C.accent}" fill-opacity="${(0.05 * 0.12).toFixed(4)}"/>`
            + `</g>`
        );

        // -------------------------------------------------------------------
        // 4. Centered text column (.cover-content, flex-centered on the page).
        //    Vertical layout mirrors the CSS line boxes + margins (px → pt).
        //    label 11px/1.2 +16 · title 52px/1.05 ×2 +24 · divider 4px +24 ·
        //    brand 28px/1.2 +8 · month 16px/1.2
        // -------------------------------------------------------------------
        const labFS = H.px(11), labLH = labFS * 1.2;
        const titFS = H.px(52), titLH = titFS * 1.05;
        const divH = H.px(4), divW = H.px(80);
        const brdFS = H.px(28), brdLH = brdFS * 1.2;
        const monFS = H.px(16), monLH = monFS * 1.2;
        const m16 = H.px(16), m24 = H.px(24), m8 = H.px(8);
        const blockH = labLH + m16 + titLH * 2 + m24 + divH + m24 + brdLH + m8 + monLH;
        let y = (PH - blockH) / 2;
        // baseline ≈ line-box top + (LH + 0.72·FS)/2
        const base = (top, lh, fs) => (top + (lh + 0.72 * fs) / 2).toFixed(1);

        // label — Inter 600 11px, ls 4px, uppercase, white@0.6
        parts.push(`<text x="${cx}" y="${base(y, labLH, labFS)}" text-anchor="middle" font-family="InterSemiBold" font-size="${labFS}" letter-spacing="${H.px(4)}" fill="#FFFFFF" fill-opacity="0.6">MONTHLY PERFORMANCE REPORT</text>`);
        y += labLH + m16;
        // title — Montserrat 900 52px, lh 1.05, ls -1px; MONTHLY white / REPORT orange
        parts.push(`<text x="${cx}" y="${base(y, titLH, titFS)}" text-anchor="middle" font-family="MontserratBlack" font-size="${titFS}" letter-spacing="${-H.px(1)}" fill="#FFFFFF">MONTHLY</text>`);
        parts.push(`<text x="${cx}" y="${base(y + titLH, titLH, titFS)}" text-anchor="middle" font-family="MontserratBlack" font-size="${titFS}" letter-spacing="${-H.px(1)}" fill="${H.C.accent}">REPORT</text>`);
        y += titLH * 2 + m24;
        // divider — 80x4px rounded, accent gradient (135deg ≈ left→right on a flat bar)
        const divId = H.gid('cvdv');
        parts.push(`<defs>${H.linGrad(divId, H.C.accentGrad, cx - divW / 2, y, cx + divW / 2, y + divH)}</defs>`);
        parts.push(`<rect x="${(cx - divW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${divW}" height="${divH}" rx="${divH / 2}" fill="url(#${divId})"/>`);
        y += divH + m24;
        // brand — Montserrat 700 28px white
        parts.push(`<text x="${cx}" y="${base(y, brdLH, brdFS)}" text-anchor="middle" font-family="Montserrat" font-weight="700" font-size="${brdFS}" fill="#FFFFFF">${esc(brandName)}</text>`);
        y += brdLH + m8;
        // month — Inter 400 16px white@0.7 ls 2px, "<month> — <year>"
        parts.push(`<text x="${cx}" y="${base(y, monLH, monFS)}" text-anchor="middle" font-family="Inter" font-size="${monFS}" letter-spacing="${H.px(2)}" fill="#FFFFFF" fill-opacity="0.7">${esc(reportMonth)} — ${esc(reportYear)}</text>`);

        const svg = `<svg width="${W}" height="${PH}" viewBox="0 0 ${W} ${PH}">${parts.join('')}</svg>`;
        const content = [H.fullPageSvg(svg)];

        // -------------------------------------------------------------------
        // 5. Agency logo (.agency-logo) — bottom:60px, max 120x40px (=90x30pt),
        //    centered, opacity 0.9. Same guard as the EJS conditional; raster
        //    on top of the SVG via absolutePosition.
        // -------------------------------------------------------------------
        if (data.showLogo && data.logoUrl) {
            const FIT_W = 90, FIT_H = 30;
            // center using the real fitted width when dimensions are readable
            let fw = FIT_W, fh = FIT_H;
            const dims = typeof data.logoUrl === 'string' ? imageDims(data.logoUrl) : null;
            if (dims && dims.w > 0 && dims.h > 0) {
                const s = Math.min(FIT_W / dims.w, FIT_H / dims.h);
                fw = dims.w * s; fh = dims.h * s;
            }
            const logo = H.imageNode(data.logoUrl, {
                fit: [FIT_W, FIT_H],
                opacity: 0.9,
                // bottom edge at PAGE.H - 45pt (CSS bottom:60px)
                absolutePosition: { x: (W - fw) / 2, y: PH - 45 - fh },
            });
            if (logo) content.push(logo);
        }

        return [{ content, footer: 'cover' }];
    },
};
