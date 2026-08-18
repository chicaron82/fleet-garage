// The scan card's status line — derived from the vehicle's ACTUAL status, not invented from a
// hold count.
//
// Aaron, 2026-08-18, scanning a Nissan Versa in circulation: *"this one is a little misleading.
// damage yes. held no. in circulation. damage marked as pre-existing... should this read as
// pre-existing and adopt the same colour as the pre-existing badge?"*
//
// He was right, and the blast radius was wider than the car in his hand. The card had THREE
// branches — on-exception / on-hold / clear — so every other status fell through to a red
// "🔧 On hold". Live distribution of vehicles carrying a live hold at the time of writing:
//
//   OUT_ON_EXCEPTION  87  → correct
//   PRE_EXISTING      59  → said "On hold" in red
//   SALE_CAR           9  → said "On hold" in red (and he flags those DELIBERATELY)
//   CLEAR              4  → said "On hold" in red
//
// 72 of 159 mislabelled. Red means stop; three-quarters of those cars were fine to move.
//
// ⭐ ROOT CAUSE, and it is mine: on 2026-08-17 `scanHoldLines` was widened from ACTIVE-only to
// ACTIVE **+ RELEASED** so an out-on-exception car could finally show its reason. That was right.
// But the label was written when the filter meant "holds that are holding this car" — and nothing
// updated the words. The count variable was even still called `activeHolds`. I audited what the
// wider gate reached in DATA and never audited what it reached in LANGUAGE.
//
// So the card no longer holds its own opinion. Labels and tones mirror `StatusBadge`, which is
// FG's canonical vocabulary for vehicle state — one source of truth, and a status added later
// can't silently fall through to red.
import type { VehicleStatus } from '../types';

export type StatusTone = 'red' | 'amber' | 'blue' | 'teal' | 'purple' | 'grey' | 'green';

export interface ScanStatusLine {
  /** Ready to render, count included when there's a live hold to count. */
  text: string;
  tone: StatusTone;
}

/** Icon + wording + tone per vehicle status. Labels and tones deliberately match
 *  `StatusBadge`'s VEHICLE_CONFIG so the scan card and the rest of FG never disagree. */
const STATUS: Record<VehicleStatus, { icon: string; label: string; tone: StatusTone }> = {
  HELD:               { icon: '🔧', label: 'On hold',      tone: 'red' },
  OUT_ON_EXCEPTION:   { icon: '⚠️', label: 'On exception', tone: 'amber' },
  PRE_EXISTING:       { icon: '🪪', label: 'Pre-existing', tone: 'blue' },
  SALE_CAR:           { icon: '🏷️', label: 'Sale car',     tone: 'teal' },
  AUCTION_SHORT_TERM: { icon: '🔨', label: 'Auction',      tone: 'purple' },
  RETURNED:           { icon: '↩️', label: 'Returned',     tone: 'grey' },
  CLEAR:              { icon: '✅', label: 'Clear',        tone: 'green' },
};

/**
 * The status line for a scanned car.
 *
 * `liveHoldCount` only ever adds a "(n)" suffix — it NEVER decides the wording or the colour.
 * That inversion is the whole fix: a hold record and a held car are different things, and the old
 * line let the former speak for the latter.
 */
export function scanStatusLine(status: VehicleStatus, liveHoldCount: number): ScanStatusLine {
  const s = STATUS[status] ?? { icon: '•', label: String(status), tone: 'grey' as StatusTone };
  // Suffix only where a count clarifies. "Clear (1)" would be nonsense — a clear car with a
  // lingering released hold reads as clear, and the detail block below still lists it.
  const showCount = liveHoldCount > 0 && status !== 'CLEAR';
  return {
    text: `${s.icon} ${s.label}${showCount ? ` (${liveHoldCount})` : ''}`,
    tone: s.tone,
  };
}

/** Tailwind text classes per tone — light + dark, mirroring StatusBadge's palette. */
export const TONE_TEXT: Record<StatusTone, string> = {
  red:    'text-red-600 dark:text-red-400',
  amber:  'text-amber-700 dark:text-amber-400',
  blue:   'text-blue-700 dark:text-blue-400',
  teal:   'text-teal-700 dark:text-teal-400',
  purple: 'text-purple-700 dark:text-purple-400',
  grey:   'text-gray-600 dark:text-gray-400',
  green:  'text-green-700 dark:text-green-400',
};

/** Tailwind background+text for the hold-DETAIL block, keyed to the same tone as the status line.
 *
 *  The detail block used to be red for everything except an on-exception hold — so a long-accepted
 *  scratch on a `PRE_EXISTING` car shouted in red underneath a line that (once fixed) calmly said
 *  "Pre-existing". Half a fix reads worse than none: the eye goes to the loudest thing on the card.
 *  Tying the block to the vehicle's tone means the whole card agrees about how alarmed to be. */
export const TONE_BLOCK: Record<StatusTone, string> = {
  red:    'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300',
  amber:  'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300',
  blue:   'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300',
  teal:   'bg-teal-50 dark:bg-teal-500/10 text-teal-800 dark:text-teal-300',
  purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300',
  grey:   'bg-gray-100 dark:bg-gray-500/10 text-gray-700 dark:text-gray-300',
  green:  'bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300',
};
