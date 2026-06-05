import type { Dispatch, SetStateAction } from 'react';

interface Props {
  plate: string;
  onPlateChange: Dispatch<SetStateAction<string>>;
  exterior: boolean;
  onExteriorChange: Dispatch<SetStateAction<boolean>>;
  interior: boolean;
  onInteriorChange: Dispatch<SetStateAction<boolean>>;
}

const PILL_ACTIVE   = 'bg-amber-500 border-amber-500 text-white';
const PILL_INACTIVE = 'border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:border-amber-400';

export function EDVNoMatchFields({ plate, onPlateChange, exterior, onExteriorChange, interior, onInteriorChange }: Props) {
  return (
    <div className="mt-2 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 space-y-3">
      <p className="text-xs text-amber-700 dark:text-amber-400">
        No released detail hold found for today. Log manually or check Holds for the unit.
      </p>

      <div>
        <label className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">
          Vehicle plate (optional)
        </label>
        <input
          type="text"
          value={plate}
          onChange={e => onPlateChange(e.target.value.toUpperCase())}
          placeholder="e.g. LUR249"
          className="w-full px-2 py-1.5 rounded-md border border-amber-300 dark:border-amber-700 text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1.5">
          Condition
        </p>
        <div className="flex gap-2">
          {([
            { label: '🚗 Exterior', active: exterior, onChange: onExteriorChange },
            { label: '🪑 Interior', active: interior, onChange: onInteriorChange },
          ] as const).map(({ label, active, onChange }) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(v => !v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${active ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
