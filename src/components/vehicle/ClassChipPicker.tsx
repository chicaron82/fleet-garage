import { useRef, useState } from 'react';
import { useRentalClasses } from '../../hooks/useRentalClasses';
import { hapticLight, hapticMedium } from '../../lib/haptics';

// The rental-class picker: recognize-and-tap instead of recall-and-type (Aaron, 2026-07-24). Chips
// come from the operator-curated `rental_classes` list (useRentalClasses); tap to select, "Other" to
// add a code seen on the lot, long-press to delete a typo or a class that left the fleet. Replaces
// the freeform text box in VehicleDirectEditModal — a mistyped class there LOCKS against tag reads
// (provenance ladder), so making a typo hard to enter is the point.

const LONG_PRESS_MS = 500;

const CHIP_BASE =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer select-none';
const CHIP_OFF =
  'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-400';
const CHIP_ON =
  'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100 text-white dark:text-gray-900';

export function ClassChipPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { classes, loading, addClass, removeClass } = useRentalClasses();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');

  const pressTimer = useRef<number | null>(null);
  const didLongPress = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const startPress = (code: string) => {
    didLongPress.current = false;
    pressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      hapticMedium();
      setPendingDelete(code);
    }, LONG_PRESS_MS);
  };

  const endPress = (code: string) => {
    clearTimer();
    if (didLongPress.current) return; // the long-press already armed delete on this chip
    if (pendingDelete) {
      setPendingDelete(null); // a tap while a delete is armed just cancels it
      return;
    }
    hapticLight();
    onChange(code);
  };

  const confirmDelete = async (code: string) => {
    setPendingDelete(null);
    await removeClass(code);
    // The vehicle keeps its stored string; if it was this code it simply reads as off-list now.
  };

  const commitAdd = async () => {
    const code = newCode.trim().toUpperCase();
    setNewCode('');
    setAdding(false);
    if (!code) return;
    await addClass(code);
    onChange(code); // select the freshly added class
  };

  const cancelAdd = () => {
    setNewCode('');
    setAdding(false);
  };

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading classes…</p>;
  }

  // A stored value that isn't in the curated list (an old freeform entry, or a class just deleted
  // from the list) — surface it as a selected chip so the current value is always visible.
  const valueOffList = value.trim() !== '' && !classes.some((c) => c.code === value);

  return (
    <div className="flex flex-wrap gap-2">
      {valueOffList && (
        <span className={`${CHIP_BASE} ${CHIP_ON} ring-1 ring-amber-400`} title="Not in your list — tap another to change it">
          {value}
          <span className="text-[10px] font-normal opacity-70">off-list</span>
        </span>
      )}

      {classes.map((c) => {
        const selected = c.code === value;
        if (pendingDelete === c.code) {
          return (
            <span key={c.code} className={`${CHIP_BASE} border-red-500 ring-1 ring-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300`}>
              <button type="button" className="cursor-pointer" onClick={() => setPendingDelete(null)} title="Cancel">
                {c.code}
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(c.code)}
                className="rounded-full bg-red-600 hover:bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] leading-none cursor-pointer"
                title={`Delete ${c.code} from the list`}
              >
                ✕
              </button>
            </span>
          );
        }
        return (
          <button
            key={c.code}
            type="button"
            className={`${CHIP_BASE} ${selected ? CHIP_ON : CHIP_OFF}`}
            onPointerDown={() => startPress(c.code)}
            onPointerUp={() => endPress(c.code)}
            onPointerLeave={clearTimer}
            onContextMenu={(e) => e.preventDefault()}
            title={c.label ?? undefined}
          >
            {c.code}
            {c.label && <span className={`text-[10px] font-normal ${selected ? 'opacity-70' : 'text-gray-400 dark:text-gray-500'}`}>{c.label}</span>}
          </button>
        );
      })}

      {adding ? (
        <span className={`${CHIP_BASE} ${CHIP_OFF} pr-1.5`}>
          <input
            autoFocus
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitAdd();
              if (e.key === 'Escape') cancelAdd();
            }}
            maxLength={5}
            placeholder="CODE"
            className="w-16 bg-transparent outline-none placeholder-gray-400 text-sm"
            aria-label="New model code"
          />
          <button type="button" onClick={() => void commitAdd()} className="text-emerald-600 hover:text-emerald-500 cursor-pointer" title="Add">✓</button>
          <button type="button" onClick={cancelAdd} className="text-gray-400 hover:text-gray-600 cursor-pointer" title="Cancel">✕</button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => { setPendingDelete(null); setAdding(true); }}
          className={`${CHIP_BASE} border-dashed border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-200`}
        >
          ＋ Other
        </button>
      )}
    </div>
  );
}
