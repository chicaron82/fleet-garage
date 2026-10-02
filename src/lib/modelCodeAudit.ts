import { lookupVehicleClass, isAmbiguousClassCode, normalizeClassCode, sameModelFamily } from '../../api/_lib/vehicleClassCodex';
import { isCodeShapedClass } from '../../api/_lib/classPin';
import { modelCodeRuling, misreadOf } from '../../api/_lib/modelCodeRulings';

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
// ⚠️⚠️ AND IT MUST NOT ASK WHAT HE HAS ALREADY ANSWERED. An hour after this shipped he read the list
// and four of its flags were things he had settled: *"CBRS, we keep discussing this, but past you
// doesn't write it down."* So it now (1) agrees across a trim or a hybrid suffix, the way
// `modelCodeMismatch` always has; (2) carries his ruling on a code and stops raising that conflict;
// (3) says when ARCHIVED cars carried a code, which makes it a real code whose cars left, not a misread.
//
// Pure: no DB, no React. docs/October/ticket-model-codes-he-can-audit.md,
// docs/October/ticket-the-audit-asks-what-he-already-answered.md

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
  model: { name: string; source: 'built-in' | 'taught'; hybrid: boolean } | null;
  /** What he has ruled about this code (modelCodeRulings). Shown, and it quiets the settled conflict. */
  ruling: string | null;
  /** A taught model the built-in list overrides, so it never applies. Shown so it can be forgotten. */
  shadowedTaught: string | null;
  rentalClass: { value: string; source: 'pinned' | 'learned' } | null;
  liveCars: number;
  /** Cars that carried this code and have since left the fleet. Proof the code is real. */
  archivedCars: number;
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

function tally(values: string[]): { name: string; cars: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([n, cars]) => ({ name: n, cars }))
    .sort((a, b) => b.cars - a.cars || a.name.localeCompare(b.name));
}

function bucketByCode(cars: readonly AuditCar[]): Map<string, AuditCar[]> {
  const by = new Map<string, AuditCar[]>();
  for (const car of cars) {
    const code = normalizeClassCode(car.classCode);
    if (!code) continue;
    const bucket = by.get(code);
    if (bucket) bucket.push(car); else by.set(code, [car]);
  }
  return by;
}

