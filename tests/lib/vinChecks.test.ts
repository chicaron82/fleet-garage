import { describe, it, expect } from 'vitest';
import { checkVinFraming, checkVinYear, vinFindings, vinFindingHint } from '../../src/lib/vinChecks';

// ⭐ Every fixture below is a REAL car from the fleet on 2026-08-29, named by its plate. Aaron
// derived the year-code rule himself from two tags he had read, and corrected two cars by hand
// before the verification query had finished running.

describe('checkVinFraming — the check digit', () => {
  // ⚠️⚠️ THE ONLY ONE IN 560 VINs, and THE TAG ITSELF IS WRONG. Opening the photo on 2026-08-30
  // settled it: the tag prints `Last9vin: VXSL47717` in nine characters, and every other field on
  // it matches FG exactly (unit 5421995, LFJ400, CKSV, B4, 08199, RED 4DR, 25). The reader copied
  // it faithfully. So the message must not blame the read — it says these nine characters cannot be
  // a valid last-9 and leaves the cause open, because accusing the scanner would send him to
  // re-photograph a tag that is already captured correctly.
  it('⭐ flags LFJ400 — a letter where the check digit belongs is a FRAMING error', () => {
    const f = checkVinFraming('VXSL47717');
    expect(f).toMatchObject({ kind: 'framing', got: 'V' });
    expect(f!.detail).toMatch(/aren't a valid last-9, whatever produced them/);
    expect(f!.detail).not.toMatch(/read|scan/i);   // never blames the capture
  });

  it('passes a legal check digit, digit or X', () => {
    expect(checkVinFraming('3S7792108')).toBeNull();   // HMT717, after his fix
    expect(checkVinFraming('XSL479274')).toBeNull();   // LFJ397 — X is legal at position 9
  });

  it('says nothing about a car with no VIN yet', () => {
    expect(checkVinFraming(null)).toBeNull();
    expect(checkVinFraming('')).toBeNull();
    expect(checkVinFraming('   ')).toBeNull();
  });

  it('normalises case before judging', () => {
    expect(checkVinFraming('vxsl47717')).toMatchObject({ got: 'V' });
    expect(checkVinFraming('xsl479274')).toBeNull();
  });
});

describe('checkVinYear — the model-year code', () => {
  // The two Aaron corrected by hand: S misread as 5, and S misread as 8.
  it('⭐ catches the exact misreads he fixed himself', () => {
    expect(checkVinYear('357792108', 2025)).toMatchObject({ kind: 'year-code', got: '5', expected: 'S' });
    expect(checkVinYear('287762260', 2025)).toMatchObject({ kind: 'year-code', got: '8', expected: 'S' });
  });

  it('passes once they are corrected', () => {
    expect(checkVinYear('3S7792108', 2025)).toBeNull();
    expect(checkVinYear('2S7762260', 2025)).toBeNull();
  });

  // ⚠️ A DIGIT AT POSITION 10 MEANS 2031-2039, so on this fleet it can never be right. The copy has
  // to say "isn't a model-year code at all" rather than naming a year nobody has.
  it('⚠️ says an impossible character is impossible, not that it means some other year', () => {
    const f = checkVinYear('68L484889', 2025)!;        // 0ES628, S read as 8
    expect(f.kind).toBe('year-code');
    expect(f.detail).toMatch(/isn't a model-year code at all/);
    expect(f.detail).toMatch(/a 2025 reads "S"/);
  });

  it('⚠️ U is barred from the year position even though it is legal elsewhere in a VIN', () => {
    const f = checkVinYear('1U1535594', 2026)!;        // LUR339, T read as U
    expect(f).toMatchObject({ got: 'U', expected: 'T', codeYear: null });
  });

  // ⭐⭐ LJF698 — the case that forbids auto-correction. Filed as a 2025, VIN says T. Aaron:
  // "LJF698 is a 2026. a misread". The VIN was right and the YEAR was the wrong field.
  it('⭐ names BOTH years when a legal code disagrees — because either field may be the wrong one', () => {
    const f = checkVinYear('9TB189231', 2025)!;
    expect(f).toMatchObject({ got: 'T', expected: 'S', storedYear: 2025, codeYear: 2026 });
    expect(f.detail).toBe('"T" means 2026, but the record says 2025 (which reads "S").');
  });

  it('handles the whole live year range', () => {
    expect(checkVinYear('7RL554216', 2024)).toBeNull();   // LFJ246
    expect(checkVinYear('8NF258345', 2022)).toBeNull();   // LJF679, a Tesla
    expect(checkVinYear('6TL355945', 2026)).toBeNull();   // 0FN125
  });

  it('stays quiet when it cannot judge', () => {
    expect(checkVinYear(null, 2025)).toBeNull();
    expect(checkVinYear('3S7792108', null)).toBeNull();
    expect(checkVinYear('3S7792108', 0)).toBeNull();      // the year-0 plate-only records
    expect(checkVinYear('AS7792108', 1998)).toBeNull();   // year outside the table — say nothing
    expect(checkVinYear('S', 2025)).toBeNull();           // too short to have a position 10
  });

  // ⚠️ A shifted window makes EVERY position meaningless, so reporting a year-code error on top of
  // a framing error is the same defect announced twice — and it would send him to re-read one glyph
  // when the whole field needs recapturing.
  it('⚠️ defers to framing rather than double-reporting the same car', () => {
    expect(checkVinYear('VXSL47717', 2025)).toBeNull();
  });
});

describe('vinFindings', () => {
  it('returns at most one finding, framing first', () => {
    expect(vinFindings('VXSL47717', 2025).map(f => f.kind)).toEqual(['framing']);
    expect(vinFindings('68L484889', 2025).map(f => f.kind)).toEqual(['year-code']);
    expect(vinFindings('3S7792108', 2025)).toEqual([]);
  });

  it('is empty for a car with nothing to check', () => {
    expect(vinFindings(null, null)).toEqual([]);
  });
});

describe('vinFindingHint — the two fixes are different actions', () => {
  // ⭐ A wrong character is one glyph to re-read. A bad check digit is the whole field to recapture.
  // Collapsing them into one message would send him to do the wrong job on LFJ400.
  it('asks for a recapture on framing and a tag check on a year code', () => {
    expect(vinFindingHint(vinFindings('VXSL47717', 2025)[0])).toMatch(/off the car itself — the door jamb/);
    expect(vinFindingHint(vinFindings('9TB189231', 2025)[0])).toMatch(/either the VIN or the year/);
  });

  // ⚠️ NEVER PROPOSES A VALUE. LJF698 proves the year can be the wrong field; the eight
  // impossible-character cars prove the VIN can be. The hint must not guess between them.
  it('⚠️ never suggests what to change it to', () => {
    for (const vin of ['VXSL47717', '9TB189231', '68L484889']) {
      const hint = vinFindingHint(vinFindings(vin, 2025)[0]);
      expect(hint).not.toMatch(/should be|change it to|correct value/i);
    }
  });
});
