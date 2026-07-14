// The "Log damage" drop-n-go entry point — a self-owned trigger + modal so its host (HoldsView)
// only adds one line and stays lean. Opens the two-photo intake (key tag + damage) that stages a
// damage hold for later approval. See LogDamageModal / docs/ticket-effie-damage-drop-intake.md.
import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { LogDamageModal } from './LogDamageModal';
import type { User } from '../../types';

export function LogDamageButton({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(true); }}
        className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition cursor-pointer"
      >
        📷 Log damage — snap key tag + damage
      </button>
      {open && <LogDamageModal user={user} onClose={() => setOpen(false)} />}
    </>
  );
}
