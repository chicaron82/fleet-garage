import type { Dispatch, SetStateAction } from 'react';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { carsFromPageCounter } from '../../lib/gas-sheet';

export interface BackfillFormState {
  totalPages: number;
  entriesOnCurrentPage: number;
  carsRemaining: string;
  cleanNotPickedUp: string;
  carryOver: number;
  teamSize: number;
  overtimeHours: number;
}

interface Props {
  label: string;
  form: BackfillFormState;
  setForm: Dispatch<SetStateAction<BackfillFormState>>;
  saving: boolean;
  saveError: string;
  onSave: () => void;
}

const INPUT = 'w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';
const STEPPER_BTN = 'w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-fg-yellow transition cursor-pointer flex items-center justify-center text-sm font-semibold';

export function BackfillEntryForm({ label, form, setForm, saving, saveError, onSave }: Props) {
  // ── Rollover handlers (same pattern as WashbayClosingLog) ──────────────────
  const handleEntryIncrement = () => {
    if (form.entriesOnCurrentPage === 19) {
      setForm(f => ({ ...f, totalPages: f.totalPages + 1, entriesOnCurrentPage: 0 }));
      hapticMedium();
    } else {
      setForm(f => ({ ...f, entriesOnCurrentPage: f.entriesOnCurrentPage + 1 }));
      hapticLight();
    }
  };
  const handleEntryDecrement = () => {
    if (form.entriesOnCurrentPage === 0 && form.totalPages > 0) {
      setForm(f => ({ ...f, totalPages: f.totalPages - 1, entriesOnCurrentPage: 19 }));
      hapticMedium();
    } else if (form.entriesOnCurrentPage > 0) {
      setForm(f => ({ ...f, entriesOnCurrentPage: f.entriesOnCurrentPage - 1 }));
      hapticLight();
    }
  };
  const handlePageIncrement = () => {
    setForm(f => ({ ...f, totalPages: f.totalPages + 1, entriesOnCurrentPage: 19 }));
    hapticLight();
  };
  const handlePageDecrement = () => {
    setForm(f => ({ ...f, totalPages: Math.max(0, f.totalPages - 1) }));
    hapticLight();
  };

  return (
    <div className="px-5 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest pt-3">
        {label} — Backfill Entry
      </p>

      {/* Gas sheet — page counter with rollover */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Gas Sheet Pages</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">Full pages</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handlePageDecrement} className={STEPPER_BTN}>−</button>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">
                {form.totalPages}
              </span>
              <button type="button" onClick={handlePageIncrement} className={STEPPER_BTN}>+</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">
              Entries on current page
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleEntryDecrement} className={STEPPER_BTN}>−</button>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">
                {form.entriesOnCurrentPage}
              </span>
              <button type="button" onClick={handleEntryIncrement} className={STEPPER_BTN}>+</button>
            </div>
          </div>
        </div>
        {(form.totalPages > 0 || form.entriesOnCurrentPage > 0) && (
          <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1.5">
            = {carsFromPageCounter(form.totalPages, form.entriesOnCurrentPage)} cars in ✓
          </p>
        )}
      </div>

      {/* Numeric fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">In queue at close</label>
          <input type="number" min="0" value={form.carsRemaining}
            onChange={e => setForm(f => ({ ...f, carsRemaining: e.target.value }))}
            placeholder="0" className={INPUT} />
        </div>
        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Clean, not picked up</label>
          <input type="number" min="0" value={form.cleanNotPickedUp}
            onChange={e => setForm(f => ({ ...f, cleanNotPickedUp: e.target.value }))}
            placeholder="0" className={INPUT} />
        </div>
      </div>

      {/* Carry-over */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400 dark:text-gray-500">Carry-over from last night</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setForm(f => ({ ...f, carryOver: Math.max(0, f.carryOver - 1) }))} className={STEPPER_BTN}>−</button>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-5 text-center tabular-nums">{form.carryOver}</span>
          <button type="button" onClick={() => setForm(f => ({ ...f, carryOver: f.carryOver + 1 }))} className={STEPPER_BTN}>+</button>
        </div>
      </div>

      {/* Team size */}
      <div>
        <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">Team size</label>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => setForm(f => ({ ...f, teamSize: Math.max(1, f.teamSize - 1) }))}
            className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-fg-yellow transition cursor-pointer flex items-center justify-center text-lg font-semibold">−</button>
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">{form.teamSize}</span>
          <button type="button"
            onClick={() => setForm(f => ({ ...f, teamSize: f.teamSize + 1 }))}
            className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-fg-yellow transition cursor-pointer flex items-center justify-center text-lg font-semibold">+</button>
        </div>
      </div>

      {/* Overtime */}
      <div>
        <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">Overtime hours (if applicable)</label>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(h => (
            <button key={h} type="button"
              onClick={() => setForm(f => ({ ...f, overtimeHours: h }))}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                form.overtimeHours === h
                  ? 'bg-fg-yellow border-fg-yellow text-gray-900'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
              {h === 0 ? '0' : `+${h}h`}
            </button>
          ))}
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-red-500 dark:text-red-400">{saveError}</p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 text-gray-900 text-sm font-semibold transition cursor-pointer"
      >
        {saving ? 'Saving…' : 'Save Entry'}
      </button>
    </div>
  );
}
