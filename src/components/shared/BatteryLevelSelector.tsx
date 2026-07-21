// The EV twin of FuelLevelSelector. A Tesla's dash reads a PERCENTAGE, not eighths — so the
// return capture mirrors the instrument the operator is actually looking at instead of making him
// convert a battery % into "3/4 of a tank". Same thumb-friendly slider shape; 5% steps (finer than
// the fuel gauge's 12.5% eighths) so it stays one-handed on a phone.
const BATTERY_STEP = 5;

function batteryColor(pct: number): string {
  if (pct <= 15) return '#ef4444';
  if (pct <= 30) return '#f97316';
  if (pct <= 50) return '#eab308';
  return '#22c55e';
}

interface BatteryLevelSelectorProps {
  batteryPct: number | null;
  setBatteryPct: (pct: number | null) => void;
}

export function BatteryLevelSelector({ batteryPct, setBatteryPct }: BatteryLevelSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
        Charge Level
      </label>
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-bold motion-safe:animate-pulse-slow"
            style={{ color: batteryPct !== null ? batteryColor(batteryPct) : '#9ca3af' }}
          >
            🔋 {batteryPct !== null ? `${batteryPct}%` : '—'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {batteryPct !== null ? `${batteryPct}%` : 'set charge'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={BATTERY_STEP}
          value={batteryPct ?? 50}
          onChange={(e) => setBatteryPct(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 transition-colors"
          style={{ accentColor: batteryPct !== null ? batteryColor(batteryPct) : '#9ca3af' }}
        />
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
