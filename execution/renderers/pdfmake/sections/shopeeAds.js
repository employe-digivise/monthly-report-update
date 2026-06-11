// Section — Shopee "Ads Performance" (template_aurora.ejs lines 499-573).
// One content page: header, ads chart (image or dashed placeholder, 280px CSS
// → 210pt), centered 2-item legend, the horizontal metrics table
// (.horizontal-metrics-table, CSS 597-629: pale header w/ 2px primary rule,
// white semibold body, no zebra) and the optional summary box. Footer: 'light'.
'use strict';

module.exports = {
    build(ctx, H) {
        const data = (ctx && ctx.data) || {};
        const CW = H.PAGE.CW;
        const CHART_H = 210; // CSS .chart-placeholder height:280px

        const content = [];
        content.push(H.contentHeader('Ads Performance'));

        // --- Chart area (EJS 505-513) ---------------------------------------
        const chartNode = H.imageNode(data.adsChartUrl, { fit: [CW, CHART_H], alignment: 'center' });
        content.push(chartNode || H.placeholder('[Ads Performance Chart]', CW, CHART_H));

        // --- Legend, centered (EJS 514-523): 8px dots, Inter 10px muted,
        //     6px dot→text gap, 24px between items, margin 16px 0 20px --------
        const dotPt = H.px(8);
        const dot = (color) => ({
            svg: `<svg width="${dotPt}" height="${dotPt}" viewBox="0 0 ${dotPt} ${dotPt}"><circle cx="${dotPt / 2}" cy="${dotPt / 2}" r="${dotPt / 2}" fill="${color}"/></svg>`,
            width: dotPt,
            margin: [0, 1.5, 0, 0], // optical vertical centering vs 7.5pt text
        });
        const legendText = (t) => ({ width: 'auto', text: t, fontSize: H.px(10), color: H.C.textMuted, margin: [H.px(6), 0, 0, 0] });
        content.push({
            columns: [
                { width: '*', text: '' },
                dot(H.C.accent),
                legendText('Penjualan dari Iklan'),
                { width: H.px(24), text: '' },
                dot(H.C.primary),
                legendText('Biaya Iklan'),
                { width: '*', text: '' },
            ],
            margin: [0, H.px(16), 0, H.px(20)],
        });

        // --- Metrics table (EJS 525-548 / CSS .horizontal-metrics-table) ----
        // generator.buildRenderContext guarantees shopeeAdsMetrics exists, but
        // mirror the template's else-branch anyway (colspan-6 "Data tidak
        // tersedia") so a bypassed normalization can never throw.
        const m = (data.shopeeAdsMetrics && typeof data.shopeeAdsMetrics === 'object') ? data.shopeeAdsMetrics : null;

        // template: shopeeAdsMetrics.dilihat?.toLocaleString() || '-' — Node
        // default locale = EN commas. Strings-in-odd-payloads pass through.
        const numFmt = (v) => {
            if (v == null || v === '') return '-';
            const n = Number(v);
            if (!isFinite(n)) return String(v); // String#toLocaleString() ≡ identity
            const s = n.toLocaleString('en-US');
            return s || '-';
        };
        const asIs = (v) => (v ? String(v) : '-'); // template: value || '-'

        const headCell = (t) => ({
            text: String(t).toUpperCase(),
            fillColor: H.C.primaryPale,
            color: H.C.primary,
            bold: true,
            fontSize: H.px(9),
            alignment: 'center',
            characterSpacing: H.px(0.5), // CSS letter-spacing: 0.5px
        });
        const bodyCell = (t, opts = {}) => Object.assign({
            text: t == null || t === '' ? '-' : t,
            font: 'InterSemiBold', // CSS font-weight: 600
            fontSize: H.px(11),
            color: H.C.textDark,
            alignment: 'center',
            fillColor: H.C.white, // explicit white, NO zebra
        }, opts);

        const headerRow = ['Dilihat', 'CTR', 'Klik', 'CPC', 'Penjualan', 'Biaya'].map(headCell);
        const bodyRow = m
            ? [
                bodyCell(numFmt(m.dilihat)),
                bodyCell(asIs(m.ctr)),
                bodyCell(numFmt(m.klik)),
                bodyCell(asIs(m.cpc)),
                bodyCell(asIs(m.penjualan)),
                bodyCell(asIs(m.biaya)),
            ]
            : [bodyCell('Data tidak tersedia', { colSpan: 6, color: H.C.textMuted }), {}, {}, {}, {}, {}];

        // column widths 15/10/15/15/25/20 % of CW. pdfmake widths are CONTENT
        // widths: subtract the 7 × 0.75pt vlines AND each column's horizontal
        // padding (6px left + 6px right) so the outer edge lands exactly on CW.
        const netW = CW - 7 * 0.75 - 6 * (H.px(6) * 2);
        const widths = [0.15, 0.10, 0.15, 0.15, 0.25, 0.20].map((f) => netW * f);

        content.push({
            table: { widths, headerRows: 1, body: [headerRow, bodyRow] },
            layout: {
                // 1.5pt (CSS 2px) primary rule under the header, thin grid elsewhere
                hLineWidth: (i) => (i === 1 ? 1.5 : 0.75),
                hLineColor: (i) => (i === 1 ? H.C.primary : H.C.tableLine),
                vLineWidth: () => 0.75,
                vLineColor: () => H.C.tableLine,
                paddingLeft: () => H.px(6),
                paddingRight: () => H.px(6),
                paddingTop: (i) => (i === 0 ? H.px(10) : H.px(12)),   // th 10px / td 12px
                paddingBottom: (i) => (i === 0 ? H.px(10) : H.px(12)),
            },
        });

        // --- Summary (EJS 551-567): only when truthy, 14px gap above ---------
        if (data.shopeeAdsSummary) {
            const box = H.summaryBox('Summary', data.shopeeAdsSummary);
            box.margin = [0, H.px(14), 0, 0];
            content.push(box);
        }

        return [{ content, footer: 'light' }];
    },
};
