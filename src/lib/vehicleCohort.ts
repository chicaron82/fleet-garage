// Walking a worklist from inside a vehicle record.
//
// ⭐ "NEXT" ONLY MEANS SOMETHING RELATIVE TO THE LIST HE CAME FROM. Aaron, double-checking held cars
// 2026-08-22: "adding prev & next to cycle between holds... this way I don't need to go back and
// find the next one to check." The order that matters is the one he was just looking at — his
// filter, his sort, his page. Arrows that cycled through anything else would drop him on a car he
// was not checking, which is worse than going back to the list.
//
// So the list travels with the route, and when it is absent the arrows do not render at all. An
// arrow that does not know what it is cycling through is worse than no arrow.

export interface CohortStep {
  /** 1-based position, or 0 when this car is not in the list. */
  index: number;
  total: number;
  /** Vehicle to the left / right, or null at the ends. Deliberately NOT wrapping — a worklist has
   *  an end, and silently looping would hide that he has finished it. */
  prevId: string | null;
  nextId: string | null;
}

const NONE: CohortStep = { index: 0, total: 0, prevId: null, nextId: null };

/**
 * Where this car sits in the list that opened it.
 *
 * Returns NONE when there is no list, when the list has one entry (nothing to step to), or when the
 * car is not in it — the last case happens for real: he opens a held car, marks it repaired, and a
 * status filter no longer matches it. Showing "0 of 14" or guessing a neighbour would both be worse
 * than the arrows quietly going away.
 */
export function cohortStep(cohort: readonly string[] | undefined, currentId: string): CohortStep {
  if (!cohort || cohort.length < 2) return NONE;
  const i = cohort.indexOf(currentId);
  if (i === -1) return NONE;
  return {
    index: i + 1,
    total: cohort.length,
    prevId: i > 0 ? cohort[i - 1] : null,
    nextId: i < cohort.length - 1 ? cohort[i + 1] : null,
  };
}
