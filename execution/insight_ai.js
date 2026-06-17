/**
 * Auto-fill / preview insight fields in the report payload using an LLM.
 *
 * Two entry points:
 *   - enrichInsightsWithAI(data): generate-path safety net. Mutates `data`,
 *     fills ONLY empty/placeholder slots, gated by INSIGHT_AI_DISABLED.
 *     Called from generator.js before render.
 *   - generateInsights(data, opts): core engine used by the /preview-insights
 *     endpoint. Returns structured per-section insights, BYPASSES the disabled
 *     gate (preview is explicitly user-requested).
 *
 * Provider is pluggable via INSIGHT_AI_PROVIDER ("nvidia" default | "anthropic").
 *
 * Env:
 *   INSIGHT_AI_PROVIDER   — "nvidia" (default) | "anthropic"
 *   INSIGHT_AI_MODEL      — override model; else provider default
 *   INSIGHT_AI_DISABLED   — "1" to disable the generate-path auto-fill
 *   INSIGHT_AI_TIMEOUT_MS — per-call timeout (default 30000; 60000 recommended for NVIDIA)
 *   INSIGHT_AI_RETRIES    — retries per slot on transient errors (default 2)
 *   NVIDIA_API_KEY        — required when provider=nvidia
 *   NVIDIA_BASE_URL       — default https://integrate.api.nvidia.com/v1
 *   ANTHROPIC_API_KEY     — required when provider=anthropic
 */

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const { SPECS } = require('./insight_prompts');

const DEFAULT_MODELS = {
    anthropic: 'claude-haiku-4-5-20251001',
    nvidia: 'meta/llama-3.3-70b-instruct',
};
const DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const LLM_TIMEOUT_MS = Number(process.env.INSIGHT_AI_TIMEOUT_MS) || 30000;
const MAX_TOKENS = 600;
const PLACEHOLDER_VALUES = new Set(['test', 'TEST', 'Test', 'placeholder', 'TODO', 'tbd', 'TBD']);

function getProvider() {
    const p = String(process.env.INSIGHT_AI_PROVIDER || 'nvidia').trim().toLowerCase();
    return (p === 'anthropic' || p === 'nvidia') ? p : 'nvidia';
}

function getModel(provider) {
    return (process.env.INSIGHT_AI_MODEL && process.env.INSIGHT_AI_MODEL.trim())
        || DEFAULT_MODELS[provider];
}

function hasCredentials(provider) {
    return provider === 'nvidia'
        ? !!process.env.NVIDIA_API_KEY
        : !!process.env.ANTHROPIC_API_KEY;
}

let _anthropicClient = null;
function getAnthropicClient() {
    if (_anthropicClient) return _anthropicClient;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    _anthropicClient = new Anthropic.default({ apiKey });
    return _anthropicClient;
}

/**
 * True for transient errors worth retrying (network blips, timeouts, 429, 5xx).
 */
function isRetryable(err) {
    const code = err && err.code;
    if (['ECONNABORTED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code)) return true;
    const status = (err && (err.httpStatus || err.status));
    if (status === 429 || (status >= 500 && status < 600)) return true;
    return /timeout|socket hang up|ENOTFOUND|EAI_AGAIN|network/i.test((err && err.message) || '');
}

/**
 * One LLM call. Branches on provider; returns raw text content.
 */
async function callOnce(provider, { systemPrompt, userPrompt, model, maxTokens }) {
    if (provider === 'nvidia') {
        const baseUrl = (process.env.NVIDIA_BASE_URL || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, '');
        const apiKey = process.env.NVIDIA_API_KEY;
        if (!apiKey) throw new Error('NVIDIA_API_KEY not set');

        const resp = await axios.post(
            `${baseUrl}/chat/completions`,
            {
                model,
                max_tokens: maxTokens,
                temperature: 0.4,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
            },
            {
                timeout: LLM_TIMEOUT_MS,
                validateStatus: (s) => s < 500, // surface 4xx body for diagnostics
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (resp.status >= 400) {
            const detail = resp.data?.error?.message || resp.data?.detail || JSON.stringify(resp.data).slice(0, 300);
            const e = new Error(`NVIDIA ${resp.status}: ${detail}`);
            e.httpStatus = resp.status;
            throw e;
        }
        const text = resp.data?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
            throw new Error('NVIDIA empty/invalid content');
        }
        return text;
    }

    // anthropic
    const client = getAnthropicClient();
    if (!client) throw new Error('ANTHROPIC_API_KEY not set');
    const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    });
    return response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
}

/**
 * Single LLM call with retry on transient errors (cold-start timeouts, DNS
 * blips, 429, 5xx). Retries = INSIGHT_AI_RETRIES (default 2) with linear backoff.
 */
async function callLLM({ systemPrompt, userPrompt, model, maxTokens = MAX_TOKENS }) {
    const provider = getProvider();
    const maxAttempts = 1 + (Number(process.env.INSIGHT_AI_RETRIES) || 2);
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await callOnce(provider, { systemPrompt, userPrompt, model, maxTokens });
        } catch (err) {
            lastErr = err;
            if (attempt >= maxAttempts || !isRetryable(err)) throw err;
            await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s, ...
        }
    }
    throw lastErr;
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
 * Strip ```json fences if the model wrapped the response, then JSON.parse.
 */
function parseModelJson(text) {
    let s = String(text).trim();
    if (s.startsWith('```')) {
        s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    return JSON.parse(s);
}

