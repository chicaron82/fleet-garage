import type { VehicleChangeRow } from './vehicleChanges';

// What a cleared note leaves behind — Aaron, 2026-08-26, on LZM533:
//
//   *"the note is fine. just something on the FG's record that happens to show it went somewhere on
//    this date to get repaired. then got cleared on this date when the vehicle showed up with no
//    more visible damage"*
//
// He left "Assigned to car star Fife" while the car was at the body shop and cleared it when it came
// back repaired — then asked whether a cleared note disappears. It does not: migration 118's trigger
// records both ends, and `VehicleNote`'s own comment already promised as much (*"Clearing is NOT
// deletion… the car keeps the history in its change trail"*). **The promise was kept in the data and
// never rendered.** Same shape as the VIN stored on 380 cars and displayed on none.
//
// ⭐ AN EPISODE, NOT AN EVENT. The useful unit is "the car carried THIS note from date A to date B",
// which is the answer to *where was it and for how long*. The raw log only has transitions, so the
// pairing has to happen here rather than in the renderer.

export interface NoteEpisode {
  text: string;
  /** When the note went on. Null when it predates the change window (see `noteEpisodes`). */
  setAt: string | null;
  /** When it came off. Null while the note is still on the car — the CURRENT note. */
  clearedAt: string | null;
}

interface NoteTransition { at: string; from: string | null; to: string | null; }

function noteTransitions(rows: readonly VehicleChangeRow[]): NoteTransition[] {
  const out: NoteTransition[] = [];
  for (const row of rows) {
    const change = row.changed?.note as { from?: unknown; to?: unknown } | undefined;
    if (!change || typeof change !== 'object') continue;
    const norm = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    const from = norm(change.from), to = norm(change.to);
    // A row where neither side is a real string says nothing — null→null happens when a note of
    // whitespace is cleared, and rendering "was '' from X to Y" would be noise.
    if (from === null && to === null) continue;
    out.push({ at: row.changedAt, from, to });
  }
  // ⚠️ Sorted OLDEST FIRST here, regardless of how the caller fetched. `useVehicleChanges` returns
  // newest-first, and pairing a start to its end depends on chronology — a summary that silently
  // depends on the query's ORDER BY is a bug waiting for someone to change the query.
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * Pair the note's transitions into episodes, newest first.
 *
 * ⚠️ AN EDIT IS A CLEAR AND A SET AT THE SAME INSTANT. `{from: "A", to: "B"}` ends A's episode and
 * begins B's on one row — treating it as only a start would lose A entirely, and treating it as only
 * an end would lose B.
 *
 * ⚠️ THE CHANGE LOG IS CAPPED (50 rows), so an episode's START can fall outside the window while its
 * clear is inside it. That yields `setAt: null` — an honest "we know it was cleared on this date and
 * not when it went on", which is strictly better than dropping the episode or inventing a date.
 */
export function noteEpisodes(rows: readonly VehicleChangeRow[]): NoteEpisode[] {
  const episodes: NoteEpisode[] = [];
  let open: NoteEpisode | null = null;

  for (const t of noteTransitions(rows)) {
    if (t.from !== null) {
      // Something was on the car and is now coming off (cleared or replaced).
      if (open && open.text === t.from) { open.clearedAt = t.at; }
      else { episodes.push({ text: t.from, setAt: null, clearedAt: t.at }); }  // start outside the window
      open = null;
    }
    if (t.to !== null) {
      open = { text: t.to, setAt: t.at, clearedAt: null };
      episodes.push(open);
    }
  }
  return episodes.reverse();   // newest first, the way the record reads
}

/**
 * Only the notes that are OVER — what the record cannot otherwise show.
 *
 * ⭐ The still-open episode is deliberately excluded: `VehicleNote` already renders the current note
 * with its own "Left <date>" line, and listing it twice under a "past notes" heading would make the
 * live note look finished. This function's whole job is the half that vanished.
 */
export function pastNoteEpisodes(rows: readonly VehicleChangeRow[]): NoteEpisode[] {
  return noteEpisodes(rows).filter(e => e.clearedAt !== null);
}
