import { hapticLight } from '../lib/haptics';
import type { TripState } from '../lib/vsa-trip';

export function Pill({ label, active, danger, onClick }: {
  label: string; active: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { hapticLight(); onClick(); }}
      className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
        active
          ? danger
            ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

const TRIP_NOTE_PRESETS = [
  'Airport full of dirties',
  'No clean units at airport',
  'Customer waiting',
  'Priority unit requested',
];

export function NotesField({ value, onChange, tripState, presets = TRIP_NOTE_PRESETS }: {
  value: string; onChange: (v: string) => void; tripState: TripState;
  presets?: string[];
}) {
  const activePills = new Set(
    (value ?? '').split(' · ').map(p => p.trim()).filter(Boolean)
  );

  const handlePillToggle = (pill: string) => {
    hapticLight();
    const parts = (value ?? '').split(' · ').map(p => p.trim()).filter(Boolean);
    if (parts.includes(pill)) {
      onChange(parts.filter(p => p !== pill).join(' · '));
    } else {
      onChange(parts.length > 0 ? `${value} · ${pill}` : pill);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
        {tripState === 'form' ? 'Notes' : 'Context / Delays'}
      </label>
      {presets && presets.length > 0 && tripState === 'form' && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {presets.map(p => (
            <button
              key={p} type="button"
              onClick={() => handlePillToggle(p)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                activePills.has(p)
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-800 dark:text-yellow-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 hover:text-yellow-700 dark:hover:text-yellow-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={value}
        onChange={e => {
          onChange(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        placeholder={tripState === 'form' ? 'Any context for this run…' : 'Stuck behind a train? Let us know…'}
        rows={1}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none overflow-hidden"
      />
    </div>
  );
}
