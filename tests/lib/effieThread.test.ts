import { describe, it, expect } from 'vitest';
import {
  packThread, unpackThread, unpackWrapped, unpackWrappedStamped,
  loadThreadStamped, saveThread, clearThread, shouldAdoptThread,
  THREAD_MAX_AGE_MS, THREAD_MAX_MESSAGES,
} from '../../src/lib/effieThread';

const NOW = 1_800_000_000_000;

describe('packThread', () => {
  it('keeps only role + text — drops proposals, images, and empty bubbles', () => {
    const raw = packThread(
      [
        { role: 'user', text: 'anything on LUR187?', image: 'data:image/png;base64,AAAA' } as never,
        { role: 'assistant', text: 'Nothing on LUR187.', proposal: { some: 'draft' } } as never,
        { role: 'assistant', text: '   ' }, // in-flight / empty → dropped
      ],
      NOW,
    );
    const parsed = JSON.parse(raw);
    expect(parsed.at).toBe(NOW);
    expect(parsed.messages).toEqual([
      { role: 'user', text: 'anything on LUR187?' },
      { role: 'assistant', text: 'Nothing on LUR187.' },
    ]);
    // no leaked fields
    expect(JSON.stringify(parsed)).not.toContain('base64');
    expect(JSON.stringify(parsed)).not.toContain('proposal');
  });

  it('caps to the most recent THREAD_MAX_MESSAGES turns', () => {
    const many = Array.from({ length: THREAD_MAX_MESSAGES + 10 }, (_, i) => ({ role: 'user' as const, text: `m${i}` }));
    const parsed = JSON.parse(packThread(many, NOW));
    expect(parsed.messages).toHaveLength(THREAD_MAX_MESSAGES);
    expect(parsed.messages[0].text).toBe('m10'); // oldest 10 dropped
    expect(parsed.messages.at(-1).text).toBe(`m${THREAD_MAX_MESSAGES + 9}`);
  });
});

describe('unpackThread', () => {
  const fresh = () => packThread([{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hey there' }], NOW);

  it('round-trips a fresh thread', () => {
    expect(unpackThread(fresh(), NOW + 1000)).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'hey there' },
    ]);
  });

  it('returns null for a stale thread (older than max age)', () => {
    expect(unpackThread(fresh(), NOW + THREAD_MAX_AGE_MS + 1)).toBeNull();
  });

  it('returns the thread right at the age boundary', () => {
    expect(unpackThread(fresh(), NOW + THREAD_MAX_AGE_MS)).not.toBeNull();
  });

  it('returns null for missing, malformed, or shapeless input', () => {
    expect(unpackThread(null, NOW)).toBeNull();
    expect(unpackThread('not json', NOW)).toBeNull();
    expect(unpackThread('{}', NOW)).toBeNull();
    expect(unpackThread(JSON.stringify({ at: NOW, messages: 'nope' }), NOW)).toBeNull();
  });

  it('returns null when every stored message is empty', () => {
    expect(unpackThread(JSON.stringify({ at: NOW, messages: [{ role: 'user', text: '  ' }] }), NOW)).toBeNull();
  });
});

// The server (effie_threads JSONB) hands the ALREADY-parsed wrapper straight in — same TTL +
// validation rules as unpackThread, just skipping the JSON.parse. This is the cross-device path.
describe('unpackWrapped', () => {
  const wrapped = (msgs: { role: 'user' | 'assistant'; text: string }[], at = NOW) => ({ at, messages: msgs });

  it('accepts a fresh parsed wrapper', () => {
    expect(unpackWrapped(wrapped([{ role: 'user', text: 'hi' }]), NOW + 1000)).toEqual([{ role: 'user', text: 'hi' }]);
  });

  it('enforces the same 12h TTL as the localStorage path', () => {
    expect(unpackWrapped(wrapped([{ role: 'user', text: 'hi' }]), NOW + THREAD_MAX_AGE_MS + 1)).toBeNull();
    expect(unpackWrapped(wrapped([{ role: 'user', text: 'hi' }]), NOW + THREAD_MAX_AGE_MS)).not.toBeNull();
  });

  it('returns null for null/undefined or a shapeless object (jsonb could be anything)', () => {
    expect(unpackWrapped(null, NOW)).toBeNull();
    expect(unpackWrapped(undefined, NOW)).toBeNull();
    expect(unpackWrapped({ at: 'nope' } as never, NOW)).toBeNull();
    expect(unpackWrapped({ at: NOW, messages: 'nope' } as never, NOW)).toBeNull();
  });

  it('drops empty turns and returns null if nothing storable remains', () => {
    expect(unpackWrapped(wrapped([{ role: 'user', text: '   ' }]), NOW)).toBeNull();
  });
});

// Live-sync (docs/ticket-effie-thread-live-sync.md) reconciliation primitives.
describe('unpackWrappedStamped', () => {
  it('keeps the `at` alongside the messages', () => {
    const parsed = { at: NOW, messages: [{ role: 'user' as const, text: 'hi' }] };
    expect(unpackWrappedStamped(parsed, NOW + 1000)).toEqual({ at: NOW, messages: [{ role: 'user', text: 'hi' }] });
  });
  it('is null for a stale/empty/malformed wrapper (same rules as unpackWrapped)', () => {
    expect(unpackWrappedStamped({ at: NOW, messages: [{ role: 'user', text: 'hi' }] }, NOW + THREAD_MAX_AGE_MS + 1)).toBeNull();
    expect(unpackWrappedStamped(null, NOW)).toBeNull();
    expect(unpackWrappedStamped({ at: NOW, messages: [{ role: 'user', text: ' ' }] }, NOW)).toBeNull();
  });
});

describe('shouldAdoptThread (the one live-sync rule)', () => {
  it('adopts a strictly newer thread', () => {
    expect(shouldAdoptThread(NOW + 1, NOW, false)).toBe(true);
  });
  it('ignores an equal `at` — that is this device\'s own echo, not a remote update', () => {
    expect(shouldAdoptThread(NOW, NOW, false)).toBe(false);
  });
  it('ignores an older thread', () => {
    expect(shouldAdoptThread(NOW - 1, NOW, false)).toBe(false);
  });
  it('never adopts mid-turn (loading), even if newer — don\'t yank the thread out from under a response', () => {
    expect(shouldAdoptThread(NOW + 10_000, NOW, true)).toBe(false);
  });
});

describe('saveThread + loadThreadStamped round-trip (shared `at`)', () => {
  it('round-trips the caller-supplied `at` so local/server/threadAtRef stay in lockstep', () => {
    clearThread();
    saveThread([{ role: 'user', text: 'ping' }], NOW);
    expect(loadThreadStamped()).toEqual({ at: NOW, messages: [{ role: 'user', text: 'ping' }] });
  });
  it('an emptied thread clears the cache (loadThreadStamped → null)', () => {
    saveThread([{ role: 'user', text: 'ping' }], NOW);
    saveThread([], NOW);
    expect(loadThreadStamped()).toBeNull();
  });
});
