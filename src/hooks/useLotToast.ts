// A short-lived message for the Lot Lookout pages: each new one replaces the last, gone after 1.8 s.
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLotToast(): [string, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 1800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [msg, toast];
}
