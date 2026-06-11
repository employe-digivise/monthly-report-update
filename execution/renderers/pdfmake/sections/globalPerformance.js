// Section 7 — "Global Performance" detail table + numbered AI insights box.
// Source of truth: template_aurora.ejs lines 349-417 and
// styles_aurora.css .performance-table (467-514) / .summary-box (383-416).
// One page, light footer.
'use strict';

// Pale summary box styled like H.summaryBox but with NUMBERED points
// (orange bold index + 10px body text), mirroring the template's inline
// "<span>1.</span> point" markup. Structure copied locally from H.summaryBox
// per contract (do not edit theme.js).
function insightsBox(points, H) {
    const px = H.px;
    const rows = points.map((p, i) => ({
        columns: [
            // CSS: font-weight:800 → InterBlack per the contract weight map.
            { width: 14, text: `${i + 1}.`, font: 'InterBlack', fontSize: px(10), color: H.C.accent, lineHeight: 1.5 },
            { width: '*', text: String(p), fontSize: px(10), color: H.C.textBody, lineHeight: 1.5 },
        ],
        margin: [0, 0, 0, i === points.length - 1 ? 0 : px(4)],
    }));
    return {
        table: {
            widths: ['*'],
            body: [[{
                stack: [
                    { text: 'INSIGHTS', fontSize: px(10), bold: true, color: H.C.primary, characterSpacing: 0.4, margin: [0, 0, 0, px(6)] },
                    ...rows,
                ],
                fillColor: H.C.primaryPale,
                margin: [px(14), px(12), px(14), px(12)],
            }]],
        },
        layout: {
            hLineWidth: () => 0,
            vLineWidth: (i) => (i === 0 ? 3 : 0),
            vLineColor: () => H.C.primary,
            paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
        // template wrapper: padding 14px 24mm 0 (sides are the page margin)
        margin: [0, px(14), 0, 0],
    };
}

module.exports = {
    build(ctx, H) {
        const px = H.px;
        const data = (ctx && ctx.data) || {};

        // --- channel columns (EJS lines 357-364) -------------------------
        const channelOrder = ['shopee', 'tiktok', 'tokopedia', 'zalora', 'lazada', 'blibli'];
        const enabled = data.enabledChannels || {};
        const channels = channelOrder.filter((ch) => enabled[ch]);
        const nCh = channels.length;
        const colCount = 1 + nCh + 3;

        // pdfmake column `widths` are CONTENT widths: cell padding and the
        // vertical grid lines are added on top. Compute the outer column
        // widths as shares of the content width minus the grid lines, then
        // subtract each column's padding (metric col: 12px left, others 6px;
        // 6px right everywhere — see layout below).
        const pool = H.PAGE.CW - (colCount + 1) * 0.75;
        const PAD_METRIC = px(12) + px(6);
        const PAD_OTHER = px(6) + px(6);
        let shares;
        if (nCh > 0) {
            // Metriks 20% | channels share 35% equally | 3 × 15% fixed cols
            shares = [0.20, ...channels.map(() => 0.35 / nCh), 0.15, 0.15, 0.15];
        } else {
            // no channels → give the 35% back to the fixed cols (20/15/15/15 of 65)
            shares = [20 / 65, 15 / 65, 15 / 65, 15 / 65];
        }
        const widths = shares.map((s, i) => s * pool - (i === 0 ? PAD_METRIC : PAD_OTHER));

        // --- table body ---------------------------------------------------
        const header = [
            H.thU('Metriks'),
            ...channels.map((ch) => H.thU(ch)),
            H.thU('This Month'),
            H.thU('Last Month'),
            H.thU('Growth'),
        ];

        const gpd = data.globalPerformanceDetail;
        const rows = (gpd && Array.isArray(gpd.comparisonData)) ? gpd.comparisonData : null;

        let body;
        if (rows && rows.length) {
            body = rows.map((r) => {
                const row = r || {};
                // EJS calls row.growth.includes(...) directly (would throw on
                // missing growth) — safe-stringify instead.
                const growth = row.growth == null ? '' : String(row.growth);
                return [
                    // .metric-col: left, 700, text-dark (padding-left via layout below)
                    H.td(row.metric, { alignment: 'left', bold: true, color: H.C.textDark }),
                    ...channels.map((ch) => H.td((row.channels && row.channels[ch]) || '-')),
                    H.td(row.thisMonth, { bold: true, color: H.C.textDark }),
                    H.td(row.lastMonth),
                    H.td(growth, { bold: true, color: growth.includes('+') ? H.C.green : H.C.red }),
                ];
            });
        } else {
            // EJS else-branch: single full-width muted cell
            body = [[
                {
                    text: 'Data tidak tersedia', colSpan: colCount, alignment: 'center',
                    color: H.C.textMuted, fontSize: px(10), margin: [0, px(11), 0, px(11)],
                },
                ...Array(colCount - 1).fill({}),
            ]];
        }

        // CSS paddings: thead th 10px 6px, tbody td 9px 6px, metric-col
        // padding-left 12px.
        const layout = H.gridLayout({ headerRows: 1, padX: 6, padY: 9 });
        layout.paddingLeft = (i) => px(i === 0 ? 12 : 6);
        layout.paddingTop = (i) => px(i === 0 ? 10 : 9);
        layout.paddingBottom = (i) => px(i === 0 ? 10 : 9);

        const content = [
            H.contentHeader('Global Performance'),
            { table: { headerRows: 1, widths, body: [header, ...body] }, layout },
        ];

        // --- AI conclusions (EJS lines 398-411) ---------------------------
        // generator.js normalizes aiConclusion to an array. The EJS renders
        // the box whenever aiConclusion is truthy — INCLUDING an empty array
        // (title-only box, as in the Chromium baseline) — so mirror that.
        if (gpd && gpd.aiConclusion) {
            const points = Array.isArray(gpd.aiConclusion)
                ? gpd.aiConclusion.filter((p) => p != null && String(p).trim() !== '')
                : [String(gpd.aiConclusion)];
            content.push(insightsBox(points, H));
        }

        return [{ content, footer: 'light' }];
    },
};
