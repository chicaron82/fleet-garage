// A model NAME read off a tag that has no model code — what FG should store for it.
//
// ⭐ WHY THIS EXISTS. There are two key-tag layouts (docs ticket-two-tag-formats). The Canadian one
// prints a 4-letter model CODE, and make + model are derived from it through the codex. The labelled
// one — US cars, old-Montreal 8892 — prints the model spelled out (`TUCSON`, `Model Y`) and carries no
// code at all. The auditor had nowhere to put a spelled-out model, so it landed in the code box:
// that is how `COMPASS` and `TUSCON` came to sit in `class_code`.
//
// ⚠️ A TAG PRINTS UPPERCASE AND FG STORES A NAME. The fleet already says `Tucson`, the codex says
// `Camry SE`; writing `TUCSON` beside them would make one model two spellings, and every exact match
// on `model` would split the car off from its siblings. So a spelling FG already holds wins, and the
// typed value is only kept as-is when nothing anywhere knows the model.
//
// ⚠️⚠️ MAKE IS NOT PRINTED ON EITHER LAYOUT. It is offered only when every car and codex entry with
// this model agrees on ONE make. Two makes is ambiguity, and guessing an identity is the failure —
// the same refusal as `nearMissCode`. The caller writes it only into a blank make.
//
// Pure: no DB, no React. The caller hands in the fleet it already holds.
import { CODEX_ENTRIES } from '../../api/_lib/vehicleClassCodex';

export interface SpelledOutModel {
  /** The spelling to store: FG's own when it knows the model, otherwise what he typed. */
  model: string;
  /** The one make this model belongs to, or null when nothing knows it or the evidence disagrees. */
  make: string | null;
}

interface ModelBearer { id: string; make?: string | null; model?: string | null }

/** Case- and space-insensitive, so `MODEL  Y` and `Model Y` are one model. */
const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function resolveSpelledOutModel(
  typed: string,
  fleet: readonly ModelBearer[],
  /** The car being audited — excluded so a record cannot vouch for its own spelling or make. */
  selfId: string,
): SpelledOutModel | null {
  const clean = typed.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const key = norm(clean);

  const spellings = new Map<string, number>();
  const makes = new Set<string>();
  const see = (make: string | null | undefined, model: string) => {
    spellings.set(model, (spellings.get(model) ?? 0) + 1);
    const m = make?.trim();
    if (m) makes.add(m);
  };

  for (const v of fleet) {
    if (v.id === selfId || !v.model || norm(v.model) !== key) continue;
    see(v.make, v.model.trim().replace(/\s+/g, ' '));
  }
  for (const [, entry] of CODEX_ENTRIES) {
    if (norm(entry.model) === key) see(entry.make, entry.model);
  }

  // The commonest spelling; ties break alphabetically so the answer is stable across reloads.
  const best = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    model: best ? best[0] : clean,
    make: makes.size === 1 ? [...makes][0] : null,
  };
}
