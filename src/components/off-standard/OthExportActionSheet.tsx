import { useState, useEffect, createElement } from 'react';
import type { ReactElement } from 'react';
import type { User, ShiftWithUser } from '../../types';
import { supabase } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import {
  rowToOffStandard, deriveShiftLine, generateOffStandardReport,
  type TripRow,
} from '../../lib/offStandardReport';
import type { OffStandardEntry } from '../../types';

interface Props {
  date: string;
  dateLabel: string;
  user: User;
  shifts: ShiftWithUser[];
  onClose: () => void;
}

export function OthExportActionSheet({ date, dateLabel, user, shifts, onClose }: Props) {
  const [entries, setEntries]     = useState<OffStandardEntry[]>([]);
  const [trips, setTrips]         = useState<TripRow[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [copied, setCopied]       = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const dayStart = new Date(date + 'T00:00:00').toISOString();
    const dayEnd   = new Date(new Date(date + 'T00:00:00').setDate(new Date(date + 'T00:00:00').getDate() + 1)).toISOString();

    Promise.all([
      supabase.from('off_standard_entries')
        .select('id, start_time, stop_time, minutes, reason, explanation, auto_from_trip, preset_reason, edit_status, edited_end_time, edit_requested_at, edit_requested_by, edit_reviewed_by, edit_reviewed_at, edit_staff_note, is_backdated, backdate_approved_by, backdate_approved_at')
        .eq('user_id', user.id)
        .eq('date', date)
        .not('minutes', 'is', null)
        .or('is_backdated.is.null,is_backdated.eq.false,edit_status.eq.approved')
        .order('start_time', { ascending: true }),

      supabase.from('vsa_trips')
        .select('depart_time, arrive_time, is_shuttle, reason')
        .eq('driver_id', user.id)
        .gte('depart_time', dayStart)
        .lt('depart_time', dayEnd)
        .not('arrive_time', 'is', null)
        .order('depart_time', { ascending: true }),
    ]).then(([othRes, tripRes]) => {
      setEntries((othRes.data ?? []).map(r => rowToOffStandard(r as unknown as Record<string, unknown>)));
      setTrips((tripRes.data ?? []) as TripRow[]);
      setFetching(false);
    });
  }, [date, user.id]);

  const shiftLine = deriveShiftLine(shifts, user.id, date);
  const busy = fetching || pdfLoading;

  const handleExport = async () => {
    hapticMedium();
    const reportText = generateOffStandardReport(entries, trips, user, shiftLine, dateLabel);
    if (navigator.share) {
      try {
        await navigator.share({ title: `OTH Report — ${user.name} · ${dateLabel}`, text: reportText });
        return;
      } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePDFExport = async () => {
    hapticMedium();
    setPdfLoading(true);
    try {
      const [{ pdf }, { OffStandardReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./OffStandardReportPDF'),
      ]);
      const data = {
        userName:   user.name,
        employeeId: user.employeeId,
        dateLabel,
        shiftLine,
        entries: entries.map(e => ({
          startTime:    e.startTime,
          stopTime:     e.stopTime,
          minutes:      e.minutes,
          reason:       e.reason,
          explanation:  e.explanation,
          autoFromTrip: e.autoFromTrip,
        })),
      };
      const blob = await pdf(createElement(OffStandardReportPDF, { data }) as ReactElement<never>).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `oth-report-${user.name.replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`;
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
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Export OTH Report</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{dateLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none cursor-pointer">✕</button>
        </div>

        {fetching ? (
          <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-2">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-2 italic">No OTH entries for this date.</p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? '✓ Copied' : '📄 Plain Text'}
            </button>
            <button
              type="button"
              onClick={handlePDFExport}
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfLoading ? 'Building PDF…' : '📋 PDF'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
