import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { GaugeLine } from '../../src/lib/fuelReadings';

// Aaron, 2026-08-29: *"after entering the pump values, can we have it collapsed, showing what was
// entered. if i open, i won't be around to enter the closing readings. that would be a VERY long
// shift lol"*.
//
// Six inputs, three of which the person looking at them structurally will not fill. The hook has
// said so in its own header the whole time — *"FG has one user, so a shift he OPENS has nobody to
// log its close"* — and the form went on showing all six anyway. These tests guard what the
// control DOES TO HIM, not what it computes.

const h = {
  saved: false,
  summary: [] as GaugeLine[],
  saving: false,
  canSave: true,
  saveError: false,
  handleSave: vi.fn().mockResolvedValue(undefined),
  clearSaved: vi.fn(),
  pump1Open: '', pump1Close: '', pump2Open: '', pump2Close: '',
  digitalOpen: '', digitalClose: '', topupNote: '',
  setPump1Open: vi.fn(), setPump1Close: vi.fn(), setPump2Open: vi.fn(), setPump2Close: vi.fn(),
  setDigitalOpen: vi.fn(), setDigitalClose: vi.fn(), setTopupNote: vi.fn(),
  pump1Pumped: null as number | null, pump2Pumped: null as number | null,
  digitalNet: null as number | null, digitalUp: false,
};
vi.mock('../../src/hooks/useFuelPumpReadings', () => ({ useFuelPumpReadings: () => h }));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

import { FuelPumpReadings } from '../../src/components/my-shift/FuelPumpReadings';

const USER = { id: 'u1', branchId: 'YWG' } as never;
const mount = () => render(<FuelPumpReadings user={USER} />);
const inputs = () => screen.queryAllByRole('spinbutton');

const OPENED_ONLY: GaugeLine[] = [
  { label: 'Pump 1', text: 'opened at 12,345', delta: null, closed: false },
  { label: 'Tank', text: 'opened at 4,200.5', delta: null, closed: false },
];
const FULL_DAY: GaugeLine[] = [
  { label: 'Pump 1', text: '12,345 → 12,890', delta: '545 L', closed: true },
];

beforeEach(() => {
  h.saved = false; h.summary = []; h.saveError = false; h.saving = false;
  h.handleSave.mockClear().mockResolvedValue(undefined);
});

describe('FuelPumpReadings — collapsing', () => {
  it('a fresh day opens expanded, with every field ready', () => {
    mount();
    expect(inputs()).toHaveLength(6);
    expect(screen.queryByText('Tap to edit')).not.toBeInTheDocument();
  });

  // He saved earlier and came back to look — not to enter.
  it('⭐ a day already saved lands COLLAPSED, showing what was entered', () => {
    h.saved = true; h.summary = OPENED_ONLY;
    mount();
    expect(inputs()).toHaveLength(0);
    expect(screen.getByText('opened at 12,345')).toBeInTheDocument();
    expect(screen.getByText('Tap to edit')).toBeInTheDocument();
  });

  // ⚠️ THE POINT. An opening-only gauge is a finished statement about a running shift, not a
  // half-filled row — so no dash, no arrow, no empty box implying he still owes a number.
  it('⚠️ says "shift still open" instead of leaving a blank to fill', () => {
    h.saved = true; h.summary = OPENED_ONLY;
    mount();
    expect(screen.getAllByText(/shift still open/)).toHaveLength(2);
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('shows the litres pumped once a gauge has both ends', () => {
    h.saved = true; h.summary = FULL_DAY;
    mount();
    expect(screen.getByText('12,345 → 12,890')).toBeInTheDocument();
    expect(screen.getByText('545 L')).toBeInTheDocument();
    expect(screen.queryByText(/shift still open/)).not.toBeInTheDocument();
  });

  it('re-expands to the full form on tap, and back again', () => {
    h.saved = true; h.summary = OPENED_ONLY;
    mount();
    const header = screen.getByRole('button', { name: /Fuel Pump Readings/i });
    fireEvent.click(header);
    expect(inputs()).toHaveLength(6);
    fireEvent.click(header);
    expect(inputs()).toHaveLength(0);
  });

  // ⚠️⚠️ THE BUG THE COLLAPSE LOGIC IS ORDERED TO PREVENT. Written the other way round, a FAILED
  // save still folds the form away behind a summary claiming the values are stored. Nothing is
  // collapsible until something is genuinely saved.
  it('⚠️ never collapses when the save did not land', () => {
    h.saved = false; h.summary = OPENED_ONLY; h.saveError = true;
    mount();
    expect(inputs()).toHaveLength(6);
    expect(screen.queryByText('Tap to edit')).not.toBeInTheDocument();
  });

  // Nothing entered at all → nothing to collapse into; the header must stay inert.
  it('stays expanded when there is no summary to show', () => {
    h.saved = true; h.summary = [];
    mount();
    expect(inputs()).toHaveLength(6);
    expect(screen.getByRole('button', { name: /Fuel Pump Readings/i })).toBeDisabled();
  });
});
