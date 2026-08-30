import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// The VIN chip's job on the record: stay quiet on a car that agrees with itself, and go amber with
// the RIGHT instruction when it doesn't. Aaron derived the rule from two tags and corrected two
// cars by hand; the fixtures below are the real plates.

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ updateVehicleFields: vi.fn(), allVehicles: [] }),
}));
vi.mock('../../src/hooks/useVehicleSightings', () => ({
  useVehicleSightings: () => ({ lastSeenAt: null, priorSeenAt: null, count: 0, neverSeen: true, rows: [] }),
}));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

import { VehicleRecordFacts } from '../../src/components/vehicle/VehicleRecordFacts';

const mount = (vinLast9: string, year: number) =>
  render(<VehicleRecordFacts vehicleId="v1" plate="TEST123" vinLast9={vinLast9} year={year} />);

const chip = (vin: string) => screen.getByText(new RegExp(vin));

describe('the VIN chip on the record', () => {
  it('is quiet when the VIN agrees with the year', () => {
    mount('3S7792108', 2025);                        // HMT717, after his own fix
    expect(chip('3S7792108').textContent).toContain('🔖');
    expect(chip('3S7792108').textContent).not.toContain('⚠️');
  });

  // ⭐ The two he corrected by hand before I finished verifying the rule.
  it('⭐ goes amber on a misread year code', () => {
    mount('357792108', 2025);                        // the 5-for-S he fixed
    const el = chip('357792108');
    expect(el.textContent).toContain('⚠️');
    expect(el.getAttribute('title')).toMatch(/isn't a model-year code at all/);
  });

  // ⚠️ DIFFERENT BUG, DIFFERENT INSTRUCTION. A wrong character is one glyph to re-read; a bad check
  // digit means the whole nine-character window is shifted. Telling him to re-read a glyph on
  // LFJ400 would have him hunting for a character that is perfectly correct on the tag.
  it('⚠️ tells him to RE-CAPTURE on a framing error, not to re-read', () => {
    mount('VXSL47717', 2025);                        // LFJ400 — the only one in 560
    const el = chip('VXSL47717');
    expect(el.textContent).toContain('⚠️');
    expect(el.getAttribute('title')).toMatch(/framed wrong, not misread/);
    expect(el.getAttribute('title')).toMatch(/Re-capture the VIN/);
  });

  // ⚠️ NEVER PROPOSES A VALUE — LJF698 is the proof: the VIN was right, the YEAR was the misread.
  it('⚠️ names both years and suggests neither', () => {
    mount('9TB189231', 2025);                        // LJF698
    const title = chip('9TB189231').getAttribute('title')!;
    expect(title).toMatch(/"T" means 2026, but the record says 2025/);
    expect(title).toMatch(/either the VIN or the year on this record is wrong/);
    expect(title).not.toMatch(/should be|change it to/i);
  });

  it('stays quiet on a car with no year on file (the plate-only records)', () => {
    mount('357792108', 0);
    expect(chip('357792108').textContent).not.toContain('⚠️');
  });
});
