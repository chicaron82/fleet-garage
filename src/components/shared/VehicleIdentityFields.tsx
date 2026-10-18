// The make / model / year / colour controls, shared by the registration form and the
// direct-edit modal so there is ONE source for the model list + input behaviour (a
// duplicated MAKES_MODELS map would drift the first time a new model is added). Controlled:
// the parent owns the state; this renders the inputs and enforces the cascade (changing
// make clears model) + the year clamp. The catalogue lives in a component-free sibling
// module so react-refresh stays happy.
import { MAKES_MODELS, MAKES, COLORS, YEAR_MIN, YEAR_MAX, INPUT, FIELD_LABEL as LABEL } from './vehicleCatalogue';

interface VehicleIdentityFieldsProps {
  make: string;
  model: string;
  year: number;
  color: string;
  onMake: (v: string) => void;
  onModel: (v: string) => void;
  onYear: (v: number) => void;
  onColor: (v: string) => void;
  // Hybrid is a flag on the vehicle, not a "<Base> Hybrid" model. Optional: only render the
  // toggle where a parent wires it (register form now; edit modal later). No onHybrid → no toggle.
  isHybrid?: boolean;
  onHybrid?: (v: boolean) => void;
}

export function VehicleIdentityFields({
  make, model, year, color, onMake, onModel, onYear, onColor, isHybrid, onHybrid,
}: VehicleIdentityFieldsProps) {
  // ⭐ YEAR 0 = NOT KNOWN, shown as such (2026-10-17). The edit modal used to seed a blank year to the
  // current year, so saving a model he DID know wrote a year he never chose — SB183H, a 2022 Tesla
  // whose tag reads "CM3L 22", was saved as 2026 and locked. Now an unknown year stays unknown until
  // he steps it; the first step lands on this year, a starting point he moves from, never a guess saved.
  const unknownYear = !year;
  const step = (d: 1 | -1) => onYear(unknownYear ? new Date().getFullYear() : year + d);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Make</label>
          <select
            value={make}
            // Changing make invalidates the model — clear it so a stale pairing can't be saved.
            onChange={e => { onMake(e.target.value); onModel(''); }}
            className={INPUT}
          >
            <option value="">Select…</option>
            {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Model</label>
          <select
            value={model}
            onChange={e => onModel(e.target.value)}
            disabled={!make}
            className={`${INPUT} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <option value="">Select…</option>
            {(MAKES_MODELS[make] ?? []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Year</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (unknownYear || year > YEAR_MIN) step(-1); }}
              disabled={!unknownYear && year <= YEAR_MIN}
              aria-label="Year down"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              −
            </button>
            <div className="flex-1 text-center">
              {unknownYear
                ? <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap">Not known</span>
                : <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{year}</span>}
            </div>
            <button
              type="button"
              onClick={() => { if (unknownYear || year < YEAR_MAX) step(1); }}
              disabled={!unknownYear && year >= YEAR_MAX}
              aria-label="Year up"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>
        <div>
          <label className={LABEL}>Color</label>
          <select
            value={color}
            onChange={e => onColor(e.target.value)}
            className={INPUT}
          >
            <option value="">Select…</option>
            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Hybrid toggle — the attribute that replaced the hard-coded "<Base> Hybrid" models.
          Pick the base model above, then flag it here. Only shown when the parent wires onHybrid. */}
      {onHybrid && (
        <label className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 cursor-pointer select-none">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">🔋 Hybrid model</span>
          <input
            type="checkbox"
            checked={!!isHybrid}
            onChange={e => onHybrid(e.target.checked)}
            className="w-5 h-5 accent-fg-yellow cursor-pointer"
          />
        </label>
      )}
    </>
  );
}
