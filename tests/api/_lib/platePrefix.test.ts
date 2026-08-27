import { describe, it, expect } from 'vitest';
import { correctManitobaPlate, MB_PLATE_PREFIXES } from '../../../api/_lib/platePrefix';

describe('correctManitobaPlate', () => {
  it('snaps the U-read-as-M/N misreads to the real prefix (the sheet hazard)', () => {
    expect(correctManitobaPlate('KMR250')).toBe('KUR250'); // U→M, the email car
    expect(correctManitobaPlate('LMR150')).toBe('LUR150');
    expect(correctManitobaPlate('LNR118')).toBe('LUR118'); // U→N
    expect(correctManitobaPlate('KNR232')).toBe('KUR232');
  });

  it('handles the LFJ/LJF swap-pair without cross-correcting them', () => {
    expect(correctManitobaPlate('LFJ383')).toBe('LFJ383'); // both are valid, untouched
    expect(correctManitobaPlate('LJF701')).toBe('LJF701');
    expect(correctManitobaPlate('LJT701')).toBe('LJF701'); // one-off from only LJF
    expect(correctManitobaPlate('LFF383')).toBe('LFF383'); // one-off from BOTH → ambiguous, left as-is
  });

  it('leaves an already-valid prefix untouched', () => {
    for (const p of MB_PLATE_PREFIXES) {
      expect(correctManitobaPlate(`${p}383`)).toBe(`${p}383`);
    }
  });

  it('never touches a foreign / out-of-province plate', () => {
    // Real non-MB plates from the inventory sheet — none is one char off a known prefix.
    for (const plate of ['SB264H', 'VR257P', 'OCC267', 'DBHJ179']) {
      expect(correctManitobaPlate(plate)).toBe(plate);
    }
  });

  it('does not guess when a misread is one-off from two prefixes', () => {
    // "MUR" is one char off both LUR (M/L) and KUR (M/K) → ambiguous → leave as-is.
    expect(correctManitobaPlate('MUR250')).toBe('MUR250');
  });

  it('normalizes case and spacing before matching', () => {
    expect(correctManitobaPlate('kmr 250')).toBe('KUR250');
    expect(correctManitobaPlate('  LFJ 383 ')).toBe('LFJ383');
  });

  it('leaves too-short or empty input alone', () => {
    expect(correctManitobaPlate('')).toBe('');
    expect(correctManitobaPlate('LF')).toBe('LF');
  });
});

// ── Pass 2: the body ─────────────────────────────────────────────────────────
// Aaron, 2026-08-21: "since its an MB car, FG knows that LUR is one of the prefixes for MB,
// so it should autocorrect in reading that L as a '1'." A confirmed MB fleet prefix IS the
// province signal, so the three characters behind it must be digits.
describe('correctManitobaPlate — digits behind a confirmed MB prefix', () => {
  it('snaps a letter sitting in a digit position', () => {
    expect(correctManitobaPlate('LURL43')).toBe('LUR143'); // the real 2026-07 duplicate
    expect(correctManitobaPlate('LURI43')).toBe('LUR143');
    expect(correctManitobaPlate('KUR2S0')).toBe('KUR250');
    expect(correctManitobaPlate('LZM5I6')).toBe('LZM516');
    expect(correctManitobaPlate('LFJ3B3')).toBe('LFJ383');
  });

  it('fixes both halves in one pass — bad prefix AND a bad digit', () => {
    expect(correctManitobaPlate('LMRL43')).toBe('LUR143'); // U→M and L→1 together
  });

  it('leaves an already-correct plate alone', () => {
    expect(correctManitobaPlate('LUR143')).toBe('LUR143');
    expect(correctManitobaPlate('LZM516')).toBe('LZM516');
  });

  it('⭐ never touches the body of a foreign plate — the prefix gate is the whole safety net', () => {
    // Out-of-province shapes that contain confusable letters where MB would want digits.
    for (const plate of ['VRS123', 'SBL456', 'OCCB12', 'MURL43', 'ABCS55']) {
      expect(correctManitobaPlate(plate)).toBe(plate);
    }
  });

  it('refuses to half-correct: one unmappable letter means hands off', () => {
    // C has no digit reading, so we do not emit "LUR1A2"-style guesswork.
    expect(correctManitobaPlate('LURCAR')).toBe('LURCAR');
    expect(correctManitobaPlate('LURL4X')).toBe('LURL4X');
  });

  it('leaves a body that is not three characters alone', () => {
    expect(correctManitobaPlate('LUR1433')).toBe('LUR1433');
    expect(correctManitobaPlate('LUR14')).toBe('LUR14');
  });

  it('still normalises case and spacing on the way through', () => {
    expect(correctManitobaPlate(' lurl43 ')).toBe('LUR143');
  });

  it('an ambiguous prefix blocks pass 2 as well', () => {
    // LFF is one-off from BOTH LFJ and LJF, so it is never confirmed MB — body untouched.
    expect(correctManitobaPlate('LFFL43')).toBe('LFFL43');
  });
});

