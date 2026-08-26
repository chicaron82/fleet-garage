import { describe, it, expect } from 'vitest';
import { MESSAGE_TONE, type MessageTone } from '../../src/lib/messageTone';
import { TONE_TEXT, TONE_BLOCK } from '../../src/lib/scanStatusLine';

// Two surfaces were each inheriting a colour instead of choosing one, and they failed in OPPOSITE
// directions: TripStartForm announced "✨ Registered LUR330 · 2026 Nissan Kicks" on Toast's
// default, which Toast documented as "the original red (alerts)"; AirportFlipSection hard-coded
// green and fed that same element "Could not read that tag — try again."

describe('MESSAGE_TONE', () => {
  it('maps the three kinds of news onto the colours they mean', () => {
    expect(MESSAGE_TONE.success).toBe('green');
    expect(MESSAGE_TONE.notice).toBe('amber');
    expect(MESSAGE_TONE.alert).toBe('red');
  });

  // ⭐ THREE, NOT TWO. The ticket said "green the successes, keep warnings red" — and binary would
  // have forced "not on file, capturing for the counter" into red, which is the same lie in the
  // other direction: nothing failed, the flip proceeds.
  it('has a tone for "happened, but worth knowing"', () => {
    const tones: MessageTone[] = ['success', 'notice', 'alert'];
    expect(Object.keys(MESSAGE_TONE).sort()).toEqual([...tones].sort());
  });

  // ⚠️ Reuses FG's EXISTING colour vocabulary rather than growing a second one — the mistake that
  // gave the register form its own EV dialect. Every tone must resolve in both class maps.
  it('every tone resolves in the colour vocabulary it borrows', () => {
    for (const tone of Object.keys(MESSAGE_TONE) as MessageTone[]) {
      expect(TONE_TEXT[MESSAGE_TONE[tone]], tone).toBeTruthy();
      expect(TONE_BLOCK[MESSAGE_TONE[tone]], tone).toBeTruthy();
    }
  });

  it('no two kinds share a colour — they must be distinguishable at a glance', () => {
    const colours = Object.values(MESSAGE_TONE);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
