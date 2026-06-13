import { hapticLight } from '../../lib/haptics';
import { DAMAGE_PRESETS } from '../../lib/hold-presets';

interface DamagePresetsSelectorProps {
  damageTypes: string[];
  toggleDamageType: (preset: string) => void;
  customDamage: string;
  setCustomDamage: (val: string) => void;
}

export function DamagePresetsSelector({
  damageTypes,
  toggleDamageType,
  customDamage,
  setCustomDamage,
}: DamagePresetsSelectorProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Damage Type *
        </label>
        {damageTypes.length > 0 && (
          <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
            {damageTypes.length} selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {DAMAGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              hapticLight();
              toggleDamageType(preset);
            }}
            className={`text-left px-3 py-2 rounded-lg border text-sm transition cursor-pointer ${
              damageTypes.includes(preset)
                ? 'border-fg-yellow bg-yellow-50 text-gray-900 dark:text-gray-100 font-medium'
                : 'border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      {damageTypes.includes('Other') && (
        <input
          type="text"
          placeholder="Describe the damage…"
          value={customDamage}
          onChange={(e) => setCustomDamage(e.target.value)}
          className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
        />
      )}
    </div>
  );
}
