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

const show = (p: Partial<Parameters<typeof ScanNotices>[0]> = {}) =>
  render(<ScanNotices scanRead={null} vehicle={null} codexToast="" {...p} />);

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
  it('says why registration degraded', () => {
    show({ scanRead: { classCode: 'CZZZ' } as KeytagRead });
    expect(screen.getByText(/isn’t in the codex yet/i)).toBeTruthy();
  });

  it('⚠️ stays quiet when this scan TAUGHT the code — asking him to add what FG just learned is the confusion it replaced', () => {
    show({ scanRead: { classCode: 'CZZZ' } as KeytagRead, codexToast: 'learned it' });
    expect(screen.queryByText(/isn’t in the codex yet/i)).toBeNull();
  });
});
