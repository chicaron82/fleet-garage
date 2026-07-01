import { describe, it, expect } from 'vitest';
import {
  packThread, unpackThread, THREAD_MAX_AGE_MS, THREAD_MAX_MESSAGES,
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
