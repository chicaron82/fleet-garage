// Graduated double-duty for the VSA Movement Log (docs/ticket-movement-staying-here-autoflip.md):
// ending an airport run "staying here" (one-way) means the VSA stayed to flip returns, so the trip
// timer stops and the off-standard "Flipping Returns" timer should auto-start — no tab-switch,
// no manual quick-tap. This is the decision gate for that auto-start.
//
// The whole VSA movement log is airport runs (depart/arrive_location are always "Airport Run"), and
// a one-way end IS the flipping signal (see lib/vsa-trip buildArrivalUpdate) — so no airport check is
// needed; the trigger is the one-way arrival. This guards the ONE thing that could go wrong: never
// clobber an off-standard timer the operator already has running (or a just-completed one awaiting
// save). The one-shot "only a new signal fires" lives in the effect (a ref); this is the "fire NOW?".

/** Should a fresh auto-flip signal start the flipping timer? Only when there's a real signal
 *  (trigger > 0) and the off-standard timer is idle — never over a running/complete one. */
export function shouldStartAutoFlip(trigger: number, timerState: string): boolean {
  return trigger > 0 && timerState === 'idle';
}
