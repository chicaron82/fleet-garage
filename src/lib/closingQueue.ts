import type { LotStatus } from '../types';

/**
 * Lot status stored for a closing washbay log, derived purely from the
 * end-of-shift queue count.
 *
 * The closing log no longer asks for a Zeroed/Manageable/Backlog judgment — the
 * *count* ("in queue at close") is the objective signal, and the same number
 * means different things to different crews (one team's "5 is manageable" is
 * another's "5 is a real backlog"). We keep the non-null `lot_status` column
 * valid by mapping 0 → 'zeroed' (objective) and any remaining queue →
 * 'manageable' (a neutral filler). The queue *count*, not this label, is what
 * the summary and report display.
 */
export function lotStatusFromQueue(carsRemaining: number): LotStatus {
  return carsRemaining <= 0 ? 'zeroed' : 'manageable';
}
