import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A SOURCE CONTRACT for the availability fallback.
//
// Aaron lost time across a whole shift to "the scanner is busy right now" — the message this file
// returns when the fast model throws a transient error. He had already been retried fifteen times
// (SDK 4 + client 3) before seeing it, so more retrying was never the fix. A DIFFERENT MODEL is a
// different capacity pool, and the escalation path was already in this file — gated on read QUALITY,
// which a thrown call never reaches.
//
// ⚠️ Asserted against the SOURCE rather than by running the handler, for the same reason the one-shot
// screen contract is: the defect lived in the CONTROL FLOW around the call, not in any unit. A test
// of `askModel` would have stayed green through the entire outage.
const SRC = readFileSync(join(process.cwd(), 'api/keytag-read.ts'), 'utf8');

/** The Pass-1 block, from the cheap read to where the fleet check begins.
 *
 *  ⚠️ ASSERTED NON-EMPTY, because my first attempt used an end marker that sits EARLIER in the file
 *  than the start marker, so `slice` returned '' and two checks below ran against nothing. That is
 *  the vacuous-extractor failure the one-shot screen contract already documents — a source contract
 *  that matches nothing is worse than none, and it is easiest to write by accident. */
function passOne(): string {
  const start = SRC.indexOf('// ── Pass 1: the cheap read ──');
  const end = SRC.indexOf('// ── Can the fleet confirm it? ──', start);
  expect(start, 'the Pass 1 marker is gone — did the handler get restructured?').toBeGreaterThan(-1);
  expect(end, 'the fleet-check marker is gone').toBeGreaterThan(start);
  const body = SRC.slice(start, end);
  expect(body.length, 'extracted nothing — every check below would pass vacuously').toBeGreaterThan(200);
  return body;
}

describe('an overloaded model is not an unreadable tag', () => {
  it('can find the block it is about to inspect', () => {
    expect(passOne()).toContain('askModel');
  });
  it('has a fallback model that is neither the fast nor the strong one', () => {
    expect(SRC).toContain("const FALLBACK_MODEL = 'claude-sonnet-5'");
    // ⚠️ Opus on the availability path would put the priciest model on the branch that fires most
    // often — the shared-budget defect that broke his scanner once already.
    expect(SRC).not.toMatch(/FALLBACK_MODEL = 'claude-opus/);
  });

  it('wraps the first read so a transient throw does not end the request', () => {
    const body = passOne();
    expect(body, 'the fast read is unguarded — a 503 goes straight to the catch').toContain('try {');
    expect(body).toContain('askModel(FALLBACK_MODEL)');
  });

  // ⭐⭐ A NON-transient error must still fail fast. Retrying a genuinely unreadable photo on a second
  // model spends money to arrive at the same "couldn't read that" a beat later.
  it('only falls over on a TRANSIENT failure, and re-throws anything else', () => {
    expect(passOne()).toContain('if (!isTransient(err)) throw err;');
  });

  // ⚠️ The ledger must name what actually ran. A fallback that spends invisibly is precisely the
  // defect that drained the account mid-shift on 2026-08-25.
  it('prices the model that actually ran, not the one it meant to run', () => {
    expect(SRC).toContain('const firstModel = usedFallback ? FALLBACK_MODEL : FAST_MODEL;');
    expect(SRC).toContain('priceUsage(firstModel, fast.usage)');
    expect(SRC).not.toContain('priceUsage(FAST_MODEL, fast.usage)');
  });

  // ⚠️ And when everything genuinely is down, the honest message survives — the fallback's own throw
  // reaches the same catch, so "busy" still means busy.
  it('keeps the busy message for when both models are down', () => {
    expect(SRC).toContain('The scanner is busy right now');
    expect(SRC).toContain('retryable: true');
  });
});
