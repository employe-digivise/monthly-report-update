// Section 4 — "Tingkat Penggunaan Alat Promosi" (promotion tools page).
// Source: template_aurora.ejs lines 139-185, styles_aurora.css .checklist-* /
// .screenshot-* / .aurora-blob-bl. One A4 page, footer 'light'.
'use strict';

module.exports = {
    build(ctx, H) {
        const data = (ctx && ctx.data) || {};
        const CW = H.PAGE.CW;
        const nodes = [];

        // --- .aurora-blob-bl decoration (bottom:40px; left:-30px; 160px circle;
        // radial-gradient rgba(255,107,44,.06) -> transparent 70%). Drawn first
        // (z-index 0) as an absolutely positioned SVG; the part left of the page
        // edge is simply not drawn.
        const blobD = H.px(160);                       // 120pt
        const blobLeft = H.px(-30);                    // -22.5pt (off-page)
        const blobTop = H.PAGE.H - H.px(40) - blobD;   // bottom offset 40px
        const visW = blobD + blobLeft;                 // visible width from x=0
        const rgId = H.gid('blob');
        nodes.push({
            svg: `<svg width="${visW}" height="${blobD}" viewBox="0 0 ${visW} ${blobD}">`
                + `<defs><radialGradient id="${rgId}" cx="${blobLeft + blobD / 2}" cy="${blobD / 2}" r="${blobD / 2}" gradientUnits="userSpaceOnUse">`
                + `<stop offset="0%" stop-color="#FF6B2C" stop-opacity="0.06"/>`
                + `<stop offset="70%" stop-color="#FF6B2C" stop-opacity="0"/>`
                + `</radialGradient></defs>`
                // svg-to-pdfkit renders gradient stop-opacity stronger than
                // browsers; extra element opacity keeps it as subtle as the CSS
                + `<circle cx="${blobLeft + blobD / 2}" cy="${blobD / 2}" r="${blobD / 2}" fill="url(#${rgId})" opacity="0.18"/>`
                + `</svg>`,
            width: visW,
            absolutePosition: { x: 0, y: blobTop },
        });

        // --- .content-header
        nodes.push(H.contentHeader('Tingkat Penggunaan Alat Promosi'));

        // --- screenshots (.screenshot-container margin-top:12px, vertical pair,
        // gap 12px). EJS: promotionScreenshots.slice(0,2) when non-empty array,
        // otherwise two 200px-high dashed placeholders.
        const SHOT_H = 150;                      // 200 CSS px
        const shotGap = H.px(12);
        const shots = Array.isArray(data.promotionScreenshots)
            ? data.promotionScreenshots.slice(0, 2)
            : [];
        const shotNodes = [];
        if (shots.length > 0) {
            shots.forEach((src, i) => {
                const img = H.imageNode(src, { fit: [CW, SHOT_H], alignment: 'center' });
                // failed download ('' data URI) -> placeholder instead of a hole
                shotNodes.push(img || H.placeholder(`[Screenshot ${i + 1} Placeholder]`, CW, SHOT_H));
            });
        } else {
            shotNodes.push(H.placeholder('[Screenshot 1 Placeholder]', CW, SHOT_H));
            shotNodes.push(H.placeholder('[Screenshot 2 Placeholder]', CW, SHOT_H));
        }
        shotNodes.forEach((n, i) => {
            n.margin = [0, i === 0 ? H.px(12) : 0, 0, i < shotNodes.length - 1 ? shotGap : 0];
            nodes.push(n);
        });

        // --- heading "Penggunaan Alat Promosi" (13px / 800 -> Montserrat bold,
        // container padding-top 16px, margin-bottom 14px)
        nodes.push({
            text: 'Penggunaan Alat Promosi',
            font: 'Montserrat', bold: true,
            fontSize: H.px(13), color: H.C.textDark,
            margin: [0, H.px(16), 0, H.px(14)],
        });

        // --- .checklist-container: 2-col grid, gap 8px. Missing/null
        // promotionTools -> empty list (matches EJS guard).
        const tools = (data.promotionTools && typeof data.promotionTools === 'object')
            ? data.promotionTools : {};
        const items = Object.keys(tools).map((tool) => ({
            label: tool.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
                + (tools[tool] ? ' digunakan' : ' tidak digunakan'),
            active: !!tools[tool],
        }));

        const gap = H.px(8);                          // 6pt grid gap
        const colW = (CW - gap) / 2;
        const fs = H.px(10);                          // item text 10px
        const padX = H.px(12), padY = H.px(8);        // item padding 8px 12px
        const icon = H.px(16);                        // 16px circle
        const textX = padX + icon + H.px(8);          // icon + 8px flex gap
        const availTextW = colW - textX - padX;
        const lineH = fs * 1.3;

        // crude Inter width estimate for wrapping (HTML wraps; SVG <text> does not)
        const wrap = (label) => {
            const maxChars = Math.max(8, Math.floor(availTextW / (fs * 0.52)));
            if (label.length <= maxChars) return [label];
            const lines = [];
            let cur = '';
            label.split(' ').forEach((w) => {
                if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; }
                else cur = cur ? cur + ' ' + w : w;
            });
            if (cur) lines.push(cur);
            return lines.slice(0, 3);
        };

        // one checklist item as a rounded SVG row (rect rx 8px + circle icon +
        // feather check / x glyph + label text)
        const itemSvg = (it, w, h, lines) => {
            const bg = it.active ? H.C.primaryPale : '#FEF2F2';
            const txt = it.active ? H.C.textBody : H.C.textMuted;
            const circ = it.active ? H.C.green : H.C.red;
            const cy = h / 2;
            // 10px (7.5pt) glyph from a 24-unit viewBox, centered in the circle
            const s = H.px(10) / 24;
            const gx = padX + icon / 2 - (24 * s) / 2;
            const gy = cy - (24 * s) / 2;
            const glyph = it.active
                ? '<polyline points="20 6 9 17 4 12" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
                : '<line x1="18" y1="6" x2="6" y2="18" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>'
                + '<line x1="6" y1="6" x2="18" y2="18" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>';
            const textY0 = cy - ((lines.length - 1) * lineH) / 2 + fs * 0.35;
            const texts = lines.map((ln, i) =>
                `<text x="${textX}" y="${textY0 + i * lineH}" font-family="Inter" font-size="${fs}" fill="${txt}">${H.esc(ln)}</text>`
            ).join('');
            return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
                + `<rect width="${w}" height="${h}" rx="${H.px(8)}" fill="${bg}"/>`
                + `<circle cx="${padX + icon / 2}" cy="${cy}" r="${icon / 2}" fill="${circ}"/>`
                + `<g transform="translate(${gx} ${gy}) scale(${s})">${glyph}</g>`
                + texts
                + `</svg>`;
        };

        for (let i = 0; i < items.length; i += 2) {
            const pair = items.slice(i, i + 2).map((it) => ({ it, lines: wrap(it.label) }));
            const rowH = Math.max(...pair.map((p) =>
                Math.max(padY * 2 + icon, padY * 2 + p.lines.length * lineH)));
            const cols = pair.map((p) => ({
                svg: itemSvg(p.it, colW, rowH, p.lines), width: colW,
            }));
            if (cols.length < 2) cols.push({ width: colW, text: '' });
            nodes.push({
                columns: cols,
                columnGap: gap,
                margin: [0, 0, 0, i + 2 < items.length ? gap : 0],
            });
        }

        return [{ content: nodes, footer: 'light' }];
    },
};
