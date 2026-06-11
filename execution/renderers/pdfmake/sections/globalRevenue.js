// Section 6 — "Global Revenue" (template_aurora.ejs lines 206-347).
// One content page: header, two KPI gradient boxes (last month revenue / ads
// spent), right-aligned legend, the big bar+line SVG chart (exact EJS math,
// viewBox 0 0 1000 380), and the summary box. Footer: 'light'.
'use strict';

module.exports = {
    build(ctx, H) {
        const data = (ctx && ctx.data) || {};

        // --- data fallbacks: exact mirror of the EJS guards (lines 215-229) ---
        const gr = (data.globalRevenue && typeof data.globalRevenue === 'object') ? data.globalRevenue : null;
        const cd = (gr && gr.chartData && typeof gr.chartData === 'object') ? gr.chartData : {};
        const revenueData = Array.isArray(cd.revenueData) ? cd.revenueData : [];
        const adsData = Array.isArray(cd.adsSpentData) ? cd.adsSpentData : [];
        const chartLabels = Array.isArray(cd.labels) ? cd.labels : [];
        const lastRevenue = revenueData.length > 0 ? (revenueData[revenueData.length - 1] || 0) : 0;
        const lastAds = adsData.length > 0 ? (adsData[adsData.length - 1] || 0) : 0;
        const lastLabel = chartLabels.length > 0 ? (chartLabels[chartLabels.length - 1] || '') : '';

        // numeric coercion for chart math only (template trusts numbers; odd
        // payloads may carry strings — Number()||0 keeps the SVG valid)
        const num = (v) => Number(v) || 0;

        const content = [];
        content.push(H.contentHeader('Global Revenue'));

        // --- KPI boxes: purple Revenue + orange Ads Spent, centered ----------
        const boxW = 165; // CSS flex:1;max-width:220px → ~165pt
        const revLabel = 'Revenue' + (lastLabel ? ' — ' + lastLabel : '');
        const adsLabel = 'Ads Spent' + (lastLabel ? ' — ' + lastLabel : '');
        content.push({
            columns: [
                { width: '*', text: '' },
                H.gradBox(revLabel, H.fmtRpShort(lastRevenue), H.C.purpleGrad, { w: boxW, valSize: H.px(20) }),
                { width: H.px(16), text: '' },
                H.gradBox(adsLabel, H.fmtRpShort(lastAds), H.C.accentGrad, { w: boxW, valSize: H.px(20) }),
                { width: '*', text: '' },
            ],
            margin: [0, 0, 0, H.px(14)],
        });

        // --- Legend (right-aligned): purple rounded square + orange circle ---
        const lFS = H.px(9);                 // 9px Inter
        const lM = H.px(10);                 // 10px markers
        const lGapIn = H.px(5), lGapMid = H.px(20);
        const revTW = 27, adsTW = 34;        // approx text widths @6.75pt Inter
        const legW = lM + lGapIn + revTW + lGapMid + lM + lGapIn + adsTW;
        const legH = lM + 1;
        const lTy = lM / 2 + lFS * 0.36;     // baseline ~ vertical center of marker
        const cx2 = lM + lGapIn + revTW + lGapMid + lM / 2;
        const legendSvg = `<svg width="${legW}" height="${legH}" viewBox="0 0 ${legW} ${legH}">`
            + `<rect x="0" y="0" width="${lM}" height="${lM}" rx="${H.px(3)}" fill="${H.C.primary}"/>`
            + `<text x="${lM + lGapIn}" y="${lTy}" font-family="Inter" font-size="${lFS}" fill="${H.C.textMuted}">Revenue</text>`
            + `<circle cx="${cx2}" cy="${lM / 2}" r="${lM / 2}" fill="${H.C.accent}"/>`
            + `<text x="${cx2 + lM / 2 + lGapIn}" y="${lTy}" font-family="Inter" font-size="${lFS}" fill="${H.C.textMuted}">Ads Spent</text>`
            + `</svg>`;
        content.push({
            columns: [{ width: '*', text: '' }, { svg: legendSvg, width: legW }],
            margin: [0, 0, 0, H.px(8)],
        });

        // --- Chart SVG — exact port of EJS lines 242-322 ----------------------
        const width = 1000, height = 380;
        const padding = { top: 55, right: 30, bottom: 40, left: 75 };
        const chartWidth = width - padding.left - padding.right;   // 895
        const chartHeight = height - padding.top - padding.bottom; // 285
        const maxRevenue = revenueData.length > 0 ? Math.max(...revenueData.map(num)) : 0;
        const maxAds = adsData.length > 0 ? Math.max(...adsData.map(num)) : 0;
        // EJS uses (max || 1): an all-negative series passes the || guard and
        // inverts the scale, drawing bars outside the plot area — clamp the
        // scale to a positive max and pin Y coords inside the plot instead.
        const maxRaw = Math.max(maxRevenue, maxAds);
        const maxValue = (maxRaw > 0 ? maxRaw : 1) * 1.2;
        const n = chartLabels.length;
        const slot = chartWidth / (n || 1);
        const barWidth = n > 0 ? slot * 0.5 : 0;
        const getBarX = (i) => padding.left + (i * slot) + (slot - barWidth) / 2;
        const getY = (v) => {
            const y = height - padding.bottom - (num(v) / maxValue) * chartHeight;
            return Math.min(Math.max(y, padding.top), height - padding.bottom);
        };

        const parts = [];
        parts.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);

        // grid lines + Y axis labels
        for (let i = 0; i <= 5; i++) {
            const y = height - padding.bottom - (i * chartHeight / 5);
            const value = (maxValue / 5) * i;
            parts.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#EDE5FB" stroke-width="1"/>`);
            parts.push(`<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-family="Inter" font-size="11" fill="#8C86A5">${H.esc(H.fmtAxis(value))}</text>`);
        }

        // revenue bars (gradient must be userSpaceOnUse — project rule)
        const barGradId = H.gid('grBar');
        parts.push(`<defs><linearGradient id="${barGradId}" x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}" gradientUnits="userSpaceOnUse">`
            + `<stop offset="0%" stop-color="#A855F7"/><stop offset="100%" stop-color="#6C2BD9"/>`
            + `</linearGradient></defs>`);
        revenueData.forEach((val, i) => {
            const x = getBarX(i);
            const y = getY(val);
            const h = height - padding.bottom - y;
            parts.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="url(#${barGradId})" rx="4" opacity="0.9"/>`);
            parts.push(`<text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-family="Inter" font-size="11" font-weight="700" fill="#6C2BD9">${H.esc(H.fmtFull(val))}</text>`);
        });

        // ads spent line
        if (adsData.length > 0) {
            const pts = adsData.map((val, i) => `${getBarX(i) + barWidth / 2},${getY(val)}`).join(' ');
            parts.push(`<polyline fill="none" stroke="#FF6B2C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>`);
        }
        // ads spent points + labels
        adsData.forEach((val, i) => {
            const x = getBarX(i) + barWidth / 2;
            const y = getY(val);
            parts.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="#FF6B2C" stroke="#fff" stroke-width="2"/>`);
            parts.push(`<text x="${x}" y="${y - 14}" text-anchor="middle" font-family="Inter" font-size="11" font-weight="700" fill="#FF6B2C">${H.esc(H.fmtFull(val))}</text>`);
        });

        // X axis labels
        chartLabels.forEach((label, i) => {
            const x = getBarX(i) + barWidth / 2;
            const y = height - padding.bottom + 20;
            parts.push(`<text x="${x}" y="${y}" text-anchor="middle" font-family="Inter" font-size="11" fill="#8C86A5">${H.esc(label)}</text>`);
        });
        parts.push('</svg>');

        // HTML: 310px container, svg vertically centered (~29px above/below at
        // 100% width), summary pulled up -10px → approximate with pt margins.
        content.push({ svg: parts.join(''), width: H.PAGE.CW, margin: [0, H.px(14), 0, H.px(24)] });

        // --- Summary -----------------------------------------------------------
        content.push(H.summaryBox('Summary', (gr && gr.summary) || ''));

        return [{ content, footer: 'light' }];
    },
};
