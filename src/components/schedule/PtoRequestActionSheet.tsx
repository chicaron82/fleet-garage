import { useState, useEffect, createElement, type ReactElement } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { supabase } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import { useShareText } from '../../hooks/useShareText';
import { SHARE_TEXT_BUTTON } from '../shared/ShareAction';
import { toISO } from '../../context/ScheduleContext';
import { buildPtoRequest, ptoTaken, type StatInfo } from '../../lib/ptoRequest';
import { isStatDay, getStatName } from '../../lib/stats';
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
  const [pendingDays, setPendingDays]   = useState<string[]>([]);
  const [approvedDays, setApprovedDays] = useState<string[]>([]);
  const [altByDate, setAltByDate]       = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);
  const { copied, share } = useShareText();
  const [pdfLoading, setPdfLoading] = useState(false);

  // Upcoming PTO from today onward, split by approval. Pending days are the
  // actual ask; already-approved days are shown for the full picture so the
  // sheet reconciles with the balance (which counts every PTO day, approved
  // or not). Past days live only in the balance — a request is forward-looking.
  useEffect(() => {
    const today = toISO(new Date());
    const year  = today.slice(0, 4);
    supabase
      .from('shifts')
      // pto_approved landed in 067; stale database.types.ts doesn't know that column yet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('date, pto_approved, pto_alternate_date' as any)
      .eq('user_id', user.id)
      .eq('shift_type', 'pto')
      .gte('date', today)
      .lte('date', `${year}-12-31`)
      .order('date', { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as { date: string; pto_approved: boolean | null; pto_alternate_date: string | null }[];
        setPendingDays(rows.filter(r => !r.pto_approved).map(r => r.date));
        setApprovedDays(rows.filter(r => r.pto_approved).map(r => r.date));
        const alts: Record<string, string> = {};
        for (const r of rows) if (r.pto_alternate_date) alts[r.date] = r.pto_alternate_date;
        setAltByDate(alts);
        setFetching(false);
      });
  }, [user.id]);

  const taken = ptoTaken(used, pendingDays.length, approvedDays.length);
  const remaining = Math.max(0, entitlement - taken);
  const busy = fetching || pdfLoading;
  const dateLabel = new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });

  // Stat-day annotations (name + optional alternate) for every requested/approved day.
  const statInfo: StatInfo = {};
  for (const d of [...pendingDays, ...approvedDays]) {
    if (isStatDay(d)) statInfo[d] = { name: getStatName(d) ?? 'Stat holiday', alternate: altByDate[d] };
  }

  const handleShare = async () => {
    hapticMedium();
    await share({
      title: `PTO Request — ${user.name}`,
      text: buildPtoRequest(user.name, pendingDays, entitlement, used, approvedDays, statInfo),
    });
  };

  const handlePDF = async () => {
    hapticMedium();
    setPdfLoading(true);
    try {
      const [{ pdf }, { PtoRequestPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./PtoRequestPDF'),
      ]);
      const data = { userName: user.name, employeeId: user.employeeId, dateLabel, days: pendingDays, approvedDays, entitlement, used, statInfo };
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
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{taken} / {entitlement} used · {remaining} left</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none cursor-pointer">✕</button>
        </div>

        {fetching ? (
          <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-2">Loading…</p>
        ) : pendingDays.length === 0 && approvedDays.length === 0 ? (
          <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-2 italic">No upcoming PTO this year.</p>
        ) : (
          <>
            {pendingDays.length > 0 && (
              <DayList label={`Requesting approval (${pendingDays.length})`} days={pendingDays} accent="violet" />
            )}
            {approvedDays.length > 0 && (
              <DayList label={`Already approved (${approvedDays.length})`} days={approvedDays} accent="emerald" />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                disabled={busy}
                className={SHARE_TEXT_BUTTON}
              >
                {copied ? '✓ Copied' : '↗ Plain Text'}
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

const LIST_ACCENTS = {
  violet:  { heading: 'text-violet-500 dark:text-violet-400',   box: 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-900/40',   text: 'text-violet-800 dark:text-violet-300' },
  emerald: { heading: 'text-emerald-600 dark:text-emerald-400', box: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300' },
} as const;

function DayList({ label, days, accent }: { label: string; days: string[]; accent: keyof typeof LIST_ACCENTS }) {
  const c = LIST_ACCENTS[accent];
  return (
    <div className="space-y-1">
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${c.heading}`}>{label}</p>
      <div className={`max-h-40 overflow-y-auto space-y-1 rounded-lg border px-3 py-2 ${c.box}`}>
        {days.map(d => (
          <p key={d} className={`text-sm ${c.text}`}>• {fmtDay(d)}</p>
        ))}
      </div>
    </div>
  );
}
