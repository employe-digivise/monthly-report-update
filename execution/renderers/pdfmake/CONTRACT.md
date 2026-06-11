# Section module contract — pdfmake native renderer

Every file in `sections/` exports:

```js
module.exports = {
  // Returns an array of PageSpec. ctx = { data, charts, warnings }.
  // H = require('../theme'). opts only used by divider.js.
  build(ctx, H, opts) { return [ { content: [/* pdfmake nodes */], footer: 'light' } ]; }
};
```

`PageSpec = { content: Node[], footer: 'light' | 'dark' | 'cover' }`
One PageSpec = exactly one A4 page. The assembler (`index.js`) adds the page
footer (brand | month + page number + gradient line) and page breaks — **never
add footers or pageBreak yourself**. `footer: 'dark'` = white footer text
(full-bleed dark pages), `'light'` = content pages.

## Source of truth

Rebuild your assigned page(s) from `execution/templates/template_aurora.ejs`
(layout + data logic, including every `typeof x !== 'undefined'` fallback) and
`execution/templates/styles_aurora.css` (visual spec). Fidelity to those files
is the acceptance criterion. `ctx.data` is the payload **after**
`buildRenderContext()` preprocessing (see `execution/generator.js`) — images
are already base64 data URIs (or `''` on failure), numbers may still be
strings in odd payloads, optional objects may be `null`/missing. Never throw
on missing data; mirror the template's fallbacks.

## Geometry & units

- Page: A4. Content area width `H.PAGE.CW` (~459pt) between side margins
  `H.PAGE.MX` (24mm). Top margin `H.PAGE.MT`=36, bottom `H.PAGE.MB`=64.
- Convert CSS px → pt with `H.px(n)` (×0.75). 1mm = `H.mm(1)`.
- Your page content MUST fit one page (HTML clips overflow; pdfmake would
  spill to a new page and break numbering). Respect the template's row caps.

## pdfmake rules (v0.3, server)

- No HTML/CSS. No CSS gradients on table cells — flat `fillColor` is the
  accepted fallback (header cells: `H.C.primary`).
- Gradients/rounded/decorative shapes: inline SVG via `{ svg, width }` nodes.
  svg-to-pdfkit supports `<linearGradient>`/`<radialGradient>` **only with
  `gradientUnits="userSpaceOnUse"`** (project rule). No `<style>` blocks, no
  CSS classes, no `filter:` — set presentation attributes per element.
- SVG `<text>` MUST set `font-family` to one of the registered families:
  `Inter`, `InterSemiBold`, `InterBlack`, `Montserrat`, `MontserratSemiBold`,
  `MontserratBlack`. CSS weight map: 400→base, 600→SemiBold, 700→base +
  `bold:true` (or `font-weight="700"` in SVG), 800/900→Black.
  Escape all dynamic text with `H.esc()`.
- Text nodes: `{ text, font, fontSize, bold, color, alignment, margin,
  lineHeight, characterSpacing, opacity }`.
- Tables: `{ table: { widths, body, headerRows }, layout }`. Use
  `H.gridLayout({headerRows})` for the standard #B7A4DA grid + zebra
  (pale even rows). `rowSpan`/`colSpan` need literal `{}` filler cells.
  Header cells via `H.thU('text')`, body via `H.td(value)` (handles `'-'`
  fallback). Cell-level `fillColor` overrides the layout zebra.
  **GOTCHA: `widths` are CONTENT widths** — layout paddings and the 0.75pt
  grid lines are added on top. Columns sized as fractions of `H.PAGE.CW`
  overflow the right margin; subtract `(nCols+1)*0.75` line width plus each
  column's `paddingLeft+paddingRight` from `H.PAGE.CW` before splitting.
- Images: `H.imageNode(dataUri, { width, height / fit: [w,h] })` → node or
  `null` (then render `H.placeholder(label, w, h)` when the template shows a
  placeholder). All data URIs are already PNG/JPEG (index.js normalizes).
  To center a fixed-width node use `columns: [{width:'*',text:''}, node,
  {width:'*',text:''}]` or `alignment:'center'` on image/svg nodes.
- Full-bleed pages (cover/dividers): draw everything in ONE page-sized SVG via
  `H.fullPageSvg(svgString)` (it absolute-positions at 0,0). Raster images
  (logo) go on top as separate nodes with `absolutePosition`.
- Radial-glow blobs (`.aurora-decoration`, cover ::before/::after): emulate
  with `<radialGradient>` (userSpaceOnUse) stops color→transparent. Subtle —
  skip if risky; cover blobs may be approximated.

## Shared helpers (use them — do not reinvent)

`H.contentHeader(title)` page heading + orange underline ·
`H.summaryBox(title, textOrPoints, {loose})` pale box w/ bullet auto-split ·
`H.gradBox(label, value, stops, {w, valSize})` gradient KPI box (purple:
`H.C.purpleGrad`, orange: `H.C.accentGrad`) · `H.placeholder(label,w,h)` ·
`H.linGrad(id, stops, x1,y1,x2,y2)` + unique ids via `H.gid('prefix')` ·
formatters `H.idN` (id-ID thousands), `H.fmtRpShort`, `H.fmtAxis`,
`H.fmtFull`, splitters `H.splitPoints`, `H.splitPointsLoose`.
Colors: `H.C.*` (see theme.js — exact CSS variable values).
Donut SVGs are prebuilt: `ctx.charts.shopeeDonutSvg` / `tiktokDonutSvg` —
embed with `{ svg: ctx.charts.shopeeDonutSvg }` (already font-pinned).

## Self-test (mandatory before you finish)

```bash
cd "/Users/savira/Downloads/monthly-report-update 2"
node execution/renderers/pdfmake/_section_test.js <yourSectionName>
```

It renders ONLY your section against `execution/sample_data.json` into
`/tmp/pdfmake_section_<name>.pdf` and must exit 0. Then visually check your
output: `python3 -c "import fitz, sys; d=fitz.open('/tmp/pdfmake_section_<name>.pdf'); [p.get_pixmap(dpi=110).save(f'/tmp/sec_<name>_{i}.png') for i,p in enumerate(d)]"`
and Read the PNG(s). Compare against the EJS/CSS spec, fix, repeat.
