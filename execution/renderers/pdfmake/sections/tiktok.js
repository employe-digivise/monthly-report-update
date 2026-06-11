// Section — "TikTok Performance" content pages (template_aurora.ejs lines
// 871-945; the "05" divider page is owned by divider.js).
// Page 1 "Store Performance": purple Total Revenue gradient box, composition
// donut (prebuilt ctx.charts.tiktokDonutSvg), 3-col blue-header revenue table
// at 85% width, summary box (always a bullet list, like the template's <ul>).
// Page 2 "GMV Max Performance": 4-col table with 2-row spanned header
// (Metrics | Periode×2 | Growth) and purple uppercase metric cells.
// Both pages footer:'light'.
'use strict';

module.exports = {
    build(ctx, H) {
        const data = (ctx && ctx.data) || {};
        const charts = (ctx && ctx.charts) || {};
        const px = H.px;

        // --- data fallbacks ------------------------------------------------
        // generator.buildRenderContext() normalizes tiktok_data when the
        // channel is enabled, but mirror the template guards anyway so a raw
        // or partial payload can never throw.
        const td = (data.tiktok_data && typeof data.tiktok_data === 'object') ? data.tiktok_data : {};
        const sp = (td.store_performance && typeof td.store_performance === 'object') ? td.store_performance : {};
        const comp = (sp.composition && typeof sp.composition === 'object') ? sp.composition : {};
        const compVideo = (comp.video && typeof comp.video === 'object') ? comp.video : {};
        const compLive = (comp.live_streaming && typeof comp.live_streaming === 'object') ? comp.live_streaming : {};
        const compCard = (comp.product_card && typeof comp.product_card === 'object') ? comp.product_card : {};
        // Defensive caps: the HTML template clips page overflow; pdfmake would
        // spill to an extra page instead (breaks numbering). Realistic payloads
        // never hit these (sample: 3 summary points, 4 metric rows).
        const summary = (Array.isArray(sp.summary) ? sp.summary : []).slice(0, 12);
        const gmv = (td.gmv_max_performance && typeof td.gmv_max_performance === 'object') ? td.gmv_max_performance : {};
        const period = Array.isArray(gmv.period) ? gmv.period : [];
        const metrics = (Array.isArray(gmv.metrics) ? gmv.metrics : []).slice(0, 20);

        // Template gap:20px between the centered blocks on page 1
        const GAP = px(20);

        // .blue-header-table thead th — 10px bold, NOT uppercase, no tracking
        const bh = (text) => H.th(text, { fontSize: px(10), characterSpacing: 0 });

        // =====================================================================
        // PAGE 1 — Store Performance
        // =====================================================================
        const p1 = [];
        p1.push(H.contentHeader('Store Performance'));

        // --- Total Revenue gradient box (template: no space after "Rp") -----
        const revVal = 'Rp' + H.idN(sp.total_revenue);
        // .revenue-accent-box is inline-block (hugs content, padding 18px 28px)
        // → size the SVG box to the value width (~MontserratBlack 26px).
        const boxW = Math.max(170, Math.round(revVal.length * 12.6 + 2 * px(28)));
        p1.push(Object.assign({}, H.gradBox('Total Revenue', revVal, H.C.purpleGrad, { w: boxW }), {
            alignment: 'center',
            margin: [0, 0, 0, GAP],
        }));

        // --- Composition donut (prebuilt, font-pinned by the assembler) ------
        // Intrinsic SVG width attr is 190 CSS px → render at 142.5pt (H.px) so
        // it matches the HTML size instead of pdfmake's pt-per-px default.
        if (charts.tiktokDonutSvg) {
            p1.push({ svg: charts.tiktokDonutSvg, width: px(190), alignment: 'center', margin: [0, 0, 0, GAP] });
        }

        // --- 3-col revenue table, width 85% of the content width -------------
        const t1W = H.PAGE.CW * 0.85;
        const t1Pool = t1W - 4 * 0.75;             // 4 vertical grid lines
        const t1Pad = px(8) + px(8);               // gridLayout padX both sides
        const t1Col = t1Pool / 3 - t1Pad;          // pdfmake widths = content width
        const revCell = (v) => H.td('Rp' + H.idN(v && v.revenue), {
            fontSize: px(13), bold: true, color: H.C.textDark,
        });
        p1.push({
            columns: [
                { width: '*', text: '' },
                {
                    width: t1W,
                    table: {
                        headerRows: 1,
                        widths: [t1Col, t1Col, t1Col],
                        body: [
                            [bh('Video'), bh('Live Streaming'), bh('Kartu Produk')],
                            [revCell(compVideo), revCell(compLive), revCell(compCard)],
                        ],
                    },
                    layout: H.gridLayout({ headerRows: 1, zebra: false }),
                },
                { width: '*', text: '' },
            ],
            margin: [0, 0, 0, GAP],
        });

        // --- Summary box — ALWAYS rendered, ALWAYS a <ul> (template uses a
        // disc list even for a single point, unlike H.summaryBox which falls
        // back to plain text for 1 item — so build the box locally).
        const sumStack = [{
            text: 'SUMMARY', fontSize: px(10), bold: true, color: H.C.primary,
            characterSpacing: 0.4, margin: [0, 0, 0, px(6)],
        }];
        if (summary.length > 0) {
            sumStack.push({
                ul: summary.map((p) => ({
                    text: String(p == null ? '' : p), fontSize: px(10),
                    color: H.C.textBody, lineHeight: 1.5, margin: [0, 0, 0, px(3)],
                })),
                markerColor: H.C.textBody,
            });
        }
        p1.push({
            table: {
                widths: ['*'],
                body: [[{
                    stack: sumStack,
                    fillColor: H.C.primaryPale,
                    margin: [px(14), px(12), px(14), px(12)],
                }]],
            },
            layout: {
                hLineWidth: () => 0,
                vLineWidth: (i) => (i === 0 ? 3 : 0),
                vLineColor: () => H.C.primary,
                paddingLeft: () => 0, paddingRight: () => 0,
                paddingTop: () => 0, paddingBottom: () => 0,
            },
        });

        // =====================================================================
        // PAGE 2 — GMV Max Performance
        // =====================================================================
        const p2 = [];
        p2.push(H.contentHeader('GMV Max Performance'));

        // Column shares of the content width: 25 / 27.5 / 27.5 / 20
        const t2Pool = H.PAGE.CW - 5 * 0.75;       // 5 vertical grid lines
        const t2Pad = px(8) + px(8);
        const t2Widths = [0.25, 0.275, 0.275, 0.20].map((s) => s * t2Pool - t2Pad);

        // Single-row header with a stacked Periode cell (PERIODE over the two
        // period values). rowSpan is avoided on purpose: pdfmake draws hLines
        // across span-covered cells and seams the fill, which cut a line
        // through the Metrics/Growth labels (same fix as cpas.js / tokopedia).
        const noBorder = { border: [false, false, false, false] };
        const headShift = (px(10) * 1.2 + px(4)) / 2;
        const header1 = [
            bh('Metrics'), Object.assign({
                colSpan: 2,
                fillColor: H.C.primary,
                stack: [
                    Object.assign(bh('Periode'), { margin: [0, 0, 0, px(4)] }, noBorder),
                    {
                        columns: [
                            Object.assign(bh(period[0] || ''), { width: '*' }),
                            Object.assign(bh(period[1] || ''), { width: '*' }),
                        ],
                    },
                ],
            }), {}, bh('Growth'),
        ];
        header1[0] = Object.assign(header1[0], { margin: [0, headShift, 0, 0] }, noBorder);
        header1[3] = Object.assign(header1[3], { margin: [0, headShift, 0, 0] }, noBorder);

        const t2Body = metrics.map((row) => {
            const r = (row && typeof row === 'object') ? row : {};
            return [
                // td style: background var(--primary), white, 700, 9px,
                // uppercase, letter-spacing 0.3 — exactly what H.thU emits.
                H.thU(r.metric == null ? '' : r.metric),
                H.td(r.prev, { fontSize: px(11) }),
                H.td(r.current, { fontSize: px(11) }),
                H.td(r.growth, { fontSize: px(11) }),
            ];
        });

        p2.push({
            table: {
                headerRows: 1,
                widths: t2Widths,
                body: [header1, ...t2Body],
            },
            layout: H.gridLayout({ headerRows: 1 }),   // zebra: pale even body rows
        });

        return [
            { content: p1, footer: 'light' },
            { content: p2, footer: 'light' },
        ];
    },
};
