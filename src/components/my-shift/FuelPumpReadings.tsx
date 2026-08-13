import { useFuelPumpReadings } from '../../hooks/useFuelPumpReadings';
import type { User } from '../../types';

const NUM_INPUT =
  'w-full mt-1 px-3 py-2.5 rounded-lg border text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
  'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-fg-yellow transition';

function Field({ label, value, onChange, decimal, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; decimal?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        inputMode={decimal ? 'decimal' : 'numeric'}
        step={decimal ? undefined : '1'}
        placeholder={placeholder ?? (decimal ? '0.0' : '0')}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={NUM_INPUT}
      />
    </div>
  );
}

/**
 * Shift Duties → fuel pump readings. Pump 1 and Pump 2 are analog metered gauges
 * (both tracked open→close for litres pumped; Pump 2 returned to service 2026-08-13,
 * retiring the old locked-tripwire), plus the digital tank inventory. Logic lives
 * in useFuelPumpReadings.
 */
export function FuelPumpReadings({ user }: { user: User }) {
  const f = useFuelPumpReadings(user);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">⛽ Fuel Pump Readings</p>
        {f.saved && <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Saved</span>}
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Pump 1 — analog, metered */}
        <div>
          <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">Pump 1 — Analog</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening" value={f.pump1Open}  onChange={v => { f.setPump1Open(v);  f.clearSaved(); }} />
            <Field label="Closing" value={f.pump1Close} onChange={v => { f.setPump1Close(v); f.clearSaved(); }} />
          </div>
          {f.pump1Pumped !== null && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">⛽ {f.pump1Pumped} L pumped today</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Closing − Opening</p>
            </div>
          )}
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Pump 2 — analog, metered (back in service 2026-08-13) */}
        <div>
          <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">Pump 2 — Analog</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening" value={f.pump2Open}  onChange={v => { f.setPump2Open(v);  f.clearSaved(); }} />
            <Field label="Closing" value={f.pump2Close} onChange={v => { f.setPump2Close(v); f.clearSaved(); }} />
          </div>
          {f.pump2Pumped !== null && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">⛽ {f.pump2Pumped} L pumped today</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Closing − Opening</p>
            </div>
          )}
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Digital tank */}
        <div>
          <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">Digital Tank Reading</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening" value={f.digitalOpen}  onChange={v => { f.setDigitalOpen(v);  f.clearSaved(); }} decimal />
            <Field label="Closing" value={f.digitalClose} onChange={v => { f.setDigitalClose(v); f.clearSaved(); }} decimal />
          </div>
          {f.digitalNet !== null && (
            <p className={`text-xs mt-1.5 ${f.digitalUp ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {f.digitalUp
                ? `🔵 Reading went UP by ${Math.abs(f.digitalNet)} L — note why below`
                : `⛽ ${Math.abs(f.digitalNet)} L net change`}
            </p>
          )}
          {f.digitalUp && (
            <input
              type="text"
              placeholder="e.g. Tank topped up mid-shift"
              value={f.topupNote}
              onChange={e => { f.setTopupNote(e.target.value); f.clearSaved(); }}
              className="w-full mt-2 px-3 py-2.5 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          )}
        </div>

        {f.saveError && (
          <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
          </div>
        )}

        <button
          type="button"
          onClick={f.handleSave}
          disabled={!f.canSave || f.saving}
          className="w-full py-3 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 text-sm font-bold transition cursor-pointer"
        >
          {f.saving ? 'Saving…' : f.saved ? 'Saved ✓ — Save again' : 'Save Fuel Readings'}
        </button>
      </div>
    </div>
  );
}
