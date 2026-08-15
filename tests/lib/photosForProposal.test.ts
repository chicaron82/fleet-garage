import { describe, it, expect } from 'vitest';
import { photosForProposal, keytagPhotoForProposal, photosForProposalConfirm } from '../../src/lib/photosForProposal';

type Turn = { role: 'user' | 'assistant'; images?: string[]; proposal?: unknown };
const draft = { kind: 'register_vehicle' };   // stand-in for a real Proposal — presence is all that matters

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

  // ── the proposal boundary ──
  it('STOPS at a prior proposal — a second register never inherits the first car\'s tag', () => {
    // Register car A off its tag, then ask to register car B without showing a new tag.
    // Before the boundary this reached back past proposal A and attached A's key tag to B.
    const messages: Turn[] = [
      { role: 'user', images: ['tag-a.jpg'] }, // 0: car A's key tag
      { role: 'assistant', proposal: draft },  // 1: drafts register A   ← boundary
      { role: 'user' },                        // 2: "now register the RAV4 too" (no photo)
      { role: 'assistant', proposal: draft },  // 3: drafts register B   ← confirming this
    ];
    expect(keytagPhotoForProposal(messages, 3)).toEqual([]);   // fails SAFE, never ['tag-a.jpg']
  });

  it('each car keeps its OWN tag in a sequential two-register chat', () => {
    const messages: Turn[] = [
      { role: 'user', images: ['tag-a.jpg'] }, // 0
      { role: 'assistant', proposal: draft },  // 1: register A
      { role: 'user', images: ['tag-b.jpg'] }, // 2
      { role: 'assistant', proposal: draft },  // 3: register B
    ];
    expect(keytagPhotoForProposal(messages, 1)).toEqual(['tag-a.jpg']);
    expect(keytagPhotoForProposal(messages, 3)).toEqual(['tag-b.jpg']);
  });

  it('the boundary is a PROPOSAL, not merely an assistant turn — Q&A still reaches back', () => {
    // Regression guard on 2372e00: plain assistant replies must NOT stop the walk, or the
    // conversational register breaks again. Only a proposal-bearing turn is a boundary.
    const messages: Turn[] = [
      { role: 'user', images: ['keytag.jpg'] },
      { role: 'assistant' },                  // "what year is it?" — no proposal, walk continues
      { role: 'user' },                       // "2021"
      { role: 'assistant' },                  // "and the class?" — still no proposal
      { role: 'user' },                       // "IFAR"
      { role: 'assistant', proposal: draft }, // 5: the register draft ← confirming this
    ];
    expect(keytagPhotoForProposal(messages, 5)).toEqual(['keytag.jpg']);
  });

  it('a proposal AFTER the tag but BEFORE this one still bounds the walk', () => {
    // A hold drafted mid-chat also closes the sub-operation — a later register must not
    // reach back across it to a tag that belonged to the pre-hold conversation.
    const messages: Turn[] = [
      { role: 'user', images: ['tag-a.jpg'] },
      { role: 'assistant', proposal: draft }, // 1: a hold draft — boundary
      { role: 'user' },
      { role: 'assistant', proposal: draft }, // 3: register draft
    ];
    expect(keytagPhotoForProposal(messages, 3)).toEqual([]);
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
