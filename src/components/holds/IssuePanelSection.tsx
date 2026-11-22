import { useState } from 'react';
import { RepairConfirmSection } from './RepairConfirmSection';
import { PanelPicker } from './PanelPicker';
import { usePanelPick } from '../../hooks/usePanelPick';
import { descriptionParts, planIssuePanels, type IssuePanelAsk, type MarkPanelsRepaired } from '../../lib/panelRepair';
import { orderZones, zoneLabel } from '../../lib/damageZones';
import { HOLD_TYPE_LABELS } from '../../lib/holdTypeLabels';
import { hapticMedium } from '../../lib/haptics';
import type { Hold, HoldType, Repair, RepairOutcome } from '../../types';
import type { RepairLanding } from '../../lib/repairChains';

// "What did the hail repair clear?" — marking ONE issue of a multi-type hold done, when the hold sits on two
// or more panels. Aaron, 2026-11-21, LJF720: *"if it was hail, then the damage map for hail should be cleared
// once marked repair. if i marked chip repaired, then the windshield would be cleared."* The rules are in
// lib/panelRepair (issuePanelPick / planIssuePanels); the split is context/panelRepair's, typed to this issue.

interface Props {
  hold: Hold;
  type: HoldType;
  ask: IssuePanelAsk;
  /** Where a whole repair of the last issue leaves the car. */
  landing?: RepairLanding;
  userId: string;
  markIssueRepaired: (holdId: string, type: HoldType, repair?: Omit<Repair, 'id'>) => Promise<void>;
  markPanelsRepaired: MarkPanelsRepaired;
  /** Back to the checklist: Cancel, or an issue done with others still open. */
  onBack: () => void;
  /** The hold is finished with: the last issue saved. */
  onDone: () => void;
}

export function IssuePanelSection({ hold, type, ask, landing, userId, markIssueRepaired, markPanelsRepaired, onBack, onDone }: Props) {
  const zones = orderZones(hold.damageZones ?? []);
  const picked = usePanelPick(ask.preset);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<RepairOutcome>('clean');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const plan = planIssuePanels(hold, picked, ask.last);
  const label = HOLD_TYPE_LABELS[type];
  const others = hold.holdTypes.filter(t => t !== type && !hold.resolvedTypes.includes(t)).map(t => HOLD_TYPE_LABELS[t]).join(' and ');
  const names = (ids: readonly string[]) => ids.map(zoneLabel).join(', ');

  const save = async (write: () => Promise<void>, after: () => void) => {
    setBusy(true);
    setError(false);
    try {
      await write();
      hapticMedium();
      after();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const repair = { repairedById: userId, repairedAt: new Date().toISOString(), notes: notes.trim(), outcome };

  const onConfirm = () => {
    if (plan.kind === 'blocked') return;
    if (plan.kind === 'resolve') return save(() => markIssueRepaired(hold.id, type), onBack);
    if (plan.kind === 'whole') return save(() => markIssueRepaired(hold.id, type, { holdId: hold.id, ...repair }), onDone);
    return save(() => markPanelsRepaired(hold.id, plan.fixed, plan.standing, repair, { type, resolves: !ask.last }),
      ask.last ? onDone : onBack);
  };

  // The confirm reads the fixed side, so the windshield outcome only shows when the windshield is a panel that got
  // fixed. Its words can't decide it here: "Hail damage; Windshield chip" names the glass on a hail-only repair.
  const fixedView: Hold = plan.kind === 'split'
    ? { ...hold, holdTypes: [type], damageZones: plan.fixed.zones,
        damageDescription: plan.fixed.zones.includes('windshield') ? plan.fixed.description : '' }
    : hold;

  const summary =
    plan.kind === 'resolve' ? <>Marks <strong>{label}</strong> done. Every panel stays on this hold for {others}.</>
    : plan.kind === 'blocked' ? <><strong>{others}</strong> is still open, so a panel has to stay on this hold. Untick the one it's on.</>
    : plan.kind === 'split' && !ask.last ? <>Marks <strong>{label}</strong> done and clears <strong>{names(plan.fixed.zones)}</strong> off the map. <strong>{names(plan.standing.zones)}</strong> stays on this hold for {others}, so the car's status doesn't change.</>
    : plan.kind === 'split' ? <>Marks <strong>{names(plan.fixed.zones)}</strong> repaired. <strong>{names(plan.standing.zones)}</strong> stays on this hold, so the car's status doesn't change.</>
    : undefined;

  const actionLabel = plan.kind === 'whole' ? undefined
    : plan.kind === 'split' && ask.last ? `Mark ${plan.fixed.zones.length} of ${zones.length} as Repaired`
    : `Mark ${label} done`;

  return (
    <RepairConfirmSection
      holds={[fixedView]}
      landing={plan.kind === 'whole' ? landing : undefined}
      repairNotes={notes} setRepairNotes={setNotes}
      repairOutcome={outcome} setRepairOutcome={setOutcome}
      repairing={busy} error={error}
      onCancel={onBack} onConfirm={onConfirm}
      summary={summary} actionLabel={actionLabel}
      bare={plan.kind === 'resolve' || plan.kind === 'blocked'}
      confirmDisabled={plan.kind === 'blocked'}
    >
      <PanelPicker
        title={ask.last ? 'What got fixed?' : `What did the ${label.toLowerCase()} repair clear?`}
        zones={zones} photos={hold.photos ?? []} parts={descriptionParts(hold.damageDescription)}
        picked={picked} split={plan.kind === 'split'}
      />
    </RepairConfirmSection>
  );
}