const carsWord = (n: number) => `${n} ${n === 1 ? 'car' : 'cars'}`;

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
  const carsBy = bucketByCode(liveCars);
  // `allCars` is the live fleet plus the archived one, so whatever is not live has left.
  const live = new Set(liveCars);
  const archivedBy = bucketByCode(allCars.filter(c => !live.has(c)));
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
    const fills = ambiguous ? null : builtIn ?? taughtRow;
    const model: ModelCodeRow['model'] = !fills ? null
      : { name: name(fills.make, fills.model), source: builtIn ? 'built-in' : 'taught', hybrid: !!builtIn?.isHybrid };
    const ruling = modelCodeRuling(code);
    const shadowedTaught = taughtName && (ambiguous || builtInName) ? taughtName : null;

    const carModels = tally(cars.map(c => name(c.make, c.model)).filter(Boolean));
    const carClasses = tally(cars.map(c => c.rentalClass?.trim().toUpperCase() ?? '').filter(Boolean));
    const cls = learnedRow?.rentalClass.trim().toUpperCase() ?? '';

    const problems: string[] = [];
    const notes: string[] = [];

    // ⭐ A code he has RULED a misread stays in front of him until it is gone: nothing carrying it,
    // nothing learned for it. FG does not correct the car or forget the lesson on its own.
    const truth = misreadOf(code);
    if (truth) {
      problems.push(cars.length > 0
        ? `A misread of ${truth}. ${cars.length === 1 ? 'One car still carries' : `${cars.length} cars still carry`} it.`
        : `A misread of ${truth}. Nothing carries it now, so what FG learned for it can be forgotten.`);
    }

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

    if (fills && cars.length > 0) {
      // ⚠️ Trim-tolerant, the same rule `modelCodeMismatch` uses: "Camry SE" on a car is not a
      // disagreement with "Camry" on the code. A warning that cries at a trim is one he learns to dismiss.
      const differ = cars.filter(c => name(c.make, c.model) && !sameModelFamily(c.make, c.model, fills.make, fills.model));
      const what = list(tally(differ.map(c => name(c.make, c.model))));
      if (differ.length === cars.length) {
        problems.push(`FG fills in ${model!.name}, but the cars carrying it are ${what}.`);
      } else if (differ.length > 0) {
        problems.push(`FG fills in ${model!.name}, but ${differ.length} of the ${cars.length} cars carrying it ${differ.length === 1 ? 'is' : 'are'} ${what}.`);
      }
    }
    // A ruling settles exactly this conflict, so it is not raised again (CBRS). And "RAV4 Hybrid"
    // taught before hybrid became a flag is the same car as the built-in RAV4, not a rival.
    if (taughtRow && builtIn && !ruling && !sameModelFamily(taughtRow.make, taughtRow.model, builtIn.make, builtIn.model)) {
      problems.push(`You taught ${taughtName}, but FG's built-in list says ${builtInName} and wins.`);
    }

    if (ambiguous) notes.push('Used for more than one model, so FG asks and never guesses.');
    if (!model && !ambiguous && cars.length > 0) {
      notes.push(`FG has no model for this code. ${cars.length === 1 ? 'One car carries' : `${cars.length} cars carry`} it.`);
    }
    const archived = archivedBy.get(code) ?? [];
    if (cars.length === 0 && archived.length > 0) {
      // ⭐ *"CBZL exists, but archived because we no longer have it"* (Aaron, 2026-10-01). A code a car
      // left the fleet wearing is a REAL code whose cars are gone — never a misread suspect, however
      // close it sits to a living one.
      const were = list(tally(archived.map(c => name(c.make, c.model)).filter(Boolean)));
      notes.push(`No live car carries it. ${archived.length === 1 ? 'One archived car' : `${archived.length} archived cars`} did${were ? ` (${were})` : ''}.`);
    } else if (cars.length === 0) {
      // ⚠️⚠️ ONE EDIT APART IS NOT ENOUGH ON ITS OWN, and the first dry run proved it: every code starts
      // with C and the space is dense, so "one character from a living code" matched nearly ALL 22
      // unbacked rows — including `CCSE`, a real built-in Camry SE. A rule that flags everything flags
      // nothing. The signal is a twin that ALSO shares what FG learned for this row: the same class
      // (`CX4L → C` beside `CK4L`, whose cars are all class C) or the same model (`CORS`, taught
      // Equinox, beside `CQRS`, whose cars are Equinoxes). Any other neighbour is only a note.
      const twins = code.length === 4
        ? [...carsBy.entries()].filter(([c]) => oneEditApart(code, c)).sort((x, y) => y[1].length - x[1].length)
        : [];
      const shared = (twinCars: AuditCar[]): string[] => [
        cls && twinCars.some(c => (c.rentalClass ?? '').trim().toUpperCase() === cls) ? `class ${cls}` : '',
        fills && twinCars.some(c => sameModelFamily(c.make, c.model, fills.make, fills.model)) ? `a ${model!.name}` : '',
      ].filter(Boolean);
      const suspect = twins.find(([, cs]) => shared(cs).length > 0);
      // A TAUGHT model does not vouch for the code: `CSM3 → Tesla Model 3` was taught from a misread of
      // `CTM3` at a registration. Only the built-in list, curated in a file, clears a code of suspicion.
      if (suspect && model?.source !== 'built-in') {
        const [c, cs] = suspect;
        problems.push(`No live car carries it. It is one character from ${c} (${carsWord(cs.length)}), which is also ${shared(cs).join(' and ')}.`);
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
      ruling,
      shadowedTaught,
      rentalClass: learnedRow ? { value: cls, source: learnedRow.pinned ? 'pinned' : 'learned' } : null,
      liveCars: cars.length,
      archivedCars: archived.length,
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
