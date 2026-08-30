import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { UnitNumberInput, PlateInput, CodeInput, DigitsInput, KeyCountSelector } from '../../src/components/shared/VehicleFields';

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

// ⭐ THE GENERIC PAIR. `PlateInput`/`UnitNumberInput` are field-named aliases of `CodeInput` and
// `DigitsInput` — the same objects, so the two can never drift into two behaviours. Asserting the
// identity is what makes every test above simultaneously a test of the generic.
describe('the generics and their field-named aliases', () => {
  it('PlateInput IS CodeInput and UnitNumberInput IS DigitsInput', () => {
    expect(PlateInput).toBe(CodeInput);
    expect(UnitNumberInput).toBe(DigitsInput);
  });

  // ⚠️ A DEFAULT, NOT A LOCK. autoCapitalize is a soft-keyboard hint and does nothing on the
  // hardware keyboard Aaron audits from — it rides along, but `.toUpperCase()` is what actually
  // holds. A caller may still override the hint.
  it('CodeInput carries the no-autocorrect defaults a code field needs', () => {
    render(<CodeInput value="" onValueChange={vi.fn()} aria-label="code" />);
    const input = screen.getByLabelText('code');
    expect(input).toHaveAttribute('autocapitalize', 'characters');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('a caller can still override a default hint', () => {
    render(<CodeInput value="" onValueChange={vi.fn()} aria-label="code" autoCapitalize="none" />);
    expect(screen.getByLabelText('code')).toHaveAttribute('autocapitalize', 'none');
  });

  // ⚠️ But NOT the uppercase transform — that is the guarantee this file exists to hold, so it
  // stays after the spread where a caller cannot reach it.
  it('⚠️ a caller cannot override the uppercase transform', () => {
    const onValueChange = vi.fn();
    const rogue = vi.fn();
    render(<CodeInput value="" onValueChange={onValueChange} aria-label="code"
      {...({ onChange: rogue } as Record<string, unknown>)} />);
    fireEvent.change(screen.getByLabelText('code'), { target: { value: 'vxsl47717' } });
    expect(rogue).not.toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith('VXSL47717');
  });
});

// ⭐⭐ ONE DEFINITION OF THE KEY ROW. This markup lived twice — RegisterVehicleForm and
// KeytagAuditFields — identical down to the aria-label, because the auditor copied the pattern
// instead of reaching for it. Aaron, 2026-08-30: *"the keys on ring is an input, why isn't it a
// tappable like when registering."*
describe('KeyCountSelector', () => {
  it('offers 1-4 and reports the tapped number as a string', () => {
    const onValueChange = vi.fn();
    render(<KeyCountSelector value="" onValueChange={onValueChange} />);
    [1, 2, 3, 4].forEach(n => expect(screen.getByLabelText(`${n} key${n === 1 ? '' : 's'} on the ring`)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('3 keys on the ring'));
    expect(onValueChange).toHaveBeenCalledWith('3');
  });

  // ⚠️ BLANK IS AN ANSWER — a ring the photo never showed has no count, and re-tapping is how he
  // takes a number back without a clear button.
  it('⚠️ re-tapping the active number clears it back to blank', () => {
    const onValueChange = vi.fn();
    render(<KeyCountSelector value="2" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByLabelText('2 keys on the ring'));
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('marks only the active number as pressed', () => {
    render(<KeyCountSelector value="2" onValueChange={vi.fn()} />);
    expect(screen.getByLabelText('2 keys on the ring')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('1 key on the ring')).toHaveAttribute('aria-pressed', 'false');
  });

  // ⚠️ 44px is the Apple/Google minimum touch target, and this row is tapped with nitrile gloves
  // on — it is the reason the control exists at this size, so it is worth a test.
  it('⚠️ every target stays 44px', () => {
    render(<KeyCountSelector value="" onValueChange={vi.fn()} />);
    [1, 2, 3, 4].forEach(n => {
      const b = screen.getByLabelText(`${n} key${n === 1 ? '' : 's'} on the ring`);
      expect(b.className).toContain('w-11');
      expect(b.className).toContain('h-11');
    });
  });

  it('takes the dark palette over the key-tag photo', () => {
    const { rerender } = render(<KeyCountSelector value="" onValueChange={vi.fn()} />);
    expect(screen.getByLabelText('1 key on the ring').className).toContain('border-gray-300');
    rerender(<KeyCountSelector value="" onValueChange={vi.fn()} dark />);
    expect(screen.getByLabelText('1 key on the ring').className).toContain('border-white/25');
  });
});
