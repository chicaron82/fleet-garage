import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { ptoTaken } from '../../lib/ptoRequest';

const LOGO_SRC = `${window.location.origin}/FG.jpg`;

export interface PtoPDFData {
  userName:     string;
  employeeId:   string;
  dateLabel:    string;   // when the request was generated
  days:         string[]; // ISO dates being requested (pending approval)
  approvedDays: string[]; // upcoming ISO dates already approved — shown for the full picture
  entitlement:  number;
  used:         number;
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const s = StyleSheet.create({
  page:          { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#ffffff' },
  header:        { backgroundColor: '#111827', borderRadius: 5, padding: 16, marginBottom: 22 },
  logo:          { width: 32, height: 32, marginBottom: 8 },
  headerTitle:   { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 12 },
  headerGrid:    { flexDirection: 'row' },
  headerCol:     { flex: 1 },
  headerLabel:   { fontSize: 7, color: '#9ca3af', marginBottom: 2 },
  headerValue:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 8 },
  section:       { marginBottom: 18 },
  sectionHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  accentBar:     { width: 3, height: 12, backgroundColor: '#7c3aed', borderRadius: 1, marginRight: 7 },
  accentApproved:{ backgroundColor: '#059669' },
  sectionTitle:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151' },
  noData:        { fontSize: 8, color: '#9ca3af', fontStyle: 'italic', paddingLeft: 10, paddingBottom: 4 },
  row:           { paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  rowText:       { fontSize: 9, color: '#111827' },
  totalRow:      { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 5 },
  totalText:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151' },
  approval:      { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  approvalLabel: { fontSize: 8, color: '#374151', marginBottom: 12 },
  sigRow:        { flexDirection: 'row', alignItems: 'flex-end' },
  sigLine:       { flex: 1, borderBottomWidth: 1, borderBottomColor: '#374151', height: 20 },
  sigLabel:      { fontSize: 7, color: '#9ca3af', marginLeft: 6 },
  footer:        { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:    { fontSize: 7, color: '#9ca3af' },
});

export function PtoRequestPDF({ data }: { data: PtoPDFData }) {
  const taken = ptoTaken(data.used, data.days.length, data.approvedDays.length);
  const remaining = Math.max(0, data.entitlement - taken);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Image src={LOGO_SRC} style={s.logo} />
          <Text style={s.headerTitle}>PTO REQUEST</Text>
          <View style={s.headerGrid}>
            <View style={s.headerCol}>
              <Text style={s.headerLabel}>NAME</Text>
              <Text style={s.headerValue}>{data.userName}</Text>
              <Text style={s.headerLabel}>EEID</Text>
              <Text style={s.headerValue}>{data.employeeId}</Text>
            </View>
            <View style={s.headerCol}>
              <Text style={s.headerLabel}>SUBMITTED</Text>
              <Text style={s.headerValue}>{data.dateLabel}</Text>
              <Text style={s.headerLabel}>BALANCE</Text>
              <Text style={s.headerValue}>{taken} / {data.entitlement} used · {remaining} left</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <SectionHead title={`REQUESTED DAYS (${data.days.length})`} />
          {data.days.length === 0
            ? <Text style={s.noData}>(none)</Text>
            : <>
                {data.days.map((d, i) => (
                  <View key={i} style={s.row}>
                    <Text style={s.rowText}>{fmtDay(d)}</Text>
                  </View>
                ))}
                <View style={s.totalRow}>
                  <Text style={s.totalText}>{data.days.length} day{data.days.length !== 1 ? 's' : ''} requested</Text>
                </View>
              </>
          }
        </View>

        {data.approvedDays.length > 0 && (
          <View style={s.section}>
            <SectionHead title={`ALREADY APPROVED (${data.approvedDays.length})`} accent={s.accentApproved} />
            {data.approvedDays.map((d, i) => (
              <View key={i} style={s.row}>
                <Text style={s.rowText}>{fmtDay(d)}</Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={s.totalText}>{data.approvedDays.length} day{data.approvedDays.length !== 1 ? 's' : ''} already approved</Text>
            </View>
          </View>
        )}

        <View style={s.approval}>
          <Text style={s.approvalLabel}>Manager approval</Text>
          <View style={s.sigRow}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Signature / date</Text>
          </View>
        </View>

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

function SectionHead({ title, accent }: { title: string; accent?: (typeof s)[keyof typeof s] }) {
  return (
    <View style={s.sectionHead}>
      <View style={accent ? [s.accentBar, accent] : s.accentBar} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}
