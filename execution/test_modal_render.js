/**
 * Converts pre-rendered HTML (from Python/Jinja2) to PDF via Puppeteer.
 * Usage: node execution/test_modal_render.js
 */
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function main() {
    const htmlPath = path.join(__dirname, '..', 'output', 'test_modal_preview.html');
    if (!fs.existsSync(htmlPath)) {
        console.error('HTML file not found. Run python3 execution/test_render_modal.py first.');
        process.exit(1);
    }

    const html = await fs.readFile(htmlPath, 'utf-8');
    console.log('Launching Puppeteer...');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfPath = path.join(__dirname, '..', 'output', `Test_Modal_ELVICTO_${Date.now()}.pdf`);
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });

    await browser.close();
    console.log(`PDF generated: ${pdfPath}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
