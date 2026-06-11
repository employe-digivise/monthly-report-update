// Section — "Action Plan & Next Steps" (template_aurora.ejs lines 1011-1062)
// One table: Priority pill / Problem / Solution / PIC / Deadline.
// CSS spec: .action-table + .priority-badge (styles_aurora.css 797-862).
//
// Template fallbacks mirrored:
//   - actionPlan guarded with Array.isArray (missing -> header-only table).
//   - plan.priority.toLowerCase() WOULD throw on a missing priority in the raw
//     template — safe fallback: gray pill with '-' (also used for unknown
//     priority values, per spec).
//   - problem/solution/pic are '-'-defaulted upstream (generator.js), but the
//     cells use H.td() so null/empty still render '-'.

'use strict';

module.exports = {
    build(ctx, H) {
        const data = ctx.data || {};
        // Template guard: typeof actionPlan !== 'undefined' && Array.isArray(actionPlan)
        const plans = Array.isArray(data.actionPlan) ? data.actionPlan : [];

        // -------------------------------------------------------------------
        // Column widths — CSS: 10% / 30% / 35% / 15% / 10%, table-layout fixed,
        // full content width. pdfmake `widths` are CONTENT widths: share out CW
        // minus the 6 vertical grid lines, then subtract each column's padding
        // (gridLayout padX default 8px -> 6pt left + right).
        // -------------------------------------------------------------------
        const COLS = 5;
        const pool = H.PAGE.CW - (COLS + 1) * 0.75;
        const PAD = H.px(8) * 2;
        // CSS shares 10/30/35/15/10 — Solution gives 2% to Deadline so the
        // "DEADLINE" header and the dates stay on one line (same adjustment
        // precedent as topProducts; pdfmake measures wider than Chromium).
        const shares = [0.10, 0.30, 0.33, 0.15, 0.12];
        const widths = shares.map((s) => s * pool - PAD);

        // ---------------------------------------------------------------
        // .priority-badge — rounded pill, 8px/700 uppercase white text,
        // letter-spacing 0.5px, padding 3px 10px, gradient bg by priority.
        // Drawn as SVG (rounded corners + gradient need it).
        // ---------------------------------------------------------------
        const GRADS = {
            high: ['#DC2626', '#EF4444'],
            medium: H.C.accentGrad,            // var(--gradient-accent)
            low: ['#6C2BD9', '#A855F7'],
        };
        const FS = H.px(8);                    // 6pt
        const LS = 0.4;                        // 0.5px letter-spacing ~ 0.4pt
        const PILL_H = 12;
        // Approximate Inter-Bold uppercase advance widths (em) — good enough
        // to size the pill (text-width + ~15pt of CSS padding).
        function estW(s) {
            let w = 0;
            for (const ch of String(s)) {
                if ('MW'.indexOf(ch) >= 0) w += 0.92 * FS;
                else if ('IJ'.indexOf(ch) >= 0) w += 0.36 * FS;
                else if (ch === '-' || ch === ' ') w += 0.42 * FS;
                else w += 0.70 * FS;
            }
            return w + Math.max(0, String(s).length - 1) * LS;
        }
        function priorityBadge(priority) {
            const key = priority != null ? String(priority).toLowerCase() : '';
            const stops = GRADS[key] || null;
            // Missing/unknown priority -> gray pill with '-' (safe fallback;
            // the raw template throws on missing and styles nothing on unknown)
            const label = stops ? String(priority).toUpperCase() : '-';
            const maxW = widths[0];            // keep the pill inside the cell
            const w = Math.min(Math.max(estW(label) + 15, 20), maxW);
            const id = H.gid('pb');
            const fillDef = stops ? `<defs>${H.linGrad(id, stops, 0, 0, w, PILL_H)}</defs>` : '';
            const fill = stops ? `url(#${id})` : H.C.textMuted;
            const svg = `<svg width="${w}" height="${PILL_H}" viewBox="0 0 ${w} ${PILL_H}">`
                + fillDef
                + `<rect width="${w}" height="${PILL_H}" rx="${PILL_H / 2}" fill="${fill}"/>`
                + `<text x="${w / 2}" y="${PILL_H / 2 + FS * 0.36}" text-anchor="middle"`
                + ` font-family="Inter" font-weight="700" font-size="${FS}" fill="#FFFFFF"`
                + ` letter-spacing="${LS}">${H.esc(label)}</text>`
                + `</svg>`;
            return { svg, width: w };
        }

        // ---------------------------------------------------------------
        // Problem cell — template splits on /\s+-\s+/ ; >=3 parts -> intro
        // paragraph (margin-bottom 4px) + disc bullets; else plain text.
        // ---------------------------------------------------------------
        function problemCell(problem) {
            const text = String(problem == null ? '' : problem);
            const parts = text.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);
            if (parts.length >= 3) {
                const intro = parts[0];
                const items = parts.slice(1);
                const stack = [];
                if (intro) stack.push({ text: intro, fontSize: H.px(10), color: H.C.textBody, margin: [0, 0, 0, H.px(4)] });
                stack.push({
                    ul: items.map((it) => ({ text: it, fontSize: H.px(10), color: H.C.textBody, margin: [0, 0, 0, H.px(2)] })),
                    markerColor: H.C.textBody,
                    alignment: 'left',
                });
                return { stack, alignment: 'left' };
            }
            return H.td(text, { alignment: 'left' });
        }

        // ---------------------------------------------------------------
        // Table — header via thU (flat H.C.primary stands in for the CSS
        // gradient header, accepted fallback), zebra grid via gridLayout.
        // Cells are top-aligned (pdfmake default), matching vertical-align:top.
        // ---------------------------------------------------------------
        const headerRow = [
            H.thU('Priority'),
            H.thU('Problem'),
            H.thU('Solution'),
            H.thU('PIC'),
            H.thU('Deadline'),
        ];
        const body = [headerRow];
        plans.forEach((plan) => {
            const p = plan || {};
            body.push([
                priorityBadge(p.priority),                       // left-aligned, like the HTML td
                problemCell(p.problem),
                H.td(p.solution, { alignment: 'left' }),
                H.td(p.pic),                                     // centered
                H.td(p.deadline, { fontSize: H.px(9) }),         // centered, 9px
            ]);
        });
        // Empty actionPlan -> header-only table (verified: pdfmake renders a
        // 1-row table with headerRows:1 without error).

        const content = [
            H.contentHeader('Action Plan & Next Steps'),
            {
                table: { headerRows: 1, widths, body },
                layout: H.gridLayout({ headerRows: 1 }),
            },
        ];

        return [{ content, footer: 'light' }];
    },
};
