const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { URL } = require('url');
const { enrichInsightsWithAI } = require('./insight_ai');

/**
 * Coerce arbitrary chart values (string, null, "", "Rp 1.000.000") to number safely.
 * Drafts saved by the frontend frequently send numeric fields as strings, which
 * silently breaks the `value > 0` filter and downstream math.
 */
function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v).trim().replace(/Rp/gi, '').replace(/\s/g, '').replace(/,/g, '');
    // Heuristic: multiple dots = ID-style thousand separators ("1.000.000")
    if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

// Template configurations
const TEMPLATE_CONFIG = {
    default: {
        css: 'styles_atria.css',
        ejs: 'template_atria.ejs',
        colors: {
            primary: '#002B5B',
            accent: '#F59E0B',
            tertiary: '#10B981',
            centerText: '#002B5B'
        }
    },
    corporate: {
        css: 'styles_corporate.css',
        ejs: 'template_corporate.ejs',
        colors: {
            primary: '#6B21A8',
            accent: '#EA580C',
            tertiary: '#7C3AED',
            centerText: '#6B21A8'
        }
    },
    dashboard: {
        css: 'styles_dashboard.css',
        ejs: 'template_dashboard.ejs',
        colors: {
            primary: '#002B5B',
            accent: '#F59E0B',
            tertiary: '#10B981',
            centerText: '#002B5B'
        }
    },
    aurora: {
        css: 'styles_aurora.css',
        ejs: 'template_aurora.ejs',
        colors: {
            primary: '#6C2BD9',
            accent: '#FF6B2C',
            tertiary: '#A855F7',
            centerText: '#6C2BD9'
        }
    }
};

// Concurrency control: max 3 simultaneous PDF generations
const MAX_CONCURRENT = 3;
let activeGenerations = 0;
const queue = [];

function acquireSlot() {
    return new Promise((resolve) => {
        if (activeGenerations < MAX_CONCURRENT) {
            activeGenerations++;
            resolve();
        } else {
            queue.push(resolve);
        }
    });
}

function releaseSlot() {
    activeGenerations--;
    if (queue.length > 0) {
        activeGenerations++;
        const next = queue.shift();
        next();
    }
}

/**
 * SSRF protection: block internal/private IPs
 */
function isUrlSafe(urlString) {
    try {
        const parsed = new URL(urlString);
        const hostname = parsed.hostname;
        // Block private/internal hostnames
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return false;
        // Block metadata endpoints (cloud providers)
        if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') return false;
        // Block private IP ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
        const parts = hostname.split('.');
        if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
            const [a, b] = parts.map(Number);
            if (a === 10) return false;
            if (a === 172 && b >= 16 && b <= 31) return false;
            if (a === 192 && b === 168) return false;
        }
        // Only allow http/https protocols
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * Convert image (local or URL) to Base64 with retry mechanism
 * @param {string} filePath - Local path or HTTP/HTTPS URL
 * @param {number} retries - Number of retry attempts
 * @returns {string} base64 string or empty string on failure
 */
// Shared warnings collector for current generation
let _currentWarnings = [];

async function imageToBase64(filePath, retries = 3) {
    try {
        // Handle HTTP/HTTPS URLs
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            if (!isUrlSafe(filePath)) {
                console.warn(`Blocked unsafe URL: ${filePath}`);
                _currentWarnings.push(`Blocked unsafe URL: ${filePath}`);
                return '';
            }
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const response = await axios.get(filePath, {
                        responseType: 'arraybuffer',
                        timeout: 15000,
                        maxRedirects: 5,
                        validateStatus: (status) => status < 400,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Cache-Control': 'no-cache',
                            'Referer': filePath.includes('shopee') ? 'https://shopee.co.id/' :
                                filePath.includes('supabase') ? 'https://supabase.com/' :
                                    'https://www.google.com/'
                        },
                        httpsAgent: new (require('https').Agent)({
                            rejectUnauthorized: true
                        })
                    });

                    const contentType = response.headers['content-type'] || 'image/jpeg';
                    const base64 = Buffer.from(response.data, 'binary').toString('base64');
                    return `data:${contentType};base64,${base64}`;
                } catch (error) {
                    if (attempt === retries) {
                        console.warn(`File not found (after ${retries} attempts): ${filePath} - ${error.message}`);
                        _currentWarnings.push(`Failed to download image: ${filePath}`);
                        return '';
                    }
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        // Handle local files
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            _currentWarnings.push(`Local file not found: ${filePath}`);
            return '';
        }
        const bitmap = await fs.readFile(filePath);
        let extension = path.extname(filePath).replace('.', '') || 'png';
        if (extension === 'svg') extension = 'svg+xml';
        return `data:image/${extension};base64,${bitmap.toString('base64')}`;
    } catch (error) {
        console.error(`Error converting image ${filePath}:`, error.message);
        _currentWarnings.push(`Error processing image: ${filePath}`);
        return '';
    }
}

