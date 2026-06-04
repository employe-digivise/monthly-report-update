const puppeteer = require('puppeteer');

const PUPPETEER_TIMEOUT = parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 120000; // 120s max

/**
 * Puppeteer renderer (baseline). Consumes the fully-static HTML string and
 * prints it to an A4 PDF via headless Chromium. This is the exact behavior the
 * project shipped before the renderer abstraction was introduced.
 *
 * @param {object} ctx        render context from buildRenderContext()
 * @param {string} outputPath where to write the PDF
 * @returns {Promise<{pdfPath: string, warnings: string[]}>}
 */
async function render(ctx, outputPath) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            executablePath: process.env.CHROME_PATH || undefined,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            timeout: PUPPETEER_TIMEOUT
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(PUPPETEER_TIMEOUT);
        page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT);

        await page.setContent(ctx.html, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT });

        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            timeout: PUPPETEER_TIMEOUT,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
        });

        console.log(`PDF Generated Successfully (puppeteer): ${outputPath}`);
        return { pdfPath: outputPath, warnings: ctx.warnings || [] };
    } catch (error) {
        console.error('Error in puppeteer render:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close().catch(err => console.error('Browser close error:', err.message));
        }
    }
}

module.exports = { name: 'puppeteer', consumes: 'html', render };
