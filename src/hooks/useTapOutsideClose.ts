// Tap the dimmed area around a sheet to close it. Spread the returned handlers on the BACKDROP element (the one that
// fills the screen behind the sheet).
//
// ⭐ Aaron, 2026-10-16, on Find a car and Scan a tag: *"can we have it so that tapping outside those two closes them
// out"*. Two guards, because a sheet that closes by itself costs more than a ✕:
//   • Only a press that STARTS and ENDS on the backdrop counts. A scroll or a drag that begins inside the sheet and
//     lets go outside it fires its click on the backdrop too, and must never close it.
//   • `enabled` false (e.g. a key tag being read) ignores the tap: the ✕ still works, a stray thumb does not.
import { useCallback, useRef } from 'react';

export function useTapOutsideClose(onClose: () => void, enabled = true) {
  const downOnBackdrop = useRef(false);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    downOnBackdrop.current = e.target === e.currentTarget;
  }, []);
  const onClick = useCallback((e: React.MouseEvent) => {
    const fromBackdrop = downOnBackdrop.current && e.target === e.currentTarget;
    downOnBackdrop.current = false;
    if (fromBackdrop && enabled) onClose();
  }, [onClose, enabled]);
  return { onPointerDown, onClick };
}
