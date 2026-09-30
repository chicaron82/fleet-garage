import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { PlateSuggestions } from '../../src/components/movement/PlateSuggestions';
import type { VehicleSearchResult } from '../../src/lib/ev-detection';

// ⚠️ Pass two on `be4ab46` (2026-09-29): `searchVehicles` promises "the caller must SAY so, never
// render silence", and both trip typeaheads ignored `failed` — a dead network looked exactly like
// "no such plate". This is the one surface that now owns saying so, for both of them.
// docs/September/ticket-lookup-goes-quiet.md

const car = (plate: string, unit: string | null = '1'): VehicleSearchResult => ({
  license_plate: plate, unit_number: unit, make: 'Nissan', model: 'Kicks', year: 2026,
  color: 'White', is_hybrid: false, is_tesla: false, archived_at: null,
} as unknown as VehicleSearchResult);

const props = { open: true, failed: false, onPick: vi.fn(), topClass: 'top-[66px]' };

describe('PlateSuggestions', () => {
  it('lists the matches', () => {
    render(<PlateSuggestions {...props} suggestions={[car('LUR479'), car('LUR538')]} />);
    expect(screen.getByText('LUR479')).toBeInTheDocument();
    expect(screen.getByText('LUR538')).toBeInTheDocument();
  });

  it('⭐ a FAILED search says so — the whole point', () => {
    render(<PlateSuggestions {...props} suggestions={[]} failed />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't search just now/i);
  });

  // ⚠️ It must tell him what still works: both forms start a trip on a typed plate alone
  // (`canStart` reads draft.plate), so this is real advice, not a shrug.
  it('⚠️ the failure line says what he can DO', () => {
    render(<PlateSuggestions {...props} suggestions={[]} failed />);
    expect(screen.getByRole('alert')).toHaveTextContent(/type the full plate/i);
  });

  it('⚠️⚠️ failure OUTRANKS a stale list — no old matches under a dead search', () => {
    render(<PlateSuggestions {...props} suggestions={[car('LUR479')]} failed />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('LUR479')).toBeNull();
  });

  it('says nothing at all when the dropdown is closed, failed or not', () => {
    const { container } = render(
      <PlateSuggestions {...props} open={false} failed suggestions={[car('LUR479')]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('an empty, successful search renders nothing — "no match" is not an error', () => {
    const { container } = render(<PlateSuggestions {...props} suggestions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('picking a row hands back that car', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<PlateSuggestions {...props} onPick={onPick} suggestions={[car('LUR479')]} />);
    await user.click(screen.getByRole('button', { name: /LUR479/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ license_plate: 'LUR479' }));
  });

  // ⚠️ Two rows can share a plate (a mock beside the real car, or a re-plate duplicate) — the same
  // React key collision VehicleLookup already documents.
  it('⚠️ two cars on one plate both render', () => {
    render(<PlateSuggestions {...props} suggestions={[car('LUR479', '5429667'), car('LUR479', 'HRZ-1')]} />);
    expect(screen.getAllByText('LUR479')).toHaveLength(2);
  });
});
