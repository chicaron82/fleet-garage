import { useState, createElement, type ReactElement } from 'react';
import { hapticMedium } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import {
  deriveShiftLine,
  generateOffStandardReport,
  todayDateStr,
} from '../lib/offStandardReport';
import type { TripRow } from '../lib/offStandardReport';
import { localDateStr } from './useFleetBalance';
import { shiftDayStartISO } from '../lib/shiftDay';
import type { OffStandardEntry, User, ShiftWithUser } from '../types';

interface UseOffStandardExportProps {
  user: User;
  shifts: ShiftWithUser[];
  entries: OffStandardEntry[];
}

/**
 * Report generation for the day's entries: share/clipboard text export and a
 * lazily-loaded PDF download. Read-only over `entries` — owns only its own
 * transient UI flags (`copied`, `pdfLoading`).
 */
export function useOffStandardExport({ user, shifts, entries }: UseOffStandardExportProps) {
  const [copied, setCopied]         = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleExport = async () => {
    hapticMedium();
    const { data: tripRows } = await supabase
      .from('vsa_trips')
      .select('depart_time, arrive_time, is_shuttle, reason')
      .eq('driver_id', user.id)
      .gte('depart_time', shiftDayStartISO(localDateStr(0)))
      .not('arrive_time', 'is', null)
      .order('depart_time', { ascending: true });
    const shiftLine  = deriveShiftLine(shifts, user.id);
    const reportText = generateOffStandardReport(
      entries,
      (tripRows ?? []) as TripRow[],
      user,
      shiftLine,
    );
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Off-Standard Report — ${user.name} · ${todayDateStr()}`,
          text: reportText,
        });
        return;
      } catch {
        // fall through to clipboard
      }
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
        import('../components/off-standard/OffStandardReportPDF'),
      ]);

      const data = {
        userName:   user.name,
        employeeId: user.employeeId,
        dateLabel:  todayDateStr(),
        shiftLine:  deriveShiftLine(shifts, user.id),
        entries:    entries.map(e => ({
          startTime:    e.startTime,
          stopTime:     e.stopTime,
          minutes:      e.minutes,
          reason:       e.reason,
          explanation:  e.explanation,
          autoFromTrip: e.autoFromTrip,
        })),
      };

      // pdf() expects ReactElement<DocumentProps>; cast needed since createElement infers the component's own props
      const blob = await pdf(createElement(OffStandardReportPDF, { data }) as ReactElement<never>).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `oth-report-${user.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  return {
    copied,
    pdfLoading,
    handleExport,
    handlePDFExport,
  };
}
