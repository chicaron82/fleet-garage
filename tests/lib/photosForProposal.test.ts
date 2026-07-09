import { describe, it, expect } from 'vitest';
import { photosForProposal } from '../../src/lib/photosForProposal';

type Turn = { role: 'user' | 'assistant'; images?: string[] };

describe('photosForProposal', () => {
  it('scopes to the damage turn — a hold does NOT pick up an earlier keytag photo', () => {
    // The real 2026-07-08 flow: keytag lookup turn, then a damage-photo turn, then the hold.
    const messages: Turn[] = [
      { role: 'user', images: ['keytag.jpg'] },          // 0: lookup / registration keytag
      { role: 'assistant' },                             // 1: "not in fleet, is it an Envista?"
      { role: 'user', images: ['hood.jpg', 'roof.jpg'] },// 2: "damage photos for LJF698"
      { role: 'assistant' },                             // 3: drafts the hail hold  ← proposal here
    ];
    expect(photosForProposal(messages, 3)).toEqual(['hood.jpg', 'roof.jpg']);
  });

  it('collects across a contiguous run of user turns', () => {
    const messages: Turn[] = [
      { role: 'assistant' },
      { role: 'user', images: ['a.jpg'] },
      { role: 'user', images: ['b.jpg', 'c.jpg'] },
      { role: 'assistant' }, // proposal
    ];
    expect(photosForProposal(messages, 3)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('returns nothing when the prompting turn had no photos', () => {
    const messages: Turn[] = [
      { role: 'user', images: ['keytag.jpg'] },
      { role: 'assistant' },
      { role: 'user' }, // text-only ("confirm it")
      { role: 'assistant' }, // proposal
    ];
    expect(photosForProposal(messages, 3)).toEqual([]);
  });

  it('handles a proposal with no preceding user turn', () => {
    expect(photosForProposal([{ role: 'assistant' }], 0)).toEqual([]);
    expect(photosForProposal([], 0)).toEqual([]);
  });
});
