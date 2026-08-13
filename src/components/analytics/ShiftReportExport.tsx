import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import { useShareText } from '../../hooks/useShareText';
import { ShareTextButton } from '../shared/ShareTextButton';
import { shiftDayWindow, businessDateOf } from '../../lib/shiftDay';
import { useAirportFlip } from '../../hooks/useAirportFlip';
import { fmtTime24 } from '../../lib/shiftTypeMeta';
import {
  buildShiftPartition,
  deriveUserShift,
  resolveShiftRates,
} from '../../lib/shift-metrics';
import {
  buildReport,
  formatDateStr,
  deriveShiftLine,
  type ReportData,
  type ReportThroughput,
} from '../../lib/buildShiftReport';
import { buildFuelReport } from '../../lib/fuelReadings';
import type { ShiftType } from '../../types';

// ── Component ─────────────────────────────────────────────────────────────────

export function ShiftReportExport({ date }: { date: string }) {
  const { user } = useAuth();
  const { shifts } = useSchedule();
  // Live flip count for the "rate excludes N airport flips" note — only attributed
  // when this report is for the current shift day (the session self-scopes to it;
  // a past-date report must not borrow today's flips). 0 → the durable flag carries.
  const flipRows = useAirportFlip().rows.length;
  const airportFlipCount = date === businessDateOf(new Date()) ? flipRows : 0;
  const [loading,    setLoading]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { copied, share }           = useShareText();

  if (!user) return null;

  const busy = loading || pdfLoading;

  const fetchReportData = async (): Promise<ReportData> => {
    const { startISO: dayStartISO, endISO: dayEndISO } = shiftDayWindow(date);

    // 90-day lookback for fleet balance projection
    const fbLookback = new Date(date + 'T00:00:00');
    fbLookback.setDate(fbLookback.getDate() - 90);
    const fbLookbackDate = fbLookback.toISOString().slice(0, 10);

    const [
      othRes, tripRes, holdRes, ciRes, lfRes, auditRes, issueRes,
      fbRes, handoffRes, washbayRes, checkpointRes, midArrivalRes, midDepartureRes,
      fuelRes,
    ] = await Promise.all([
      supabase.from('off_standard_entries')
        .select('start_time, stop_time, minutes, reason, explanation, auto_from_trip, preset_reason')
        .eq('user_id', user.id).eq('status', 'complete')
        // Match the live ShiftRatesCard: exclude backdated entries that aren't yet
        // approved, so the report's OTH total and personal rate agree with the card.
        .or('is_backdated.is.null,is_backdated.eq.false,edit_status.eq.approved')
        .gte('start_time', dayStartISO).lt('start_time', dayEndISO)
        .order('start_time', { ascending: true }),

      supabase.from('vsa_trips')
        .select('depart_time, arrive_time, is_shuttle, reason, is_vsa_interruption, queue_at_departure')
        .eq('driver_id', user.id)
        .gte('depart_time', dayStartISO).lt('depart_time', dayEndISO)
        .not('arrive_time', 'is', null)
        .order('depart_time', { ascending: true }),

      supabase.from('holds')
        .select('flagged_at, hold_types, damage_description, photos, vehicles(unit_number, license_plate)')
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
        .select('full_pages, last_page_entries, lot_status, logged_at, morning_hours, airport_flipping')
        .gte('logged_at', dayStartISO)
        .lt('logged_at', dayEndISO)
        .order('logged_at', { ascending: false })
        .limit(1),

      // Washbay log for the day
      supabase.from('washbay_logs')
        .select('full_pages, last_page_entries, cars_remaining, overtime_hours, lot_status, carry_over, airport_flipping')
        .eq('date', date)
        .limit(1),

      // Closing arrival checkpoint
      supabase.from('shift_checkpoints')
        .select('full_pages, last_page_entries')
        .eq('date', date)
        .eq('checkpoint_type', 'closing_arrival')
        .limit(1),

      // Mid shift checkpoints
      supabase.from('shift_checkpoints')
        .select('full_pages, last_page_entries, logged_at')
        .eq('date', date)
        .eq('checkpoint_type', 'mid_arrival')
        .limit(1),

      supabase.from('shift_checkpoints')
        .select('full_pages, last_page_entries, logged_at')
        .eq('date', date)
        .eq('checkpoint_type', 'mid_departure')
        .limit(1),

      supabase.from('fuel_pump_readings')
        .select('pump1_open, pump1_close, pump2_open, pump2_close, digital_open, digital_close, topup_note')
        .eq('branch_id', user.branchId)
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Shift type + actual hours worked (drives the window when logged)
    const myShift = deriveUserShift(shifts, user.id, date);
    const shiftType: ShiftType | null = myShift?.shiftType ?? null;

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
    type WashbayRow    = { full_pages: number; last_page_entries: number; cars_remaining: number; overtime_hours: number; lot_status: string; carry_over: number; airport_flipping: boolean };
    type CheckpointRow = { full_pages: number; last_page_entries: number; logged_at?: string };
    const handoffRow    = (handoffRes.data    ?? [])[0] as { full_pages: number; last_page_entries: number; lot_status: string; logged_at: string; morning_hours: number | null; airport_flipping: boolean } | undefined;
    const washbayRow    = (washbayRes.data    ?? [])[0] as WashbayRow    | undefined;
    const checkpointRow = (checkpointRes.data ?? [])[0] as CheckpointRow | undefined;
    const midArrRow     = (midArrivalRes.data ?? [])[0] as CheckpointRow | undefined;
    const midDepRow     = (midDepartureRes.data ?? [])[0] as CheckpointRow | undefined;

    let throughput: ReportThroughput | null = null;
    if (handoffRow || washbayRow || midArrRow) {
      const openingCleaned  = handoffRow  ? handoffRow.full_pages * 19 + handoffRow.last_page_entries : null;
      const carsIn          = washbayRow  ? washbayRow.full_pages * 19 + washbayRow.last_page_entries : null;
      const fullDayCleaned  = carsIn != null && washbayRow ? Math.max(0, carsIn - washbayRow.cars_remaining) : null;
      const checkpointCount = checkpointRow ? checkpointRow.full_pages * 19 + checkpointRow.last_page_entries : null;
      const closingStart    = checkpointCount ?? openingCleaned;
      const closingCleaned  = closingStart != null && fullDayCleaned != null
        ? Math.max(0, fullDayCleaned - closingStart)
        : null;

      const midArrCount = midArrRow ? midArrRow.full_pages * 19 + midArrRow.last_page_entries : null;
      const midDepCount = midDepRow ? midDepRow.full_pages * 19 + midDepRow.last_page_entries : null;
      const midCleaned  = midArrCount != null && midDepCount != null ? Math.max(0, midDepCount - midArrCount) : null;
      const midShiftHours = midArrRow?.logged_at && midDepRow?.logged_at
        ? Math.max(0.1, (new Date(midDepRow.logged_at).getTime() - new Date(midArrRow.logged_at).getTime()) / 3_600_000)
        : null;

      // Closing reports show the objective queue count (queueAtClose) instead of a
      // Zeroed/Manageable/Backlog judgment; only opening/handoff keep the label.
      const lotStatus = shiftType === 'closing' ? null : (handoffRow?.lot_status ?? null);
      const queueAtClose = shiftType === 'closing' ? (washbayRow?.cars_remaining ?? null) : null;

      // Personal rate — same path as the live ShiftRatesCard so the PDF/text
      // report and the in-app card never disagree. Off-standard is scoped to the
      // shift window inside buildShiftPartition; do not subtract the full-day total.
      const offEntries = (othRes.data ?? []).map((r: Record<string, unknown>) => ({
        startTime:    r.start_time as string,
        minutes:      r.minutes as number,
        presetReason: r.preset_reason as string | null,
      }));
      const partition = buildShiftPartition({
        handoff: handoffRow
          ? { fullPages: handoffRow.full_pages, lastPageEntries: handoffRow.last_page_entries, loggedAt: handoffRow.logged_at, morningHours: handoffRow.morning_hours ?? undefined }
          : null,
        checkpoint: checkpointRow
          ? { fullPages: checkpointRow.full_pages, lastPageEntries: checkpointRow.last_page_entries }
          : null,
        fullDayCleaned,
        offStandardEntries: offEntries,
        midArrival:   midArrRow ? { fullPages: midArrRow.full_pages, lastPageEntries: midArrRow.last_page_entries, loggedAt: midArrRow.logged_at } : null,
        midDeparture: midDepRow ? { fullPages: midDepRow.full_pages, lastPageEntries: midDepRow.last_page_entries, loggedAt: midDepRow.logged_at } : null,
      });
      // Same shared seam as the live card — window from actual→planned→default.
      const { baseline, yourEffort } = resolveShiftRates({
        partition, shift: myShift, date, offStandardEntries: offEntries,
      });

      // When actual hours are logged, show the real clock window on the report
      // instead of the standard per-type range (or the unreliable checkpoint span).
      const actualWindowLabel = myShift?.actualStartTime && myShift?.actualEndTime
        ? `${fmtTime24(myShift.actualStartTime)}–${fmtTime24(myShift.actualEndTime)}`
        : null;

      throughput = {
        shiftType,
        openingCleaned,
        closingCleaned,
        midCleaned,
        midShiftHours,
        fullDayCleaned,
        branchOpHours: 15 + (washbayRow?.overtime_hours ?? 0),
        lotStatus,
        queueAtClose,
        baseline,
        yourEffort,
        actualWindowLabel,
        carryOver: washbayRow?.carry_over ?? 0,
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
        presetReason: r.preset_reason as string | null,
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
          photos:       (r.photos as string[] | null) ?? undefined,
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
      // True if flipping shows up through ANY channel that day: a VSA's own OTH log,
      // the morning handoff attestation, or the closing log attestation — so a
      // turnaround run by someone who doesn't use FG still explains the light count.
      airportFlipping: (othRes.data ?? []).some((r: Record<string, unknown>) => r.preset_reason === 'airport_flip')
        || (handoffRow?.airport_flipping ?? false)
        || (washbayRow?.airport_flipping ?? false),
      airportFlipCount,
      fuel: buildFuelReport(fuelRes.data),
    };
  };

  const handleExport = async () => {
    hapticMedium();
    setLoading(true);
    try {
      const data = await fetchReportData();
      await share({ title: `Shift Report — ${user.name} · ${formatDateStr(date)}`, text: buildReport(data) });
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
      <ShareTextButton onClick={handleExport} disabled={busy} copied={copied} loading={loading} />
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
