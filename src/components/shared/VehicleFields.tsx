import type { InputHTMLAttributes } from 'react';

// Shared vehicle-identity inputs — the durable fix for the keyboard/caps drift
// the June-10 consistency pass (fee3854) patched form-by-form. New forms reach
// for these instead of a raw <input>, so the behaviour can't re-drift:
//   - UnitNumberInput: numeric pad on mobile (inputMode + pattern)
//   - PlateInput: value stored uppercase AND displayed uppercase while typing
// Both forward className + native props, so each form keeps its own look.
// Deliberately NOT for combined "unit # or plate" search fields — those must
// accept letters and serve lookup, not vehicle-identity entry.

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  onValueChange: (value: string) => void;
};

export function UnitNumberInput({ onValueChange, ...rest }: FieldProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      onChange={e => onValueChange(e.target.value)}
    />
  );
}

export function PlateInput({ onValueChange, className = '', ...rest }: FieldProps) {
  return (
    <input
      {...rest}
      type="text"
      onChange={e => onValueChange(e.target.value.toUpperCase())}
      className={`${className} uppercase`.trim()}
    />
  );
}
