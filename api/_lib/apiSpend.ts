// What a single Anthropic call cost — priced from the `usage` block the API already hands back.
//
// FG's Anthropic key is DEDICATED (`fg-api-key`), so every dollar it spends is Effie's. That
// makes self-accounting exact: we don't have to ask Anthropic what we spent, we can count it.
// (The alternative — the Admin Usage & Cost API — needs an `sk-ant-admin01-…` key that does not
// exist for an individual account; verified live 2026-08-15.) Self-accounting is also *ahead*
// of the cost report, which settles over hours.
//
// ⚠️ THE ONE MAINTENANCE HAZARD: RATES is a hardcoded price list. If Anthropic changes pricing,
// or fg-chat switches models, this drifts silently — the number stays plausible and becomes
// wrong, which is worse than an error. So: the model ids here MUST match the ones in
// api/fg-chat.ts + api/keytag-read.ts + api/fg-schedule-parse.ts, an unknown model is treated
// as an explicit miss (not zero), and the ledger stores raw tokens so history can be re-priced.

/** USD per MILLION tokens, per model. Verified against platform.claude.com/docs/en/about-claude/pricing
 *  on 2026-08-15. `cacheWrite` is the 5-minute write (1.25× input) — FG uses the default 5m cache;
 *  the 1h write (2× input) is not used here. `cacheRead` is 0.1× input. */
interface Rate {
  input: number;
  output: number;
  /** Cache reads bill at a fraction of input; cache writes at a premium. */
  cacheRead: number;
  cacheWrite: number;
}

export const RATES: Readonly<Record<string, Rate>> = {
  // Effie's text/routing model (api/fg-chat.ts MODEL)
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  // Effie's vision model (api/fg-chat.ts VISION_MODEL) — keytag + damage reads
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  // fg-schedule-parse's availability fallback (scheduleVisionRequest FALLBACK_VISION_MODEL)
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/** The token counts we price. Mirrors the shape of Anthropic's `message.usage`. */
export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface SpendLine {
  model: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** True when the model wasn't in RATES — cost is 0 and the caller should NOT trust it. */
  unpriced: boolean;
}

const n = (v: number | null | undefined): number => (typeof v === 'number' && v > 0 ? v : 0);

/**
 * Price one API response. Returns the raw token counts alongside the dollars so the ledger can
 * store both — a stored token count can be re-priced later if a rate here turns out wrong; a
 * stored dollar figure alone can never be corrected.
 *
 * An unknown model returns costUsd 0 with `unpriced: true` rather than guessing a rate. A wrong
 * guess would quietly under- or over-report the balance, and the whole point of this feature is
 * to replace guessing with knowing — a feature that guesses at its own numbers is worse than none.
 */
export function priceUsage(model: string, usage: TokenUsage | null | undefined): SpendLine {
  const inputTokens = n(usage?.input_tokens);
  const outputTokens = n(usage?.output_tokens);
  const cacheReadTokens = n(usage?.cache_read_input_tokens);
  const cacheWriteTokens = n(usage?.cache_creation_input_tokens);
  const rate = RATES[model];
  if (!rate) {
    return { model, costUsd: 0, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, unpriced: true };
  }
  const costUsd =
    (inputTokens * rate.input +
      outputTokens * rate.output +
      cacheReadTokens * rate.cacheRead +
      cacheWriteTokens * rate.cacheWrite) /
    1_000_000;
  return { model, costUsd, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, unpriced: false };
}

/**
 * Sum several responses into one ledger row. A single Effie turn can be up to MAX_TOOL_TURNS
 * separate billable API calls (the tool loop in fg-chat), and one row per *turn* is the useful
 * granularity — one row per internal API call would triple the table for no extra insight.
 */
export function sumSpend(lines: readonly SpendLine[]): SpendLine | null {
  if (lines.length === 0) return null;
  return lines.reduce((acc, l) => ({
    // The model of the last line: within a turn they're the same model anyway (text or vision).
    model: l.model,
    costUsd: acc.costUsd + l.costUsd,
    inputTokens: acc.inputTokens + l.inputTokens,
    outputTokens: acc.outputTokens + l.outputTokens,
    cacheReadTokens: acc.cacheReadTokens + l.cacheReadTokens,
    cacheWriteTokens: acc.cacheWriteTokens + l.cacheWriteTokens,
    // If ANY call in the turn was unpriced the whole row is suspect — surface it, don't average it away.
    unpriced: acc.unpriced || l.unpriced,
  }));
}
