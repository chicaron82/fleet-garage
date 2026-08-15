// Write one turn's cost to the effie_ledger. The recording half of the credit tracker —
// api/_lib/apiSpend.ts does the pricing, this does the persisting.
//
// ⚠️ THE LOAD-BEARING RULE: a bookkeeping failure must NEVER break a chat turn. Effie is the
// operator's tool on a live shift; a ledger insert failing (network blip, RLS change, table
// missing on a preview deploy) must cost him a log line, not his answer. So every path here
// swallows its error after a console.error and returns — the caller intentionally does not
// await a result it can act on. Losing a row costs a fraction of a cent of accuracy, which the
// "Topped up" reset re-baselines anyway. Losing an answer costs him the thing he came for.
import type { SupabaseClient } from '@supabase/supabase-js';
import { sumSpend, type SpendLine } from './apiSpend.js';

/**
 * Record the cost of one Effie turn (which may have been several billable API calls).
 * Fire-and-forget by contract — callers should NOT await this on the response path.
 */
export async function recordSpend(
  supabase: SupabaseClient,
  source: string,
  lines: readonly SpendLine[],
): Promise<void> {
  const total = sumSpend(lines);
  if (!total) return;                  // nothing billable happened
  if (total.unpriced) {
    // Deliberate: an unknown model is logged loudly and NOT written as a $0 row. A zero row
    // would silently under-report the balance and make the readout confidently wrong — the
    // exact failure the whole feature exists to prevent. Fix the RATES table instead.
    console.error(`[recordSpend] UNPRICED model "${total.model}" — add it to api/_lib/apiSpend.ts RATES. Tokens: in=${total.inputTokens} out=${total.outputTokens}`);
    return;
  }
  try {
    const { error } = await supabase.from('effie_ledger').insert({
      kind: 'spend',
      amount_usd: total.costUsd,
      model: total.model,
      input_tokens: total.inputTokens,
      output_tokens: total.outputTokens,
      cache_read_tokens: total.cacheReadTokens,
      cache_write_tokens: total.cacheWriteTokens,
      source,
    });
    if (error) console.error('[recordSpend] insert failed:', error.message);
  } catch (err) {
    console.error('[recordSpend] insert threw:', err);
  }
}
