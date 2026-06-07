import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useAuth } from '../../context/AuthContext';
import { hapticMedium } from '../../lib/haptics';

interface Props {
  prefill?: string;
  onBack: () => void;
  onSuccess: (vehicleId: string) => void;
  returnTo?: 'fleet' | 'hold';
}

const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Brown', 'Gold', 'Other'];

const MAKES_MODELS: Record<string, string[]> = {
  Chevrolet:       ['Blazer', 'Colorado', 'Equinox', 'Malibu', 'Malibu LT', 'Silverado', 'Suburban', 'Tahoe', 'Trailblazer', 'Trax', 'Traverse'],
  Ford:            ['Bronco Sport', 'Edge', 'Escape', 'Escape Hybrid', 'Expedition', 'Explorer', 'F-150', 'Maverick', 'Mustang'],
  Toyota:          ['4Runner', 'Camry', 'Camry Hybrid', 'Camry LE', 'Corolla', 'Corolla Cross', 'Corolla Hybrid', 'Highlander', 'Prius', 'RAV4', 'Sienna', 'Tacoma'],
  Honda:           ['Accord', 'Civic', 'CR-V', 'HR-V', 'Pilot', 'Ridgeline'],
  Nissan:          ['Altima', 'Frontier', 'Kicks', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Versa'],
  Hyundai:         ['Elantra', 'Ioniq 5', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson', 'Venue'],
  Kia:             ['Carnival', 'Forte', 'K4', 'K5', 'Niro', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Telluride'],
  Jeep:            ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Wrangler'],
  Dodge:           ['Challenger', 'Charger', 'Durango', 'Grand Caravan', 'Ram 1500'],
  Chrysler:        ['300', 'Pacifica'],
  Buick:           ['Encore', 'Encore GX', 'Enclave', 'Envision'],
  GMC:             ['Acadia', 'Canyon', 'Sierra', 'Terrain', 'Yukon'],
  Cadillac:        ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6'],
  BMW:             ['2 Series', '3 Series', '5 Series', 'X1', 'X3', 'X5'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLC', 'GLE', 'GLS'],
  Audi:            ['A4', 'A6', 'Q3', 'Q5', 'Q7'],
  Mazda:           ['CX-30', 'CX-5'],
  Volkswagen:      ['Atlas', 'Jetta', 'Passat', 'Taos', 'Tiguan'],
  Volvo:           ['XC60', 'XC90'],
  Tesla:           ['Model 3', 'Model S', 'Model X', 'Model Y'],
  Other:           ['Other'],
};

const MAKES = Object.keys(MAKES_MODELS).sort();

const INPUT = 'w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition bg-white dark:bg-gray-900 transition-colors';

function classifyPrefill(value?: string): { unit: string; plate: string } {
  if (!value) return { unit: '', plate: '' };
  // All digits → unit number; anything with letters → license plate
  return /^\d+$/.test(value)
    ? { unit: value, plate: '' }
    : { unit: '', plate: value };
}

export function RegisterVehicleForm({ prefill, onBack, onSuccess, returnTo = 'hold' }: Props) {
  const { addVehicle } = useVehicleHoldContext();
  const { user } = useAuth();
  const seed = classifyPrefill(prefill);

  const currentYear = new Date().getFullYear();

  const [unit, setUnit] = useState(seed.unit);
  const [plate, setPlate] = useState(seed.plate);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(currentYear);
  const [color, setColor] = useState('');
  const [hasMobileCable,  setHasMobileCable]  = useState(true);
  const [hasJ1772Adapter, setHasJ1772Adapter] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const canSubmit = unit.trim() && plate.trim() && make && model && year > 1999 && color && !submitting;

  const handleYearDecrement = () => {
    if (year > 2000) setYear(year - 1);
  };

  const handleYearIncrement = () => {
    if (year < 2030) setYear(year + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const isTesla = make === 'Tesla';
      const id = await addVehicle({
        unitNumber:     unit.trim(),
        licensePlate:   plate.trim().toUpperCase(),
        make,
        model,
        year:           year,
        color,
        branchId:       user?.branchId,
        isTesla,
        hasMobileCable:  isTesla ? hasMobileCable  : null,
        hasJ1772Adapter: isTesla ? hasJ1772Adapter : null,
        // Fleet-add path has no hold — vehicle enters clean. Hold path lets
        // addVehicle default to HELD, then addHold overwrites it immediately.
        status: returnTo === 'fleet' ? 'CLEAR' : undefined,
      });
      hapticMedium();
      if (returnTo === 'fleet') {
        setSuccessToast(`✅ Vehicle ${unit.trim()} registered`);
        setTimeout(() => onSuccess(id), 2500);
      } else {
        onSuccess(id);
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="transition-colors">
      {/* Nav */}
      <nav className="bg-white dark:bg-gray-900 transition-colors border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Add to Ledger</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Vehicle Details
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Unit #</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={unit}
                  onChange={e => setUnit(e.target.value.toUpperCase())}
                  placeholder="e.g. 5428735"
                  autoFocus
                  className={`${INPUT} uppercase`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate</label>
                <input
                  type="text"
                  value={plate}
                  onChange={e => setPlate(e.target.value.toUpperCase())}
                  placeholder="e.g. LFJ108"
                  className={`${INPUT} uppercase`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Make</label>
                <select
                  value={make}
                  onChange={e => { setMake(e.target.value); setModel(''); }}
                  className={INPUT}
                >
                  <option value="">Select…</option>
                  {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Model</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Year</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleYearDecrement}
                    disabled={year <= 2000}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {year}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleYearIncrement}
                    disabled={year >= 2030}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Color</label>
                <select
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className={INPUT}
                >
                  <option value="">Select…</option>
                  {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* EV Asset Check — shown when Tesla is selected */}
          {make === 'Tesla' && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">⚡ EV Asset Check</p>
              {([
                { label: 'Mobile Charge Cable',  checked: hasMobileCable,  onChange: setHasMobileCable },
                { label: 'J1772 Adapter',        checked: hasJ1772Adapter, onChange: setHasJ1772Adapter },
              ] as const).map(({ label, checked, onChange }) => (
                <label key={label} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-black font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding…' : 'Add to Ledger'}
            </button>
          </div>

        </form>
      </div>

      {successToast && (
        <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="px-5 py-3 rounded-2xl bg-green-800/90 text-white text-sm font-semibold shadow-xl backdrop-blur-sm">
            {successToast}
          </div>
        </div>
      )}
    </div>
  );
}
