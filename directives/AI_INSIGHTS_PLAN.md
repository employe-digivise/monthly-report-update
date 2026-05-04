# AI-Generated Insights — Implementation Plan & Status

Auto-fill empty/placeholder insight fields in monthly reports using Claude (Haiku 4.5).

## Status

**Wired & tested locally — gated off in production until Anthropic credits are topped up.**

To enable: set `INSIGHT_AI_DISABLED=0` in `.env` after credits are added at https://console.anthropic.com/settings/billing.

## Insight Slots

| # | Field path | Type | Section | Trigger |
|---|---|---|---|---|
| 1 | `metrics.summary` | string | Operational Performance | empty/placeholder |
| 2 | `globalRevenue.summary` | string | Global Revenue | empty/placeholder |
| 3 | `globalPerformanceDetail.aiConclusion` | string[] | Global Performance | empty array/placeholder |
| 4 | `storePerformance.notes` | string | Shopee Store Performance | empty/placeholder |
| 5 | `shopeeAdsSummary` | string | Shopee Ads | empty/placeholder |
| 6 | `tiktok_data.store_performance.summary` | string[] | TikTok Store Performance | empty + tiktok enabled |

Placeholder values treated as empty: `""`, `"test"`, `"TODO"`, `"tbd"`, `null`, `undefined`, `[]`.

## Architecture

```
POST /generate-report or /webhook/lovable
  → generator.js: generatePDF(data)
    → safety checks (existing)
    → enrichInsightsWithAI(data)        ← gated by INSIGHT_AI_DISABLED
        ├─ scan SPECS for empty slots
        ├─ Promise.allSettled — 1 Claude call per slot in parallel
        ├─ parse JSON output, mutate data in place
        └─ per-slot failures logged, do not abort
    → render template & output PDF
```

## Files

| File | Role |
|---|---|
| [execution/insight_ai.js](../execution/insight_ai.js) | `enrichInsightsWithAI(data)` — orchestrator, gating, parallel calls, error handling |
| [execution/insight_prompts.js](../execution/insight_prompts.js) | 6 SPECS — extractor + prompt builder + output schema per slot |
| [execution/generator.js](../execution/generator.js) (line 7, 351-359) | Import + invocation point |
| [.env](../.env) / [.env.example](../.env.example) | `ANTHROPIC_API_KEY`, `INSIGHT_AI_MODEL`, `INSIGHT_AI_DISABLED` |
| [directives/API_DOCS.md](API_DOCS.md) | Public-facing doc for the auto-fill behavior |

## Env Vars

| Var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | Required to enable AI calls. Missing → enrichment skipped with warning. |
| `INSIGHT_AI_MODEL` | `claude-haiku-4-5-20251001` | Override model if needed (e.g. switch to Opus for higher quality). |
| `INSIGHT_AI_DISABLED` | `0` | Set to `1` to force-disable enrichment (currently `1` until credits topped up). |

## Behavior Contract

- Slots with real user content → **preserved as-is** (not regenerated).
- Slots empty or with placeholders → **regenerated** by Claude.
- Per-slot failure (timeout, rate limit, billing, parse error) → logged, slot stays empty, **report still renders** with template fallbacks.
- TikTok slot skipped when `enabledChannels.tiktok = false`.

## Validation Done

- Module loading: ✅
- `isEmpty` edge cases (11 cases pass): ✅
- Slot detection on `test_payload.json` & `goods_a_footwear_payload.json`: ✅ (correct slots flagged)
- Parallel call mechanics (705ms for 4 slots): ✅
- Error handling (4× billing-error 400s, no crash, payload intact): ✅
- Preserved field (`shopeeAdsSummary` with real content untouched): ✅

## Not Yet Validated (blocked on credits)

- Actual Claude output quality per slot — prompt tuning may be needed after first real run.
- Latency under real generation (each call returns ~50-300 tokens; total expected 2-5s for 4-6 slots in parallel).
- End-to-end PDF render with AI-filled content.

## Resume Steps (when credits added)

1. Top up at https://console.anthropic.com/settings/billing.
2. Set `INSIGHT_AI_DISABLED=0` in `.env`.
3. Smoke test:
   ```bash
   set -a && source .env && set +a && node -e "
   const fs=require('fs');
   const {enrichInsightsWithAI}=require('./execution/insight_ai');
   const d=JSON.parse(fs.readFileSync('./test_payload.json','utf8'));
   (async()=>{await enrichInsightsWithAI(d);console.log(JSON.stringify(d,null,2));})();
   "
   ```
4. Full PDF test:
   ```bash
   npm start &
   curl -X POST http://localhost:3000/generate-report \
     -H "Content-Type: application/json" \
     -d @test_payload.json -o out.pdf
   ```
5. Inspect `out.pdf` — verify all 4 previously-empty sections now have AI-generated content.
6. If any slot's output quality is poor, edit prompts in [execution/insight_prompts.js](../execution/insight_prompts.js).

## Cost Estimate

Per report (4-6 slots, Haiku 4.5 pricing as of 2026):
- Input: ~2-3k tokens total across slots → ~$0.002-0.003
- Output: ~500-1k tokens total → ~$0.005-0.010
- **Per report: ~$0.01-0.015** (~Rp 200-250)

For higher quality switch to Opus 4.7 via `INSIGHT_AI_MODEL` (~10× cost, ~Rp 2k-3k per report).
