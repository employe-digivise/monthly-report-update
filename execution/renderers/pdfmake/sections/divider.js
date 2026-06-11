// sections/divider.js — full-bleed section divider page.
// Spec: template_aurora.ejs lines 45-62 + styles_aurora.css lines 190-260
// (.section-divider / -left / -right / .section-number(-bg) / .section-title).
//
// One page-sized SVG (H.fullPageSvg), footer 'dark' (added by the assembler):
//   - left panel  : 0..45% width, vertical gradient #2A0A6E -> #1A0545
//   - right panel : 45%..100%, 160deg gradient #FF6B2C/#FF8F5C/#FFB088.
//     The CSS skewX(-6deg) 120px strip over the seam is emulated by giving
//     the orange polygon a slanted left edge (top shifted right, bottom
//     shifted left by tan(6deg)*H/2 each).
//   - number bg   : MontserratBlack 220px, white @ 0.06, centered in left panel
//   - number fg   : MontserratBlack 72px, #FF6B2C, same center
//   - title lines : MontserratBlack 44px white, line-height 1.1, left-aligned
//     at 45%W + 50px padding, vertically centered as a block.
// Accepted tradeoffs (CONTRACT): text-shadow on the title is skipped; the
// seam strip shares the right panel's gradient instead of having its own.

module.exports = {
    build(ctx, H, opts) {
        opts = opts || {};
        // EJS hardcodes these per divider; never throw if the caller omits them.
        const number = opts.number != null ? String(opts.number) : '';
        let lines = opts.title != null ? opts.title : [];
        if (!Array.isArray(lines)) lines = String(lines).split(/<br\s*\/?\s*>/i);
        lines = lines.map((s) => String(s)).filter((s) => s.length > 0);

        const W = H.PAGE.W;
        const PH = H.PAGE.H;
        const seam = W * 0.45;                                  // .section-divider-left width: 45%
        const skew = Math.tan((6 * Math.PI) / 180) * (PH / 2);  // ~6deg slanted seam (skewX strip)

        // --- left panel gradient: linear-gradient(180deg, #2A0A6E, #1A0545)
        const leftId = H.gid('divL');
        const leftGrad = H.linGrad(leftId, H.C.dividerLeftGrad, 0, 0, 0, PH);

        // --- right panel gradient: linear-gradient(160deg, ...) computed the
        // CSS way over the right panel box (line through center, length
        // |w*sin| + |h*cos|). Screen-coords direction = (sin a, -cos a).
        const a = (160 * Math.PI) / 180;
        const dirX = Math.sin(a);
        const dirY = -Math.cos(a);
        const rw = W - seam;
        const len = Math.abs(rw * dirX) + Math.abs(PH * dirY);
        const cx = (seam + W) / 2;
        const cy = PH / 2;
        const rightId = H.gid('divR');
        const rightGrad = H.linGrad(
            rightId, H.C.dividerRightGrad,
            (cx - (dirX * len) / 2).toFixed(2), (cy - (dirY * len) / 2).toFixed(2),
            (cx + (dirX * len) / 2).toFixed(2), (cy + (dirY * len) / 2).toFixed(2)
        );

        // Orange polygon with slanted left edge over the seam.
        const poly = `${(seam + skew).toFixed(2)},0 ${W},0 ${W},${PH} ${(seam - skew).toFixed(2)},${PH}`;

        // --- numbers, centered in the left panel. svg-to-pdfkit has no
        // dominant-baseline, so center manually: baseline = cy + ~0.35*size
        // (digit cap-height centering for Montserrat Black).
        const numCx = seam / 2;
        const bgSize = H.px(220);   // 165pt
        const fgSize = H.px(72);    // 54pt
        const numBgY = cy + bgSize * 0.35;
        const numFgY = cy + fgSize * 0.35;

        // --- title block, vertically centered; line-height 1.1
        const titleX = seam + H.px(50);
        const tSize = H.px(44);     // 33pt
        const lineH = tSize * 1.1;
        const n = lines.length;
        const titleText = lines.map((line, i) => {
            const lineCy = cy + (i - (n - 1) / 2) * lineH;
            const baseY = lineCy + tSize * 0.35;
            return `<text x="${titleX.toFixed(2)}" y="${baseY.toFixed(2)}" font-family="MontserratBlack" font-size="${tSize}" fill="${H.C.white}">${H.esc(line)}</text>`;
        }).join('');

        // HTML paint order: bg number sits under the orange panel (right div
        // comes later in the DOM); only the z-index:2 fg number + title float
        // above it. Mirror that: bg number -> polygon -> fg number -> title.
        const svg = `<svg width="${W}" height="${PH}" viewBox="0 0 ${W} ${PH}">`
            + `<defs>${leftGrad}${rightGrad}</defs>`
            + `<rect x="0" y="0" width="${W}" height="${PH}" fill="url(#${leftId})"/>`
            + `<text x="${numCx.toFixed(2)}" y="${numBgY.toFixed(2)}" text-anchor="middle" font-family="MontserratBlack" font-size="${bgSize}" fill="#FFFFFF" fill-opacity="0.06">${H.esc(number)}</text>`
            + `<polygon points="${poly}" fill="url(#${rightId})"/>`
            + `<text x="${numCx.toFixed(2)}" y="${numFgY.toFixed(2)}" text-anchor="middle" font-family="MontserratBlack" font-size="${fgSize}" fill="${H.C.accent}">${H.esc(number)}</text>`
            + titleText
            + `</svg>`;

        return [{ content: [H.fullPageSvg(svg)], footer: 'dark' }];
    },
};
