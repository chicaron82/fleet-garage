// The one place FG re-seeds local state from a ROUTED prop.
//
// A prop that arrives across a module boundary (a `Screen` prop from navigate, a modal's
// initial value) must be DERIVED or explicitly RE-SEEDED — never `useState(theProp)` and
// walked away from. `useState` reads its argument only at MOUNT, and re-navigating to a
// screen you are already on renders the SAME mounted component: the new value is silently
// discarded and the surface looks dead. See FG CLAUDE.md, "Routed props".
//
// That bug shipped in five places before it was swept (9d1535f, e86441b, /reflect 45), and
// each fix hand-rolled the same four lines. This is those four lines, once.
//
// Implemented as a render-time state adjustment — React's documented "adjusting state when a
// prop changes" — NOT a useEffect: the repo lints `react-hooks/set-state-in-effect`, and an
// effect also costs an extra render pass with a visible flash of the stale value.
import { useState } from 'react';

/**
 * Run `onChange` during render whenever `prop` becomes a NEW truthy value.
 *
 * Truthy-guarded on purpose: an absent/empty routed prop must never blank a value the operator
 * typed themselves. Fires once per distinct value, so a user edit after the re-seed stands.
 *
 * @example
 *   useRoutedProp(initialPlate, setLicensePlate);            // mirror the prop into state
 *   useRoutedProp(prefillPlate, () => setShowSheet(true));   // or just react to it changing
 */
export function useRoutedProp<T>(prop: T, onChange: (value: NonNullable<T>) => void): void {
  const [last, setLast] = useState<T>(prop);
  if (prop && prop !== last) {
    setLast(prop);
    onChange(prop as NonNullable<T>);
  }
}
