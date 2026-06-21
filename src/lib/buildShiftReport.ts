import type { ShiftType, ShiftWithUser } from '../types';
import { EXPECTED_PUMP2, type FuelReport } from './fuelReadings';
import { holdTypeLabel } from './holdTypeLabels';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportThroughput {
  shiftType:      ShiftType | null;
  openingCleaned: number | null;
  closingCleaned: number | null;
  midCleaned:     number | null;
  midShiftHours:  number | null;  // derived from mid_arrival → mid_departure timestamps
  fullDayCleaned: number | null;
  branchOpHours:  number;
  lotStatus:      string | null;
  queueAtClose:   number | null;  // closing only — the objective end-of-shift queue count (replaces the lot-status label)
  // Personal rates — computed once via computeShiftRates so the report matches
  // the live ShiftRatesCard exactly (cars / fixed shift-hours, effort-adjusted
  // for off-standard within the shift window). null when the window has no count.
  baseline:       number | null;
  yourEffort:     number | null;
  // Actual worked clock window 'HH:MM–HH:MM' when the shift logged actual hours,
  // else null → renderers fall back to the standard per-type range label.
  actualWindowLabel: string | null;
  carryOver: number; // Vehicles inherited from previous shift's queue (0 = none / not recorded)
}

export interface ReportData {
  shiftLine:    string;
  dateLabel:    string;
  userName:     string;
  employeeId:   string;
  shiftType:    ShiftType | null;
  offStandard:  { startTime: string; stopTime: string; minutes: number; reason: string; explanation: string | null; autoFromTrip: boolean }[];
  trips:        { departTime: string; arriveTime: string; isShuffle: boolean | null; reason: string | null; isVsaInterruption: boolean | null; queueAtDeparture: string | null }[];
  holds:        { flaggedAt: string; holdTypes: string[]; vehicleUnit: string; vehiclePlate: string; description: string; photos?: string[] }[];
  checkIns:     { checkedInAt: string; vehicleUnit: string; vehiclePlate: string }[];
  lostFound:    { foundAt: string; description: string; location: string; unitNumber: string | null }[];
  audits:       { createdAt: string; vehicleNumber: string; status: string }[];
  issues:       { reportedAt: string; title: string; severity: string }[];
  fleetBalance: { outCount: number; inCount: number; isProjected: boolean } | null;
  throughput:   ReportThroughput | null;
  // True when flipping was recorded that day through ANY channel — a VSA's own
  // 'airport_flip' OTH time, or the manual handoff/closing attestation (for flips
  // run by people who don't use FG). Cars flipped at the airport never reach the
  // washbay, so the bay count reads light — this flag tells a report reader why.
  airportFlipping: boolean;
  // Every reading the paper Gasoline Pump Card carries, surfaced in FG. null when
  // no fuel was logged for the day. The Pump 2 status doubles as the theft tripwire.
  fuel: FuelReport | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDateStr(dateISO: string): string {
  const [y, mo, d] = dateISO.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  opening:   'Opening shift',
  mid:       'Mid shift',
  closing:   'Closing shift',
  'day-off': 'Day Off',
  pto:       'PTO',
  sick:      'Sick Day',
};

export function deriveShiftLine(shifts: ShiftWithUser[], userId: string, date: string): string {
  const dayShifts = shifts.filter(s => s.userId === userId && s.date === date);
  if (dayShifts.length === 0) return '8-hour shift';
  const withTimes = dayShifts.find(s => s.startTime && s.endTime);
  const chosen = withTimes ?? dayShifts[0];
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
  return types.map(holdTypeLabel).join(' & ') + ' hold';
}

function resolveQueueLabel(raw: string | null): string | null {
  if (raw == null) return null;
  if (typeof (raw as unknown) !== 'string') {
    const obj = raw as unknown as { label?: string };
    if (!obj.label || obj.label === 'Resumed') return null;
    return obj.label === 'TOO_MUCH' ? '10+' : obj.label;
  }
  return raw === 'TOO_MUCH' ? '10+' : raw;
}

function fmtRate(n: number): string {
  return n.toFixed(1) + '/hr';
}

// The fuel block — all three readings off the paper Gasoline Pump Card (Pump 1
// meter, locked Pump 2, digital tank inventory), with the Pump 2 line carrying
// the loss-prevention verdict (theft / fault) inline.
function fuelSection(f: FuelReport): string[] {
  const SEP = '─'.repeat(37);
  const n = (v: number) => v.toLocaleString('en-CA');
  const out: string[] = ['', 'FUEL — PUMP READINGS', SEP];

  if (f.pump1Open != null && f.pump1Close != null) {
    out.push(`Pump 1:  ${n(f.pump1Open)} → ${n(f.pump1Close)}${f.pump1Pumped != null ? `  ·  ${n(f.pump1Pumped)} L pumped` : ''}`);
  } else if (f.pump1Close != null) {
    out.push(`Pump 1:  ${n(f.pump1Close)}`);
  }

  if (f.pump2Reading != null) {
    if (f.pump2 === 'used') {
      out.push(`⚠ Pump 2:  ${n(f.pump2Reading)} — ABOVE locked ${EXPECTED_PUMP2}. Fuel theft — flag immediately.`);
    } else if (f.pump2 === 'fault') {
      out.push(`⚠ Pump 2:  ${n(f.pump2Reading)} — BELOW locked ${EXPECTED_PUMP2}. Meter fault/misread (a cumulative meter can't drop).`);
    } else {
      out.push(`Pump 2:  ${n(f.pump2Reading)}  ✓ locked, untouched`);
    }
  }

  if (f.digitalOpen != null && f.digitalClose != null) {
    const net = f.digitalNet ?? 0;
    const dir = net > 0 ? `${n(Math.abs(net))} L up` : net < 0 ? `${n(Math.abs(net))} L down` : 'no change';
    out.push(`Tank:    ${n(f.digitalOpen)} → ${n(f.digitalClose)}  ·  ${dir}`);
    if (net > 0 && f.topupNote) out.push(`         ↳ ${f.topupNote}`);
  } else if (f.digitalClose != null) {
    out.push(`Tank:    ${n(f.digitalClose)}`);
  }

  return out;
}

// ── Report builder ────────────────────────────────────────────────────────────

export function buildReport(d: ReportData): string {
  const SEP = '─'.repeat(37);
  const lines: string[] = [
    'SHIFT REPORT',
    SEP,
    `Name:     ${d.userName}`,
    `EEID:     ${d.employeeId}`,
    `Date:     ${d.dateLabel}`,
    `Shift:    ${d.shiftLine}`,
  ];

  // Fleet demand
  if (d.fleetBalance) {
    const { outCount, inCount, isProjected } = d.fleetBalance;
    const gap = inCount - outCount;
    lines.push('', isProjected ? 'FLEET DEMAND  (Est.)' : 'FLEET DEMAND', SEP);
    const totalCleaned = d.throughput?.fullDayCleaned ?? null;
    if (totalCleaned != null) lines.push(`${totalCleaned} sent to airport`);
    const resDelta = totalCleaned != null && totalCleaned > outCount ? `  (+${totalCleaned - outCount} above demand)` : '';
    const retDelta = gap > 0 ? `  (+${gap} more came back)` : '';
    lines.push(`Reservations: ${outCount}${resDelta}`);
    lines.push(`Returns:      ${inCount}${retDelta}`);
    if (gap < 0) lines.push(`Supply gap: ${gap}  — demand exceeds returns before cleaning starts`);
  }

  // Throughput
  if (d.throughput) {
    const t = d.throughput;
    const totalOthMins = d.offStandard.reduce((s, e) => s + e.minutes, 0);
    lines.push('', 'THROUGHPUT', SEP);

    if (t.shiftType === 'opening') {
      if (t.openingCleaned != null) lines.push(`Opening crew: ${t.openingCleaned} cars (${t.actualWindowLabel ?? '06:45–15:15'})`);
    } else if (t.shiftType === 'mid') {
      if (t.midCleaned != null) {
        const win = t.actualWindowLabel ?? (t.midShiftHours != null ? `${t.midShiftHours.toFixed(1)}h window` : null);
        lines.push(`Mid shift: ${t.midCleaned} cars${win ? ` (${win})` : ''}`);
      }
      if (t.openingCleaned != null && t.midCleaned != null) {
        lines.push(`Opening crew: ${t.openingCleaned} cars (06:45–15:15)`);
      }
    } else {
      if (t.openingCleaned != null) lines.push(`Opening crew: ${t.openingCleaned} cars (06:45–15:15)`);
      if (t.closingCleaned != null) lines.push(`Closing crew: ${t.closingCleaned} cars (${t.actualWindowLabel ?? '13:30–22:00'})`);
      if (t.fullDayCleaned != null) {
        const target = d.fleetBalance ? ` of ${d.fleetBalance.outCount} needed` : '';
        lines.push(`Full day: ${t.fullDayCleaned}${target}`);
      }
    }

    const rateParts: string[] = [];
    if (t.fullDayCleaned != null && t.branchOpHours > 0) {
      rateParts.push(`Branch rate: ${fmtRate(t.fullDayCleaned / t.branchOpHours)}`);
    }
    if (t.shiftType === 'closing' && t.closingCleaned != null) {
      rateParts.push(`Shift rate: ${fmtRate(t.closingCleaned / 8)}`);
    }
    if (t.yourEffort != null) {
      if (totalOthMins > 0) {
        rateParts.push(`Personal: ${fmtRate(t.yourEffort)}`);
      } else {
        rateParts.push('Personal: Log off-standard time to see your personal rate');
      }
    }
    if (rateParts.length > 0) lines.push(rateParts.join('  |  '));

    if (d.airportFlipping) {
      lines.push('🔄 Flipping returns — bay count excludes cars turned around at the airport');
    }

    if (t.queueAtClose != null) {
      lines.push(t.queueAtClose === 0
        ? 'In queue at close: 0 (zeroed)'
        : `In queue at close: ${t.queueAtClose} vehicle${t.queueAtClose !== 1 ? 's' : ''}`);
    } else if (t.lotStatus) {
      const label = t.lotStatus.charAt(0).toUpperCase() + t.lotStatus.slice(1);
      lines.push(`Lot status at handoff: ${label}`);
    }
    if (t.carryOver > 0) {
      lines.push(`Carry-over from previous shift: ${t.carryOver} vehicle${t.carryOver !== 1 ? 's' : ''}`);
    }
  }

  // OTH summary (replaces full entry list)
  const offTotal = d.offStandard.reduce((s, e) => s + e.minutes, 0);
  lines.push('', 'OFF-STANDARD TIME', SEP);
  if (d.offStandard.length === 0) {
    lines.push('(none)');
  } else {
    const manualOth = d.offStandard.filter(e => !e.autoFromTrip && e.reason === 'OTH').reduce((s, e) => s + e.minutes, 0);
    const wfw      = d.offStandard.filter(e => e.reason === 'WFW').reduce((s, e) => s + e.minutes, 0);
    const auto     = d.offStandard.filter(e => e.autoFromTrip).reduce((s, e) => s + e.minutes, 0);
    const interruptions = d.trips.filter(t => t.isVsaInterruption).length;
    lines.push(`Total: ${fmtMinutes(offTotal)}`);
    const breakdown: string[] = [];
    if (manualOth > 0) breakdown.push(`Manual OTH · ${fmtMinutes(manualOth)}`);
    if (wfw > 0)       breakdown.push(`WFW · ${fmtMinutes(wfw)}`);
    if (auto > 0)      breakdown.push(`Auto-logged · ${fmtMinutes(auto)}`);
    if (breakdown.length > 0) lines.push(breakdown.join('    '));
    lines.push(`Trips: ${d.trips.length}    Interruptions: ${interruptions}`);
    lines.push('See attached OTH report for full entry breakdown.');
  }

  // Queue at departure
  const tripsWithQueue = d.trips.filter(t => resolveQueueLabel(t.queueAtDeparture) !== null);
  if (tripsWithQueue.length > 0) {
    lines.push('', 'WASHBAY QUEUE AT DEPARTURE', SEP);
    for (const t of tripsWithQueue) {
      lines.push(`${fmtTime(t.departTime)}  Queue: ${resolveQueueLabel(t.queueAtDeparture)}`);
    }
    const peakCount = tripsWithQueue.filter(t => resolveQueueLabel(t.queueAtDeparture) === '10+').length;
    if (peakCount > 0) {
      lines.push(`⚠ ${peakCount} trip(s) departed with washbay queue at 10+ — VSA coverage pulled during peak window`);
    }
  }

  // Units flagged
  if (d.holds.length > 0) {
    lines.push('', 'UNITS FLAGGED', SEP);
    for (const h of d.holds) {
      const desc = h.description ? `  — ${h.description}` : '';
      lines.push(`${formatHoldTypes(h.holdTypes)} · Unit ${h.vehicleUnit}  ${h.vehiclePlate}${desc}  (${fmtTime(h.flaggedAt)})`);
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

  if (d.fuel) {
    lines.push(...fuelSection(d.fuel));
  }

  lines.push('', 'Manager approval: _________________', SEP, 'Generated by Fleet Garage');
  return lines.join('\n');
}
