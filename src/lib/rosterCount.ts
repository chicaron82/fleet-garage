import type { Attendance, ExtraBlock, ShiftType, UserRole } from '../types';
import { dayMinute } from './bayCrewBlocks';

const VSA_ROLES: UserRole[] = ['VSA', 'Lead VSA'];

type CountableShift = {
  userId: string;
  date: string;
  shiftType: ShiftType;
  user: { role: UserRole };
  attendance?: Attendance;
  extraBlocks?: ExtraBlock[];
};

export type BlockCrew = NonNullable<ExtraBlock['crew']>;

/**
 * Which crew a [+] block could join, from where it sits against the day's main hours
 * (docs/ticket-plus-block-crew-tick.md). Aaron, 2026-11-04: *"Can we make it smart depending on when the hours are
 * added? If I'm on a close and the additional hours is to help with the morning?"*
 *
 * Starts before the main hours → `opening`; starts at or after their end → `closing`; no times yet, or inside the
 * shift → null (nothing to offer). This only decides the tick's LABEL: the roster reads the tick, never this.
 */
export function blockCrewSide(mainStart: string | undefined, mainEnd: string | undefined, block: ExtraBlock): BlockCrew | null {
  if (!block.start || !mainStart || !mainEnd) return null;
  const at = dayMinute(block.start);
  if (at < dayMinute(mainStart)) return 'opening';
  if (at >= dayMinute(mainEnd)) return 'closing';
  return null;
}

/** A block's tick survives only while its times still put it on that side, so an edit never re-points his word. */
export function keepCrewIfStillSide(mainStart: string, mainEnd: string, block: ExtraBlock): ExtraBlock {
  if (!block.crew || blockCrewSide(mainStart, mainEnd, block) === block.crew) return block;
  return { start: block.start, end: block.end };
}

/**
 * In the window by shift type, or by a ticked [+] block for that crew. Aaron, 2026-11-04: opened, went home, came
 * back 18:00–21:00 to close with Khaiat, and the close read *"roster shows 1"*. His fix: *"an explicit check to the
 * added hours. ✅ If closing"*. Only his tick counts; `ae6cfa17`'s guess (any block after the shift) is gone.
 */
function inWindow(s: CountableShift, windowTypes: ShiftType[]): boolean {
  return windowTypes.includes(s.shiftType) || (s.extraBlocks ?? []).some(b => !!b.crew && windowTypes.includes(b.crew));
}

// Count distinct VSA / Lead-VSA users rostered on `date` for the given shift
// window(s). `excludeAbsent` drops anyone marked 'absent' (no-show/sick).
function countVsas(shifts: CountableShift[], date: string, windowTypes: ShiftType[], excludeAbsent: boolean): number {
  const ids = new Set<string>();
  for (const s of shifts) {
    if (s.date !== date || !inWindow(s, windowTypes) || !VSA_ROLES.includes(s.user.role)) continue;
    if (excludeAbsent && s.attendance === 'absent') continue;
    ids.add(s.userId);
  }
  return ids.size;
}

/**
 * How many VSAs are ROSTERED on `date` for the given window(s) — the plain roster
 * count, shown as "roster shows N". Ignores attendance (the schedule, not who
 * actually showed). Opening pulls the opening crew, the close pulls the closers,
 * plus anyone whose [+] block is ticked for that crew.
 */
export function rosteredVsaCount(shifts: CountableShift[], date: string, windowTypes: ShiftType[]): number {
  return countVsas(shifts, date, windowTypes, false);
}

/**
 * How many rostered VSAs are actually PRESENT — the roster minus anyone marked
 * 'absent' (no-show/sick) on the My-Day pills. The sensible DEFAULT for a washbay
 * log's team size (cars ÷ team-hours), so the throughput rate divides by who
 * actually showed, not who was scheduled. Unmarked (scheduled) still counts, so
 * before any attendance is marked this equals the full roster.
 */
export function presentVsaCount(shifts: CountableShift[], date: string, windowTypes: ShiftType[]): number {
  return countVsas(shifts, date, windowTypes, true);
}
