const { spawn } = require('child_process');

const WEASYPRINT_TIMEOUT = parseInt(process.env.WEASYPRINT_TIMEOUT, 10) || 120000; // 120s max
// Binary: override with WEASYPRINT_BIN. On this dev Mac WeasyPrint lives in the
// anaconda env, so fall back to that path before giving up.
const WEASYPRINT_BIN =
    process.env.WEASYPRINT_BIN ||
    (process.platform === 'darwin' ? '/opt/anaconda3/bin/weasyprint' : 'weasyprint');

/**
 * Build the child env. On macOS, WeasyPrint's native libs (pango/cairo/...) are
 * installed via Homebrew and must be discoverable through DYLD_FALLBACK_LIBRARY_PATH.
 * On Linux the libs sit on the default loader path, so nothing extra is needed.
 */
function childEnv() {
    const env = { ...process.env };
    if (process.platform === 'darwin') {
        const brewLib = process.env.WEASYPRINT_DYLD || '/opt/homebrew/lib';
        env.DYLD_FALLBACK_LIBRARY_PATH = env.DYLD_FALLBACK_LIBRARY_PATH
            ? `${brewLib}:${env.DYLD_FALLBACK_LIBRARY_PATH}`
            : brewLib;
    }
    return env;
}

/**
 * WeasyPrint renderer. Consumes the same fully-static HTML string as puppeteer
 * (fonts + images are already base64-inlined, CSS is inlined in a <style> tag),
 * so WeasyPrint needs no base-url / filesystem access. HTML is piped via stdin
 * and the PDF is written directly to `outputPath` (`weasyprint - <output>`).
 *
 * @param {object} ctx        render context from buildRenderContext()
 * @param {string} outputPath where to write the PDF
 * @returns {Promise<{pdfPath: string, warnings: string[]}>}
 */
async function render(ctx, outputPath) {
    await new Promise((resolve, reject) => {
        const proc = spawn(WEASYPRINT_BIN, ['-', outputPath], { env: childEnv() });

        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error(`weasyprint timed out after ${WEASYPRINT_TIMEOUT}ms`));
        }, WEASYPRINT_TIMEOUT);

        proc.on('error', (err) => {
            clearTimeout(timer);
            if (err.code === 'ENOENT') {
                return reject(new Error(
                    `weasyprint binary not found ("${WEASYPRINT_BIN}"). Set WEASYPRINT_BIN to its path.`
                ));
            }
            reject(err);
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            // WeasyPrint prints harmless GLib-GObject warnings to stderr on macOS;
            // only a non-zero exit code is a real failure.
            if (code === 0) return resolve();
            reject(new Error(`weasyprint exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
        });

        proc.stdin.on('error', () => { /* ignore EPIPE if the process dies early */ });
        proc.stdin.write(ctx.html);
        proc.stdin.end();
    });

    console.log(`PDF Generated Successfully (weasyprint): ${outputPath}`);
    return { pdfPath: outputPath, warnings: ctx.warnings || [] };
}

module.exports = { name: 'weasyprint', consumes: 'html', render };
