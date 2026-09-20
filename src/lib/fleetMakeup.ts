/** A model the branch holds, and the class(es) it rents as. */
export interface MakeupModel { model: string; count: number; classes: string[] }
/** A make the branch holds, with its models commonest-first. */
export interface MakeupMake { make: string; count: number; models: MakeupModel[] }

/** What a car with no make or model shows as — counted, never silently dropped. */
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
): MakeupMake[] {
  const makes = new Map<string, Map<string, { count: number; classes: Set<string> }>>();

  for (const v of fleet) {
    const make = label(v.make);
    const model = label(v.model);
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

  return [...makes.entries()]
    .map(([make, models]) => ({
      make,
      count: [...models.values()].reduce((t, m) => t + m.count, 0),
      models: [...models.entries()]
        .map(([model, m]) => ({ model, count: m.count, classes: [...m.classes].sort() }))
        .sort(byCountThenName<MakeupModel>(m => m.model)),
    }))
    .sort(byCountThenName<MakeupMake>(m => m.make));
}
