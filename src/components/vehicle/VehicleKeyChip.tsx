import { useState } from 'react';
import { keyOptionsFor } from '../../lib/keyCount';
import { hapticLight } from '../../lib/haptics';

// The key-count chip on the vehicle facts strip: a tap opens the 1-2-3-4 picker, a pick writes.
//
// ⭐ Extracted from VehicleRecordFacts 2026-09-19, when guarding the write took that file to 335
// against the hard 330 cap. The cap did its job again: the picker's open/closed state was never
// the strip's business, and `onPick` resolving TRUE-on-saved is exactly the seam that fixes the
// bug — the editor closes on a write that landed, not on a tap that happened.
// See docs/September/ticket-writes-that-vanish-into-void.md.
export function VehicleKeyChip({ isTesla, keyCount, onPick }: {
  isTesla?: boolean | null;
  keyCount?: number | null;
  /** Writes the count; resolves whether it actually landed. A false keeps the picker OPEN. */
  onPick: (n: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);

  const pick = async (n: number) => {
    hapticLight();
    if (await onPick(n)) setEditing(false);
  };

  return (
    <>
    {editing ? (
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">{isTesla ? '⚡' : '🔑'}</span>
        {keyOptionsFor(isTesla === true).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => void pick(n)}
            className={`w-7 h-7 rounded-lg text-xs font-semibold border transition cursor-pointer ${keyCount === n ? 'bg-fg-yellow border-fg-yellow text-black' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
          >
            {n}
          </button>
        ))}
        <button type="button" onClick={() => setEditing(false)} className="ml-0.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => { hapticLight(); setEditing(true); }}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
      >
        {/* ⭐ Emoji + value, nothing else (Aaron, 2026-09-12): *"how bout having the key emoji
            plus key count"*. The noun was doing no work — the emoji already says "keys" — and the
            ✏️ was a hint, which the row does not need when every chip on it is tappable. */}
        {isTesla ? '⚡' : '🔑'} {keyCount ?? '—'}
      </button>
    )}
    </>
  );
}
