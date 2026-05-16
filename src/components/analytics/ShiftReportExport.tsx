import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase } from '../../lib/supabase';
import { localDateStr } from '../../hooks/useFleetBalance';
import { hapticMedium } from '../../lib/haptics';
import type { ShiftWithUser, ShiftType } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function todayDateStr(): string {
  return new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  opening:  'Opening shift',
  mid:      'Mid shift',
  closing:  'Closing shift',
  'day-off': 'Day Off',
  pto:      'PTO',
  sick:     'Sick Day',
};

function deriveShiftLine(shifts: ShiftWithUser[], userId: string): string {
  const today = localDateStr(0);
  const todayShifts = shifts.filter(s => s.userId === userId && s.date === today);
  if (todayShifts.length === 0) return '8-hour shift';
  const withTimes = todayShifts.find(s => s.startTime && s.endTime);
  const chosen = withTimes ?? todayShifts[0];
  if (!chosen) return '8-hour shift';
  const label = SHIFT_TYPE_LABEL[chosen.shiftType] ?? 'Shift';
  return chosen.startTime && chosen.endTime
    ? `${label} ${chosen.startTime}–${chosen.endTime}`
    : label;
}

function formatLocation(loc: string): string {
  return loc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatHoldTypes(types: string[]): string {
  if (types.length === 0) return 'Hold';
  return types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ') + ' hold';
}

// ── Report generator ──────────────────────────────────────────────────────────

interface ReportData {
  shiftLine: string;
  userName: string;
  employeeId: string;
  offStandard:  { startTime: string; stopTime: string; minutes: number; reason: string; explanation: string | null; autoFromTrip: boolean }[];
  trips:        { departTime: string; arriveTime: string; isShuffle: boolean | null; reason: string | null }[];
  holds:        { flaggedAt: string; holdTypes: string[] }[];
  checkIns:     { checkedInAt: string; vehicleUnit: string; vehiclePlate: string }[];
  lostFound:    { foundAt: string; description: string; location: string; unitNumber: string | null }[];
  audits:       { createdAt: string; vehicleNumber: string; status: string }[];
  issues:       { reportedAt: string; title: string; severity: string }[];
}

function buildReport(d: ReportData): string {
  const SEP = '─'.repeat(37);
  const lines: string[] = [
    'SHIFT REPORT',
    SEP,
    `Name:     ${d.userName}`,
    `EEID:     ${d.employeeId}`,
    `Date:     ${todayDateStr()}`,
    `Shift:    ${d.shiftLine}`,
  ];

  const offTotal = d.offStandard.reduce((s, e) => s + e.minutes, 0);
  if (d.offStandard.length > 0) {
    lines.push('', 'OFF-STANDARD TIME', SEP);
    for (const e of d.offStandard) {
      const auto = e.autoFromTrip ? '  [auto]' : '';
      const expl = e.explanation ? `  ${e.explanation}` : '';
      lines.push(`${fmtTime(e.startTime)} – ${fmtTime(e.stopTime)}  ${e.reason}${expl}${auto}`);
    }
    lines.push(`Total: ${fmtMinutes(offTotal)}`);
  }

  if (d.trips.length > 0) {
    lines.push('', 'AIRPORT TRIPS', SEP);
    for (const t of d.trips) {
      const mins = Math.round(
        (new Date(t.arriveTime).getTime() - new Date(t.departTime).getTime()) / 60000
      );
      const label = t.isShuffle ? 'Shuttle Transfer' : (t.reason ?? 'Airport Run');
      lines.push(`${fmtTime(t.departTime)} – ${fmtTime(t.arriveTime)}  ${label}  (${mins}m)`);
    }
  }

  if (d.holds.length > 0) {
    lines.push('', 'HOLDS FLAGGED', SEP);
    for (const h of d.holds) {
      lines.push(`${formatHoldTypes(h.holdTypes)} · ${fmtTime(h.flaggedAt)}`);
    }
  }

  if (d.checkIns.length > 0) {
    lines.push('', 'VEHICLES CHECKED IN', SEP);
    for (const c of d.checkIns) {
      lines.push(`Unit ${c.vehicleUnit}  ${c.vehiclePlate}  ${fmtTime(c.checkedInAt)}`);
    }
  }

  if (d.lostFound.length > 0) {
    lines.push('', 'LOST & FOUND', SEP);
    for (const item of d.lostFound) {
      const unit = item.unitNumber ? `  Unit ${item.unitNumber}` : '';
      lines.push(`${item.description} · ${formatLocation(item.location)}${unit}  (${fmtTime(item.foundAt)})`);
    }
  }

  if (d.audits.length > 0) {
    lines.push('', 'AUDITS', SEP);
    for (const a of d.audits) {
      lines.push(`Unit ${a.vehicleNumber} · ${a.status}  (${fmtTime(a.createdAt)})`);
    }
  }

  if (d.issues.length > 0) {
    lines.push('', 'ISSUES REPORTED', SEP);
    for (const i of d.issues) {
      const sev = i.severity.charAt(0).toUpperCase() + i.severity.slice(1);
      lines.push(`[${sev}] ${i.title}  (${fmtTime(i.reportedAt)})`);
    }
  }

  lines.push('', 'Manager approval: _________________', SEP, 'Generated by Fleet Garage');
  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShiftReportExport() {
  const { user } = useAuth();
  const { shifts } = useSchedule();
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);

  if (!user) return null;

  const handleExport = async () => {
    hapticMedium();
    setLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();
    const todayDate     = localDateStr(0);

    const [othRes, tripRes, holdRes, ciRes, lfRes, auditRes, issueRes] = await Promise.all([
      supabase.from('off_standard_entries')
        .select('start_time, stop_time, minutes, reason, explanation, auto_from_trip')
        .eq('user_id', user.id).eq('status', 'complete')
        .gte('start_time', todayStartISO)
        .order('start_time', { ascending: true }),

      supabase.from('vsa_trips')
        .select('depart_time, arrive_time, is_shuttle, reason')
        .eq('driver_id', user.id)
        .gte('depart_time', todayStartISO)
        .not('arrive_time', 'is', null)
        .order('depart_time', { ascending: true }),

      supabase.from('holds')
        .select('flagged_at, hold_types')
        .eq('flagged_by_id', user.id)
        .gte('flagged_at', todayStartISO)
        .order('flagged_at', { ascending: true }),

      supabase.from('vehicle_checkins')
        .select('checked_in_at, vehicle_unit, vehicle_plate')
        .eq('checked_in_by_id', user.id)
        .gte('checked_in_at', todayStartISO)
        .order('checked_in_at', { ascending: true }),

      supabase.from('lost_found')
        .select('found_at, description, location, unit_number')
        .eq('found_by', user.id)
        .gte('found_at', todayStartISO)
        .order('found_at', { ascending: true }),

      supabase.from('audits')
        .select('created_at, vehicle_number, status')
        .eq('auditor_id', user.id)
        .eq('date', todayDate)
        .order('created_at', { ascending: true }),

      supabase.from('facility_issues')
        .select('reported_at, title, severity')
        .eq('reported_by', user.id)
        .gte('reported_at', todayStartISO)
        .order('reported_at', { ascending: true }),
    ]);

    const reportText = buildReport({
      shiftLine:  deriveShiftLine(shifts, user.id),
      userName:   user.name,
      employeeId: user.employeeId,
      offStandard: (othRes.data ?? []).map((r: Record<string, unknown>) => ({
        startTime:   r.start_time as string,
        stopTime:    r.stop_time as string,
        minutes:     r.minutes as number,
        reason:      r.reason as string,
        explanation: r.explanation as string | null,
        autoFromTrip: r.auto_from_trip as boolean,
      })),
      trips: (tripRes.data ?? []).map((r: Record<string, unknown>) => ({
        departTime: r.depart_time as string,
        arriveTime: r.arrive_time as string,
        isShuffle:  r.is_shuttle as boolean | null,
        reason:     r.reason as string | null,
      })),
      holds: (holdRes.data ?? []).map((r: Record<string, unknown>) => ({
        flaggedAt:  r.flagged_at as string,
        holdTypes:  (r.hold_types as string[] | null) ?? [],
      })),
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
    });

    setLoading(false);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Shift Report — ${user.name} · ${todayDateStr()}`,
          text:  reportText,
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

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="w-full py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Generating…' : copied ? '✓ Copied to clipboard' : 'Export Shift Report'}
    </button>
  );
}
