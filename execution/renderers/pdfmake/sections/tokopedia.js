// Section 06 — Tokopedia "Ads Performance" page.
// Source: template_aurora.ejs lines 969-1005 (divider page 951-967 is owned by
// divider.js via index.js), styles_aurora.css .revenue-accent-box /
// .blue-header-table. One A4 page, footer 'light'.
'use strict';

module.exports = {
    build(ctx, H) {
        const data = (ctx && ctx.data) || {};
        const CW = H.PAGE.CW;

        // ctx.data.tokopedia_data is normalized by buildRenderContext() when the
        // channel is enabled (total_revenue number, ads_performance.metrics
        // array, period[2]) — still guard every level so a direct/odd invocation
        // can never throw (the raw EJS would throw on missing total_revenue).
        const tk = (data.tokopedia_data && typeof data.tokopedia_data === 'object')
            ? data.tokopedia_data : {};
        const ap = (tk.ads_performance && typeof tk.ads_performance === 'object')
            ? tk.ads_performance : {};
        const period = Array.isArray(ap.period) ? ap.period : ['', ''];
        const metrics = Array.isArray(ap.metrics) ? ap.metrics : [];

        const content = [];
        content.push(H.contentHeader('Ads Performance'));

        // --- Total Revenue KPI (.revenue-accent-box.centered) ----------------
        // Template: "Rp" + total_revenue.toLocaleString('id-ID'), no space.
        // inline-block => box hugs its content; widen past gradBox's default
        // 180pt when the value is long (MontserratBlack 26px ≈ 0.72em/char,
        // CSS padding 28px each side).
        const valStr = 'Rp' + H.idN(tk.total_revenue);
        const valSize = H.px(26);
        const boxW = Math.min(CW, Math.max(180, Math.ceil(valStr.length * valSize * 0.72) + 2 * H.px(28)));
        const kpi = H.gradBox('Total Revenue', valStr, H.C.purpleGrad, { w: boxW });
        kpi.alignment = 'center';
        kpi.margin = [0, 0, 0, 15];                    // inline style margin-bottom:20px
        content.push(kpi);

        // --- .blue-header-table (same structure as TikTok GMV Max) -----------
        // Header: Metrics 25% rowSpan2 / Periode colSpan2 / Growth 20% rowSpan2.
        // CSS thead th: 10px / 700, gradient bg (flat H.C.primary fallback per
        // contract), no uppercase / letter-spacing on this table's headers.
        const thOpts = { fontSize: H.px(10), characterSpacing: 0 };
        // Single-row header with a stacked Periode cell — rowSpan is avoided
        // on purpose: pdfmake draws hLines across span-covered cells and seams
        // the fill, cutting a line through the Metrics/Growth labels (same fix
        // as cpas.js / tiktok.js). Side labels get a half-line top margin to
        // fake vertical-align:middle next to the two-line Periode cell.
        const noBorder = { border: [false, false, false, false] };
        const headShift = (H.px(10) * 1.2 + H.px(4)) / 2;
        const thSide = (t) => H.th(t, Object.assign({ margin: [0, headShift, 0, 0] }, thOpts, noBorder));
        const body = [
            [
                thSide('Metrics'),
                {
                    colSpan: 2,
                    fillColor: H.C.primary,
                    stack: [
                        H.th('Periode', Object.assign({ margin: [0, 0, 0, H.px(4)] }, thOpts, noBorder)),
                        {
                            columns: [
                                Object.assign(H.th(period[0] != null ? period[0] : '', thOpts), { width: '*' }),
                                Object.assign(H.th(period[1] != null ? period[1] : '', thOpts), { width: '*' }),
                            ],
                        },
                    ],
                },
                {},
                thSide('Growth'),
            ],
        ];
        metrics.forEach((row) => {
            const r = row || {};
            body.push([
                // body first cell: purple fill, white, 700, 9px, uppercase,
                // letter-spacing .3px — exactly thU()'s defaults
                H.thU(r.metric != null ? r.metric : ''),
                H.td(r.prev, { fontSize: H.px(11) }),
                H.td(r.current, { fontSize: H.px(11) }),
                H.td(r.growth, { fontSize: H.px(11) }),
            ]);
        });

        // #B7A4DA grid + zebra (even body rows pale).
        const table = {
            table: {
                widths: ['25%', '*', '*', '20%'],
                headerRows: 1,
                body,
            },
            layout: H.gridLayout({ headerRows: 1 }),
        };
        content.push(table);

        // Vertical centering (.page justify-content:center) is handled
        // globally by the assembler's two-pass spacer — no local spacer here.

        return [{ content, footer: 'light' }];
    },
};
