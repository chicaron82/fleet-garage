import { describe, it, expect } from 'vitest';
import { priceUsage } from '../../api/_lib/apiSpend';



describe('cache writes bill by TTL, not by one flat rate', () => {
  it('⭐ a ONE-HOUR cache write costs 2x input, not 1.25x', () => {
    // Measured against the live API 2026-08-19: opus wrote 1,836 tokens at ttl "1h" and the
    // response reported them under cache_creation.ephemeral_1h_input_tokens. Pricing that at the
    // 5m rate under-reports the row by 40% — and a ledger that is quietly low is worse than none.
    const line = priceUsage('claude-opus-4-8', {
      input_tokens: 1690, output_tokens: 0,
      cache_creation_input_tokens: 1836,
      cache_creation: { ephemeral_1h_input_tokens: 1836, ephemeral_5m_input_tokens: 0 },
    });
    // 1690 * $5/M  +  1836 * $10/M
    expect(line.costUsd).toBeCloseTo((1690 * 5 + 1836 * 10) / 1_000_000, 10);
  });

  it('a five-minute write still bills at 1.25x', () => {
    const line = priceUsage('claude-opus-4-8', {
      input_tokens: 1690, output_tokens: 0,
      cache_creation_input_tokens: 1836,
      cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 1836 },
    });
    expect(line.costUsd).toBeCloseTo((1690 * 5 + 1836 * 6.25) / 1_000_000, 10);
  });

  it('⭐ a response with no breakdown prices exactly as it always did', () => {
    // Every response before extended-TTL caching existed looks like this. The change must not move
    // a single historical number.
    const line = priceUsage('claude-opus-4-8', {
      input_tokens: 1690, output_tokens: 0, cache_creation_input_tokens: 1836,
    });
    expect(line.costUsd).toBeCloseTo((1690 * 5 + 1836 * 6.25) / 1_000_000, 10);
    expect(line.cacheWriteTokens).toBe(1836);
  });
});

