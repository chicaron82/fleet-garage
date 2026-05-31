import { useState, useEffect, createElement, type ReactElement } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { supabase } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import { toISO } from '../../context/ScheduleContext';
import { buildPtoRequest } from '../../lib/ptoRequest';
import type { User } from '../../types';

interface Props {
  user: User;
  entitlement: number;
  used: number;
  onClose: () => void;
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function PtoRequestActionSheet({ user, entitlement, used, onClose }: Props) {
  useEscapeKey(onClose);
  const [days, setDays]         = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Only days from today onward — a request is for time off that hasn't happened.
  useEffect(() => {
    const today = toISO(new Date());
    const year  = today.slice(0, 4);
    supabase
      .from('shifts')
      .select('date')
      .eq('user_id', user.id)
      .eq('shift_type', 'pto')
      .gte('date', today)
      .lte('date', `${year}-12-31`)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setDays((data ?? []).map(r => (r as { date: string }).date));
        setFetching(false);
      });
  }, [user.id]);

  const remaining = Math.max(0, entitlement - used);
  const busy = fetching || pdfLoading;
  const dateLabel = new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });

  const handleShare = async () => {
    hapticMedium();
    const text = buildPtoRequest(user.name, days, entitlement, used);
    if (navigator.share) {
      try { await navigator.share({ title: `PTO Request — ${user.name}`, text }); return; }
      catch { /* fall through to clipboard */ }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePDF = async () => {
    hapticMedium();
    setPdfLoading(true);
    try {
      const [{ pdf }, { PtoRequestPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./PtoRequestPDF'),
      ]);
      const data = { userName: user.name, employeeId: user.employeeId, dateLabel, days, entitlement, used };
      const blob = await pdf(createElement(PtoRequestPDF, { data }) as ReactElement<never>).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `pto-request-${user.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-4 motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">PTO Request</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{used} / {entitlement} used · {remaining} left</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none cursor-pointer">✕</button>
        </div>

        {fetching ? (
          <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-2">Loading…</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-2 italic">No upcoming PTO days entered.</p>
        ) : (
          <>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40 px-3 py-2">
              {days.map(d => (
                <p key={d} className="text-sm text-violet-800 dark:text-violet-300">• {fmtDay(d)}</p>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                disabled={busy}
                className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? '✓ Copied' : '📄 Plain Text'}
              </button>
              <button
                type="button"
                onClick={handlePDF}
                disabled={busy}
                className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pdfLoading ? 'Building PDF…' : '📋 PDF'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
