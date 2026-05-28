// Pure PDF section renderers for ShiftReportPDF.
// Exception to the 330-line cap: pure renderer with many cases (see CLAUDE.md).
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { fmtTime, fmtMinutes, type ReportData, type ReportThroughput } from '../../lib/buildShiftReport';

export const LOGO_SRC = `${window.location.origin}/fleet-garage-logo.webp`;

// ── Styles ────────────────────────────────────────────────────────────────────

export const s = StyleSheet.create({
  page:          { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#ffffff' },

  // Header
  header:        { backgroundColor: '#111827', borderRadius: 5, padding: 16, marginBottom: 22 },
  logo:          { width: 32, height: 32, marginBottom: 8 },
  headerTitle:   { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 12 },
  headerGrid:    { flexDirection: 'row' },
  headerCol:     { flex: 1 },
  headerLabel:   { fontSize: 7, color: '#9ca3af', marginBottom: 2 },
  headerValue:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 8 },

  // Section chrome
  section:       { marginBottom: 18 },
  sectionHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  accentBar:     { width: 3, height: 12, backgroundColor: '#f59e0b', borderRadius: 1, marginRight: 7 },
  sectionTitle:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151' },
  noData:        { fontSize: 8, color: '#9ca3af', fontStyle: 'italic', paddingLeft: 10, paddingBottom: 4 },

  // Generic rows
  row:           { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  timeCol:       { width: 100, fontSize: 8, color: '#6b7280' },
  mainCol:       { flex: 1 },
  mainText:      { fontSize: 8, color: '#111827' },
  subText:       { fontSize: 7, color: '#6b7280', marginTop: 1 },
  totalRow:      { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 5 },
  totalText:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151' },
  badgeDot:      { fontSize: 7, color: '#b45309' },

  // Fleet demand
  sentRow:       { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  sentCount:     { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#111827' },
  sentLabel:     { fontSize: 10, color: '#6b7280', marginLeft: 4 },
  demandRow:     { flexDirection: 'row', gap: 8, marginBottom: 6 },
  demandCard:    { flex: 1, backgroundColor: '#f9fafb', borderRadius: 4, padding: 8, alignItems: 'center' },
  demandValue:   { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
  demandLabel:   { fontSize: 7, color: '#6b7280' },
  demandDelta:   { fontSize: 7, color: '#16a34a', marginTop: 2 },
  gapRowNeg:     { backgroundColor: '#fee2e2', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 10 },
  gapText:       { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },

  // Throughput
  tpCols:        { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tpCard:        { flex: 1, backgroundColor: '#f9fafb', borderRadius: 4, padding: 8 },
  tpCount:       { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
  tpLabel:       { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 1 },
  tpSub:         { fontSize: 7, color: '#9ca3af' },
  tpNA:          { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#d1d5db', marginBottom: 2 },
  rateRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  rateLabel:     { fontSize: 8, color: '#374151' },
  rateValue:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },
  rateValueGreen:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  rateNoOth:     { fontSize: 7, color: '#9ca3af', fontStyle: 'italic' },
  lotPill:       { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  lotPillText:   { fontSize: 7, color: '#374151' },

  // OTH summary
  othTotal:      { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 4 },
  othBreakdown:  { fontSize: 8, color: '#374151', marginBottom: 2 },
  othTripLine:   { fontSize: 8, color: '#6b7280', marginBottom: 4 },
  othFootnote:   { fontSize: 7, color: '#9ca3af', fontStyle: 'italic' },

  // Queue bars
  queueRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  queueTime:     { width: 44, fontSize: 7, color: '#6b7280' },
  queueTrack:    { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 2, marginHorizontal: 8, overflow: 'hidden' },
  queueBarEmpty: { height: 8, width: '4%',  backgroundColor: '#e5e7eb', borderRadius: 2 },
  queueBarMid:   { height: 8, width: '45%', backgroundColor: '#f59e0b', borderRadius: 2 },
  queueBarFull:  { height: 8, width: '100%',backgroundColor: '#ef4444', borderRadius: 2 },
  queueLbl:      { width: 28, fontSize: 7, color: '#374151', textAlign: 'right' },
  queueCallout:  { marginTop: 6, backgroundColor: '#fef2f2', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 },
  queueCallTxt:  { fontSize: 7, color: '#b91c1c' },

  // Approval / footer
  approval:      { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  approvalLabel: { fontSize: 8, color: '#374151', marginBottom: 12 },
  sigRow:        { flexDirection: 'row', alignItems: 'flex-end' },
  sigLine:       { flex: 1, borderBottomWidth: 1, borderBottomColor: '#374151', height: 20 },
  sigLabel:      { fontSize: 7, color: '#9ca3af', marginLeft: 6 },
  footer:        { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:    { fontSize: 7, color: '#9ca3af' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.accentBar} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

// keep in sync with HOLD_TYPE_LABELS in buildShiftReport.ts
const HOLD_TYPE_LABELS: Record<string, string> = {
  damage:     'Damage',
  detail:     'Detail',
  mechanical: 'Mechanical',
  sale_car:   'Sale Car',
};

function formatHoldTypes(types: string[]): string {
  if (types.length === 0) return 'Hold';
  return types.map(t => HOLD_TYPE_LABELS[t] ?? (t.charAt(0).toUpperCase() + t.slice(1))).join(' & ') + ' hold';
}

function formatLocation(loc: string): string {
  return loc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtRate(n: number): string { return n.toFixed(1) + '/hr'; }

export function resolveQueueLabel(raw: string | null): string | null {
  if (raw == null) return null;
  if (typeof (raw as unknown) !== 'string') {
    const obj = raw as unknown as { label?: string };
    if (!obj.label || obj.label === 'Resumed') return null;
    return obj.label === 'TOO_MUCH' ? '10+' : obj.label;
  }
  return raw === 'TOO_MUCH' ? '10+' : raw;
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function ShiftReportHeader({ userName, employeeId, dateLabel, shiftLine }: {
  userName: string; employeeId: string; dateLabel: string; shiftLine: string;
}) {
  return (
    <View style={s.header}>
      <Image src={LOGO_SRC} style={s.logo} />
      <Text style={s.headerTitle}>SHIFT REPORT</Text>
      <View style={s.headerGrid}>
        <View style={s.headerCol}>
          <Text style={s.headerLabel}>NAME</Text>
          <Text style={s.headerValue}>{userName}</Text>
          <Text style={s.headerLabel}>EEID</Text>
          <Text style={s.headerValue}>{employeeId}</Text>
        </View>
        <View style={s.headerCol}>
          <Text style={s.headerLabel}>DATE</Text>
          <Text style={s.headerValue}>{dateLabel}</Text>
          <Text style={s.headerLabel}>SHIFT</Text>
          <Text style={s.headerValue}>{shiftLine}</Text>
        </View>
      </View>
    </View>
  );
}

export function FleetDemandSection({ fb, gap, fullDayCleaned }: {
  fb: NonNullable<ReportData['fleetBalance']>;
  gap: number;
  fullDayCleaned: number | null;
}) {
  return (
    <View style={s.section}>
      <SectionHead title={fb.isProjected ? 'FLEET DEMAND  (Est.)' : 'FLEET DEMAND'} />
      {fullDayCleaned != null && (
        <View style={s.sentRow}>
          <Text style={s.sentCount}>{fullDayCleaned}</Text>
          <Text style={s.sentLabel}> sent to airport</Text>
        </View>
      )}
      <View style={s.demandRow}>
        <View style={s.demandCard}>
          <Text style={s.demandValue}>{fb.outCount}</Text>
          <Text style={s.demandLabel}>Reservations today</Text>
          {fullDayCleaned != null && fullDayCleaned > fb.outCount && (
            <Text style={s.demandDelta}>+{fullDayCleaned - fb.outCount} above demand</Text>
          )}
        </View>
        <View style={s.demandCard}>
          <Text style={s.demandValue}>{fb.inCount}</Text>
          <Text style={s.demandLabel}>Expected returns</Text>
          {gap > 0 && <Text style={s.demandDelta}>+{gap} more came back</Text>}
        </View>
      </View>
      {gap < 0 && (
        <View style={s.gapRowNeg}>
          <Text style={s.gapText}>
            Supply gap: {gap}  — demand exceeds returns before cleaning starts
          </Text>
        </View>
      )}
    </View>
  );
}

export function ThroughputSection({ t, fb, offTotal, branchRate, shiftRate, windowCleaned, windowHours, personalRate }: {
  t: ReportThroughput;
  fb: ReportData['fleetBalance'];
  offTotal: number;
  branchRate: number | null;
  shiftRate: number | null;
  windowCleaned: number | null;
  windowHours: number | null;
  personalRate: number | null;
}) {
  return (
    <View style={s.section}>
      <SectionHead title="THROUGHPUT" />
      <View style={s.tpCols}>
        <View style={s.tpCard}>
          <Text style={windowCleaned != null ? s.tpCount : s.tpNA}>
            {windowCleaned != null ? windowCleaned : '—'}
          </Text>
          <Text style={s.tpLabel}>
            {t.shiftType === 'opening' ? 'Opening crew' : t.shiftType === 'mid' ? 'Mid shift' : 'Closing crew'}
          </Text>
          <Text style={s.tpSub}>
            {t.shiftType === 'opening' ? '06:45–15:15'
              : t.shiftType === 'mid'
                ? (t.midShiftHours != null ? `${t.midShiftHours.toFixed(1)}h window` : 'variable window')
                : '13:30–22:00'}
          </Text>
        </View>
        {t.shiftType === 'mid' && (
          <View style={s.tpCard}>
            <Text style={t.openingCleaned != null ? s.tpCount : s.tpNA}>
              {t.openingCleaned != null ? t.openingCleaned : '—'}
            </Text>
            <Text style={s.tpLabel}>Opening crew</Text>
            <Text style={s.tpSub}>06:45–15:15</Text>
          </View>
        )}
        <View style={s.tpCard}>
          <Text style={t.fullDayCleaned != null ? s.tpCount : s.tpNA}>
            {t.shiftType === 'opening' ? 'N/A' : (t.fullDayCleaned != null ? t.fullDayCleaned : '—')}
          </Text>
          <Text style={s.tpLabel}>Full day</Text>
          {fb && t.fullDayCleaned != null && t.shiftType !== 'opening' && (
            <Text style={s.tpSub}>of {fb.outCount} needed</Text>
          )}
        </View>
      </View>
      {branchRate != null && (
        <View style={s.rateRow}>
          <Text style={s.rateLabel}>Branch day rate  ({t.branchOpHours}hr operational window)</Text>
          <Text style={s.rateValue}>{fmtRate(branchRate)}</Text>
        </View>
      )}
      {shiftRate != null && (
        <View style={s.rateRow}>
          <Text style={s.rateLabel}>Shift rate  (8hr closing window)</Text>
          <Text style={s.rateValue}>{fmtRate(shiftRate)}</Text>
        </View>
      )}
      <View style={s.rateRow}>
        <Text style={s.rateLabel}>
          Personal rate{offTotal > 0 && windowHours != null ? `  (${windowHours.toFixed(0)}hr − ${fmtMinutes(offTotal)} OTH)` : ''}
        </Text>
        {personalRate != null
          ? <Text style={s.rateValueGreen}>{fmtRate(personalRate)}</Text>
          : <Text style={s.rateNoOth}>Log off-standard time to see your personal rate</Text>
        }
      </View>
      {t.lotStatus && (
        <View style={s.lotPill}>
          <Text style={s.lotPillText}>
            Lot status at handoff: {t.lotStatus.charAt(0).toUpperCase() + t.lotStatus.slice(1)}
          </Text>
        </View>
      )}
    </View>
  );
}

export function OthSection({ offStandard, offTotal, manualOth, wfw, autoLogged, tripCount, interrupts }: {
  offStandard: ReportData['offStandard'];
  offTotal: number;
  manualOth: number;
  wfw: number;
  autoLogged: number;
  tripCount: number;
  interrupts: number;
}) {
  return (
    <View style={s.section}>
      <SectionHead title="OFF-STANDARD TIME" />
      {offStandard.length === 0
        ? <Text style={s.noData}>(none)</Text>
        : <>
            <Text style={s.othTotal}>Total: {fmtMinutes(offTotal)}</Text>
            <Text style={s.othBreakdown}>
              {[
                manualOth > 0  && `Manual OTH · ${fmtMinutes(manualOth)}`,
                wfw > 0        && `WFW · ${fmtMinutes(wfw)}`,
                autoLogged > 0 && `Auto-logged · ${fmtMinutes(autoLogged)}`,
              ].filter(Boolean).join('    ')}
            </Text>
            <Text style={s.othTripLine}>Trips: {tripCount}    Interruptions: {interrupts}</Text>
            <Text style={s.othFootnote}>See attached OTH report for full entry breakdown.</Text>
          </>
      }
    </View>
  );
}

export function QueueSection({ tripsWithQueue, peakCount }: {
  tripsWithQueue: ReportData['trips'];
  peakCount: number;
}) {
  if (tripsWithQueue.length === 0) return null;
  return (
    <View style={s.section}>
      <SectionHead title="WASHBAY QUEUE AT DEPARTURE" />
      {tripsWithQueue.map((tr, i) => {
        const qLabel = resolveQueueLabel(tr.queueAtDeparture)!;
        return (
          <View key={i} style={s.queueRow}>
            <Text style={s.queueTime}>{fmtTime(tr.departTime)}</Text>
            <View style={s.queueTrack}>
              <View style={
                qLabel === '10+' ? s.queueBarFull :
                qLabel === '~5'  ? s.queueBarMid  :
                                   s.queueBarEmpty
              } />
            </View>
            <Text style={s.queueLbl}>{qLabel}</Text>
          </View>
        );
      })}
      {peakCount > 0 && (
        <View style={s.queueCallout}>
          <Text style={s.queueCallTxt}>
            ⚠ {peakCount} trip(s) departed with washbay queue at 10+ — VSA coverage pulled during peak window
          </Text>
        </View>
      )}
    </View>
  );
}

export function HoldsSection({ holds }: { holds: ReportData['holds'] }) {
  if (holds.length === 0) return null;
  return (
    <View style={s.section}>
      <SectionHead title="UNITS FLAGGED" />
      {holds.map((h, i) => (
        <View key={i} style={s.row}>
          <Text style={s.timeCol}>{fmtTime(h.flaggedAt)}</Text>
          <View style={s.mainCol}>
            <Text style={s.mainText}>{formatHoldTypes(h.holdTypes)}  ·  Unit {h.vehicleUnit}  {h.vehiclePlate}</Text>
            {h.description ? <Text style={s.subText}>{h.description}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function CheckInsSection({ checkIns }: { checkIns: ReportData['checkIns'] }) {
  if (checkIns.length === 0) return null;
  return (
    <View style={s.section}>
      <SectionHead title="VEHICLES CHECKED IN" />
      {checkIns.map((c, i) => (
        <View key={i} style={s.row}>
          <Text style={s.timeCol}>{fmtTime(c.checkedInAt)}</Text>
          <Text style={[s.mainCol, s.mainText]}>Unit {c.vehicleUnit}</Text>
          <Text style={s.mainText}>{c.vehiclePlate}</Text>
        </View>
      ))}
    </View>
  );
}

export function LostFoundSection({ lostFound }: { lostFound: ReportData['lostFound'] }) {
  if (lostFound.length === 0) return null;
  return (
    <View style={s.section}>
      <SectionHead title="LOST & FOUND" />
      {lostFound.map((item, i) => (
        <View key={i} style={s.row}>
          <Text style={s.timeCol}>{fmtTime(item.foundAt)}</Text>
          <View style={s.mainCol}>
            <Text style={s.mainText}>{item.description}</Text>
            <Text style={s.subText}>
              {formatLocation(item.location)}{item.unitNumber ? `  ·  Unit ${item.unitNumber}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function AuditsSection({ audits }: { audits: ReportData['audits'] }) {
  if (audits.length === 0) return null;
  return (
    <View style={s.section}>
      <SectionHead title="AUDITS" />
      {audits.map((a, i) => (
        <View key={i} style={s.row}>
          <Text style={s.timeCol}>{fmtTime(a.createdAt)}</Text>
          <Text style={[s.mainCol, s.mainText]}>Unit {a.vehicleNumber}</Text>
          <Text style={s.mainText}>{a.status}</Text>
        </View>
      ))}
    </View>
  );
}

export function IssuesSection({ issues }: { issues: ReportData['issues'] }) {
  if (issues.length === 0) return null;
  return (
    <View style={s.section}>
      <SectionHead title="ISSUES REPORTED" />
      {issues.map((iss, i) => (
        <View key={i} style={s.row}>
          <Text style={s.timeCol}>{fmtTime(iss.reportedAt)}</Text>
          <Text style={[s.mainCol, s.mainText]}>{iss.title}</Text>
          <Text style={s.badgeDot}>{iss.severity.charAt(0).toUpperCase() + iss.severity.slice(1)}</Text>
        </View>
      ))}
    </View>
  );
}

export function ApprovalSection() {
  return (
    <View style={s.approval}>
      <Text style={s.approvalLabel}>Manager approval</Text>
      <View style={s.sigRow}>
        <View style={s.sigLine} />
        <Text style={s.sigLabel}>Signature / date</Text>
      </View>
    </View>
  );
}

export function ReportFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Generated by Fleet Garage</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
