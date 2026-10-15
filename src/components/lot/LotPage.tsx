// The public /lot page: what a driver at the airport opens. No FG login — a shared PIN, asked once per phone,
// then initials, asked once per phone (a label on each tap, not security). Served at FG's /lot ahead of the auth
// gate, the way nanays serves /request (Aaron, 2026-10-14: *"can't it be a link through FG just like nanays'
// public order form?"*). The only writer behind it is api/lot.ts.
import { useCallback, useMemo, useRef, useState } from 'react';
import { lotTotals } from '../../lib/lotLookout';
import { useLotBoard } from '../../hooks/useLotBoard';
import { useLotTaps } from '../../hooks/useLotTaps';
import { LotSummary } from './LotSummary';
import { LotMap } from './LotMap';

function PinGate({ onUnlock }: { onUnlock: (pin: string) => Promise<string | null> }) {
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
      <p className="text-sm text-gray-500 dark:text-gray-400">The airport stall board. Enter the PIN you were given. This phone remembers it.</p>
      <input id="lot-pin" inputMode="numeric" autoComplete="off" value={pin} onChange={e => { setPin(e.target.value); setErr(''); }}
        aria-label="PIN" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono text-gray-900 dark:text-gray-100" />
      {err && <p className="text-sm text-red-700 dark:text-red-400">{err}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 py-3 font-semibold text-black cursor-pointer">
        {busy ? 'Checking…' : 'Open the board'}
      </button>
    </form>
  );
}

export function LotPage() {
  const board = useLotBoard();
  const [toastMsg, setToastMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(''), 1800);
  }, []);
  const taps = useLotTaps(board, toast);
  const totals = useMemo(() => lotTotals(board.stalls, board.aisle, board.nowMs), [board.stalls, board.aisle, board.nowMs]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pb-24">
        {!taps.pin ? <PinGate onUnlock={taps.unlock} /> : (
          <>
            {/* Not sticky: pinned, the counts and legend took half a phone and left the map a slot. */}
            <header className="pt-3 pb-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-extrabold">Lot Lookout</h1>
                <span className="text-xs text-gray-500 dark:text-gray-400">Airport · 1965 Wellington</span>
              </div>
              <LotSummary totals={totals} aisleCars={board.aisle.cars} />
            </header>
            {board.error && <p className="my-2 text-sm text-red-700 dark:text-red-400">{board.error}</p>}
            {!board.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the lot…</p> : (
              <LotMap stalls={board.stalls} aisle={board.aisle} nowMs={board.nowMs} nPulse={totals.nPulse}
                onTap={(stall, state) => void taps.tapStall(stall, state)} onAisle={d => void taps.tapAisle(d)} />
            )}
            <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Tap a colour on a stall: white open, green clean, red dirty. Tap the same colour again within 5 seconds to
              undo. Tapping the colour a stall already shows tells everyone you looked and it is still true. Every tap
              shows on every phone.
            </p>
          </>
        )}
      </div>

      {taps.pin && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-2.5"
          style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto max-w-[460px] flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{taps.by ? 'Tap a colour on any stall' : 'Put your initials on your taps →'}</span>
            <label htmlFor="lot-by" className="flex items-center gap-2">Tapping as
              <input id="lot-by" value={taps.by} onChange={e => taps.setBy(e.target.value)} maxLength={3} autoComplete="off" placeholder="—"
                className={`w-16 rounded-lg border px-2 py-1.5 font-mono font-bold uppercase text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 ${
                  taps.by ? 'border-gray-300 dark:border-gray-700' : 'border-fg-yellow'}`} />
            </label>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite"
        className={`fixed left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-32px)] rounded-full bg-gray-900 dark:bg-gray-100 px-4 py-2 text-center text-sm font-semibold text-white dark:text-gray-900 transition-opacity ${toastMsg ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
        {toastMsg}
      </div>
    </div>
  );
}
