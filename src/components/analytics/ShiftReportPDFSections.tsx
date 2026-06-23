// Pure PDF section renderers for ShiftReportPDF.
// Exception to the 330-line cap: pure renderer with many cases (see CLAUDE.md).
import { View, Text, Image, Link } from '@react-pdf/renderer';
import { fmtTime, fmtMinutes, type ReportData, type ReportThroughput } from '../../lib/buildShiftReport';
import { LOGO_SRC, s, resolveQueueLabel } from './ShiftReportPDFUtils';
import { holdTypeLabel } from '../../lib/holdTypeLabels';
import { EXPECTED_PUMP2 } from '../../lib/fuelReadings';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return types.map(holdTypeLabel).join(' & ') + ' hold';
}

function formatLocation(loc: string): string {
  return loc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtRate(n: number): string { return n.toFixed(1) + '/hr'; }


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

export function ThroughputSection({ t, fb, offTotal, branchRate, shiftRate, windowCleaned, personalRate, airportFlipping }: {
  t: ReportThroughput;
  fb: ReportData['fleetBalance'];
  offTotal: number;
  branchRate: number | null;
  shiftRate: number | null;
  windowCleaned: number | null;
  personalRate: number | null;
  airportFlipping: boolean;
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
            {t.actualWindowLabel ?? (t.shiftType === 'opening' ? '06:45–15:15'
              : t.shiftType === 'mid'
                ? (t.midShiftHours != null ? `${t.midShiftHours.toFixed(1)}h window` : 'variable window')
                : '13:30–22:00')}
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
            <Text style={s.tpSub}>of {fb.isProjected ? '~' : ''}{fb.outCount} needed{fb.isProjected ? ' (est.)' : ''}</Text>
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
          Personal rate{offTotal > 0 ? `  (effort-adjusted for ${fmtMinutes(offTotal)} off-standard)` : ''}
        </Text>
        {personalRate != null
          ? <Text style={s.rateValueGreen}>{fmtRate(personalRate)}</Text>
          : <Text style={s.rateNoOth}>Log off-standard time to see your personal rate</Text>
        }
      </View>
      {airportFlipping && (
        <View style={s.flipNote}>
          <Text style={s.flipNoteText}>Flipping returns — bay count excludes cars turned around at the airport</Text>
        </View>
      )}
      {t.queueAtClose != null ? (
        <View style={s.lotPill}>
          <Text style={s.lotPillText}>
            {t.queueAtClose === 0
              ? 'In queue at close: 0 (zeroed)'
              : `In queue at close: ${t.queueAtClose} vehicle${t.queueAtClose !== 1 ? 's' : ''}`}
          </Text>
        </View>
      ) : t.lotStatus ? (
        <View style={s.lotPill}>
          <Text style={s.lotPillText}>
            Lot status at handoff: {t.lotStatus.charAt(0).toUpperCase() + t.lotStatus.slice(1)}
          </Text>
        </View>
      ) : null}
      {t.carryOver > 0 && (
        <View style={s.lotPill}>
          <Text style={s.lotPillText}>
            Carry-over from previous shift: {t.carryOver} vehicle{t.carryOver !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

export function FuelSection({ fuel }: { fuel: NonNullable<ReportData['fuel']> }) {
  const n = (v: number) => v.toLocaleString('en-CA');
  const net = fuel.digitalNet ?? 0;
  const dir = net > 0 ? `${n(Math.abs(net))} L up` : net < 0 ? `${n(Math.abs(net))} L down` : 'no change';
  return (
    <View style={s.section}>
      <SectionHead title="FUEL — PUMP READINGS" />
      {fuel.pump1Open != null && fuel.pump1Close != null && (
        <View style={s.rateRow}>
          <Text style={s.rateLabel}>Pump 1</Text>
          <Text style={s.rateValue}>{n(fuel.pump1Open)} – {n(fuel.pump1Close)}{fuel.pump1Pumped != null ? `  ·  ${n(fuel.pump1Pumped)} L pumped` : ''}</Text>
        </View>
      )}
      {fuel.pump2Reading != null && (
        <View style={s.rateRow}>
          <Text style={s.rateLabel}>Pump 2 (locked)</Text>
          {fuel.pump2 === 'used' ? (
            <Text style={s.fuelAlert}>{n(fuel.pump2Reading)} — above {EXPECTED_PUMP2}. Fuel theft, flag immediately.</Text>
          ) : fuel.pump2 === 'fault' ? (
            <Text style={s.fuelAlert}>{n(fuel.pump2Reading)} — below {EXPECTED_PUMP2}. Meter fault / misread.</Text>
          ) : (
            <Text style={s.rateValue}>{n(fuel.pump2Reading)}  ·  untouched</Text>
          )}
        </View>
      )}
      {fuel.digitalOpen != null && fuel.digitalClose != null && (
        <View style={s.rateRow}>
          <Text style={s.rateLabel}>Digital tank</Text>
          <Text style={s.rateValue}>{n(fuel.digitalOpen)} – {n(fuel.digitalClose)}  ·  {dir}</Text>
        </View>
      )}
      {net > 0 && fuel.topupNote ? <Text style={s.subText}>Top-up: {fuel.topupNote}</Text> : null}
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
            {peakCount} trip(s) departed with washbay queue at 10+ — VSA coverage pulled during peak window
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
            {(h.photos ?? []).length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                {(h.photos ?? []).map((url, pi) => (
                  <Link key={pi} src={url} style={{ textDecoration: 'none' }}>
                    <Text style={{ fontSize: 9, color: '#92400e', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
                      Photo {pi + 1}
                    </Text>
                  </Link>
                ))}
              </View>
            )}
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
