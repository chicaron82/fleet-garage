// ── Haptic Feedback Utility ───────────────────────────────────────────────
// navigator.vibrate is Android/web only — optional chaining means this
// silently no-ops on iOS and desktop. No try/catch needed.

/** Light tap — selections, toggles, nav interactions */
export const hapticLight = (): void => {
  navigator.vibrate?.(10);
};

/** Medium pulse — submissions, confirmations, state transitions */
export const hapticMedium = (): void => {
  navigator.vibrate?.(25);
};

/** Heavy pattern — manager approvals, errors, high-stakes actions */
export const hapticHeavy = (): void => {
  navigator.vibrate?.([30, 10, 30]);
};