async function generateOne(model, path, spec, data) {
    const ctx = spec.extract(data);
    const { systemPrompt, userPrompt } = spec.build(ctx);

    const text = await callLLM({ systemPrompt, userPrompt, model, maxTokens: MAX_TOKENS });

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
 * Core insight engine.
 *
 * @param {object} data  report payload (read; mutated only when opts.mutate)
 * @param {object} opts
 *   - onlyEmpty (default true): generate only empty/placeholder slots; filled
 *     slots are echoed into `insights` and listed in `skipped`.
 *   - force (default false): regenerate every eligible slot regardless of content.
 *   - mutate (default false): write generated values back into `data` in place.
 * @returns {{insights:object, generated:string[], failed:object[], skipped:string[], provider:string, model:string, elapsedMs:number}}
 */
async function generateInsights(data, { onlyEmpty = true, mutate = false, force = false } = {}) {
    const provider = getProvider();
    const model = getModel(provider);
    const insights = {};
    const generated = [];
    const failed = [];
    const skipped = [];
    const t0 = Date.now();

    const targets = [];
    for (const [path, spec] of Object.entries(SPECS)) {
        if (shouldSkipForChannel(path, data)) { skipped.push(path); continue; }
        const current = getByPath(data, path);
        const empty = isEmpty(current, spec.shape);
        if (!force && onlyEmpty && !empty) {
            insights[path] = current; // echo existing so the frontend sees every section
            skipped.push(path);
            continue;
        }
        targets.push({ path, spec, current });
    }

    if (targets.length > 0) {
        const results = await Promise.allSettled(
            targets.map(({ path, spec }) => generateOne(model, path, spec, data))
        );
        results.forEach((res, i) => {
            const { path, spec, current } = targets[i];
            if (res.status === 'fulfilled') {
                const value = res.value;
                const empty = spec.shape === 'array' ? (!Array.isArray(value) || value.length === 0) : !value;
                if (empty) {
                    failed.push({ path, error: 'empty result' });
                    if (current !== undefined && current !== null) insights[path] = current;
                    return;
                }
                insights[path] = value;
                generated.push(path);
                if (mutate) setByPath(data, path, value);
            } else {
                failed.push({ path, error: res.reason?.message || String(res.reason) });
                if (current !== undefined && current !== null) insights[path] = current;
            }
        });
    }

    const elapsedMs = Date.now() - t0;
    if (targets.length > 0) {
        console.log(`[insight-ai] provider=${provider} model=${model} generated=${generated.length} failed=${failed.length} skipped=${skipped.length} elapsed=${elapsedMs}ms`);
        failed.forEach(f => console.warn(`[insight-ai] FAILED ${f.path}: ${f.error}`));
    }

    return { insights, generated, failed, skipped, provider, model, elapsedMs };
}

/**
 * Generate-path safety net. Mutates `data` in place, fills only empty slots.
 * Gated by INSIGHT_AI_DISABLED. Keeps its original public contract.
 */
async function enrichInsightsWithAI(data) {
    if (process.env.INSIGHT_AI_DISABLED === '1') {
        console.log('[insight-ai] disabled via INSIGHT_AI_DISABLED=1');
        return { generated: [], skipped: ['*all*'], failed: [] };
    }

    const provider = getProvider();
    if (!hasCredentials(provider)) {
        const keyName = provider === 'nvidia' ? 'NVIDIA_API_KEY' : 'ANTHROPIC_API_KEY';
        console.warn(`[insight-ai] ${keyName} not set — skipping AI insight generation`);
        return { generated: [], skipped: ['*no-key*'], failed: [] };
    }

    const out = await generateInsights(data, { onlyEmpty: true, mutate: true });
    if (out.generated.length === 0 && out.failed.length === 0) {
        console.log('[insight-ai] no empty slots to fill');
    }
    return { generated: out.generated, skipped: out.skipped, failed: out.failed };
}

module.exports = { enrichInsightsWithAI, generateInsights, isEmpty, getProvider, getModel };
