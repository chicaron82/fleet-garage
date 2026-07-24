import { useEffect, useRef } from 'react';

/**
 * Bring a freshly-revealed panel into view when it mounts.
 *
 * The buttons that open these panels live in the action card at the top of the vehicle screen,
 * while the panels themselves render further down. On a phone the action card alone fills the
 * viewport, so the panel opens BELOW THE FOLD and nothing visibly changes — the tap reads as a
 * no-op (Aaron, 2026-07-23: *"I'm not sure if I tapped it or not because there isn't a change in
 * what I see... so I have to remember to scroll"*). It gets worse the more hold records the unit
 * carries.
 *
 * Same fix `NewHoldDetailsSection` already applies to a revealed hold-type section, whose comment
 * names the identical symptom ("tap doesn't look like it did nothing") — lifted here so the three
 * hold action panels share one definition instead of three copies.
 *
 * `block: 'center'` rather than 'nearest': these panels open well off-screen, and 'nearest' would
 * scroll the minimum distance, landing the panel at the very bottom edge with its controls still
 * half-hidden. Deliberately does NOT focus an input — the quick-pick authorizer pills are the
 * common path, and popping the mobile keyboard would fight them.
 */
export function useRevealScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);   // mount only — these panels are conditionally rendered, so mounting IS the reveal
  return ref;
}
