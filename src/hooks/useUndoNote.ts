// A note with an optional Undo: 5 s when it can be undone, otherwise gone quickly. The Erin pill's sheet and the
// closing inventory's Erin line both show one.
import { useCallback, useEffect, useRef, useState } from 'react';

export type UndoNote = { msg: string; undo?: () => void } | null;

export function useUndoNote() {
  const [note, setNote] = useState<UndoNote>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((msg: string, undo?: () => void) => {
    setNote({ msg, undo });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), undo ? 5000 : 1800);
  }, []);
  const clear = useCallback(() => setNote(null), []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [note, show, clear] as const;
}
