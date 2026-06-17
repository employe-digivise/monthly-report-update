// Load .env so the app can read NVIDIA_API_KEY / ANTHROPIC_API_KEY etc.
// (PM2 does not auto-load .env; without this the keys are never seen.)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const fs = require('fs');
const { generatePDF } = require('./generator');
const { generateInsights } = require('./insight_ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Per-user cooldown: 1 request per 30 seconds per IP (PDF generation).
const cooldownMap = new Map();
const COOLDOWN_SECONDS = 30;

// Lighter cooldown for the insight preview endpoint (fast, may be retried).
// Separate map so previewing does not burn the 30s generate budget.
const previewCooldownMap = new Map();
const PREVIEW_COOLDOWN_SECONDS = 5;

function makeRateLimiter(map, cooldownSeconds) {
    return function rateLimiter(req, res, next) {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const lastRequest = map.get(ip);

        if (lastRequest) {
            const elapsed = (now - lastRequest) / 1000;
            if (elapsed < cooldownSeconds) {
                const remaining = Math.ceil(cooldownSeconds - elapsed);
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${remaining} seconds before trying again.`,
                    retryAfter: remaining
                });
            }
        }

        map.set(ip, now);
        return next();
    };
}

const rateLimiter = makeRateLimiter(cooldownMap, COOLDOWN_SECONDS);
const previewRateLimiter = makeRateLimiter(previewCooldownMap, PREVIEW_COOLDOWN_SECONDS);

// Cleanup stale cooldown entries every 5 minutes (both maps).
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamp] of cooldownMap) {
        if (now - timestamp > COOLDOWN_SECONDS * 1000) cooldownMap.delete(ip);
    }
    for (const [ip, timestamp] of previewCooldownMap) {
        if (now - timestamp > PREVIEW_COOLDOWN_SECONDS * 1000) previewCooldownMap.delete(ip);
    }
}, 5 * 60 * 1000);

// Request ID middleware
app.use((req, res, next) => {
    req.requestId = crypto.randomBytes(8).toString('hex');
    res.setHeader('X-Request-Id', req.requestId);
    next();
});

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Secret'],
    credentials: true
}));
app.use(morgan((tokens, req, res) => {
    return [
        `[${req.requestId || '-'}]`,
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), 'ms'
    ].join(' ');
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static output files from root output folder
app.use('/output', express.static(path.join(__dirname, '..', 'output')));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        timestamp: new Date().toISOString()
    });
});

/**
 * Compatible endpoint with monthly-report-generator-main 2
 */
app.post('/generate-report', rateLimiter, async (req, res) => {
    await handleReportGeneration(req, res);
});

/**
 * Endpoint specifically for Lovable Webhook
 */
app.post('/webhook/lovable', rateLimiter, async (req, res) => {
    await handleReportGeneration(req, res);
});

/**
 * Preview AI insights per section WITHOUT rendering a PDF.
 * Same payload as /generate-report. Returns insights keyed by canonical
 * payload path so the frontend can show/edit them before generating.
 * Runs regardless of INSIGHT_AI_DISABLED (preview is explicitly requested).
 * Optional body flag: regenerateAll/force = regenerate even filled slots.
 */
app.post('/preview-insights', previewRateLimiter, async (req, res) => {
    const reqId = req.requestId;
    const v = validateAndSanitize(req.body);
    if (!v.ok) {
        return res.status(v.status).json({ success: false, message: v.message, requestId: reqId });
    }
    const force = req.body.regenerateAll === true || req.body.force === true;
    try {
        const r = await generateInsights(v.data, { onlyEmpty: !force, mutate: false, force });
        return res.status(200).json({
            success: true,
            requestId: reqId,
            provider: r.provider,
            model: r.model,
            elapsedMs: r.elapsedMs,
            insights: r.insights,
            meta: { generated: r.generated, failed: r.failed, skipped: r.skipped }
        });
    } catch (error) {
        console.error(`[${reqId}] preview-insights error:`, error);
        return res.status(500).json({ success: false, message: 'Insight generation failed', requestId: reqId });
    }
});

/**
 * Sanitize a string: strip HTML tags and limit length
 */
function sanitizeString(str, maxLen = 200) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

/**
 * Validate and sanitize enabledChannels
 */
function sanitizeEnabledChannels(channels) {
    const validChannels = ['shopee', 'tiktok', 'tokopedia', 'lazada', 'blibli', 'cpas', 'zalora'];
    const result = {};
    for (const ch of validChannels) {
        result[ch] = !!(channels && typeof channels === 'object' && channels[ch]);
    }
    return result;
}

/**
 * Validate numeric fields in metrics
 */
function sanitizeMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') return undefined;
    const rangeRules = {
        unfulfilledOrders: { min: 0, max: 100 },
        lateShipment: { min: 0, max: 100 },
        chatResponseRate: { min: 0, max: 100 },
        overallRating: { min: 0, max: 5 }
    };
    for (const [field, range] of Object.entries(rangeRules)) {
        if (metrics[field] !== undefined) {
            const num = Number(metrics[field]);
            metrics[field] = isNaN(num) ? 0 : Math.min(Math.max(num, range.min), range.max);
        }
    }
    if (metrics.summary && typeof metrics.summary === 'string') {
        metrics.summary = sanitizeString(metrics.summary, 500);
    }
    return metrics;
}

/**
 * Shared validation + sanitization for the report payload. Mutates `data`
 * in place (sanitized fields). Returns { ok:true, data } or
 * { ok:false, status, message }. Does NOT set data.template (render-only).
 */
function validateAndSanitize(data) {
    if (!data || Object.keys(data).length === 0) {
        return { ok: false, status: 400, message: 'Invalid or empty JSON body.' };
    }
    if (!data.brandName || typeof data.brandName !== 'string') {
        return { ok: false, status: 400, message: 'Invalid data format. brandName is required and must be a string.' };
    }
    for (const field of ['reportMonth', 'reportYear']) {
        if (!data[field]) {
            return { ok: false, status: 400, message: `Missing required field: ${field}` };
        }
    }
    const year = Number(data.reportYear);
    if (isNaN(year) || year < 2020 || year > 2030) {
        return { ok: false, status: 400, message: 'Invalid reportYear. Must be between 2020 and 2030.' };
    }

    // Sanitize text fields to prevent HTML/script injection
    data.brandName = sanitizeString(data.brandName, 100);
    data.reportMonth = sanitizeString(data.reportMonth, 50);
    data.reportYear = sanitizeString(String(data.reportYear), 10);
    if (data.footerText) data.footerText = sanitizeString(data.footerText, 200);
    if (data.shopeeAdsSummary) data.shopeeAdsSummary = sanitizeString(data.shopeeAdsSummary, 1000);

    // Sanitize enabledChannels
    data.enabledChannels = sanitizeEnabledChannels(data.enabledChannels);

    // Sanitize numeric metrics
    if (data.metrics) {
        data.metrics = sanitizeMetrics(data.metrics);
    }

    return { ok: true, data };
}

async function handleReportGeneration(req, res) {
    const reqId = req.requestId;
    try {
        const v = validateAndSanitize(req.body);
        if (!v.ok) {
            return res.status(v.status).json({ success: false, message: v.message, requestId: reqId });
        }
        const data = v.data;

        // Template is fixed to 'aurora' (the only supported template).
        // Any incoming `template` value (incl. legacy corporate/atria/dashboard) is coerced to aurora.
        data.template = 'aurora';

        console.log(`[${reqId}] Received request for brand: ${data.brandName}`);

        // Trigger the Iron Frame generator
        const result = await generatePDF(data);
        const pdfPath = result.pdfPath || result;
        const warnings = result.warnings || [];
        const fileName = path.basename(pdfPath);

        // Construct the full download URL
        const downloadUrl = `${req.protocol}://${req.get('host')}/output/${fileName}`;

        // Read PDF and convert to base64
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfBase64 = pdfBuffer.toString('base64');

        console.log(`[${reqId}] PDF generated: ${fileName}`);
        if (warnings.length > 0) {
            console.warn(`[${reqId}] Warnings: ${warnings.join(', ')}`);
        }

        const response = {
            success: true,
            message: 'PDF generated successfully',
            fileName: fileName,
            downloadUrl: downloadUrl,
            requestId: reqId,
            data: {
                pdfUrl: downloadUrl,
                pdfBase64: pdfBase64
            }
        };
        if (warnings.length > 0) {
            response.warnings = warnings;
        }
        res.status(200).json(response);

    } catch (error) {
        console.error(`[${reqId}] Server error during PDF generation:`, error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            requestId: reqId
        });
    }
}

app.get('/', (req, res) => {
    res.send('PDF Report Generator Server (The Iron Frame) is running. POST to /webhook/lovable or /generate-report');
});

// Auto-cleanup: delete PDFs older than 24 hours
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cleanupOldPDFs() {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return;
        const files = fs.readdirSync(OUTPUT_DIR);
        const now = Date.now();
        let removed = 0;

        for (const file of files) {
            if (!file.endsWith('.pdf')) continue;
            const filePath = path.join(OUTPUT_DIR, file);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > MAX_AGE_MS) {
                fs.unlinkSync(filePath);
                removed++;
            }
        }

        if (removed > 0) console.log(`Cleanup: removed ${removed} old PDF(s)`);
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
}

// Start Server
let server;
server = app.listen(PORT, () => {
    console.log(`-----------------------------------------------`);
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Cooldown: ${COOLDOWN_SECONDS}s per IP`);
    console.log(`-----------------------------------------------`);

    // Run cleanup on start and every hour
    cleanupOldPDFs();
    setInterval(cleanupOldPDFs, 60 * 60 * 1000);
});

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('All connections closed. Exiting.');
        process.exit(0);
    });
    // Force exit after 10 seconds if connections don't close
    setTimeout(() => {
        console.error('Forced exit after timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
