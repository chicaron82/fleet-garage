// An in-progress schedule import, kept across a closed modal.
//
// ⚠️ WHY THIS EXISTS. The import used to live entirely in component state — the photo, the parsed
// grid, the name matches Aaron had corrected, every cell he had re-typed. The modal closes on Escape
// AND on a backdrop click, so leaving it did not pause the import, it DELETED it. On the floor that
// is one stray tap with wet hands away, on a sheet already half-verified.
//
// He put the cost plainly (2026-08-24, mid-shift): "I was importing it but I also am mid clean on
// cars so wanted to scan and register another vehicle... that's why I asked you to import." The job
// demanded an uninterrupted block of attention, and a washbay is not a desk — so he handed it off
// rather than do it himself. That is a feature failing at the exact moment it should help.
//
// ⭐ THE PRIORITY, AND IT DECIDES THE DESIGN: his CORRECTIONS are irreplaceable; the PHOTO is not.
// He is holding the paper and can re-shoot it in seconds. So when storage runs short the draft is
// saved WITHOUT the image rather than not at all — never lose the work to save the picture.
import type { ParsedSchedule, ParsedShiftType } from '../../api/_lib/scheduleParse';

const STORAGE_KEY = 'fg_schedule_import_draft';

/** A draft older than this is a schedule whose week has almost certainly passed. Dropping it on read
 *  keeps a stale grid from greeting him months later looking like live work. */
const MAX_AGE_DAYS = 14;

export interface ImportDraft {
  /** The compressed photo / PDF data URL. Null when it was dropped to fit the quota (see above). */
  image: string | null;
  schedule: ParsedSchedule | null;
  /** True when a backup vision model read the sheet — the preview's "look harder" warning. */
  degraded: boolean;
  /** Row index → profile id he picked (or null for "not this person"). */
  nameOverrides: Record<number, string | null>;
  /** "row-col" → the type he cycled that cell to. */
  cellOverrides: Record<string, ParsedShiftType>;
  savedAt: string;
}

export type SaveResult = 'saved' | 'saved-without-image' | 'failed';

/** Is a draft still worth restoring? Age only — an empty grid he never corrected is still his. */
export function isDraftFresh(draft: ImportDraft, now: Date = new Date()): boolean {
  const saved = new Date(draft.savedAt).getTime();
  if (Number.isNaN(saved)) return false;
  return (now.getTime() - saved) / 86_400_000 <= MAX_AGE_DAYS;
}

/** Does this draft hold anything worth restoring? A picked photo counts — the parse may still be in
 *  flight — but an untouched empty shell does not, or reopening would resume nothing at all. */
export function draftHasWork(draft: ImportDraft): boolean {
  return !!draft.image
    || !!draft.schedule
    || Object.keys(draft.nameOverrides).length > 0
    || Object.keys(draft.cellOverrides).length > 0;
}

export function loadImportDraft(now: Date = new Date()): ImportDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ImportDraft;
    if (!d || typeof d !== 'object' || !d.savedAt) return null;
    if (!isDraftFresh(d, now)) { clearImportDraft(); return null; }
    if (!draftHasWork(d)) return null;
    return {
      image: d.image ?? null,
      schedule: d.schedule ?? null,
      degraded: d.degraded === true,
      nameOverrides: d.nameOverrides ?? {},
      cellOverrides: d.cellOverrides ?? {},
      savedAt: d.savedAt,
    };
  } catch {
    return null;                      // corrupt draft is the same as no draft — never block the modal
  }
}

/** Save, degrading rather than failing: image first, and if the quota refuses it, the work alone. */
export function saveImportDraft(draft: Omit<ImportDraft, 'savedAt'>, now: Date = new Date()): SaveResult {
  const full: ImportDraft = { ...draft, savedAt: now.toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    return 'saved';
  } catch {
    // Almost always the ~5MB quota, and almost always the photo. Drop it and keep his taps.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...full, image: null }));
      return 'saved-without-image';
    } catch {
      return 'failed';                // storage is gone entirely; the modal carries on in memory
    }
  }
}

export function clearImportDraft(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to clean up */ }
}
