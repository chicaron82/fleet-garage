import { Document, Page } from '@react-pdf/renderer';
import { type ReportData } from '../../lib/buildShiftReport';
import {
  s, resolveQueueLabel,
  ShiftReportHeader, FleetDemandSection, ThroughputSection,
  OthSection, QueueSection, HoldsSection, CheckInsSection,
  LostFoundSection, AuditsSection, IssuesSection,
  ApprovalSection, ReportFooter,
} from './ShiftReportPDFSections';

export function ShiftReportPDF({ data }: { data: ReportData }) {
  const fb = data.fleetBalance;
  const gap = fb ? fb.inCount - fb.outCount : 0;

  const offTotal   = data.offStandard.reduce((s, e) => s + e.minutes, 0);
  const manualOth  = data.offStandard.filter(e => !e.autoFromTrip && e.reason === 'OTH').reduce((s, e) => s + e.minutes, 0);
  const wfw        = data.offStandard.filter(e => e.reason === 'WFW').reduce((s, e) => s + e.minutes, 0);
  const autoLogged = data.offStandard.filter(e => e.autoFromTrip).reduce((s, e) => s + e.minutes, 0);
  const interrupts = data.trips.filter(t => t.isVsaInterruption).length;

  const t = data.throughput;
  const branchRate    = t?.fullDayCleaned != null && t.branchOpHours > 0 ? t.fullDayCleaned / t.branchOpHours : null;
  const shiftRate     = t?.shiftType === 'closing' && t.closingCleaned != null ? t.closingCleaned / 8 : null;
  const windowCleaned = t ? (t.shiftType === 'opening' ? t.openingCleaned : t.shiftType === 'mid' ? t.midCleaned : t.closingCleaned) : null;
  const windowHours   = t?.shiftType === 'mid' ? (t.midShiftHours ?? null) : 8;
  const personalRate  = windowCleaned != null && windowHours != null && offTotal > 0
    ? windowCleaned / Math.max(0.1, windowHours - offTotal / 60)
    : null;

  const tripsWithQueue = data.trips.filter(tr => resolveQueueLabel(tr.queueAtDeparture) !== null);
  const peakCount      = tripsWithQueue.filter(tr => resolveQueueLabel(tr.queueAtDeparture) === '10+').length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <ShiftReportHeader
          userName={data.userName} employeeId={data.employeeId}
          dateLabel={data.dateLabel} shiftLine={data.shiftLine}
        />
        {fb && (
          <FleetDemandSection fb={fb} gap={gap} fullDayCleaned={t?.fullDayCleaned ?? null} />
        )}
        {t && (
          <ThroughputSection
            t={t} fb={fb} offTotal={offTotal}
            branchRate={branchRate} shiftRate={shiftRate}
            windowCleaned={windowCleaned} windowHours={windowHours} personalRate={personalRate}
          />
        )}
        <OthSection
          offStandard={data.offStandard} offTotal={offTotal}
          manualOth={manualOth} wfw={wfw} autoLogged={autoLogged}
          tripCount={data.trips.length} interrupts={interrupts}
        />
        <QueueSection tripsWithQueue={tripsWithQueue} peakCount={peakCount} />
        <HoldsSection holds={data.holds} />
        <CheckInsSection checkIns={data.checkIns} />
        <LostFoundSection lostFound={data.lostFound} />
        <AuditsSection audits={data.audits} />
        <IssuesSection issues={data.issues} />
        <ApprovalSection />
        <ReportFooter />
      </Page>
    </Document>
  );
}
