const FUEL_LABELS: Record<number, string> = {
  0: 'Empty',
  1: '1/8',
  2: '1/4',
  3: '3/8',
  4: '1/2',
  5: '5/8',
  6: '3/4',
  7: '7/8',
  8: 'Full',
};

function fuelColor(v: number): string {
  if (v <= 1) return '#ef4444';
  if (v <= 2) return '#f97316';
  if (v <= 3) return '#eab308';
  return '#22c55e';
}

interface FuelLevelSelectorProps {
  fuelLevel: number | null;
  setFuelLevel: (level: number | null) => void;
}

export function FuelLevelSelector({ fuelLevel, setFuelLevel }: FuelLevelSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
        Fuel Level
      </label>
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-bold motion-safe:animate-pulse-slow"
            style={{ color: fuelLevel !== null ? fuelColor(fuelLevel) : '#9ca3af' }}
          >
            ⛽ {fuelLevel !== null ? FUEL_LABELS[fuelLevel] : '—'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {fuelLevel !== null ? `${fuelLevel}/8` : 'set level'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={8}
          step={1}
          value={fuelLevel ?? 4}
          onChange={(e) => setFuelLevel(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 transition-colors"
          style={{ accentColor: fuelLevel !== null ? fuelColor(fuelLevel) : '#9ca3af' }}
        />
        <div className="flex justify-between px-0.5">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className={`w-px h-1.5 rounded-full transition-colors ${
                fuelLevel !== null && i <= fuelLevel
                  ? 'bg-gray-400 dark:bg-gray-400'
                  : 'bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>E</span>
          <span>1/4</span>
          <span>1/2</span>
          <span>3/4</span>
          <span>F</span>
        </div>
      </div>
    </div>
  );
}
export { FUEL_LABELS };
