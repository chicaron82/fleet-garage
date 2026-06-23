import { StyleSheet } from '@react-pdf/renderer';

export const LOGO_SRC = `${window.location.origin}/FG.jpg`;

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
  flipNote:      { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#fffbeb', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 },
  flipNoteText:  { fontSize: 7, color: '#b45309' },

  // Fuel — pump readings
  fuelAlert:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#b91c1c' },

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

export function resolveQueueLabel(raw: string | null): string | null {
  if (raw == null) return null;
  if (typeof (raw as unknown) !== 'string') {
    const obj = raw as unknown as { label?: string };
    if (!obj.label || obj.label === 'Resumed') return null;
    return obj.label === 'TOO_MUCH' ? '10+' : obj.label;
  }
  return raw === 'TOO_MUCH' ? '10+' : raw;
}
