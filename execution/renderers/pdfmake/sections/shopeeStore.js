// Section — Shopee "Store Performance" (template_aurora.ejs lines 441-497).
// One content page, everything horizontally centered:
//   purple Total Revenue gradient box → buyers donut (prebuilt SVG) →
//   2-col mini summary table (Ad Sales / Existing) → titleless notes box.
// CSS refs: .revenue-accent-box (565-595), .mini-summary-table (631-660),
// .summary-box (383-416). Footer: 'light'.
'use strict';

// Local copy of generator.js toNum — payloads may carry numbers as strings
// ("Rp 1.000.000", "261488920"); template math would NaN on those.
function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v).trim().replace(/Rp/gi, '').replace(/\s/g, '').replace(/,/g, '');
    if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

module.exports = {
    build(ctx, H) {
        const data = (ctx && ctx.data) || {};

        // --- data fallbacks: mirror of EJS lines 449-460 ---------------------
        const sp = (data.storePerformance && typeof data.storePerformance === 'object')
            ? data.storePerformance
            : { newBuyers: 0, oldBuyers: 0, adSalesRevenue: 0, existingRevenue: 0, totalRevenue: 0, notes: '' };
        const totalRev = toNum(sp.totalRevenue);
        const adSalesRev = toNum(sp.adSalesRevenue);   // sample payloads often omit → Rp0.0M
        const existingRev = toNum(sp.existingRevenue);

        const content = [];
        content.push(H.contentHeader('Store Performance'));

        // Vertical centering (.page justify-content:center) is handled
        // globally by the assembler's two-pass spacer — no local spacer here.

        // --- Total Revenue KPI (.revenue-accent-box, purple gradient) --------
        // Template: "Rp <x.x> M" with spaces; falsy totalRevenue renders "Rp 0 M".
        const totalRevStr = 'Rp ' + (totalRev ? (totalRev / 1000000).toFixed(1) : '0') + ' M';
        const kpi = H.gradBox('Total Revenue', totalRevStr, H.C.purpleGrad);
        kpi.alignment = 'center';
        kpi.margin = [0, 0, 0, H.px(20)];              // flex gap:20px
        content.push(kpi);

        // --- Donut chart (prebuilt, font-pinned) ------------------------------
        // Intrinsic SVG width is 240 (CSS px in HTML) → 180pt for 1:1 fidelity.
        // Wrapper has margin:20px 0 on top of the flex gap → 15pt extra each side.
        if (ctx.charts && ctx.charts.shopeeDonutSvg) {
            content.push({
                svg: ctx.charts.shopeeDonutSvg,
                width: H.px(240),
                alignment: 'center',
                margin: [0, H.px(20), 0, H.px(20)],
            });
        }

        // --- Ad Sales vs Existing mini table (70% of CW, 2 equal cols) -------
        // CSS .mini-summary-table: header gradient (flat H.C.primary fallback),
        // 10px bold NOT uppercase; body 13px bold text-dark on white.
        const tw = H.PAGE.CW * 0.7;
        const miniTable = {
            width: tw,
            table: {
                widths: ['*', '*'],
                headerRows: 1,
                body: [
                    [
                        H.th('Ad Sales', { fontSize: H.px(10), characterSpacing: 0 }),
                        H.th('Existing', { fontSize: H.px(10), characterSpacing: 0 }),
                    ],
                    [
                        H.td('Rp' + (adSalesRev / 1000000).toFixed(1) + 'M', { fontSize: H.px(13), bold: true, color: H.C.textDark }),
                        H.td('Rp' + (existingRev / 1000000).toFixed(1) + 'M', { fontSize: H.px(13), bold: true, color: H.C.textDark }),
                    ],
                ],
            },
            layout: H.gridLayout({ headerRows: 1, zebra: false, padX: 20, padY: 11 }),
        };
        content.push({
            columns: [{ width: '*', text: '' }, miniTable, { width: '*', text: '' }],
            margin: [0, H.px(20), 0, H.px(20)],        // flex gap above + below
        });

        // --- Notes (.summary-box WITHOUT title, 85% of CW, centered) ---------
        // Template EJS 476-489: no title line — built locally because
        // H.summaryBox('') would still emit an empty title row + its margin.
        const notes = sp.notes || 'Dapat dilihat bahwa kontribusi omset terbanyak datang dari penjualan iklan.';
        const points = H.splitPoints(notes);
        let notesBody;
        if (points.length > 1) {
            notesBody = {
                ul: points.map((p) => ({ text: p, fontSize: H.px(10), color: H.C.textBody, lineHeight: 1.5 })),
                markerColor: H.C.textBody,
            };
        } else {
            notesBody = {
                text: points[0] != null ? points[0] : String(notes),
                fontSize: H.px(11), color: H.C.textBody, lineHeight: 1.5,
            };
        }
        const notesBox = {
            width: H.PAGE.CW * 0.85,
            table: {
                widths: ['*'],
                body: [[{
                    stack: [notesBody],
                    fillColor: H.C.primaryPale,
                    margin: [H.px(14), H.px(12), H.px(14), H.px(12)],
                }]],
            },
            layout: {
                hLineWidth: () => 0,
                vLineWidth: (i) => (i === 0 ? 3 : 0),
                vLineColor: () => H.C.primary,
                paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
            },
        };
        content.push({ columns: [{ width: '*', text: '' }, notesBox, { width: '*', text: '' }] });

        return [{ content, footer: 'light' }];
    },
};
