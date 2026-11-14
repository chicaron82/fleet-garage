// Taking back a wrong odo days later: what migration 170's take_back_odometer answered, and the words for it.
// Aaron, 2026-11-14: *"just the odo is incorrect. but a way to undo the incorrect odo so yesterday's can be entered."*
// docs/November/ticket-odo-take-back-newest.md.
import { dayOfInstant } from './sheetDay';

export type TakeBackResult =
  | { status: 'taken_back'; km: number; at: string }
  | { status: 'not_current' | 'no_previous' | 'no_car' };

/** The reading the car would go back to, or null when there is nothing before it (Clear is the answer then). */
export interface PriorReading { km: number; at: string }

const n = (km: number) => km.toLocaleString('en-CA');

/** The button: what the car goes back to, with that reading's own day, so he can judge it before he taps. */
export function takeBackLabel(prior: PriorReading, unit: string, armed: boolean): string {
  return armed ? `Tap again: back to ${n(prior.km)} ${unit}` : `Wrong? Back to ${n(prior.km)} ${unit} (${dayOfInstant(prior.at)})`;
}

/** What happened, said plainly. `ok` = the car's odo moved back. */
export function takeBackWords(r: TakeBackResult | null, unit: string): { ok: boolean; text: string } {
  if (!r) return { ok: false, text: "That didn't take. Check your signal and try again." };
  switch (r.status) {
    case 'taken_back': return { ok: true, text: `Taken back: ${n(r.km)} ${unit} (${dayOfInstant(r.at)}) is the odo again` };
    // A reading landed since he looked: the newest is never taken back blind.
    case 'not_current': return { ok: false, text: 'The odo changed since. Nothing was taken back.' };
    case 'no_previous': return { ok: false, text: 'No reading before this one to go back to.' };
    default: return { ok: false, text: 'FG has no car by that id.' };
  }
}
