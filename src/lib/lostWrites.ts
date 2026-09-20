/** A side-write that should be followed, and the word for it if it doesn't land. */
export interface FollowedWrite {
  label: string;
  run: () => Promise<unknown>;
}

/**
 * Run side-writes in order and return the labels of the ones that did not land.
 *
 * ⭐⭐ THE AIRPORT FLIP'S THREE (2026-09-19, docs/September/ticket-writes-that-vanish-into-void.md).
 * The key count, the odometer and the EV check used to go out as `void` and the capture card closed
 * on the next line. `recordKeyCount` THROWS on failure — an unhandled rejection that ⚠️ no React
 * error boundary catches — and `recordOdometer` returns quietly, so on a weak signal at the return
 * lane the card closed clean and the numbers he had just typed were gone.
 *
 * ⚠️ BOTH failure shapes, because FG has both: a throw, and an explicit `false`. Anything else
 * (including `undefined`, which is what most of FG's `Promise<void>` writers resolve) counts as
 * landed — a checker that cried wolf on every successful write would be worse than the silence.
 *
 * ⚠️ SEQUENTIAL ON PURPOSE. These are three small writes against one row from a phone on lot wifi;
 * running them in order keeps the failure attribution exact, and nothing is waiting on the result —
 * the counter list already has its row before this is called.
 */
export async function collectLostWrites(writes: readonly FollowedWrite[]): Promise<string[]> {
  const lost: string[] = [];
  for (const { label, run } of writes) {
    try {
      if (await run() === false) lost.push(label);
    } catch {
      lost.push(label);
    }
  }
  return lost;
}

/**
 * What to tell him when some of them didn't land.
 *
 * ⚠️ It names what is NOT lost, because that is the first thing he would wonder standing at the
 * return lane: the counter list is built from the row already in hand, never from these writes.
 */
export function lostWritesNote(lost: readonly string[]): string {
  if (lost.length === 0) return '';
  return `${lost.join(' + ')} didn't save to FG — the counter list is fine.`;
}
