import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const LOGO_SRC = `${window.location.origin}/fleet-garage-logo.png`;

// Redeclared locally — avoid circular import with ShiftReportExport
export interface PDFReportData {
  shiftLine:   string;
  dateLabel:   string;
  userName:    string;
  employeeId:  string;
  offStandard: { startTime: string; stopTime: string; minutes: number; reason: string; explanation: string | null; autoFromTrip: boolean }[];
  holds:       { flaggedAt: string; holdTypes: string[]; vehicleUnit: string; vehiclePlate: string; description: string }[];
  checkIns:    { checkedInAt: string; vehicleUnit: string; vehiclePlate: string }[];
  lostFound:   { foundAt: string; description: string; location: string; unitNumber: string | null }[];
  audits:      { createdAt: string; vehicleNumber: string; status: string }[];
  issues:      { reportedAt: string; title: string; severity: string }[];
}

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

function formatHoldTypes(types: string[]): string {
  if (types.length === 0) return 'Hold';
  return types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ') + ' hold';
}

function formatLocation(loc: string): string {
  return loc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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

  // Section
  section:       { marginBottom: 18 },
  sectionHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  accentBar:     { width: 3, height: 12, backgroundColor: '#f59e0b', borderRadius: 1, marginRight: 7 },
  sectionTitle:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151' },
  noData:        { fontSize: 8, color: '#9ca3af', fontStyle: 'italic', paddingLeft: 10, paddingBottom: 4 },

  // Rows
  row:           { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  autoRow:       { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  timeCol:       { width: 100, fontSize: 8, color: '#6b7280' },
  mainCol:       { flex: 1 },
  mainText:      { fontSize: 8, color: '#111827' },
  subText:       { fontSize: 7, color: '#6b7280', marginTop: 1 },
  totalRow:      { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 5 },
  totalText:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151' },
  badgeDot:      { fontSize: 7, color: '#b45309' },

  // Approval
  approval:      { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  approvalLabel: { fontSize: 8, color: '#374151', marginBottom: 12 },
  sigRow:        { flexDirection: 'row', alignItems: 'flex-end' },
  sigLine:       { flex: 1, borderBottomWidth: 1, borderBottomColor: '#374151', height: 20 },
  sigLabel:      { fontSize: 7, color: '#9ca3af', marginLeft: 6 },

  // Footer
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

// ── Document ──────────────────────────────────────────────────────────────────

export function ShiftReportPDF({ data }: { data: PDFReportData }) {
  const offTotal = data.offStandard.reduce((sum, e) => sum + e.minutes, 0);

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

        {/* Off-Standard Time */}
        <View style={s.section}>
          <SectionHead title="OFF-STANDARD TIME" />
          {data.offStandard.length === 0
            ? <Text style={s.noData}>(none)</Text>
            : <>
                {data.offStandard.map((e, i) => (
                  <View key={i} style={e.autoFromTrip ? s.autoRow : s.row}>
                    <Text style={s.timeCol}>{fmtTime(e.startTime)} – {fmtTime(e.stopTime)}</Text>
                    <View style={s.mainCol}>
                      <Text style={s.mainText}>
                        {e.reason}{e.autoFromTrip ? '  [auto]' : ''}
                      </Text>
                      {e.explanation ? <Text style={s.subText}>{e.explanation}</Text> : null}
                    </View>
                    <Text style={s.mainText}>{fmtMinutes(e.minutes)}</Text>
                  </View>
                ))}
                <View style={s.totalRow}>
                  <Text style={s.totalText}>Total: {fmtMinutes(offTotal)}</Text>
                </View>
              </>
          }
        </View>

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
