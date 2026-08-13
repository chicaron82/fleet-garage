import { describe, it, expect } from 'vitest';
import { photosForProposal, keytagPhotoForProposal, photosForProposalConfirm } from '../../src/lib/photosForProposal';

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

describe('keytagPhotoForProposal', () => {
  it('reaches BACK past assistant turns for the keytag — the conversational-register case', () => {
    // Aaron's real 2026-08-13 flow: upload the handwritten tag, then Effie asks for the
    // missing year, the operator answers in text, THEN the register proposal drafts.
    const messages: Turn[] = [
      { role: 'user', images: ['keytag.jpg'] }, // 0: the key-tag photo
      { role: 'assistant' },                    // 1: "what year is it?"
      { role: 'user' },                         // 2: "2021" (text-only)
      { role: 'assistant' },                    // 3: drafts the register  ← proposal here
    ];
    // photosForProposal misses it (stops at the text turn); keytag scope finds it.
    expect(photosForProposal(messages, 3)).toEqual([]);
    expect(keytagPhotoForProposal(messages, 3)).toEqual(['keytag.jpg']);
  });

  it('returns the LAST image of the most-recent image-bearing user turn', () => {
    const messages: Turn[] = [
      { role: 'user', images: ['old.jpg'] },
      { role: 'assistant' },
      { role: 'user', images: ['tag-a.jpg', 'tag-b.jpg'] }, // re-shot the tag
      { role: 'assistant' }, // proposal
    ];
    expect(keytagPhotoForProposal(messages, 3)).toEqual(['tag-b.jpg']);
  });

  it('returns [] when the operator uploaded no image at all', () => {
    const messages: Turn[] = [
      { role: 'user' },
      { role: 'assistant' },
    ];
    expect(keytagPhotoForProposal(messages, 2)).toEqual([]);
    expect(keytagPhotoForProposal([], 0)).toEqual([]);
  });
});

describe('photosForProposalConfirm — kind-aware scope', () => {
  // A register drafted after a conversational Q&A: keytag several turns back.
  const conversational: Turn[] = [
    { role: 'user', images: ['keytag.jpg'] },
    { role: 'assistant' },
    { role: 'user' }, // "2021"
    { role: 'assistant' }, // proposal at index 3
  ];

  it('register_vehicle uses the keytag reach-back scope', () => {
    expect(photosForProposalConfirm('register_vehicle', conversational, 3)).toEqual(['keytag.jpg']);
  });

  it('update_vehicle (backfill) uses the keytag reach-back scope', () => {
    expect(photosForProposalConfirm('update_vehicle', conversational, 3)).toEqual(['keytag.jpg']);
  });

  it('a hold keeps the tight contiguous scope (never sweeps an earlier keytag)', () => {
    const holdFlow: Turn[] = [
      { role: 'user', images: ['keytag.jpg'] },
      { role: 'assistant' },
      { role: 'user', images: ['hood.jpg'] }, // damage turn
      { role: 'assistant' }, // hold proposal
    ];
    expect(photosForProposalConfirm('flag_hold', holdFlow, 3)).toEqual(['hood.jpg']);
    // register_and_hold is a hold for photo purposes — damage scope, not keytag reach-back.
    expect(photosForProposalConfirm('register_and_hold', conversational, 3)).toEqual([]);
  });
});
