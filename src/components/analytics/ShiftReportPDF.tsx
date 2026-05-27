import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { fmtTime, fmtMinutes, type ReportData } from '../../lib/buildShiftReport';

const LOGO_SRC = `${window.location.origin}/fleet-garage-logo.png`;

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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
  demandRow:     { flexDirection: 'row', gap: 8, marginBottom: 6 },
  demandCard:    { flex: 1, backgroundColor: '#f9fafb', borderRadius: 4, padding: 8, alignItems: 'center' },
  demandValue:   { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
  demandLabel:   { fontSize: 7, color: '#6b7280' },
  gapRowPos:     { backgroundColor: '#dcfce7', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 10 },
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.accentBar} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function formatHoldTypes(types: string[]): string {
  if (types.length === 0) return 'Hold';
  return types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ') + ' hold';
}

function formatLocation(loc: string): string {
  return loc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtRate(n: number): string { return n.toFixed(1) + '/hr'; }

// ── Document ──────────────────────────────────────────────────────────────────

export function ShiftReportPDF({ data }: { data: ReportData }) {
  // Fleet demand
  const fb = data.fleetBalance;
  const gap = fb ? fb.inCount - fb.outCount : 0;

  // OTH summary
  const offTotal    = data.offStandard.reduce((s, e) => s + e.minutes, 0);
  const manualOth   = data.offStandard.filter(e => !e.autoFromTrip && e.reason === 'OTH').reduce((s, e) => s + e.minutes, 0);
  const wfw         = data.offStandard.filter(e => e.reason === 'WFW').reduce((s, e) => s + e.minutes, 0);
  const autoLogged  = data.offStandard.filter(e => e.autoFromTrip).reduce((s, e) => s + e.minutes, 0);
  const interrupts  = data.trips.filter(t => t.isVsaInterruption).length;

  // Throughput rates
  const t = data.throughput;
  const branchRate  = t?.fullDayCleaned != null && t.branchOpHours > 0 ? t.fullDayCleaned / t.branchOpHours : null;
  const shiftRate   = t?.shiftType !== 'opening' && t?.closingCleaned != null ? t.closingCleaned / 8 : null;
  const shiftCleaned = t ? (t.shiftType === 'opening' ? t.openingCleaned : t.closingCleaned) : null;
  const personalRate = shiftCleaned != null && offTotal > 0
    ? shiftCleaned / Math.max(0.1, 8 - offTotal / 60)
    : null;

  // Queue
  const tripsWithQueue = data.trips.filter(tr => tr.queueAtDeparture != null);
  const peakCount      = tripsWithQueue.filter(tr => tr.queueAtDeparture === '10+').length;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Image src={LOGO_SRC} style={s.logo} />
          <Text style={s.headerTitle}>SHIFT REPORT</Text>
          <View style={s.headerGrid}>
            <View style={s.headerCol}>
              <Text style={s.headerLabel}>NAME</Text>
              <Text style={s.headerValue}>{data.userName}</Text>
              <Text style={s.headerLabel}>EEID</Text>
              <Text style={s.headerValue}>{data.employeeId}</Text>
            </View>
            <View style={s.headerCol}>
              <Text style={s.headerLabel}>DATE</Text>
              <Text style={s.headerValue}>{data.dateLabel}</Text>
              <Text style={s.headerLabel}>SHIFT</Text>
              <Text style={s.headerValue}>{data.shiftLine}</Text>
            </View>
          </View>
        </View>

        {/* Fleet Demand */}
        {fb && (
          <View style={s.section}>
            <SectionHead title={fb.isProjected ? 'FLEET DEMAND  (Est.)' : 'FLEET DEMAND'} />
            <View style={s.demandRow}>
              <View style={s.demandCard}>
                <Text style={s.demandValue}>{fb.outCount}</Text>
                <Text style={s.demandLabel}>Reservations today</Text>
              </View>
              <View style={s.demandCard}>
                <Text style={s.demandValue}>{fb.inCount}</Text>
                <Text style={s.demandLabel}>Expected returns</Text>
              </View>
            </View>
            <View style={gap >= 0 ? s.gapRowPos : s.gapRowNeg}>
              <Text style={s.gapText}>
                Supply gap: {gap >= 0 ? `+${gap}` : `${gap}`}
                {gap < 0 ? '  — demand exceeds returns before cleaning starts' : '  — returns cover demand'}
              </Text>
            </View>
          </View>
        )}

        {/* Throughput */}
        {t && (
          <View style={s.section}>
            <SectionHead title="THROUGHPUT" />
            <View style={s.tpCols}>
              {/* Opening */}
              <View style={s.tpCard}>
                <Text style={t.openingCleaned != null ? s.tpCount : s.tpNA}>
                  {t.openingCleaned != null ? t.openingCleaned : '—'}
                </Text>
                <Text style={s.tpLabel}>Opening crew</Text>
                <Text style={s.tpSub}>06:45–15:15</Text>
              </View>
              {/* Closing */}
              <View style={s.tpCard}>
                <Text style={t.closingCleaned != null ? s.tpCount : s.tpNA}>
                  {t.shiftType === 'opening' ? 'N/A' : (t.closingCleaned != null ? t.closingCleaned : '—')}
                </Text>
                <Text style={s.tpLabel}>Closing crew</Text>
                <Text style={s.tpSub}>13:30–22:00</Text>
              </View>
              {/* Full day */}
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

            {/* Rates */}
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
                Personal rate{offTotal > 0 ? `  (8hr − ${fmtMinutes(offTotal)} OTH)` : ''}
              </Text>
              {personalRate != null
                ? <Text style={s.rateValueGreen}>{fmtRate(personalRate)}</Text>
                : <Text style={s.rateNoOth}>Log off-standard time to see your personal rate</Text>
              }
            </View>

            {/* Lot status */}
            {t.lotStatus && (
              <View style={s.lotPill}>
                <Text style={s.lotPillText}>
                  Lot status at handoff: {t.lotStatus.charAt(0).toUpperCase() + t.lotStatus.slice(1)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Off-Standard Time — summary */}
        <View style={s.section}>
          <SectionHead title="OFF-STANDARD TIME" />
          {data.offStandard.length === 0
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
                <Text style={s.othTripLine}>Trips: {data.trips.length}    Interruptions: {interrupts}</Text>
                <Text style={s.othFootnote}>See attached OTH report for full entry breakdown.</Text>
              </>
          }
        </View>

        {/* Washbay Queue at Departure */}
        {tripsWithQueue.length > 0 && (
          <View style={s.section}>
            <SectionHead title="WASHBAY QUEUE AT DEPARTURE" />
            {tripsWithQueue.map((tr, i) => (
              <View key={i} style={s.queueRow}>
                <Text style={s.queueTime}>{fmtTime(tr.departTime)}</Text>
                <View style={s.queueTrack}>
                  <View style={
                    tr.queueAtDeparture === '10+' ? s.queueBarFull :
                    tr.queueAtDeparture === '~5'  ? s.queueBarMid  :
                                                    s.queueBarEmpty
                  } />
                </View>
                <Text style={s.queueLbl}>{tr.queueAtDeparture}</Text>
              </View>
            ))}
            {peakCount > 0 && (
              <View style={s.queueCallout}>
                <Text style={s.queueCallTxt}>
                  ⚠ {peakCount} trip(s) departed with washbay queue at 10+ — VSA coverage pulled during peak window
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Units Flagged */}
        {data.holds.length > 0 && (
          <View style={s.section}>
            <SectionHead title="UNITS FLAGGED" />
            {data.holds.map((h, i) => (
              <View key={i} style={s.row}>
                <Text style={s.timeCol}>{fmtTime(h.flaggedAt)}</Text>
                <View style={s.mainCol}>
                  <Text style={s.mainText}>{formatHoldTypes(h.holdTypes)}  ·  Unit {h.vehicleUnit}  {h.vehiclePlate}</Text>
                  {h.description ? <Text style={s.subText}>{h.description}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Vehicles Checked In */}
        {data.checkIns.length > 0 && (
          <View style={s.section}>
            <SectionHead title="VEHICLES CHECKED IN" />
            {data.checkIns.map((c, i) => (
              <View key={i} style={s.row}>
                <Text style={s.timeCol}>{fmtTime(c.checkedInAt)}</Text>
                <Text style={[s.mainCol, s.mainText]}>Unit {c.vehicleUnit}</Text>
                <Text style={s.mainText}>{c.vehiclePlate}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Lost & Found */}
        {data.lostFound.length > 0 && (
          <View style={s.section}>
            <SectionHead title="LOST & FOUND" />
            {data.lostFound.map((item, i) => (
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
        )}

        {/* Audits */}
        {data.audits.length > 0 && (
          <View style={s.section}>
            <SectionHead title="AUDITS" />
            {data.audits.map((a, i) => (
              <View key={i} style={s.row}>
                <Text style={s.timeCol}>{fmtTime(a.createdAt)}</Text>
                <Text style={[s.mainCol, s.mainText]}>Unit {a.vehicleNumber}</Text>
                <Text style={s.mainText}>{a.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Issues Reported */}
        {data.issues.length > 0 && (
          <View style={s.section}>
            <SectionHead title="ISSUES REPORTED" />
            {data.issues.map((iss, i) => (
              <View key={i} style={s.row}>
                <Text style={s.timeCol}>{fmtTime(iss.reportedAt)}</Text>
                <Text style={[s.mainCol, s.mainText]}>{iss.title}</Text>
                <Text style={s.badgeDot}>{iss.severity.charAt(0).toUpperCase() + iss.severity.slice(1)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Manager Approval */}
        <View style={s.approval}>
          <Text style={s.approvalLabel}>Manager approval</Text>
          <View style={s.sigRow}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Signature / date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by Fleet Garage</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
