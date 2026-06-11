// Section — CPAS Performance (3 pages, footer 'light' each).
// Source of truth: template_aurora.ejs lines 672-848 (table page + Best
// Campaign NV + Best Campaign RM) and styles_aurora.css .cpas-table (748-795)
// / .best-campaign-* (887-951). The section divider page (EJS 674-688) is
// owned by divider.js — not built here.
//
// Real payloads ship cpas_data with missing period / best_campaigns.nv.images
// etc. Everything is guarded; where the raw EJS would throw (e.g.
// `cpas_data.period[0]` with no period, `best_campaigns.nv.images` with no
// best_campaigns) we fall back to ''/placeholder instead.
'use strict';

module.exports = {
    build(ctx, H) {
        const px = H.px;
        const data = (ctx && ctx.data) || {};
        const cpas = (data.cpas_data && typeof data.cpas_data === 'object') ? data.cpas_data : {};
        const CW = H.PAGE.CW;

        // EJS prints cpas_data.period[0]/[1] directly (throws when absent) —
        // guard with '' fallbacks.
        const period = (Array.isArray(cpas.period) && cpas.period.length >= 2)
            ? cpas.period : ['', ''];

        // generator.buildRenderContext pre-fills these with 5 zero rows when
        // empty, but stay safe for direct callers.
        const aw = Array.isArray(cpas.awareness_nv) ? cpas.awareness_nv : [];
        const cv = Array.isArray(cpas.conversion_rm) ? cpas.conversion_rm : [];

        // template fallback semantics: only null/undefined get the fallback;
        // 0 prints as '0' (stringified so H.td never maps it to '-').
        const valOr = (v, fb) => (v === null || v === undefined) ? fb : String(v);

        // ------------------------------------------------------------------
        // PAGE 1 — "CPAS Performance" big comparison table
        // ------------------------------------------------------------------
        // Column shares per spec: Objective 20 / Metrics 25 / periods 20+20 /
        // Growth 15. vLines are 0 (CSS has no column separators on this
        // table), so the width pool is exactly CW minus each column's padding.
        // CSS cell padding: 8px 6px; metric col padding-left 10px.
        const shares = [0.20, 0.25, 0.20, 0.20, 0.15];
        const widths = shares.map((s, i) => s * CW - (i === 1 ? px(10) + px(6) : px(6) * 2));

        // NOTE on structure: rowSpan is deliberately NOT used in this table.
        // pdfmake 0.3 paints rowSpan fills in per-row segments and draws hLines
        // across span-covered filler cells (their border flags are ignored),
        // which produced a white "strikethrough" through the OBJECTIVE/METRICS
        // header labels and fragmented the deep-purple objective column
        // (verified vs the Chromium baseline). Instead:
        //  - the 2-row header is collapsed into ONE row whose Periode cell
        //    stacks "PERIODE" over the two period values (CSS draws no line
        //    between those rows anyway: thead th { border: none });
        //  - the objective column is one REAL cell per row (same fill, label
        //    on the middle row, border:[false×4] so no hLine crosses it).
        const noBorder = { border: [false, false, false, false] };
        // vertical offset that fakes vertical-align:middle for the single-line
        // header labels next to the two-line stacked Periode cell
        const headShift = (px(9) * 1.2 + px(4)) / 2;

        // One header row: [Objective, Metrics, {PERIODE / p0 | p1}, Growth].
        // CSS uppercases everything in thead; the EJS mid-header repeats the
        // block inside tbody with inline styles (period values NOT uppercased
        // there). upper=true → thead variant.
        const headerRow = (p0, p1, upper) => {
            const periodCell = {
                colSpan: 2,
                fillColor: H.C.primary,
                stack: [
                    H.thU('Periode', Object.assign({ margin: [0, 0, 0, px(4)] }, noBorder)),
                    {
                        columns: [
                            Object.assign(upper ? H.thU(p0) : H.th(p0, { characterSpacing: 0 }), { width: '*' }),
                            Object.assign(upper ? H.thU(p1) : H.th(p1, { characterSpacing: 0 }), { width: '*' }),
                        ],
                    },
                ],
            };
            const side = (t) => H.thU(t, Object.assign({ margin: [0, headShift, 0, 0] }, noBorder));
            return [side('Objective'), side('Metrics'), periodCell, {}, side('Growth (%)')];
        };

        // .objective-col — deep purple, white, 700, 9px uppercase. One cell per
        // row; the group label sits on the middle row (≈ vertical centering of
        // the merged HTML cell).
        const objCell = (label) => Object.assign({
            text: label ? String(label).toUpperCase() : '',
            fillColor: H.C.primaryDeep,
            color: H.C.white,
            bold: true,
            fontSize: px(9),
            alignment: 'center',
            characterSpacing: 0.3,
        }, noBorder);

        const dataRow = (row, i, groupLabel, groupLen) => {
            const r = row || {};
            return [
                objCell(i === Math.floor((groupLen - 1) / 2) ? groupLabel : ''),
                // metric cell: left, font-weight 500 (no Medium TTF — mapped
                // to InterSemiBold), padding-left 10px via layout below
                H.td(r.metric || '-', { alignment: 'left', font: 'InterSemiBold' }),
                H.td(valOr(r.prev, '0')),
                H.td(valOr(r.current, '0')),
                H.td(valOr(r.growth, '0%')),
            ];
        };

        const body = [
            headerRow(period[0], period[1], true),
            ...aw.map((row, i) => dataRow(row, i, 'Awareness (NV)', aw.length)),
            headerRow(valOr(period[0], ''), valOr(period[1], ''), false),
            ...cv.map((row, i) => dataRow(row, i, 'Conversion (RM)', cv.length)),
        ];

        // CSS borders: thead none; tbody td border-bottom 1px var(--border);
        // no vertical separators (.cpas-table is NOT in the TABLE GRID LINES
        // override block). hLines: below every data row only; the objective
        // column is protected by its cells' border:[false×4].
        const awFirst = 1;                            // first awareness row index
        const midIdx = awFirst + aw.length;           // mid-header row index
        const cvFirst = midIdx + 1;                   // first conversion row
        const cvLastLine = cvFirst + cv.length;       // line below last cv row
        const cpasLayout = {
            hLineWidth: (i) => (
                (i > awFirst && i <= midIdx) || (i > cvFirst && i <= cvLastLine)
                    ? 0.75 : 0),
            hLineColor: () => H.C.border,
            vLineWidth: () => 0,
            // zebra: CSS counts tbody children — the HTML mid-header is TWO
            // <tr>s but ours is one row, so conversion rows shift by +1 to
            // keep the original parity.
            fillColor: (rowIndex, node, columnIndex) => {
                if (columnIndex === 0 || rowIndex === 0 || rowIndex === midIdx) return null;
                const tbodyChild = rowIndex < midIdx ? rowIndex : rowIndex + 1;
                return tbodyChild % 2 === 0 ? H.C.primaryPale : null;
            },
            paddingLeft: (i) => px(i === 1 ? 10 : 6),
            paddingRight: () => px(6),
            paddingTop: () => px(8),
            paddingBottom: () => px(8),
        };

        const page1 = [
            H.contentHeader('CPAS Performance'),
            { table: { widths, body, headerRows: 1 }, layout: cpasLayout },
        ];
        if (cpas.summary) {
            // EJS wrapper: padding 14px 24mm 0 (sides = page margin)
            const box = H.summaryBox('Summary', cpas.summary, { loose: true });
            box.margin = [0, px(14), 0, 0];
            page1.push(box);
        }

        // ------------------------------------------------------------------
        // PAGES 2 & 3 — Best Campaign NV / RM
        // ------------------------------------------------------------------
        // EJS reads cpas_data.best_campaigns.nv.images unguarded (throws when
        // best_campaigns/nv missing — real payloads do that). Guard to {}.
        const bcRoot = (cpas.best_campaigns && typeof cpas.best_campaigns === 'object')
            ? cpas.best_campaigns : {};

        // twoLineIdx: header labels known to wrap onto 2 lines at these column
        // widths ('Amount Spend' / 'Total Revenue' — they wrap in the HTML
        // build too). Single-line labels get a half-line top margin to emulate
        // the browser's vertical-align:middle on th.
        const campaignPage = (title, bcRaw, headerLabels, rowCells, twoLineIdx) => {
            const nodes = [H.contentHeader(title)];

            // .best-campaign-image-grid: 2 cols 1fr/1fr, gap 12px,
            // margin-bottom 20px. CSS images are aspect 9/16 contain — two
            // full 9:16 boxes (~225pt wide -> 400pt tall) would overflow the
            // page with the table, so the height budget is capped at 300pt
            // (accepted tradeoff per spec).
            const gap = px(12);
            const colW = (CW - gap) / 2;
            const imgH = 300;
            const imgs = Array.isArray(bcRaw.images) ? bcRaw.images.slice(0, 2) : [];
            const cells = [];
            if (imgs.length > 0) {
                imgs.forEach((src, i) => {
                    const img = H.imageNode(src, { fit: [colW, imgH], alignment: 'center' });
                    // failed download ('' data URI) -> placeholder, not a hole
                    cells.push(img || H.placeholder(`[Image ${i + 1}]`, colW, imgH));
                });
                if (imgs.length < 2) cells.push(H.placeholder('[Image 2]', colW, imgH));
            } else {
                cells.push(H.placeholder('[Image 1]', colW, imgH));
                cells.push(H.placeholder('[Image 2]', colW, imgH));
            }
            nodes.push({
                columns: cells.map((c) => Object.assign({ width: colW }, c)),
                columnGap: gap,
                margin: [0, 0, 0, px(20)],
            });

            // .best-campaign-table: name col 30%, 5 equal cols; header purple
            // 9px bold uppercase padding 10px 6px (no letter-spacing in CSS);
            // body td white bg, border-top 1px var(--border) only.
            const tShares = [0.30, 0.14, 0.14, 0.14, 0.14, 0.14];
            const tWidths = tShares.map((s) => s * CW - px(6) * 2);
            nodes.push({
                table: {
                    widths: tWidths,
                    headerRows: 1,
                    body: [
                        headerLabels.map((t, i) => H.thU(t, {
                            characterSpacing: 0,
                            margin: twoLineIdx.indexOf(i) === -1
                                ? [0, px(9) * 1.2 / 2, 0, 0] : undefined,
                        })),
                        rowCells,
                    ],
                },
                layout: {
                    hLineWidth: (i) => (i === 1 ? 0.75 : 0),
                    hLineColor: () => H.C.border,
                    vLineWidth: () => 0,
                    paddingLeft: () => px(6),
                    paddingRight: () => px(6),
                    paddingTop: () => px(10),
                    paddingBottom: () => px(10),
                },
            });
            return nodes;
        };

        const nv = (bcRoot.nv && typeof bcRoot.nv === 'object') ? bcRoot.nv : {};
        const rm = (bcRoot.rm && typeof bcRoot.rm === 'object') ? bcRoot.rm : {};

        const page2 = campaignPage('Best Campaign NV', nv,
            ['NV Campaign', 'Impresi', 'CTR', 'Amount Spend', 'ATC', 'C/ATC'],
            [
                // name: font-weight 600 -> InterSemiBold; '-' when falsy
                H.td(nv.name || '-', { font: 'InterSemiBold' }),
                H.td(valOr(nv.impression, '-')),   // 0 prints as '0'
                H.td(nv.ctr || '-'),
                H.td(nv.spend || '-'),
                H.td(valOr(nv.atc, '-')),
                H.td(nv.c_atc || '-'),
            ],
            [3]); // 'Amount Spend' wraps

        const page3 = campaignPage('Best Campaign RM', rm,
            ['RM Campaign', 'Frequency', 'Amount Spend', 'Total Revenue', 'QTY', 'ROAS'],
            [
                H.td(rm.name || '-', { font: 'InterSemiBold' }),
                H.td(valOr(rm.frequency, '-')),
                H.td(rm.spend || '-'),
                H.td(rm.revenue || '-'),
                H.td(valOr(rm.qty, '-')),
                H.td(rm.roas || '-'),
            ],
            [2, 3]); // 'Amount Spend' + 'Total Revenue' wrap

        return [
            { content: page1, footer: 'light' },
            { content: page2, footer: 'light' },
            { content: page3, footer: 'light' },
        ];
    },
};
