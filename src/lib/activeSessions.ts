// Label + elapsed helpers for the persistent active-session pill (the badge in
// the app shell that follows you across modules while a trip or off-standard
// timer is running). Pure so the pill and its tests share one source of truth.

import { OFF_STANDARD_LABELS, OFF_STANDARD_PRESET_LABELS } from '../types';
import type { OffStandardReason, OffStandardPresetReason } from '../types';

/** Human label for a running off-standard session — prefer the preset's name
 *  ("Flipping Returns"), fall back to the reason's full label ("Waiting for work"). */
export function othSessionLabel(
  reason: OffStandardReason,
  preset: OffStandardPresetReason | null,
): string {
  if (preset && OFF_STANDARD_PRESET_LABELS[preset]) return OFF_STANDARD_PRESET_LABELS[preset];
  return OFF_STANDARD_LABELS[reason]?.full ?? 'Off-Standard';
}

/** Compact running elapsed for the pill: "3m" under an hour, "1h 04m" beyond. */
export function elapsedLabel(startISO: string, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - new Date(startISO).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
