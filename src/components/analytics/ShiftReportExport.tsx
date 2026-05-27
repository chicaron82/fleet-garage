import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import {
  buildReport,
  formatDateStr,
  deriveShiftLine,
  type ReportData,
  type ReportThroughput,
} from '../../lib/buildShiftReport';
import type { ShiftType } from '../../types';

// ── Component ─────────────────────────────────────────────────────────────────

export function ShiftReportExport({ date }: { date: string }) {
  const { user } = useAuth();
  const { shifts } = useSchedule();
  const [loading,    setLoading]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied,     setCopied]     = useState(false);

  if (!user) return null;

  const busy = loading || pdfLoading;

  const fetchReportData = async (): Promise<ReportData> => {
    const dayStart    = new Date(date + 'T00:00:00');
    const dayEnd      = new Date(date + 'T00:00:00');
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayStartISO = dayStart.toISOString();
    const dayEndISO   = dayEnd.toISOString();

    // 90-day lookback for fleet balance projection
    const fbLookback = new Date(date + 'T00:00:00');
    fbLookback.setDate(fbLookback.getDate() - 90);
    const fbLookbackDate = fbLookback.toISOString().slice(0, 10);

    const [
      othRes, tripRes, holdRes, ciRes, lfRes, auditRes, issueRes,
      fbRes, handoffRes, washbayRes, checkpointRes,
    ] = await Promise.all([
      supabase.from('off_standard_entries')
        .select('start_time, stop_time, minutes, reason, explanation, auto_from_trip')
        .eq('user_id', user.id).eq('status', 'complete')
        .gte('start_time', dayStartISO).lt('start_time', dayEndISO)
        .order('start_time', { ascending: true }),

      supabase.from('vsa_trips')
        .select('depart_time, arrive_time, is_shuttle, reason, is_vsa_interruption, queue_at_departure')
        .eq('driver_id', user.id)
        .gte('depart_time', dayStartISO).lt('depart_time', dayEndISO)
        .not('arrive_time', 'is', null)
        .order('depart_time', { ascending: true }),

      supabase.from('holds')
        .select('flagged_at, hold_types, damage_description, vehicles(unit_number, license_plate)')
        .eq('flagged_by_id', user.id)
        .gte('flagged_at', dayStartISO).lt('flagged_at', dayEndISO)
        .order('flagged_at', { ascending: true }),

      supabase.from('vehicle_checkins')
        .select('checked_in_at, vehicle_unit, vehicle_plate')
        .eq('checked_in_by_id', user.id)
        .gte('checked_in_at', dayStartISO).lt('checked_in_at', dayEndISO)
        .order('checked_in_at', { ascending: true }),

      supabase.from('lost_found')
        .select('found_at, description, location, unit_number')
        .eq('found_by', user.id)
        .gte('found_at', dayStartISO).lt('found_at', dayEndISO)
        .order('found_at', { ascending: true }),

      supabase.from('audits')
        .select('created_at, vehicle_number, status')
        .eq('auditor_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: true }),

      supabase.from('facility_issues')
        .select('reported_at, title, severity')
        .eq('reported_by', user.id)
        .gte('reported_at', dayStartISO).lt('reported_at', dayEndISO)
        .order('reported_at', { ascending: true }),

      // Fleet balance — 90 days for projection fallback
      supabase.from('fleet_balance')
        .select('out_count, in_count, date')
        .gte('date', fbLookbackDate)
        .lte('date', date)
        .order('date', { ascending: false }),

      // Handoff note for the day
      supabase.from('handoff_notes')
        .select('full_pages, last_page_entries, lot_status')
        .gte('logged_at', dayStartISO)
        .lt('logged_at', dayEndISO)
        .order('logged_at', { ascending: false })
        .limit(1),

      // Washbay log for the day
      supabase.from('washbay_logs')
        .select('full_pages, last_page_entries, overtime_hours')
        .eq('date', date)
        .limit(1),

      // Closing arrival checkpoint
      supabase.from('shift_checkpoints')
        .select('full_pages, last_page_entries')
        .eq('date', date)
        .eq('checkpoint_type', 'closing_arrival')
        .limit(1),
    ]);

    // Shift type
    const shiftType: ShiftType | null = (() => {
      const dayShifts = shifts.filter(s => s.userId === user.id && s.date === date);
      if (!dayShifts.length) return null;
      const withTimes = dayShifts.find(s => s.startTime && s.endTime);
      return (withTimes ?? dayShifts[0])?.shiftType ?? null;
    })();

    // Fleet balance — actual or same-day-of-week projection
    const fbRows = (fbRes.data ?? []) as { date: string; out_count: number; in_count: number }[];
    const todayFb = fbRows.find(r => r.date === date);
    let fleetBalance: ReportData['fleetBalance'] = null;
    if (todayFb) {
      fleetBalance = { outCount: todayFb.out_count, inCount: todayFb.in_count, isProjected: false };
    } else if (fbRows.length >= 2) {
      const dow = new Date(date + 'T00:00:00').getDay();
      const sameDow = fbRows.filter(r => new Date(r.date + 'T00:00:00').getDay() === dow);
      if (sameDow.length >= 2) {
        fleetBalance = {
          outCount:    Math.round(sameDow.reduce((s, r) => s + r.out_count, 0) / sameDow.length),
          inCount:     Math.round(sameDow.reduce((s, r) => s + r.in_count,  0) / sameDow.length),
          isProjected: true,
        };
      }
    }

    // Throughput
    const handoffRow    = (handoffRes.data ?? [])[0] as { full_pages: number; last_page_entries: number; lot_status: string } | undefined;
    const washbayRow    = (washbayRes.data ?? [])[0] as { full_pages: number; last_page_entries: number; overtime_hours: number } | undefined;
    const checkpointRow = (checkpointRes.data ?? [])[0] as { full_pages: number; last_page_entries: number } | undefined;

    let throughput: ReportThroughput | null = null;
    if (handoffRow || washbayRow) {
      const openingCleaned  = handoffRow    ? handoffRow.full_pages * 19 + handoffRow.last_page_entries : null;
      const fullDayCleaned  = washbayRow    ? washbayRow.full_pages * 19 + washbayRow.last_page_entries : null;
      const checkpointCount = checkpointRow ? checkpointRow.full_pages * 19 + checkpointRow.last_page_entries : null;
      const closingStart    = checkpointCount ?? openingCleaned;
      const closingCleaned  = closingStart != null && fullDayCleaned != null
        ? Math.max(0, fullDayCleaned - closingStart)
        : null;
      throughput = {
        shiftType,
        openingCleaned,
        closingCleaned,
        fullDayCleaned,
        branchOpHours: 15 + (washbayRow?.overtime_hours ?? 0),
        lotStatus:     handoffRow?.lot_status ?? null,
      };
    }

    return {
      shiftLine:  deriveShiftLine(shifts, user.id, date),
      dateLabel:  formatDateStr(date),
      userName:   user.name,
      employeeId: user.employeeId,
      shiftType,
      offStandard: (othRes.data ?? []).map((r: Record<string, unknown>) => ({
        startTime:    r.start_time as string,
        stopTime:     r.stop_time as string,
        minutes:      r.minutes as number,
        reason:       r.reason as string,
        explanation:  r.explanation as string | null,
        autoFromTrip: r.auto_from_trip as boolean,
      })),
      trips: (tripRes.data ?? []).map((r: Record<string, unknown>) => ({
        departTime:       r.depart_time as string,
        arriveTime:       r.arrive_time as string,
        isShuffle:        r.is_shuttle as boolean | null,
        reason:           r.reason as string | null,
        isVsaInterruption: r.is_vsa_interruption as boolean | null,
        queueAtDeparture: r.queue_at_departure as string | null,
      })),
      holds: (holdRes.data ?? []).map((r: Record<string, unknown>) => {
        const v = r.vehicles as { unit_number: string; license_plate: string } | null;
        return {
          flaggedAt:    r.flagged_at as string,
          holdTypes:    (r.hold_types as string[] | null) ?? [],
          vehicleUnit:  v?.unit_number ?? '—',
          vehiclePlate: v?.license_plate ?? '—',
          description:  (r.damage_description as string | null) ?? '',
        };
      }),
      checkIns: (ciRes.data ?? []).map((r: Record<string, unknown>) => ({
        checkedInAt:  r.checked_in_at as string,
        vehicleUnit:  r.vehicle_unit as string,
        vehiclePlate: r.vehicle_plate as string,
      })),
      lostFound: (lfRes.data ?? []).map((r: Record<string, unknown>) => ({
        foundAt:     r.found_at as string,
        description: r.description as string,
        location:    r.location as string,
        unitNumber:  r.unit_number as string | null,
      })),
      audits: (auditRes.data ?? []).map((r: Record<string, unknown>) => ({
        createdAt:     r.created_at as string,
        vehicleNumber: r.vehicle_number as string,
        status:        r.status as string,
      })),
      issues: (issueRes.data ?? []).map((r: Record<string, unknown>) => ({
        reportedAt: r.reported_at as string,
        title:      r.title as string,
        severity:   r.severity as string,
      })),
      fleetBalance,
      throughput,
    };
  };

  const handleExport = async () => {
    hapticMedium();
    setLoading(true);
    try {
      const data = await fetchReportData();
      const reportText = buildReport(data);
      if (navigator.share) {
        try {
          await navigator.share({ title: `Shift Report — ${user.name} · ${formatDateStr(date)}`, text: reportText });
          return;
        } catch { /* fall through to clipboard */ }
      }
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handlePDFExport = async () => {
    hapticMedium();
    setPdfLoading(true);
    try {
      const data = await fetchReportData();
      const [{ pdf }, { ShiftReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ShiftReportPDF'),
      ]);
      const blob = await pdf(<ShiftReportPDF data={data} />).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `shift-report-${user.name.replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating…' : copied ? '✓ Copied' : 'Export as Text'}
      </button>
      <button
        type="button"
        onClick={handlePDFExport}
        disabled={busy}
        className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pdfLoading ? 'Building PDF…' : 'Download PDF ↓'}
      </button>
    </div>
  );
}
