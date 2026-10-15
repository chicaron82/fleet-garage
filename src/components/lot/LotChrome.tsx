// The pieces every tapping Lot Lookout page shares: the PIN gate, the "Tapping as" bar pinned to the bottom, and
// the toast above it. Split out of LotPage when Erin St's count page (LotBayPage) needed the same three.
import { useState } from 'react';

export function LotPinGate({ onUnlock, blurb }: { onUnlock: (pin: string) => Promise<string | null>; blurb: string }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    const problem = await onUnlock(pin.trim());
    setBusy(false);
    if (problem) setErr(problem);
  };
  return (
    <form onSubmit={submit} className="mt-16 mx-auto max-w-xs space-y-3 text-center">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Lot Lookout</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{blurb} Enter the PIN you were given. This phone remembers it.</p>
      <input id="lot-pin" inputMode="numeric" autoComplete="off" value={pin} onChange={e => { setPin(e.target.value); setErr(''); }}
        aria-label="PIN" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono text-gray-900 dark:text-gray-100" />
      {err && <p className="text-sm text-red-700 dark:text-red-400">{err}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 py-3 font-semibold text-black cursor-pointer">
        {busy ? 'Checking…' : 'Open the board'}
      </button>
    </form>
  );
}

export function LotTapperBar({ by, setBy, hint }: { by: string; setBy: (v: string) => void; hint: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-2.5"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-auto max-w-[460px] flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>{by ? hint : 'Put your initials on your taps →'}</span>
        <label htmlFor="lot-by" className="flex items-center gap-2">Tapping as
          <input id="lot-by" value={by} onChange={e => setBy(e.target.value)} maxLength={3} autoComplete="off" placeholder="—"
            className={`w-16 rounded-lg border px-2 py-1.5 font-mono font-bold uppercase text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 ${
              by ? 'border-gray-300 dark:border-gray-700' : 'border-fg-yellow'}`} />
        </label>
      </div>
    </div>
  );
}

export function LotToast({ msg }: { msg: string }) {
  return (
    <div role="status" aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-32px)] rounded-full bg-gray-900 dark:bg-gray-100 px-4 py-2 text-center text-sm font-semibold text-white dark:text-gray-900 transition-opacity ${msg ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
      {msg}
    </div>
  );
}
