/** A model the branch holds, and the class(es) it rents as. */
export interface MakeupModel { model: string; count: number; classes: string[] }
/** A make the branch holds, with its models commonest-first. */
export interface MakeupMake { make: string; count: number; models: MakeupModel[] }
/** The makes, and how many rows were set aside for having no name at all. */
export interface FleetMakeup { makes: MakeupMake[]; plateOnly: number }

/** Shown for a car that has a make but no model — a real car with a gap, still counted. */
export const NO_NAME = '—';

const label = (v: string | null | undefined): string => {
  const t = (v ?? '').trim();
  return t === '' ? NO_NAME : t;
};

/**
 * What the fleet is made of: every make, its car count, and its models with the classes they rent as.
 *
 * ⭐⭐ Aaron asked for this on 2026-09-19 — *"how much of each model we have for the makes we have in
 * the fleet"* — and the design decision is the CLASS column. Model alone is a census; model with its
 * class is the thing he actually reasons with, because several models straddle classes: the Kicks is
 * B4 and B5 (the model-year move, reference_rental_class_by_model_year), the Sportage is E6 and Q4
 * (the hybrids), the Corolla is C and E6, the Model 3 spans four. A card that dropped the class
 * would hide the only part that answers a question at the counter.
 *
 * ⚠️ It is a CENSUS, never availability. It says what the branch holds, not what is on the lot — FG
 * knows what it has been shown (project_fg_attendance_observation_boundary). Pass it the same
 * live-fleet rows the class bars use (`liveFleet`), so the two surfaces can never disagree.
 *
 * ⚠️ It makes no recommendation. A B5 covering a Q4 ask is Aaron's call in the moment
 * (reference_class_substitutions), not a rule FG gets to apply — this returns counts and stops.
 *
 * Commonest first at both levels, ties alphabetical, so a glance lands in the same place every time.
 */
export function fleetMakeup(
  fleet: readonly { make?: string | null; model?: string | null; rentalClass?: string | null }[],
): FleetMakeup {
  const makes = new Map<string, Map<string, { count: number; classes: Set<string> }>>();
  let plateOnly = 0;

  for (const v of fleet) {
    const make = label(v.make);
    const model = label(v.model);
    // ⭐⭐ NEITHER a make NOR a model = a car FG knows OF and has never MET — the plate-only shape
    // (`year: 0`, `make: ''`, `model: ''`) the geotab-watchlist rows have carried since 2026-07-18
    // (see resolveKeytagScan: *"not broken records"*). This card counts what the branch HOLDS, and a
    // plate on an install list is not yet a car to hold. Aaron, seeing 14 of them bucketed under
    // "—" on the first render: *"i think it should filter those out until they have data attached
    // to them."* ⚠️ Set ASIDE, never hidden — the count comes back so the card can say so.
    if (make === NO_NAME && model === NO_NAME) { plateOnly += 1; continue; }
    const models = makes.get(make) ?? new Map();
    const row = models.get(model) ?? { count: 0, classes: new Set<string>() };
    row.count += 1;
    const cls = (v.rentalClass ?? '').trim();
    if (cls) row.classes.add(cls);            // a car with no class adds nothing, and hides nothing
    models.set(model, row);
    makes.set(make, models);
  }

  const byCountThenName = <T extends { count: number }>(name: (x: T) => string) =>
    (a: T, b: T) => b.count - a.count || name(a).localeCompare(name(b));

  const out = [...makes.entries()]
    .map(([make, models]) => ({
      make,
      count: [...models.values()].reduce((t, m) => t + m.count, 0),
      models: [...models.entries()]
        .map(([model, m]) => ({ model, count: m.count, classes: [...m.classes].sort() }))
        .sort(byCountThenName<MakeupModel>(m => m.model)),
    }))
    .sort(byCountThenName<MakeupMake>(m => m.make));

  return { makes: out, plateOnly };
}
