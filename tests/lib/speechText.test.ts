import { describe, it, expect } from 'vitest';
import { stripForSpeech } from '../../src/lib/speechText';

describe('stripForSpeech', () => {
  it('drops **bold** markers but keeps the words (the "asterisk asterisk" bug)', () => {
    expect(stripForSpeech('Unit **5427620** is a **Kia Sportage Hybrid**')).toBe(
      'Unit 5427620 is a Kia Sportage Hybrid',
    );
  });

  it('strips italics, inline code, and any stray asterisk', () => {
    expect(stripForSpeech('the *plate* is `LJF723` and a lone * here')).toBe('the plate is LJF723 and a lone here');
  });

  it('strips headers, bullet and quote markers', () => {
    expect(stripForSpeech('# Held\n- LFJ379\n> note')).toBe('Held\nLFJ379\nnote');
  });

  it('leaves plain text untouched (the goal once the prompt lands)', () => {
    const plain = 'Registered LJF723 to the fleet.';
    expect(stripForSpeech(plain)).toBe(plain);
  });
});