// ── MCM / MCN, added 2026-08-25 ───────────────────────────────────────────────
// MCN was missing while 43 active cars wore it — the fleet's 5th-largest prefix, with no
// misread protection at all, and nothing anywhere warned about it. Aaron named both from
// the lot. These tests exist because the list's staleness is otherwise INVISIBLE: an
// unlisted prefix simply gets no correction, and every existing test keeps passing.
describe('the MCM / MCN series', () => {
  it('corrects the digit body now that the prefixes are known', () => {
    // Before they were listed, these fell straight through the province gate untouched.
    expect(correctManitobaPlate('MCN1O5')).toBe('MCN105');   // O→0
    expect(correctManitobaPlate('MCM55I')).toBe('MCM551');   // I→1, a real F-150
    expect(correctManitobaPlate('MCNS43')).toBe('MCN543');   // S→5
  });

  it('leaves both untouched when already valid', () => {
    expect(correctManitobaPlate('MCN443')).toBe('MCN443');
    expect(correctManitobaPlate('MCM557')).toBe('MCM557');
  });

  it('snaps to whichever of the pair is the UNIQUE one-off match', () => {
    expect(correctManitobaPlate('NCM557')).toBe('MCM557');   // one-off from MCM only
    expect(correctManitobaPlate('MCN557')).toBe('MCN557');   // already valid, not "corrected" to MCM
  });

  // THE PAIR HAZARD. MCM and MCN are one character apart — the first such pair in this list.
  // A read sitting one char from BOTH is genuinely ambiguous between two real cars, so it must
  // be handed back untouched rather than guessed. Same contract as LFJ/LJF.
  it('refuses to guess between MCM and MCN', () => {
    expect(correctManitobaPlate('MCH557')).toBe('MCH557');   // one-off from both
    expect(correctManitobaPlate('MCR557')).toBe('MCR557');
  });

  // A deliberate, documented COST of adding MCM: MZM is now one char from LZM and from MCM,
  // so it stops snapping to LZM. Pinned so a future reader sees intent, not an oversight.
  it('gives up correcting MZM → LZM, because MCM made it ambiguous', () => {
    expect(correctManitobaPlate('MZM123')).toBe('MZM123');
  });

  // The province gate must still hold: the Suburban being converted wears an Alberta plate,
  // and the singleton MB-shaped plates on file are unverified — none may be dragged toward
  // a known prefix.
  it('still never touches an out-of-province plate', () => {
    for (const plate of ['0GK641', '0HC426', 'DEYT759', 'NW129N', '407PFI']) {
      expect(correctManitobaPlate(plate)).toBe(plate);
    }
  });
});

// ── All-or-nothing, added 2026-08-27 ──────────────────────────────────────────────────────────
//
// Aaron, from the scan sheet: *"why is it if I typed it incorrectly and hit look up it comes up as
// 'LFJK947' even if I typed it as 'DFJK947'?"* Every early return handed back the ALREADY-SNAPPED
// string, including the branch whose own comment said "leave it be". So a plate could have its
// prefix rewritten, then be correctly declared unqualified, and keep the rewrite.
describe('a correction is all-or-nothing', () => {
  // ⭐⭐⭐ THE REPORTED BUG. `DFJ` is one character from `LFJ` and uniquely so, so pass 1 snapped it;
  // the 4-character body then disqualified it; and the snapped value came back regardless.
  it('does not half-correct a plate whose shape disqualifies it', () => {
    expect(correctManitobaPlate('DFJK947')).toBe('DFJK947');
  });

  // ⚠️ NOT A TYPING-ONLY BUG — the scan path ran the same code. These two survived by LUCK, not by
  // the shape gate the old comment claimed: DFD sits near no prefix, and DUR is one char from BOTH
  // LUR and KUR so snapPrefix refuses on ambiguity. Pinned so the luck becomes a rule.
  it('leaves out-of-province plates alone by DESIGN, not coincidence', () => {
    for (const p of ['DFDA712', 'DUR143', 'SPHV03', '0GK641', 'DFKJ947']) {
      expect(correctManitobaPlate(p)).toBe(p);
    }
  });

  // ⭐ And the corrector must still do the job it exists for — a hand-drawn U misread as M or N, and
  // a letter sitting in a digit slot. Losing these to fix the above would be the wrong trade.
  it('still corrects the misreads it was built for', () => {
    expect(correctManitobaPlate('LMR143')).toBe('LUR143');   // U read as M
    expect(correctManitobaPlate('LNR143')).toBe('LUR143');   // U read as N
    expect(correctManitobaPlate('KMR700')).toBe('KUR700');
    expect(correctManitobaPlate('LURL43')).toBe('LUR143');   // L sitting in a digit slot
    expect(correctManitobaPlate('DFJ143')).toBe('LFJ143');   // a REAL MB-shaped misread still snaps
  });

  // ⚠️ The distinction the whole fix turns on: the same wrong prefix is corrected when the rest of
  // the plate says "this is one of ours", and left alone when it doesn't.
  it('snaps DFJ143 but not DFJK947 — the body is what decides', () => {
    expect(correctManitobaPlate('DFJ143')).toBe('LFJ143');
    expect(correctManitobaPlate('DFJK947')).toBe('DFJK947');
  });
});
