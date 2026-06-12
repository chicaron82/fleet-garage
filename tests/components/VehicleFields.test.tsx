import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { UnitNumberInput, PlateInput } from '../../src/components/shared/VehicleFields';

// The shared vehicle-identity inputs exist so the keyboard/caps behaviour can't
// re-drift form by form (the June-10 consistency pass fixed it field-by-field;
// these lock it structurally). The contract under test IS that baked-in part.

describe('UnitNumberInput', () => {
  it('always carries the numeric-pad attributes', () => {
    render(<UnitNumberInput value="5421" onValueChange={vi.fn()} aria-label="unit" />);
    const input = screen.getByLabelText('unit');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('pattern', '[0-9]*');
  });

  it('passes the typed value through unchanged', () => {
    const onValueChange = vi.fn();
    render(<UnitNumberInput value="" onValueChange={onValueChange} aria-label="unit" />);
    fireEvent.change(screen.getByLabelText('unit'), { target: { value: '5428735' } });
    expect(onValueChange).toHaveBeenCalledWith('5428735');
  });

  it('forwards the host form styling', () => {
    render(<UnitNumberInput value="" onValueChange={vi.fn()} aria-label="unit" className="host-class" />);
    expect(screen.getByLabelText('unit').className).toBe('host-class');
  });
});

describe('PlateInput', () => {
  function Harness() {
    const [plate, setPlate] = useState('');
    return <PlateInput value={plate} onValueChange={setPlate} aria-label="plate" />;
  }

  it('uppercases the value before it reaches the caller', () => {
    const onValueChange = vi.fn();
    render(<PlateInput value="" onValueChange={onValueChange} aria-label="plate" />);
    fireEvent.change(screen.getByLabelText('plate'), { target: { value: 'lur156' } });
    expect(onValueChange).toHaveBeenCalledWith('LUR156');
  });

  it('always carries the uppercase display class — typed lowercase can never SHOW lowercase', () => {
    render(<PlateInput value="" onValueChange={vi.fn()} aria-label="plate" className="host-class" />);
    const input = screen.getByLabelText('plate');
    expect(input.className).toContain('host-class');
    expect(input.className).toContain('uppercase');
  });

  it('round-trips as a controlled input: display value ends uppercase', () => {
    render(<Harness />);
    const input = screen.getByLabelText('plate') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hfe 872' } });
    expect(input.value).toBe('HFE 872');
  });
});
