import { lookupVehicleClass, isAmbiguousClassCode, normalizeClassCode } from '../../api/_lib/vehicleClassCodex';
import { isCodeShapedClass } from '../../api/_lib/classPin';

// What FG has LEARNED about model codes, laid out so a person can audit it.
//
// ⭐ Aaron, 2026-10-01, with the Fleet page's class breakdown on screen and `CK4L → CK4L` just removed:
// *"just like the class codes, can we have somewhere i can see FG's learned model codes to audit"*.
//
// FG learns two things about a code and showed neither anywhere: a rental class
// (`class_code_rental_class`, from scans or his pins) and a make + model (`vehicle_class_codex`, taught
// when he registers a car). The only readers were the scanner and the tag reader, so a bad lesson was
// invisible until it mislabelled a car. Grounded that evening: 30 learned classes with no live car
// behind them, 6 taught models with none, `Q4 → O`, `CKRG → CA`, `CCRA → 34`.
//
// ⚠️⚠️ IT SURFACES, IT NEVER VOTES. Every rule here compares what FG learned against the cars that carry
// the code and SAYS when they differ. None of them picks a winner or rewrites anything: sixteen cars
// agreeing is a majority, and a majority is not evidence when one upstream hand typed all sixteen
// (CTAV, 2026-09-25). The person reads the row and decides; the only action offered is to forget.
//
// Pure: no DB, no React. docs/October/ticket-model-codes-he-can-audit.md

export interface LearnedClassRow { code: string; rentalClass: string; pinned: boolean }
export interface TaughtModelRow { code: string; make: string; model: string }
export interface AuditCar {
  classCode?: string | null;
  make?: string | null;
  model?: string | null;
  rentalClass?: string | null;
}

export interface ModelCodeRow {
  code: string;
  /** What FG fills in for this code today, and where that came from. Null = FG asks. */
  model: { name: string; source: 'built-in' | 'taught' } | null;
  /** A taught model the built-in list overrides, so it never applies. Shown so it can be forgotten. */
  shadowedTaught: string | null;
  rentalClass: { value: string; source: 'pinned' | 'learned' } | null;
  liveCars: number;
  /** Distinct "Make Model" on the live cars carrying this code, most common first, with counts. */
  carModels: { name: string; cars: number }[];
  carClasses: { name: string; cars: number }[];
  /** Likely wrong: worth his eyes. */
  problems: string[];
  /** Not wrong, just unbacked or informational. */
  notes: string[];
  /** A learned (unpinned) class can be forgotten. A pin is his decision and is not offered here. */
  canForgetClass: boolean;
  /** A taught model can be forgotten, whether it applies or is shadowed. Built-in ones cannot. */
  canForgetModel: boolean;
}

export interface ModelCodeAudit {
  rows: ModelCodeRow[];
  toCheck: number;
  unbacked: number;
}

const name = (make: string | null | undefined, model: string | null | undefined) =>
  `${(make ?? '').trim()} ${(model ?? '').trim()}`.trim();
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function tally(values: string[]): { name: string; cars: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([n, cars]) => ({ name: n, cars }))
    .sort((a, b) => b.cars - a.cars || a.name.localeCompare(b.name));
}

const list = (items: { name: string; cars: number }[]) =>
  items.map(i => (i.cars > 1 ? `${i.name} ×${i.cars}` : i.name)).join(', ');

/**
 * Same length and ONE edit apart: a single wrong character, or two neighbours swapped.
 *
 * ⭐ Found on the first dry run against the live tables (2026-10-01): the unbacked learned codes were
 * mostly near-twins of real ones — `CX4L` beside `CK4L` (23 cars), `GTAV` beside `CTAV`, `CRBV` beside
 * `CRVB`. The existing `nearMissCode` only knows the look-alike pairs (O/0, S/5…) and saw none of them:
 * a misread is not always a look-alike, and a typo is often a swap.
 */
