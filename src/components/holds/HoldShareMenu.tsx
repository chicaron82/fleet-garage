import { useState } from 'react';
import { buildHoldReport, exportHoldToHtml } from '../../lib/hold-export';
import { renderHoldReportPng, shareReportFile } from '../../lib/holdReportImage';
import type { Hold, Vehicle } from '../../types';

interface Props {
  vehicle: Vehicle;
  holds: Hold[];
  getName: (id: string, snapshot?: string) => string;
  getEmpId: (id: string, snapshot?: string) => string;
}

const TRIGGER = 'px-3 py-2 border border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium text-sm rounded-lg transition cursor-pointer';
const OPTION  = 'w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer';

/**
 * Share a vehicle's hold record, with a choice of scope. One record → shares straight away (latest
 * and full are the same). Multiple → a small menu: the latest flag or the full history.
 *
 * ⭐ It shares an IMAGE of the report through the phone's share sheet (lib/holdReportImage). It used
 * to open an about:blank tab, and sharing that sent an empty email (Aaron, 2026-09-28).
 * ⚠️ A failure SAYS so and offers the printable page — never a silent nothing.
 */
export function HoldShareMenu({ vehicle, holds, getName, getEmpId }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // A drawn image waiting on one more tap: the browser wants a FRESH tap to open the share sheet,
  // and drawing the photos can outlast the first one.
  const [pending, setPending] = useState<{ file: File; title: string } | null>(null);
  const [failed, setFailed] = useState<Hold[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (holds.length === 0) return null;

  // Latest flag = the single most-recently flagged record (the one on top).
  const latest = holds.reduce((a, b) =>
    new Date(b.flaggedAt).getTime() > new Date(a.flaggedAt).getTime() ? b : a
  );

  const offer = async (file: File, title: string) => {
    const outcome = await shareReportFile(file, title);
    setPending(outcome === 'needs-tap' ? { file, title } : null);
    setNote(outcome === 'downloaded' ? 'Saved the report image to your downloads' : null);
  };

  const share = async (subset: Hold[]) => {
    setOpen(false);
    setBusy(true);
    setFailed(null);
    setNote(null);
    try {
      const report = buildHoldReport({ vehicle, holds: subset, getName, getEmpId });
      const file = await renderHoldReportPng(report);
      await offer(file, report.title);
    } catch {
      setFailed(subset);
    } finally {
      setBusy(false);
    }
  };

  const sendPending = async () => {
    if (!pending) return;
    try { await offer(pending.file, pending.title); } catch { setPending(null); setFailed(holds); }
  };

  const openPrintable = () => {
    if (failed) exportHoldToHtml({ vehicle, holds: failed, getName, getEmpId });
    setFailed(null);
  };

  const handleTrigger = () => (holds.length === 1 ? share(holds) : setOpen(o => !o));

  return (
    <div className="relative ml-auto">
      {pending ? (
        <button onClick={sendPending} className={TRIGGER}>↗ Send report</button>
      ) : (
        <button onClick={handleTrigger} disabled={busy} className={`${TRIGGER} disabled:opacity-60`}>
          {busy ? 'Preparing…' : '↗ Share'}
        </button>
      )}
      {failed && (
        <div role="alert" className="absolute right-0 mt-1 z-50 w-60 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 shadow-lg p-3 text-xs text-red-700 dark:text-red-400">
          Couldn't make the report image.{' '}
          <button onClick={openPrintable} className="underline font-medium cursor-pointer">Open the printable page</button>
        </div>
      )}
      {note && <p className="absolute right-0 mt-1 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{note}</p>}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 w-52 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
            <button onClick={() => share([latest])} className={OPTION}>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Latest flag</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500">Just the most recent record</span>
            </button>
            <button onClick={() => share(holds)} className={`${OPTION} border-t border-gray-100 dark:border-gray-800`}>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Full history</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500">All {holds.length} records</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
