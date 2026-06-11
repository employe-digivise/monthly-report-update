// Section — Shopee "Top Products" (template_aurora.ejs lines 575-667)
// Page 1: items 1-5. Page 2 ("Top Products (Lanjutan)"): items 6-10, only
// when topProducts.length > 5. Template loops i < Math.min(len, 5|10) — we
// render exactly the existing items, never padding with empty rows.
// CSS spec: .action-table (797-862) + .product-photo-* (864-881).

'use strict';

module.exports = {
    build(ctx, H) {
        const data = ctx.data || {};
        // Template guard: typeof topProducts !== 'undefined' && Array.isArray(topProducts)
        const top = (data && Array.isArray(data.topProducts)) ? data.topProducts : [];

        // -------------------------------------------------------------------
        // Column widths — CSS: 5% / 40% / 15% / 10% / 10% / 20%, table-layout
        // fixed, full content width. pdfmake `widths` are CONTENT widths, so
        // share out CW minus the 7 vertical grid lines, then subtract each
        // column's padding (gridLayout padX default 8px → 6pt left + right).
        // -------------------------------------------------------------------
        const COLS = 6;
        const pool = H.PAGE.CW - (COLS + 1) * 0.75;
        const PAD = H.px(8) * 2;
        // CSS shares 5/40/15/10/10/20 — Foto gives 1% to Proporsi so the
        // "PROPORSI" header stays on one line as it does in the HTML render
        // (pdfmake measures it a hair wider than Chromium).
        const shares = [0.05, 0.40, 0.14, 0.11, 0.10, 0.20];
        const widths = shares.map((s) => s * pool - PAD);

        // .action-table .table-header th — gradient bg (flat H.C.primary is the
        // accepted fallback, applied by thU), 9px / 700 / uppercase / centered.
        // "Produk" header is text-align:left per the template's inline style.
        const headerRow = () => [
            H.thU('No'),
            H.thU('Produk', { alignment: 'left' }),
            H.thU('Foto'),
            H.thU('Proporsi'),
            H.thU('QTY'),
            H.thU('Penjualan'),
        ];

        // -------------------------------------------------------------------
        // Body row. Template fallbacks: every cell renders '-' when product is
        // falsy. product.qty.toLocaleString() WOULD throw on missing qty in the
        // raw template — safe fallback Number(qty||0) instead (per spec).
        // -------------------------------------------------------------------
        const row = (product, i) => {
            const p = product || null;

            // No — inline style: font-weight:800 (→ InterBlack) color primary, centered
            const no = { text: String(i + 1), font: 'InterBlack', fontSize: H.px(10), color: H.C.primary, alignment: 'center' };

            // Produk — 10px, left, wraps freely (word-wrap: break-word)
            const name = H.td(p && p.name != null && p.name !== '' ? String(p.name) : '-', { alignment: 'left' });

            // Foto — .product-photo-cell (centered, ~50px tall) with
            // .product-photo-img max 45px (≈34pt). Rounded corners / 1px image
            // border are accepted tradeoffs. Muted 9px '-' when no image.
            let foto = (p && p.image) ? H.imageNode(p.image, { fit: [34, 34], alignment: 'center' }) : null;
            if (!foto) foto = { text: '-', fontSize: H.px(9), color: H.C.textMuted, alignment: 'center' };

            // Proporsi — string as-is, 600 weight (→ InterSemiBold), centered
            const prop = H.td(p ? p.soldPercent : '-', { font: 'InterSemiBold' });

            // QTY — centered, thousands-formatted
            const qty = H.td(p ? Number(p.qty || 0).toLocaleString() : '-');

            // Penjualan — 'Rp X.XM', 700 (bold) color primary, centered
            const rev = p
                ? H.td('Rp ' + ((Number(p.revenue) || 0) / 1000000).toFixed(1) + 'M', { bold: true, color: H.C.primary })
                : H.td('-');

            return [no, name, foto, prop, qty, rev];
        };

        const tableNode = (from, to) => {
            const body = [headerRow()];
            for (let i = from; i < Math.min(top.length, to); i++) body.push(row(top[i], i));
            return {
                table: { headerRows: 1, widths, body },
                layout: H.gridLayout({ headerRows: 1, padY: 7 }),
            };
        };

        // Page 1 — always rendered (items 0-4; empty table if no products)
        const pages = [{
            content: [
                H.contentHeader('Top Products'),
                tableNode(0, 5),
            ],
            footer: 'light',
        }];

        // Page 2 — only when more than 5 products (items 5-9)
        if (top.length > 5) {
            pages.push({
                content: [
                    H.contentHeader('Top Products (Lanjutan)'),
                    tableNode(5, 10),
                ],
                footer: 'light',
            });
        }

        return pages;
    },
};
