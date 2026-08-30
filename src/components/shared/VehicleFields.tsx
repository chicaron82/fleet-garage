import type { InputHTMLAttributes } from 'react';

// Shared vehicle form controls — the durable fix for the keyboard/caps drift
// the June-10 consistency pass (fee3854) patched form-by-form. New forms reach
// for these instead of a raw <input>, so the behaviour can't re-drift:
//   - DigitsInput: numeric pad on mobile (inputMode + pattern)
//   - CodeInput:   value stored uppercase AND displayed uppercase while typing
//   - KeyCountSelector: the 1-4 tappable, 44px, re-tap to clear
// Both inputs forward className + native props, so each form keeps its own look.
// Deliberately NOT for combined "unit # or plate" search fields — those must
// accept letters and serve lookup, not vehicle-identity entry.
//
// ⚠️⚠️ THE PRIMITIVES EXISTING IS NOT THE SAME AS THEM BEING USED, and this file learned that the
// hard way. It was built in June (77d7faa, *"keyboard/caps can't re-drift"*) — and the keytag
// auditor, written ten weeks later, hand-rolled its own <input> anyway, then hand-rolled a SECOND
// copy of the register form's 44px key selector. Aaron found the duplication by using it: *"the
// keys on ring is an input, why isn't it a tappable like when registering"*, then named the
// principle: *"editing the license plate also displays uppercase, so the VIN should have followed
// the same since its both letters and numbers."*
//
// ⭐ So the rule is not "check whether a design exists" — that was already written twice and still
// did not fire. It is: **A VEHICLE FORM CONTROL IS NOT A RAW <input>.** It comes from this file. If
// the primitive you need isn't here, you ADD IT HERE. That version is greppable, and it is the one
// recorded in CLAUDE.md.

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  onValueChange: (value: string) => void;
};

/** An all-digit field — unit number, owning area. The numeric pad is a HINT, not a rule: a no-op on
 *  a hardware keyboard, and nothing here guarantees digits. That guarantee lives on the write. */
export function DigitsInput({ onValueChange, ...rest }: FieldProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      {...rest}
      onChange={e => onValueChange(e.target.value)}
    />
  );
}

/**
 * Any uppercase vehicle-identity code — plate, VIN last-9, model code, rental class.
 *
 * ⚠️ A REAL TRANSFORM, NOT `autoCapitalize` — that attribute steers a SOFT keyboard and does
 * exactly nothing on a hardware one, which matters because Aaron audits tags from couch command
 * (PC into the TV). Every caller that relied on it had its own `.toUpperCase()` sitting elsewhere,
 * so nothing was ever stored wrong; the point is that the guarantee stops being a property of the
 * CALLER and becomes a property of the CONTROL. A caller can forget. This can't.
 */
export function CodeInput({ onValueChange, className = '', ...rest }: FieldProps) {
  return (
    <input
      type="text"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      onChange={e => onValueChange(e.target.value.toUpperCase())}
      className={`${className} uppercase`.trim()}
    />
  );
}

/** A licence plate. Named for the field because that is what seven forms ask for; the behaviour is
 *  CodeInput's, and deliberately the same object so the two can never diverge. */
export const PlateInput = CodeInput;

/** A unit number. Same relationship to DigitsInput as PlateInput has to CodeInput. */
export const UnitNumberInput = DigitsInput;

/**
 * 🔑 Keys on the ring — 1 to 4, tappable, re-tap the active one to clear.
 *
 * ⚠️ 44px IS THE POINT, not a style choice: the Apple/Google minimum touch target, swept across the
 * register form and the scan card on 2026-08-18 because this row is tapped **with nitrile gloves
 * on**. A number input was the wrong dialect for a value that is always 1-4 and summons a keyboard
 * to ask it.
 *
 * `value` is a string so a form holding '' (nothing counted) and a form holding null can share one
 * control — blank is the honest answer for a ring the photo never showed.
 */
export function KeyCountSelector({ value, onValueChange, dark = false }: {
  value: string;
  onValueChange: (value: string) => void;
  /** Over the key-tag photo the ground is black and the light palette disappears. */
  dark?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4].map(n => (
        <button key={n} type="button"
          onClick={() => onValueChange(value === String(n) ? '' : String(n))}
          aria-pressed={value === String(n)}
          aria-label={`${n} key${n === 1 ? '' : 's'} on the ring`}
          className={`w-11 h-11 rounded-lg text-sm font-semibold border transition cursor-pointer ${
            value === String(n)
              ? 'bg-fg-yellow border-fg-yellow text-black'
              : dark
                ? 'border-white/25 text-gray-300'
                : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
          {n}
        </button>
      ))}
    </div>
  );
}
