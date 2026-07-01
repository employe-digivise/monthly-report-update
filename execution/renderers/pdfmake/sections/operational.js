// Section 3 — "Performa Operasional Toko" (template_aurora.ejs lines 64-137)
// KPI grid 2x2 + operational screenshots + optional metrics summary box.
// CSS spec: .kpi-* (297-348), .screenshot-* (350-377), .summary-box (379-416).

'use strict';

module.exports = {
    build(ctx, H) {
        const data = ctx.data || {};
        const metrics = data.metrics || {};               // template guards: typeof metrics !== 'undefined'
        const CW = H.PAGE.CW;
        const GAP = H.px(12);                             // .kpi-grid / .screenshot-pair gap: 12px

        // -------------------------------------------------------------------
        // KPI card — SVG: rounded 12px rect, white fill, 1px border, 4px left
        // bar (clipped to the rounded outline, like CSS border-left+radius).
        // -------------------------------------------------------------------
        const cardW = (CW - GAP) / 2;                     // grid-template-columns: 1fr 1fr
        const cardH = 62;
        function kpiCard(label, value, suffix, accent) {
            const barColor = accent ? H.C.accent : H.C.primary;   // .kpi-card--accent
            const valColor = accent ? H.C.accent : H.C.primary;   // .kpi-card__value(--highlight)
            const padL = H.px(4) + H.px(18);              // border-left 4px + padding-left 18px
            const labY = H.px(16) + H.px(10);             // padding-top 16px + label font-size
            const valY = labY + H.px(8) + H.px(32) * 0.85; // label mb 8px + value 32px (lh 1)
            const clipId = H.gid('kc');
            return {
                svg: `<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}">`
                    + `<defs><clipPath id="${clipId}"><rect x="0.5" y="0.5" width="${cardW - 1}" height="${cardH - 1}" rx="9"/></clipPath></defs>`
                    + `<rect x="0.5" y="0.5" width="${cardW - 1}" height="${cardH - 1}" rx="9" fill="${H.C.white}" stroke="${H.C.border}" stroke-width="1"/>`
                    + `<rect x="0" y="0" width="${H.px(4)}" height="${cardH}" fill="${barColor}" clip-path="url(#${clipId})"/>`
                    + `<text x="${padL}" y="${labY}" font-family="InterSemiBold" font-size="${H.px(10)}" fill="${H.C.textMuted}" letter-spacing="${H.px(0.5)}">${H.esc(String(label).toUpperCase())}</text>`
                    + `<text x="${padL}" y="${valY}" font-family="MontserratBlack" font-size="${H.px(32)}" fill="${valColor}">${H.esc(String(value))}`
                    + `<tspan font-family="Inter" font-weight="700" font-size="${H.px(16)}" fill="${H.C.textMuted}" dx="${H.px(2)}">${H.esc(suffix)}</tspan>`
                    + `</text>`
                    + `</svg>`,
                width: cardW,
            };
        }

        // Template: (metrics.X) ? metrics.X : 0 — falsy (0/''/null) renders 0.
        // Render the payload number verbatim (0.5, 98.5, 4.8 ...).
        const v = (x) => (x ? x : 0);
        const cards = [
            kpiCard('Pesanan Tidak Terselesaikan', v(metrics.unfulfilledOrders), '%', false),
            kpiCard('Keterlambatan Pengiriman', v(metrics.lateShipment), '%', false),
            kpiCard('Chat Dibalas', v(metrics.chatResponseRate), '%', true),
            kpiCard('Penilaian Keseluruhan', v(metrics.overallRating), '/5', true),
        ];
        const kpiGrid = [
            { columns: [cards[0], cards[1]], columnGap: GAP, margin: [0, 0, 0, GAP] },
            { columns: [cards[2], cards[3]], columnGap: GAP, margin: [0, 0, 0, H.px(16)] }, // inline margin-bottom:16px
        ];

        // -------------------------------------------------------------------
        // Screenshots — slice(0,2), stacked (grid-template-columns: 1fr),
        // gap 12px, max-height 200px (≈150pt), centered. Placeholders when the
        // array is empty or every image failed to download ('' data URI).
        // -------------------------------------------------------------------
        const shots = Array.isArray(data.operationalScreenshots) ? data.operationalScreenshots : [];
        let shotNodes = shots.slice(0, 2)
            .map((src) => H.imageNode(src, { fit: [CW, 150], alignment: 'center' }))
            .filter(Boolean);
        if (!shotNodes.length) {
            shotNodes = [
                H.placeholder('[Screenshot 1 Placeholder]', CW, 150),
                H.placeholder('[Screenshot 2 Placeholder]', CW, 150),
            ];
        }
        const screenshotStack = {
            stack: shotNodes.map((n, i) => Object.assign({}, n, {
                margin: [0, i === 0 ? H.px(12) : GAP, 0, 0],   // .screenshot-container mt 12px + gap
            })),
        };

        // -------------------------------------------------------------------
        // Summary box intentionally omitted on this page (per request): the
        // operational page shows KPI cards + screenshots only. metrics.summary
        // is still collected/generated — it just isn't rendered here.
        // -------------------------------------------------------------------
        const content = [
            H.contentHeader('Performa Operasional Toko'),
            ...kpiGrid,
            screenshotStack,
        ];

        return [{ content, footer: 'light' }];
    },
};
