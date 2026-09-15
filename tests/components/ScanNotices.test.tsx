import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanNotices } from '../../src/components/scan-router/ScanNotices';
import type { Vehicle } from '../../src/types';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// Everything a scan wants to TELL him while he is standing at the car. Every one of these REPORTS
// and never acts — a scan is a moment of attention, not a moment of decision.

const car = (over: Partial<Vehicle> = {}) => ({
  id: 'v1', licensePlate: 'LUR202', make: 'Mazda', model: 'CX-30', year: 2025,
  color: 'White', status: 'CLEAR', branchId: 'YWG', ...over,
} as Vehicle);

// ⚠️ `photographed` defaults TRUE here because every case below is a SCAN — a tag was in hand and a
// photo was taken. The typed-plate door is the false case, and it has its own describe at the bottom.
const show = (p: Partial<Parameters<typeof ScanNotices>[0]> = {}) =>
  render(<ScanNotices scanRead={null} vehicle={null} codexToast="" photographed {...p} />);

describe('ScanNotices — the retake watchlist, at the car', () => {
  // Aaron, 2026-08-27: "I pictured it like the geotab watch list. anytime I scan one that is on that
  // list it tells me." The flag had been written by the auditor since migration 130 and read by
  // NOTHING at scan time — a column with a writer and no reader on the surface that matters.
  it('⭐ tells him when he could not read this tag last time', () => {
    show({ vehicle: car({ keytagAuditResult: 'unreadable' }) });
    expect(screen.getByText(/couldn't read this tag last time/i)).toBeTruthy();
  });

  it('⭐ says the retake also returns the car to the audit queue', () => {
    show({ vehicle: car({ keytagAuditResult: 'unreadable' }) });
    expect(screen.getByText(/back in the audit queue/i)).toBeTruthy();
  });

  it('says nothing for a car he read fine, or never audited, or that did not match', () => {
    for (const v of [car({ keytagAuditResult: 'verified' }), car(), null]) {
      const { unmount } = show({ vehicle: v });
      expect(screen.queryByText(/couldn't read this tag/i), `${v?.keytagAuditResult}`).toBeNull();
      unmount();
    }
  });
});

describe('ScanNotices — the tag disagreeing with itself', () => {
  const read = (o: Partial<KeytagRead>) => ({ ...o } as KeytagRead);

  it('⭐ names the contradiction when city and owning number cannot both be right', () => {
    show({ scanRead: read({ owningCity: 'HALIFAX', owningArea: '8199' }) });
    expect(screen.getByText(/disagrees with itself/i)).toBeTruthy();
    // It names BOTH halves and what the city should be, because the operator decides which won —
    // FG never picks. (HALIFAX appears twice by design: the read, then the expectation.)
    expect(screen.getByText('HALIFAX')).toBeTruthy();     // what the tag says
    expect(screen.getByText('8199')).toBeTruthy();        // what the number says
    const note = screen.getByText(/disagrees with itself/i);
    expect(note.textContent).toMatch(/Winnipeg/);         // what the number MEANS
    expect(note.textContent).toMatch(/Halifax \(8198\)/);  // what the city should be
    expect(note.textContent).toMatch(/Check the tag/);     // and who decides: him
  });

  it('says nothing when the two halves agree', () => {
    show({ scanRead: read({ owningCity: 'WINNIPEG', owningArea: '8199' }) });
    expect(screen.queryByText(/disagrees with itself/i)).toBeNull();
  });

  it('⚠️ says nothing about a city FG cannot name — unknown is not disagreement', () => {
    // The Dollar/Thrifty Vancouver tags print "VAN DTG", which is not the string "Vancouver".
    show({ scanRead: read({ owningCity: 'VAN DTG', owningArea: '8890' }) });
    expect(screen.queryByText(/disagrees with itself/i)).toBeNull();
  });
});

describe('ScanNotices — the unknown model code', () => {
  it('says why registration degraded, for a code that resembles nothing', () => {
    show({ scanRead: { classCode: 'CZZZ' } as KeytagRead });
    expect(screen.getByText(/isn’t in the codex yet/i)).toBeTruthy();
  });

  it('⭐⭐ raises DOUBT instead, when the unknown code is one character from a known one', () => {
    // Measured 2026-08-29: CJCL was read as CJCI. Without this, that lands on the notice inviting
    // him to add the code by hand — which is exactly how CC59, CK45 and CN were born.
    show({ scanRead: { classCode: 'CJCI' } as KeytagRead });
    expect(screen.getByText(/read the tag again before teaching it as new/i)).toBeTruthy();
    expect(screen.queryByText(/isn’t in the codex yet/i)).toBeNull();
  });

  it('⚠️ never says "did you mean" — the nearest code is often the wrong one', () => {
    // CRSR is a misread of CKSE and sits one character from CRSV, a different car entirely.
    show({ scanRead: { classCode: 'CRSR' } as KeytagRead });
    expect(screen.getByText(/read the tag again/i)).toBeTruthy();
    expect(screen.queryByText(/did you mean/i)).toBeNull();
  });

  it('⚠️ stays quiet when this scan TAUGHT the code — asking him to add what FG just learned is the confusion it replaced', () => {
    show({ scanRead: { classCode: 'CZZZ' } as KeytagRead, codexToast: 'learned it' });
    expect(screen.queryByText(/isn’t in the codex yet/i)).toBeNull();
  });
});

// ⭐⭐ THE VIN FLAG, AND IT BELONGS HERE RATHER THAN ON THE RECORD. I shipped these checks onto the
// vehicle record first; Aaron corrected the placement in one sentence, 2026-08-30: *"the scanner
// worked perfectly, i just needed the flag on it so the next time i see it, the scan will tell me to
// recheck the VIN."* A VIN he can only see by opening a record is one he checks at a desk, where the
// door jamb is not reachable. Standing at the car is the only moment the fix is free.
describe('ScanNotices — recheck the VIN', () => {
  it('says nothing when the VIN agrees with the year', () => {
    show({ vehicle: car({ vinLast9: '3S7792108', year: 2025 }) });
    expect(screen.queryByText(/Recheck the VIN/)).not.toBeInTheDocument();
  });

  it('says nothing when there is no VIN on file yet', () => {
    show({ vehicle: car({ vinLast9: null, year: 2025 }) });
    expect(screen.queryByText(/Recheck the VIN/)).not.toBeInTheDocument();
  });

  it('⭐ flags a misread year code, with both values named', () => {
    show({ vehicle: car({ vinLast9: '68L484889', year: 2025 }) });   // 0ES628 — S read as 8
    expect(screen.getByText(/Recheck the VIN/)).toBeInTheDocument();
    expect(screen.getByText(/isn't a model-year code at all/)).toBeInTheDocument();
  });

  // ⚠️ LFJ400 — the tag itself prints VXSL47717, so a fresh read reproduces it exactly. The notice
  // has to fire EVERY time that car comes through, and it must send him to the door jamb rather
  // than to a scanner that is working perfectly.
  it('⚠️ sends him to the car, not the scanner, on a framing error', () => {
    show({ vehicle: car({ licensePlate: 'LFJ400', vinLast9: 'VXSL47717', year: 2025 }) });
    expect(screen.getByText(/off the car itself — the door jamb/)).toBeInTheDocument();
    expect(screen.queryByText(/re-?scan|scanner/i)).not.toBeInTheDocument();
  });

  // ⚠️ It reads the STORED VIN, not this scan's read — the whole point is that it keeps telling him
  // on every future scan of that car until somebody fixes the record.
  it('⚠️ fires on the stored VIN even with no fresh read in hand', () => {
    show({ scanRead: null, vehicle: car({ vinLast9: 'VXSL47717', year: 2025 }) });
    expect(screen.getByText(/Recheck the VIN/)).toBeInTheDocument();
  });

  it('is silent when the plate did not resolve to a car', () => {
    show({ vehicle: null });
    expect(screen.queryByText(/Recheck the VIN/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The tag is sharp, current, genuinely this car's — and still has no answer on it.
// Aaron, 2026-09-13: "wanna flag both priuses so the next scan will let me know to check other
// sources on the vehicle. like what the barcode sticker has."
describe('ScanNotices — when the TAG is what cannot answer', () => {
  it('⭐ sends him to the barcode sticker, at the car', () => {
    show({ vehicle: car({ keytagAuditResult: 'check-vehicle' }) });
    expect(screen.getByText(/barcode sticker in the door jamb/i)).toBeInTheDocument();
  });

  // ⚠️⚠️ THE WHOLE POINT OF A FOURTH WORD. 'unreadable' and 'stale' both end in "take a photo",
  // and that is the one instruction guaranteed to fail here: a perfect photo of a hand-written tag
  // still prints no VIN, and a perfect photo of a mis-printed tag reproduces the wrong VIN exactly.
  it('⚠️⚠️ never tells him a fresh photo will help — that is the instruction that cannot work', () => {
    show({ vehicle: car({ keytagAuditResult: 'check-vehicle' }) });
    expect(screen.getByText(/fresh photo of the tag won’t help/i)).toBeInTheDocument();
    expect(screen.queryByText(/grab a fresh photo|snap the one in your hand/i)).not.toBeInTheDocument();
  });

  // ⚠️⚠️ THE REGRESSION THIS FILE EXISTS TO HOLD. The first cut read "FG has no VIN for it, and
  // this tag doesn't carry one" — false on LZM539, whose tag prints 0T3076384 perfectly well. It is
  // simply another car's, so FG cannot store it. He would have been standing at the car holding a
  // tag with a VIN on it while FG insisted there wasn't one. Aaron: "they're two different vehicles
  // with the same unit and VIN."
  //
  // ⭐ THE RULE THAT CAME OUT OF IT: this notice may describe FG'S OWN RECORD and must never assert
  // what the tag does or does not print. A claim the artifact in his hand can contradict is worse
  // than no claim.
  it('⚠️⚠️ never claims the tag is blank — it speaks only for FG\'s record', () => {
    show({ vehicle: car({ keytagAuditResult: 'check-vehicle', vinLast9: null }) });
    expect(screen.getByText(/no VIN on file for it/i)).toBeInTheDocument();
    expect(screen.queryByText(/tag doesn’t carry|tag doesn't carry|not on the tag/i)).not.toBeInTheDocument();
  });

  // ⭐ DERIVED, NOT STORED — and the two cases want opposite things from him. LZM516 holds a VIN
  // that may be the OTHER car's, so the ask is to corroborate it, never to trust it.
  // ⚠️ year 2026 matches the VIN's own `T`, so ONLY this notice fires. At 2025 the VIN-recheck
  // notice fires too and prints the same string — correct behaviour, and the reason this fixture
  // is pinned: a test that happens to pass because two notices agree is not testing either one.
  it('⭐ asks him to corroborate a VIN FG already holds, rather than trust it', () => {
    show({ vehicle: car({ keytagAuditResult: 'check-vehicle', vinLast9: '0T3076384', year: 2026 }) });
    expect(screen.getByText('0T3076384')).toBeInTheDocument();
    expect(screen.getByText(/confirm the sticker agrees before trusting it/i)).toBeInTheDocument();
  });

  // ⭐ AND WHEN BOTH ARE TRUE, HE GETS BOTH. A car flagged check-vehicle whose stored VIN also
  // fails its own year check has two independent things wrong; suppressing either would hide one.
  it('⭐ stacks with the VIN-recheck notice rather than competing with it', () => {
    show({ vehicle: car({ keytagAuditResult: 'check-vehicle', vinLast9: '0T3076384', year: 2025 }) });
    expect(screen.getByText(/barcode sticker in the door jamb/i)).toBeInTheDocument();
    expect(screen.getByText(/Recheck the VIN/)).toBeInTheDocument();
  });

  it('is silent for every other audit state, and for an unmatched plate', () => {
    for (const v of [car({ keytagAuditResult: 'verified' }), car({ keytagAuditResult: 'unreadable' }), car(), null]) {
      const { unmount } = show({ vehicle: v });
      expect(screen.queryByText(/barcode sticker/i), `${v?.keytagAuditResult}`).toBeNull();
      unmount();
    }
  });
});

// ⭐⭐ THE TYPED DOOR'S BLIND SPOT (Aaron, 2026-09-15). A scan quietly attaches a missing tag photo
// (`useBackfillOnScan` → `attachKeytagPhotoIfMissing`), so the gap only ever existed where he TYPED:
// *"because I typed instead of using API on the scan the missing keytags never surfaced."*
// 41 of 763 live cars had no tag photo when this landed.
describe('ScanNotices — FG has never seen this car\'s tag', () => {
  it('⭐ asks for the tag when he typed the plate and FG has no photo', () => {
    show({ vehicle: car({ keytagPhotoUrl: undefined }), photographed: false });
    expect(screen.getByText(/no key tag photo on file/i)).toBeTruthy();
  });

  // ⚠️ THE FLASH GUARD. After a real scan the attach is in flight for a second or two, so keying off
  // the URL alone would tell him a photo is missing about one he just took.
  it('⚠️ stays silent on a real scan, even before the upload has landed', () => {
    show({ vehicle: car({ keytagPhotoUrl: undefined }), photographed: true });
    expect(screen.queryByText(/no key tag photo on file/i)).toBeNull();
  });

  it('stays silent when FG already has the tag', () => {
    show({ vehicle: car({ keytagPhotoUrl: 'https://x/keytag.jpg' }), photographed: false });
    expect(screen.queryByText(/no key tag photo on file/i)).toBeNull();
  });

  // Nothing resolved = nothing to ask about; the notice must not fire on a bare lookup miss.
  it('stays silent when no car resolved', () => {
    show({ vehicle: null, photographed: false });
    expect(screen.queryByText(/no key tag photo on file/i)).toBeNull();
  });

  // ⚠️ This file's standing rule: every notice REPORTS and never ACTS. The 📷 Scan a tag button is
  // already on the sheet — a second way to do the same thing is how two surfaces start to disagree.
  it('⚠️ reports only — it offers no button of its own', () => {
    const { container } = show({ vehicle: car({ keytagPhotoUrl: undefined }), photographed: false });
    expect(container.querySelectorAll('button').length).toBe(0);
  });
});
