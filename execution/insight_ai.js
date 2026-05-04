/**
 * Auto-fill empty insight fields in the report payload using Claude.
 *
 * Triggered from generator.js after data normalization, before render.
 * Only fills slots that are empty / placeholder ("test"). User-provided
 * content is respected.
 *
 * Env:
 *   ANTHROPIC_API_KEY     — required; missing key → enrichment is skipped
 *   INSIGHT_AI_MODEL      — default claude-haiku-4-5-20251001
 *   INSIGHT_AI_DISABLED   — "1" to force-disable (used in tests)
 */

const Anthropic = require('@anthropic-ai/sdk');
const { SPECS } = require('./insight_prompts');

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const PLACEHOLDER_VALUES = new Set(['test', 'TEST', 'Test', 'placeholder', 'TODO', 'tbd', 'TBD']);

let _client = null;
function getClient() {
    if (_client) return _client;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    _client = new Anthropic.default({ apiKey });
    return _client;
}

function isEmpty(value, shape) {
    if (value === null || value === undefined) return true;
    if (shape === 'array') {
        if (!Array.isArray(value)) return true;
        if (value.length === 0) return true;
        const allBlank = value.every(v => typeof v === 'string' && (!v.trim() || PLACEHOLDER_VALUES.has(v.trim())));
        return allBlank;
    }
    // string shape
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return true;
    return PLACEHOLDER_VALUES.has(trimmed);
}

function getByPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setByPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
}

function shouldSkipForChannel(path, data) {
    if (path.startsWith('tiktok_data') && !data.enabledChannels?.tiktok) return true;
    return false;
}

/**
 * Strip ```json fences if Claude wrapped the response, then JSON.parse.
 */
function parseModelJson(text) {
    let s = String(text).trim();
    if (s.startsWith('```')) {
        s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    return JSON.parse(s);
}

async function generateOne(client, model, path, spec, data) {
    const ctx = spec.extract(data);
    const { systemPrompt, userPrompt } = spec.build(ctx);

    const response = await client.messages.create({
        model,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

    const parsed = parseModelJson(text);
    let result = parsed.result;

    if (spec.shape === 'array') {
        if (!Array.isArray(result)) {
            result = typeof result === 'string' ? [result] : [];
        }
        result = result.map(v => String(v).trim()).filter(Boolean);
    } else {
        result = String(result || '').trim();
    }

    return result;
}

/**
 * Mutates `data` in place. Slots that are non-empty and non-placeholder
 * are left untouched. Failures per slot are logged but do not throw —
 * the report still renders with whatever slots succeeded.
 */
async function enrichInsightsWithAI(data) {
    if (process.env.INSIGHT_AI_DISABLED === '1') {
        console.log('[insight-ai] disabled via INSIGHT_AI_DISABLED=1');
        return { generated: [], skipped: ['*all*'], failed: [] };
    }

    const client = getClient();
    if (!client) {
        console.warn('[insight-ai] ANTHROPIC_API_KEY not set — skipping AI insight generation');
        return { generated: [], skipped: ['*no-key*'], failed: [] };
    }

    const model = process.env.INSIGHT_AI_MODEL || DEFAULT_MODEL;
    const targets = [];

    for (const [path, spec] of Object.entries(SPECS)) {
        if (shouldSkipForChannel(path, data)) continue;
        const current = getByPath(data, path);
        if (!isEmpty(current, spec.shape)) continue;
        targets.push({ path, spec });
    }

    if (targets.length === 0) {
        console.log('[insight-ai] no empty slots to fill');
        return { generated: [], skipped: [], failed: [] };
    }

    console.log(`[insight-ai] filling ${targets.length} slot(s) with model ${model}: ${targets.map(t => t.path).join(', ')}`);
    const t0 = Date.now();

    const results = await Promise.allSettled(
        targets.map(({ path, spec }) => generateOne(client, model, path, spec, data))
    );

    const generated = [];
    const failed = [];

    results.forEach((res, i) => {
        const { path, spec } = targets[i];
        if (res.status === 'fulfilled') {
            const value = res.value;
            const empty = spec.shape === 'array' ? value.length === 0 : !value;
            if (empty) {
                failed.push({ path, error: 'empty result' });
                return;
            }
            setByPath(data, path, value);
            generated.push(path);
        } else {
            failed.push({ path, error: res.reason?.message || String(res.reason) });
        }
    });

    const elapsed = Date.now() - t0;
    console.log(`[insight-ai] generated=${generated.length} failed=${failed.length} elapsed=${elapsed}ms`);
    if (failed.length) {
        failed.forEach(f => console.warn(`[insight-ai] FAILED ${f.path}: ${f.error}`));
    }

    return { generated, skipped: [], failed };
}

module.exports = { enrichInsightsWithAI, isEmpty };