export function oneEditApart(a: string, b: string): boolean {
  if (a.length !== b.length || a === b) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  if (diff.length === 1) return true;
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

/**
 * One row per code FG has LEARNED something about, plus every code a live car carries.
 *
 * ⚠️ A built-in code with no car and nothing learned is left out on purpose: the built-in list is
 * curated in a file under review, and ~97 rows of "nothing to see" would bury the ones to check.
 *
 * @param liveCars   the live fleet (no archived, no mocks) — what "the cars say" is measured against
 * @param allCars    live AND archived — the vocabulary of classes the fleet has ever carried
 */
export function auditModelCodes(
  liveCars: readonly AuditCar[],
  allCars: readonly AuditCar[],
  learned: readonly LearnedClassRow[],
  taught: readonly TaughtModelRow[],
): ModelCodeAudit {
  const learnedBy = new Map(learned.map(r => [normalizeClassCode(r.code), r]));
  const taughtBy = new Map(taught.map(r => [normalizeClassCode(r.code), r]));
  const carsBy = new Map<string, AuditCar[]>();
  for (const car of liveCars) {
    const code = normalizeClassCode(car.classCode);
    if (!code) continue;
    const bucket = carsBy.get(code);
    if (bucket) bucket.push(car); else carsBy.set(code, [car]);
  }
  // Classes any car has ever carried. Code-shaped values are left out — one car storing `CK4L` as its
  // class is exactly what must not be allowed to vouch for `CK4L` here (see isCodeShapedClass).
  const fleetClasses = new Set<string>();
  for (const car of allCars) {
    const cls = car.rentalClass?.trim().toUpperCase();
    if (cls && !isCodeShapedClass(cls, car.classCode)) fleetClasses.add(cls);
  }

  const codes = new Set<string>([...learnedBy.keys(), ...taughtBy.keys(), ...carsBy.keys()]);
  codes.delete('');

  const rows: ModelCodeRow[] = [...codes].map(code => {
    const cars = carsBy.get(code) ?? [];
    const builtIn = lookupVehicleClass(code);
    const taughtRow = taughtBy.get(code) ?? null;
    const learnedRow = learnedBy.get(code) ?? null;
    const ambiguous = isAmbiguousClassCode(code);

    const builtInName = builtIn ? name(builtIn.make, builtIn.model) : null;
    const taughtName = taughtRow ? name(taughtRow.make, taughtRow.model) : null;
    // ⚠️ Mirrors the reader exactly: the built-in list is tried first and a taught row only fills a gap
    // (keytagReader). An ambiguous code resolves to nothing, whatever was taught.
    const model: ModelCodeRow['model'] = ambiguous ? null
      : builtInName ? { name: builtInName, source: 'built-in' }
      : taughtName ? { name: taughtName, source: 'taught' }
      : null;
    const shadowedTaught = taughtName && (ambiguous || builtInName) ? taughtName : null;

    const carModels = tally(cars.map(c => name(c.make, c.model)).filter(Boolean));
    const carClasses = tally(cars.map(c => c.rentalClass?.trim().toUpperCase() ?? '').filter(Boolean));
    const cls = learnedRow?.rentalClass.trim().toUpperCase() ?? '';

    const problems: string[] = [];
    const notes: string[] = [];

    if (code.length !== 4) problems.push(`“${code}” isn't shaped like a model code. They are four characters.`);

    if (cls) {
      if (isCodeShapedClass(cls, code)) {
        problems.push(`Its class is “${cls}”, which is a model code, not a class.`);
      } else if (!fleetClasses.has(cls)) {
        problems.push(`Its class is “${cls}”, and no car on the fleet has that class.`);
      } else if (!learnedRow!.pinned && carClasses.length > 0 && !carClasses.some(c => c.name === cls)) {
        problems.push(`FG learned class ${cls}, but the cars carrying it are ${list(carClasses)}.`);
      }
    }

    if (model && carModels.length > 0) {
      const matching = carModels.filter(c => same(c.name, model.name));
      if (matching.length === 0) {
        problems.push(`FG fills in ${model.name}, but the cars carrying it are ${list(carModels)}.`);
      } else if (carModels.length > 1) {
        problems.push(`The cars carrying it don't agree: ${list(carModels)}.`);
      }
    }
    if (shadowedTaught && builtInName && !same(shadowedTaught, builtInName)) {
      problems.push(`You taught ${shadowedTaught}, but FG's built-in list says ${builtInName} and wins.`);
    }

    if (ambiguous) notes.push('Used for more than one model, so FG asks and never guesses.');
    if (!model && !ambiguous && cars.length > 0) {
      notes.push(`FG has no model for this code. ${cars.length === 1 ? 'One car carries' : `${cars.length} cars carry`} it.`);
    }
    if (cars.length === 0) {
      // ⚠️⚠️ ONE EDIT APART IS NOT ENOUGH ON ITS OWN, and the first dry run proved it: every code starts
      // with C and the space is dense, so "one character from a living code" matched nearly ALL 22
      // unbacked rows — including `CCSE`, a real built-in Camry SE. A rule that flags everything flags
      // nothing. The signal is the twin that ALSO carries this row's learned class, on a code FG has no
      // model for: `CX4L → C` beside `CK4L`, whose 23 cars are all class C. That is a problem; any other
      // neighbour is only a note, and neither one says "misread" — a real code whose cars all left can
      // sit one character from a living one.
      const twins = code.length === 4
        ? [...carsBy.entries()].filter(([c]) => oneEditApart(code, c)).sort((x, y) => y[1].length - x[1].length)
        : [];
      const sameClass = cls
        ? twins.filter(([, cs]) => cs.some(c => (c.rentalClass ?? '').trim().toUpperCase() === cls))
        : [];
      const carsWord = (n: number) => `${n} ${n === 1 ? 'car' : 'cars'}`;
      // A TAUGHT model does not vouch for the code: `CSM3 → Tesla Model 3` was taught from a misread of
      // `CTM3` at a registration. Only the built-in list, curated in a file, clears a code of suspicion.
      if (sameClass.length > 0 && model?.source !== 'built-in') {
        const [c, cs] = sameClass[0];
        problems.push(`No live car carries it. It is one character from ${c} (${carsWord(cs.length)}), which is also class ${cls}.`);
      } else if (twins.length > 0) {
        const [c, cs] = twins[0];
        notes.push(`No live car carries this code. Nearest living code: ${c} (${carsWord(cs.length)}).`);
      } else {
        notes.push('No live car carries this code.');
      }
    }

    return {
      code,
      model,
      shadowedTaught,
      rentalClass: learnedRow ? { value: cls, source: learnedRow.pinned ? 'pinned' : 'learned' } : null,
      liveCars: cars.length,
      carModels,
      carClasses,
      problems,
      notes,
      canForgetClass: !!learnedRow && !learnedRow.pinned,
      canForgetModel: !!taughtRow,
    };
  });

  // Problems first, then the unbacked, then the healthy — busiest code first within each tier.
  const tier = (r: ModelCodeRow) => (r.problems.length > 0 ? 0 : r.liveCars === 0 ? 1 : 2);
  rows.sort((a, b) => tier(a) - tier(b) || b.liveCars - a.liveCars || a.code.localeCompare(b.code));

  return {
    rows,
    toCheck: rows.filter(r => r.problems.length > 0).length,
    unbacked: rows.filter(r => r.problems.length === 0 && r.liveCars === 0).length,
  };
}
