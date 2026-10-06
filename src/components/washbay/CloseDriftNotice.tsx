// The saved close has fallen behind tonight's inventory — say so, and offer the fix.
//
// Aaron, 2026-10-05: saved the close at 22:23 (0 cleans, true then), wrote MCM571 up as a clean at 22:55, and the
// saved close kept saying 0. *"doesn't it read the inventory? because i logged one clean there"* The form seeds its
// counts while it is OPEN; nothing re-read them after Submit. The morning card and the forecast game read the SAVED
// close, so the clean he left them was invisible to both. `closeDrift` decides; this only shows it.
//
// ⭐ The button OPENS the close pre-filled from the inventory rather than saving silently: he sees the new numbers
// and presses Submit himself, the same way every close is filed.

interface Props {
  saved: { carsRemaining: number; cleanNotPickedUp: number };
  inventory: { dirties: number; cleans: number };
  onUpdate: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function CloseDriftNotice({ saved, inventory, onUpdate }: Props) {
  return (
    <div role="status" className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-2">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
        📋 The inventory changed after you logged the close
      </p>
      <p className="text-xs text-amber-700 dark:text-amber-400 tabular-nums">
        Close says {plural(saved.cleanNotPickedUp, 'clean', 'cleans')} · {plural(saved.carsRemaining, 'dirty', 'dirties')}.
        {' '}Inventory now shows {plural(inventory.cleans, 'clean', 'cleans')} · {plural(inventory.dirties, 'dirty', 'dirties')}.
      </p>
      <button
        type="button"
        onClick={onUpdate}
        className="w-full py-2 rounded-lg text-sm font-semibold bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900 transition cursor-pointer"
      >
        Update the close to match
      </button>
    </div>
  );
}
