import { describe, it, expect } from 'vitest';
import { priceUsage, sumSpend, RATES } from '../../../api/_lib/apiSpend';

describe('priceUsage', () => {
  it('prices input and output at the model\'s per-million rates', () => {
    // Sonnet: $3/M in, $15/M out. 1M in + 1M out = $3 + $15.
    const line = priceUsage('claude-sonnet-4-6', { input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(line.costUsd).toBeCloseTo(18, 10);
    expect(line.unpriced).toBe(false);
  });

  it('prices cache reads far below input, and cache writes above it', () => {
    const read = priceUsage('claude-sonnet-4-6', { cache_read_input_tokens: 1_000_000 });
    const write = priceUsage('claude-sonnet-4-6', { cache_creation_input_tokens: 1_000_000 });
    const input = priceUsage('claude-sonnet-4-6', { input_tokens: 1_000_000 });
    expect(read.costUsd).toBeLessThan(input.costUsd);
    expect(write.costUsd).toBeGreaterThan(input.costUsd);
  });

  it('is realistic at Effie\'s actual scale — a normal text turn costs fractions of a cent', () => {
    // ~2k prompt (mostly cached) + ~300 out is a typical Effie lookup.
    const line = priceUsage('claude-sonnet-4-6', {
      input_tokens: 400,
      output_tokens: 300,
      cache_read_input_tokens: 1_600,
    });
    expect(line.costUsd).toBeGreaterThan(0);
    expect(line.costUsd).toBeLessThan(0.01);
  });

  it('returns raw token counts alongside the dollars so history can be re-priced', () => {
    const line = priceUsage('claude-opus-4-8', {
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 40,
    });
    expect(line).toMatchObject({
      inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40,
    });
  });

  it('flags an UNKNOWN model as unpriced instead of guessing a rate', () => {
    // Guessing would keep the balance plausible and make it wrong — the exact failure this
    // feature exists to prevent. A miss must be visible.
    const line = priceUsage('claude-some-future-model', { input_tokens: 1_000_000 });
    expect(line.unpriced).toBe(true);
    expect(line.costUsd).toBe(0);
    expect(line.inputTokens).toBe(1_000_000); // tokens still captured — re-priceable later
  });

  it('treats missing, null and negative counts as zero', () => {
    expect(priceUsage('claude-sonnet-4-6', null).costUsd).toBe(0);
    expect(priceUsage('claude-sonnet-4-6', {}).costUsd).toBe(0);
    expect(priceUsage('claude-sonnet-4-6', { input_tokens: null, output_tokens: -5 }).costUsd).toBe(0);
  });

  it('covers every model the api/ endpoints actually call', () => {
    // Guard against the silent-drift hazard: if fg-chat switches models and this list is not
    // updated, spend goes unpriced. These ids must match api/fg-chat.ts MODEL + VISION_MODEL.
    expect(RATES).toHaveProperty('claude-sonnet-4-6');
    expect(RATES).toHaveProperty('claude-opus-4-8');
  });
});

describe('sumSpend', () => {
  it('adds a multi-call tool turn into one ledger row', () => {
    const a = priceUsage('claude-sonnet-4-6', { input_tokens: 100, output_tokens: 50 });
    const b = priceUsage('claude-sonnet-4-6', { input_tokens: 200, output_tokens: 80 });
    const total = sumSpend([a, b])!;
    expect(total.costUsd).toBeCloseTo(a.costUsd + b.costUsd, 12);
    expect(total.inputTokens).toBe(300);
    expect(total.outputTokens).toBe(130);
  });

  it('propagates unpriced — one unknown call makes the whole row suspect', () => {
    const known = priceUsage('claude-sonnet-4-6', { input_tokens: 100 });
    const unknown = priceUsage('mystery-model', { input_tokens: 100 });
    expect(sumSpend([known, unknown])!.unpriced).toBe(true);
  });

  it('returns null for an empty turn (nothing to log)', () => {
    expect(sumSpend([])).toBeNull();
  });
});
