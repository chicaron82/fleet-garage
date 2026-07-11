import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VehicleIdentityFields } from '../../src/components/shared/VehicleIdentityFields';

// The shared make/model/year/colour controls, used by BOTH the registration form and the
// direct-edit modal. The load-bearing contract is the cascade — changing make must clear the
// model so a stale pairing (e.g. a Corolla still sitting under Hyundai) can never be saved —
// plus the year clamp. These are exactly what a make/model CORRECTION leans on.

function props(overrides: Partial<Parameters<typeof VehicleIdentityFields>[0]> = {}) {
  return {
    make: 'Toyota', model: 'Corolla', year: 2025, color: 'Blue',
    onMake: vi.fn(), onModel: vi.fn(), onYear: vi.fn(), onColor: vi.fn(),
    ...overrides,
  };
}

describe('VehicleIdentityFields', () => {
  it('clears the model when the make changes — a stale pairing can never be saved', () => {
    const p = props();
    render(<VehicleIdentityFields {...p} />);
    // comboboxes render in order: make, model, colour.
    const make = screen.getAllByRole('combobox')[0];
    fireEvent.change(make, { target: { value: 'Hyundai' } });
    expect(p.onMake).toHaveBeenCalledWith('Hyundai');
    expect(p.onModel).toHaveBeenCalledWith(''); // the cascade — model reset
  });

  it('offers the chosen make\'s models (Hyundai → Elantra, the LUR471 correction)', () => {
    render(<VehicleIdentityFields {...props({ make: 'Hyundai', model: '' })} />);
    expect(screen.getByRole('option', { name: 'Elantra' })).toBeTruthy();
    // Corolla belongs to Toyota, not Hyundai — it must NOT be offered here.
    expect(screen.queryByRole('option', { name: 'Corolla' })).toBeNull();
  });

  it('steps the year and clamps at the ceiling', () => {
    const p = props({ year: 2030 });
    render(<VehicleIdentityFields {...p} />);
    fireEvent.click(screen.getByText('−'));
    expect(p.onYear).toHaveBeenCalledWith(2029);
    // At 2030 the increment is disabled — no call past the ceiling.
    fireEvent.click(screen.getByText('+'));
    expect(p.onYear).not.toHaveBeenCalledWith(2031);
  });
});
