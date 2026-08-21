// The scan-router's one shared instance. Both entry points (the My Day card + the header icon)
// call scan(); the overlay is rendered once here, at app scope. A context (not props)
// because the two triggers live in different trees — the header is in AppShell, the card is deep
// in a screen — and prop-drilling an opener through both would be the god-shell it's meant to avoid.
// `navigate` is handed in from App (which owns routing) so an action tap routes like any button.
// The context object + useScanRouter hook live in ./scanRouter (react-refresh: components only here).
//
// ⭐ The file input lives HERE, not in the overlay, and that placement is load-bearing. A tap on the
// header icon used to open the overlay onto a "Snap the key tag" prompt — a second tap to reach the
// camera the first tap had already asked for. Firing the camera from the first tap requires the
// input to exist AT TAP TIME, and the overlay isn't mounted yet. Mounting it here makes the input
// permanent, so scan() can open the overlay and fire the camera in the SAME user gesture. Moving
// this input back inside the overlay silently restores the two-tap flow — or worse, an
// `input.click()` from a mount effect, which browsers block outright.
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScanRouterOverlay } from '../components/scan-router/ScanRouterOverlay';
import { ScanRouterContext } from './scanRouter';
import type { Screen } from '../types';

export function ScanRouterProvider({ navigate, children }: { navigate: (screen: Screen) => void; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // The picked photo rides a ref + a nonce rather than state: a File in state would re-run the
  // overlay's consume-effect on every identity change, and re-reading one tag costs a real API
  // call and a duplicate sighting row.
  const pickedFileRef = useRef<File | null>(null);
  const [pickedNonce, setPickedNonce] = useState(0);

  const scan = useCallback(() => {
    setIsOpen(true);
    // Synchronous, inside the caller's gesture. React hasn't re-rendered yet — which is fine,
    // because this input is mounted whether the overlay is or not. That's the point.
    fileRef.current?.click();
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    pickedFileRef.current = null;
  }, []);

  const value = useMemo(() => ({ scan, pickedFileRef, pickedNonce }), [scan, pickedNonce]);

  return (
    <ScanRouterContext.Provider value={value}>
      {children}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="scan-router-file"
        onChange={(e) => {
          pickedFileRef.current = e.target.files?.[0] ?? null;
          setPickedNonce(n => n + 1);
          e.target.value = '';
        }}
      />
      {isOpen && <ScanRouterOverlay navigate={navigate} onClose={close} />}
    </ScanRouterContext.Provider>
  );
}