/**
 * Read a local font file and return a base64 data URI string
 * @param {string} filePath - Absolute path to the woff2 font file
 * @returns {string} base64 data URI
 */
async function fontToBase64(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`Font not found: ${filePath}`);
            return null;
        }
        const buffer = await fs.readFile(filePath);
        return `data:font/woff2;base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error(`Error reading font ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Build an SVG donut chart string (2 or 3 segments)
 * @param {Array} segments - [{pct, color, label}]
 * @param {Object} opts - {cx, cy, r, rout, width, height, centerLabel, centerValue}
 * @returns {string} complete SVG HTML string
 */
function buildDonutChartSVG(segments, opts) {
    const cx = opts.cx || 130, cy = opts.cy || 130;
    const r = opts.r || 80, rout = opts.rout || 105;
    const w = opts.width || 260, h = opts.height || 260;

    // Clamp percentages to 0-100 and normalize so total = 100
    segments = segments.map(seg => ({ ...seg, pct: Math.max(0, Math.min(100, seg.pct || 0)) }));
    const rawTotal = segments.reduce((s, seg) => s + seg.pct, 0);
    if (rawTotal > 0 && rawTotal !== 100) {
        segments = segments.map(seg => ({ ...seg, pct: (seg.pct / rawTotal) * 100 }));
    }
    const total = 100;

    const toRad = (deg) => (deg - 90) * Math.PI / 180;
    const px = (a, radius) => cx + radius * Math.cos(toRad(a));
    const py = (a, radius) => cy + radius * Math.sin(toRad(a));
    const arcPath = (sP, eP) => {
        const sa = (sP / total) * 360, ea = Math.min((eP / total) * 360, 359.99);
        const lg = (ea - sa) > 180 ? 1 : 0;
        return `M ${px(sa, rout).toFixed(2)} ${py(sa, rout).toFixed(2)} A ${rout} ${rout} 0 ${lg} 1 ${px(ea, rout).toFixed(2)} ${py(ea, rout).toFixed(2)} L ${px(ea, r).toFixed(2)} ${py(ea, r).toFixed(2)} A ${r} ${r} 0 ${lg} 0 ${px(sa, r).toFixed(2)} ${py(sa, r).toFixed(2)} Z`;
    };
    const midAng = (sP, eP) => ((sP / total) * 360 + (eP / total) * 360) / 2;

    let parts = [];
    let acc = 0;
    const displaySegments = segments.filter(seg => seg.pct > 0);

    // If only 1 segment, render as full circle instead of arc
    if (displaySegments.length === 1) {
        const seg = displaySegments[0];
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${rout}" fill="${seg.color}" />`);
        const lx = cx, ly1 = cy - rout - 18, ly2 = ly1 + 14;
        parts.push(`<text x="${lx}" y="${ly1}" text-anchor="middle" font-size="8" font-weight="700" fill="${seg.color}">${seg.label}</text>`);
        parts.push(`<text x="${lx}" y="${ly2}" text-anchor="middle" font-size="9" font-weight="900" fill="${seg.color}">${(opts.originalPcts && opts.originalPcts[seg.label] !== undefined ? opts.originalPcts[seg.label] : seg.pct).toFixed(1)}%</text>`);
    } else {
        segments.forEach(seg => {
            if (seg.pct > 0) {
                const s = acc, e = acc + seg.pct, mid = midAng(s, e);
                parts.push(`<path d="${arcPath(s, e)}" fill="${seg.color}" />`);
                const lx = px(mid, rout + 24).toFixed(1), ly1 = (py(mid, rout + 24) - 5).toFixed(1), ly2 = (py(mid, rout + 24) + 9).toFixed(1);
                parts.push(`<text x="${lx}" y="${ly1}" text-anchor="middle" font-size="8" font-weight="700" fill="${seg.color}">${seg.label}</text>`);
                parts.push(`<text x="${lx}" y="${ly2}" text-anchor="middle" font-size="9" font-weight="900" fill="${seg.color}">${(opts.originalPcts && opts.originalPcts[seg.label] !== undefined ? opts.originalPcts[seg.label] : seg.pct).toFixed(1)}%</text>`);
            }
            acc += seg.pct;
        });
    }

    // Center hole
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" />`);
    if (opts.centerLabel && !opts.hideCenterLabel) {
        parts.push(`<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="10" font-weight="600" fill="#6b7280">${opts.centerLabel}</text>`);
    }
    if (opts.centerValue !== undefined && !opts.hideCenterLabel) {
        parts.push(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="16" font-weight="900" fill="${opts.centerColor || '#002B5B'}">${opts.centerValue}</text>`);
    }

    return `<svg viewBox="0 0 ${w} ${h}" width="${opts.displayWidth || 210}" height="${opts.displayHeight || 210}">${parts.join('')}</svg>`;
}

const PUPPETEER_TIMEOUT = 120000; // 120s max for entire PDF generation

async function generatePDF(data) {
    await acquireSlot();
    _currentWarnings = []; // Reset warnings for this generation

    // Resolve template configuration
    const templateKey = (data.template && TEMPLATE_CONFIG[data.template]) ? data.template : 'aurora';
    const templateConfig = TEMPLATE_CONFIG[templateKey];
    console.log(`Using template: ${templateKey}`);
    let browser = null;
    try {
        console.log(`Starting PDF generation... (active: ${activeGenerations}/${MAX_CONCURRENT})`);

        // 1. DATA SLICING & SAFETY CHECKS
        if (!data.topProducts || !Array.isArray(data.topProducts)) {
            data.topProducts = [];
        }

        // TikTok Safety Check
        if (data.enabledChannels && data.enabledChannels.tiktok && !data.tiktok_data) {
            console.warn('TikTok enabled but no data provided. initializing empty structure.');
            data.tiktok_data = { store_performance: { composition: { video: { percentage: 0 }, live_streaming: { percentage: 0 }, product_card: { percentage: 0 } }, summary: [] }, gmv_max_performance: { metrics: [], period: [] } };
        }

        // Tokopedia Safety Check
        if (data.enabledChannels && data.enabledChannels.tokopedia && !data.tokopedia_data) {
            console.warn('Tokopedia enabled but no data provided. initializing empty structure.');
            data.tokopedia_data = { total_revenue: 0, ads_performance: { metrics: [], period: [] } };
        }

        // shopeeAdsMetrics Safety Check
        if (!data.shopeeAdsMetrics) {
            data.shopeeAdsMetrics = {
                dilihat: 0,
                ctr: '-',
                klik: 0,
                cpc: '-',
                penjualan: '-',
                biaya: '-'
            };
        }

        // shopeeAdsSummary Safety Check (fallback to empty string, NOT hardcoded text)
        if (typeof data.shopeeAdsSummary === 'undefined' || data.shopeeAdsSummary === null) {
            data.shopeeAdsSummary = '';
        }

        // globalPerformanceDetail Safety Check
        if (data.globalPerformanceDetail) {
            if (data.globalPerformanceDetail.comparisonData) {
                data.globalPerformanceDetail.comparisonData = data.globalPerformanceDetail.comparisonData.map(row => ({
                    ...row,
                    channels: row.channels || {}
                }));
            }

            // Map summary to aiConclusion if aiConclusion is missing/empty
            if (!data.globalPerformanceDetail.aiConclusion || (Array.isArray(data.globalPerformanceDetail.aiConclusion) && data.globalPerformanceDetail.aiConclusion.length === 0)) {
                if (data.globalPerformanceDetail.summary) {
                    if (Array.isArray(data.globalPerformanceDetail.summary)) {
                        data.globalPerformanceDetail.aiConclusion = data.globalPerformanceDetail.summary;
                    } else {
                        data.globalPerformanceDetail.aiConclusion = [data.globalPerformanceDetail.summary];
                    }
                } else {
                    data.globalPerformanceDetail.aiConclusion = [];
                }
            }

            // Ensure array
            if (!Array.isArray(data.globalPerformanceDetail.aiConclusion)) {
                data.globalPerformanceDetail.aiConclusion = [String(data.globalPerformanceDetail.aiConclusion)];
            }
        }

        // Auto-fill empty insight slots with Claude. Slots that already have
        // user content (non-placeholder) are left untouched. Failures per slot
        // are logged but do not abort the render.
        try {
            await enrichInsightsWithAI(data);
        } catch (err) {
            console.warn('[insight-ai] enrichment crashed, continuing with original data:', err.message);
        }

        // DEBUG: Log chart data as received from request
        if (data.globalRevenue && data.globalRevenue.chartData) {
            console.log('[CHART DEBUG] Raw chartData received:');
            console.log('[CHART DEBUG] labels:', JSON.stringify(data.globalRevenue.chartData.labels));
            console.log('[CHART DEBUG] revenueData:', JSON.stringify(data.globalRevenue.chartData.revenueData));
            console.log('[CHART DEBUG] adsSpentData:', JSON.stringify(data.globalRevenue.chartData.adsSpentData));
        }

        // Drop pre-2026 entries — all brands start tracking from January 2026.
        // Handles label formats like "Jan 25", "January 2025", "Jan 26", etc.
        if (data.globalRevenue && data.globalRevenue.chartData) {
            const _cd = data.globalRevenue.chartData;
            if (Array.isArray(_cd.labels) && Array.isArray(_cd.revenueData) && Array.isArray(_cd.adsSpentData)) {
                const _yearOf = (label) => {
                    const m = String(label).match(/(\d{2,4})\s*$/);
                    if (!m) return null;
                    const n = parseInt(m[1], 10);
                    return n < 100 ? 2000 + n : n;
                };
                const _keep = _cd.labels
                    .map((l, i) => ({ y: _yearOf(l), i }))
                    .filter(({ y }) => y === null || y >= 2026)
                    .map(({ i }) => i);
                if (_keep.length && _keep.length < _cd.labels.length) {
                    _cd.labels = _keep.map(i => _cd.labels[i]);
                    _cd.revenueData = _keep.map(i => _cd.revenueData[i]);
                    _cd.adsSpentData = _keep.map(i => _cd.adsSpentData[i]);
                }
            }
        }

        // Global Revenue Chart Data Filtering: Remove months where both Revenue
        // and Ads Spent are 0 — but only if at least one non-zero entry exists.
        // Otherwise keep the (coerced) original series so the chart still renders
        // instead of collapsing to an empty SVG in the PDF.
        if (data.globalRevenue && data.globalRevenue.chartData) {
            const { labels, revenueData, adsSpentData } = data.globalRevenue.chartData;

            if (Array.isArray(labels) && Array.isArray(revenueData) && Array.isArray(adsSpentData)) {
                // Coerce up-front so stringified payloads (e.g. "0", "1000000")
                // don't break the `> 0` comparison or downstream math.
                const revNum = revenueData.map(toNum);
                const adsNum = adsSpentData.map(toNum);

                const filteredLabels = [];
                const filteredRevenue = [];
                const filteredAds = [];

                labels.forEach((label, index) => {
                    const revenue = revNum[index] || 0;
                    const ads = adsNum[index] || 0;

                    if (revenue > 0 || ads > 0) {
                        filteredLabels.push(label);
                        filteredRevenue.push(revenue);
                        filteredAds.push(ads);
                    }
                });

                if (filteredLabels.length > 0) {
                    data.globalRevenue.chartData.labels = filteredLabels;
                    data.globalRevenue.chartData.revenueData = filteredRevenue;
                    data.globalRevenue.chartData.adsSpentData = filteredAds;
                } else {
                    // Fallback: every month is zero — keep coerced originals so
                    // the chart axis & labels still render in the PDF.
                    data.globalRevenue.chartData.revenueData = revNum;
                    data.globalRevenue.chartData.adsSpentData = adsNum;
                }

                // DEBUG: Log chart data that will be rendered
                console.log('[CHART DEBUG] Final chartData for rendering:');
                console.log('[CHART DEBUG] labels:', JSON.stringify(data.globalRevenue.chartData.labels));
                console.log('[CHART DEBUG] revenueData:', JSON.stringify(data.globalRevenue.chartData.revenueData));
                console.log('[CHART DEBUG] adsSpentData:', JSON.stringify(data.globalRevenue.chartData.adsSpentData));
            }
        }

        // Slice to 5
        data.topProducts.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
        data.topProducts = data.topProducts.slice(0, 10);

        // Action Plan: Limit to 5 rows but DO NOT TRUNCATE TEXT
        if (data.actionPlan && Array.isArray(data.actionPlan)) {
            data.actionPlan = data.actionPlan.slice(0, 5).map(ap => ({
                ...ap,
                // Ensure text is preserved for wrapping in CSS
                problem: ap.problem || '-',
                solution: ap.solution || '-',
                pic: ap.pic || '-'
            }));
        }

        // 2. IMAGE CONVERSION (Base64)
        // Processing logo
        if (!data.logoUrl) {
            const logoPathSvg = path.join(__dirname, 'assets', 'logo.svg');
            const logoPathPng = path.join(__dirname, 'assets', 'logo.png');
            let logoPath = logoPathSvg;

            if (fs.existsSync(logoPathSvg)) {
                logoPath = logoPathSvg;
            } else {
                logoPath = logoPathPng;
                if (!fs.existsSync(logoPath)) {
                    if (!fs.existsSync(path.join(__dirname, 'assets'))) {
                        await fs.ensureDir(path.join(__dirname, 'assets'));
                    }
                    const dummyLogo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
                    await fs.writeFile(logoPath, dummyLogo);
                }
            }
            data.logoUrl = await imageToBase64(logoPath);
        } else if (data.logoUrl && !data.logoUrl.startsWith('data:')) {
            // Convert both HTTP URLs and local paths to base64
            data.logoUrl = await imageToBase64(data.logoUrl);
        }

        // Process Top Products Images
        if (data.topProducts && Array.isArray(data.topProducts)) {
            for (const p of data.topProducts) {
                if (p.image && !p.image.startsWith('data:')) {
                    // Convert both local paths and HTTP URLs to Base64
                    p.image = await imageToBase64(p.image);
                }
            }
        }

        // Process CPAS Best Campaign Images
        if (data.cpas_data) {
            // Safety Check: Populate awareness_nv with 0s if empty
            if (!data.cpas_data.awareness_nv || data.cpas_data.awareness_nv.length === 0) {
                data.cpas_data.awareness_nv = [
                    { "metric": "Ads Spend", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" },
                    { "metric": "Impression", "prev": "0", "current": "0", "growth": "0%" },
                    { "metric": "Link Clicks", "prev": "0", "current": "0", "growth": "0%" },
                    { "metric": "CTR (%)", "prev": "0%", "current": "0%", "growth": "0%" },
                    { "metric": "CPC (Rp)", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" }
                ];
            }

            // Safety Check: Populate conversion_rm with 0s if empty
            if (!data.cpas_data.conversion_rm || data.cpas_data.conversion_rm.length === 0) {
                data.cpas_data.conversion_rm = [
                    { "metric": "Ads Spend", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" },
                    { "metric": "Frequency", "prev": "0", "current": "0", "growth": "0%" },
                    { "metric": "Revenue", "prev": "Rp 0", "current": "Rp 0", "growth": "0%" },
                    { "metric": "Transaction", "prev": "0", "current": "0", "growth": "0%" },
                    { "metric": "ROAS", "prev": "0", "current": "0", "growth": "0%" }
                ];
            }

            if (data.cpas_data.best_campaigns) {
                const types = ['nv', 'rm'];
                for (const type of types) {
                    if (data.cpas_data.best_campaigns[type] && Array.isArray(data.cpas_data.best_campaigns[type].images)) {
                        for (let i = 0; i < data.cpas_data.best_campaigns[type].images.length; i++) {
                            let imgUrl = data.cpas_data.best_campaigns[type].images[i];
                            if (imgUrl && !imgUrl.startsWith('data:')) {
                                // Convert both local paths and HTTP URLs to Base64
                                data.cpas_data.best_campaigns[type].images[i] = await imageToBase64(imgUrl);
                            }
                        }
                    }
                }
            }
        }

        // Process Operational Screenshots
        if (data.operationalScreenshots && Array.isArray(data.operationalScreenshots)) {
            for (let i = 0; i < data.operationalScreenshots.length; i++) {
                let imgUrl = data.operationalScreenshots[i];
                if (imgUrl && !imgUrl.startsWith('data:')) {
                    // Convert both local paths and HTTP URLs to Base64
                    data.operationalScreenshots[i] = await imageToBase64(imgUrl);
                }
            }
        }

        // Process Promotion Screenshots
        if (data.promotionScreenshots && Array.isArray(data.promotionScreenshots)) {
            for (let i = 0; i < data.promotionScreenshots.length; i++) {
                let imgUrl = data.promotionScreenshots[i];
                if (imgUrl && !imgUrl.startsWith('data:')) {
                    // Convert both local paths and HTTP URLs to Base64
                    data.promotionScreenshots[i] = await imageToBase64(imgUrl);
                }
            }
        }

        // Process Ads Performance Chart
        if (data.adsChartUrl && !data.adsChartUrl.startsWith('data:')) {
            data.adsChartUrl = await imageToBase64(data.adsChartUrl);
        } else if (data.adsPerformanceChart && !data.adsPerformanceChart.startsWith('data:')) {
            data.adsChartUrl = await imageToBase64(data.adsPerformanceChart);
        }

        // 3. READ CSS AND EJS (template-driven)
        let cssContent = await fs.readFile(path.join(__dirname, 'templates', templateConfig.css), 'utf-8');
        const templatePath = path.join(__dirname, 'templates', templateConfig.ejs);
        const templateContent = await fs.readFile(templatePath, 'utf-8');

        // 3b. EMBED FONTS AS BASE64 (offline-safe, no Google Fonts CDN dependency)
        const fontsDir = path.join(__dirname, 'assets', 'fonts');
        const fontMap = [
            { file: 'Inter-Regular.woff2', family: 'Inter', weight: 400, style: 'normal' },
            { file: 'Inter-SemiBold.woff2', family: 'Inter', weight: 600, style: 'normal' },
            { file: 'Inter-Bold.woff2', family: 'Inter', weight: 700, style: 'normal' },
            { file: 'Inter-Black.woff2', family: 'Inter', weight: 900, style: 'normal' },
            { file: 'Montserrat-Regular.woff2', family: 'Montserrat', weight: 400, style: 'normal' },
            { file: 'Montserrat-SemiBold.woff2', family: 'Montserrat', weight: 600, style: 'normal' },
            { file: 'Montserrat-Bold.woff2', family: 'Montserrat', weight: 700, style: 'normal' },
            { file: 'Montserrat-Black.woff2', family: 'Montserrat', weight: 900, style: 'normal' },
        ];

        let embeddedFontCSS = '/* Embedded Fonts */\n';
        for (const font of fontMap) {
            const fontPath = path.join(fontsDir, font.file);
            const fontDataUri = await fontToBase64(fontPath);
            if (fontDataUri) {
                embeddedFontCSS += `@font-face {\n  font-family: '${font.family}';\n  font-weight: ${font.weight};\n  font-style: ${font.style};\n  src: url('${fontDataUri}') format('woff2');\n}\n`;
            }
        }
        // Remove the CDN @import and prepend embedded fonts instead
        cssContent = cssContent.replace(/@import url\([^)]+\);\s*/g, '');
        cssContent = embeddedFontCSS + cssContent;

        // 4. RENDER HTML
        // Ensure optional data objects are defined to prevent EJS ReferenceErrors
        if (typeof data.cpas_data === 'undefined') data.cpas_data = null;
        if (typeof data.tiktok_data === 'undefined') data.tiktok_data = null;
        if (typeof data.tokopedia_data === 'undefined') data.tokopedia_data = null;
        if (!data.shopeeAdsSummary) data.shopeeAdsSummary = '';

        // Build SVG donut charts in JS (avoids EJS string-wrapping issues)
        const sp = (data.storePerformance && typeof data.storePerformance === 'object') ? data.storePerformance : {};
        // New Buyers vs Old Buyers for donut chart
        const newBuyersPct = Math.max(0, Math.min(100, sp.newBuyers || sp.adSales || 0));
        const oldBuyersPct = Math.max(0, Math.min(100, sp.oldBuyers || sp.existingSales || 0));
        const shopeeDonutSvg = buildDonutChartSVG(
            [
                { pct: newBuyersPct, color: templateConfig.colors.primary, label: 'NEW BUYERS' },
                { pct: oldBuyersPct, color: templateConfig.colors.accent, label: 'OLD BUYERS' }
            ],
            { cx: 150, cy: 150, r: 80, rout: 105, width: 300, height: 300, displayWidth: 240, displayHeight: 240, centerLabel: 'BUYERS', centerValue: newBuyersPct.toFixed(1) + '%', centerColor: templateConfig.colors.centerText }
        );

        let tiktokDonutSvg = '';
        if (data.tiktok_data && data.tiktok_data.store_performance && data.tiktok_data.store_performance.composition) {
            const comp = data.tiktok_data.store_performance.composition;
            tiktokDonutSvg = buildDonutChartSVG(
                [
                    { pct: comp.video?.percentage || 0, color: templateConfig.colors.primary, label: 'VIDEO' },
                    { pct: comp.live_streaming?.percentage || 0, color: templateConfig.colors.accent, label: 'LIVE' },
                    { pct: comp.product_card?.percentage || 0, color: templateConfig.colors.tertiary, label: 'KARTU' }
                ],
                { cx: 125, cy: 125, r: 75, rout: 100, width: 250, height: 250, displayWidth: 190, displayHeight: 190, centerLabel: 'KOMPOSISI', centerColor: templateConfig.colors.centerText }
            );
        }

        const html = await ejs.render(templateContent, {
            ...data,
            cssContent: cssContent,
            shopeeDonutSvg: shopeeDonutSvg,
            tiktokDonutSvg: tiktokDonutSvg
        }, { async: true });

        // 5. PUPPETEER RENDER
        browser = await puppeteer.launch({
            executablePath: process.env.CHROME_PATH || undefined,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            timeout: PUPPETEER_TIMEOUT
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(PUPPETEER_TIMEOUT);
        page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT);

        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT });

        const outputDir = path.join(__dirname, '..', 'output');
        const outputPath = path.join(outputDir, `Report_${data.brandName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
        await fs.ensureDir(outputDir);

        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            timeout: PUPPETEER_TIMEOUT,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            }
        });

        console.log(`PDF Generated Successfully: ${outputPath}`);
        return { pdfPath: outputPath, warnings: [..._currentWarnings] };

    } catch (error) {
        console.error('Error in PDF generation:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close().catch(err => console.error('Browser close error:', err.message));
        }
        releaseSlot();
    }
}

if (require.main === module) {
    const sampleData = require('./sample_data.json');
    generatePDF(sampleData).then(result => {
        if (result.warnings && result.warnings.length > 0) {
            console.warn('Warnings:', result.warnings);
        }
    });
}

module.exports = { generatePDF };
