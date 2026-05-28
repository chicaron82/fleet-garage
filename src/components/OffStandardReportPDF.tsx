import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { fmtTime, fmtMinutes } from '../lib/offStandardReport';

const LOGO_SRC = `${window.location.origin}/FG.jpg`;

export interface OTHPDFData {
  userName:    string;
  employeeId:  string;
  dateLabel:   string;
  shiftLine:   string;
  entries:     { startTime: string; stopTime: string; minutes: number; reason: string; explanation?: string; autoFromTrip: boolean }[];
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
  accentBar:     { width: 3, height: 12, backgroundColor: '#f59e0b', borderRadius: 1, marginRight: 7 },
  sectionTitle:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151' },
  noData:        { fontSize: 8, color: '#9ca3af', fontStyle: 'italic', paddingLeft: 10, paddingBottom: 4 },

  row:           { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  autoRow:       { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  timeCol:       { width: 100, fontSize: 8, color: '#6b7280' },
  mainCol:       { flex: 1 },
  mainText:      { fontSize: 8, color: '#111827' },
  subText:       { fontSize: 7, color: '#6b7280', marginTop: 1 },
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

function SectionHead({ title }: { title: string }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.accentBar} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

export function OffStandardReportPDF({ data }: { data: OTHPDFData }) {
  const offTotal = data.entries.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Image src={LOGO_SRC} style={s.logo} />
          <Text style={s.headerTitle}>OFF-STANDARD TIME REPORT</Text>
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

        <View style={s.section}>
          <SectionHead title="OFF-STANDARD ENTRIES" />
          {data.entries.length === 0
            ? <Text style={s.noData}>(none)</Text>
            : <>
                {data.entries.map((e, i) => (
                  <View key={i} style={e.autoFromTrip ? s.autoRow : s.row}>
                    <Text style={s.timeCol}>{fmtTime(e.startTime)} – {fmtTime(e.stopTime)}</Text>
                    <View style={s.mainCol}>
                      <Text style={s.mainText}>{e.reason}{e.autoFromTrip ? '  [auto]' : ''}</Text>
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
