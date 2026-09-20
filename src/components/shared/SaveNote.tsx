// A write that didn't land, said in one line where it was attempted.
//
// ⭐ The sibling of `PhotoError` (which speaks for the photo pipeline) — same voice, same place on
// the screen, so "that didn't save" reads identically whether it was a photo, a key count or an
// odometer. Fed by `useWriteGuard`; see docs/September/ticket-writes-that-vanish-into-void.md.
export function SaveNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="status" className="text-xs text-amber-700 dark:text-amber-400 mt-1">
      ⚠️ {message}
    </p>
  );
}
