import { useState } from 'react';
import { RepairConfirmSection, type RepairConfirmSectionProps } from './RepairConfirmSection';
import { PanelPicker } from './PanelPicker';
import { usePanelPick } from '../../hooks/usePanelPick';
import { descriptionParts, planPanelRepair, type MarkPanelsRepaired } from '../../lib/panelRepair';
import { orderZones, zoneLabel } from '../../lib/damageZones';
import { hapticMedium } from '../../lib/haptics';
import type { Hold } from '../../types';

// "Which panels got fixed?" — the repair confirm for one hold that sits on two or more panels.
//
// Aaron, 2026-10-21, 0ET075: the windshield chips came back fixed the same day, the rear rim did not,
// and both were on one hold. See lib/panelRepair for the split this drives.
//
// ⭐ EVERY PANEL STARTS TICKED. Most multi-panel holds are ONE damage spread wide — hail across the
// hood, roof and liftgate; low tread on all four — and get fixed all at once. Ticked-by-default keeps
// that the same one tap it always was; only unticking a panel turns this into a part repair.
//
// The chips themselves live in PanelPicker, shared with a multi-type hold's per-issue pick.

interface Props {
  hold: Hold;
  userId: string;
  markPanelsRepaired: MarkPanelsRepaired;
  /** The whole-hold confirm — used untouched when every panel is ticked. */
  confirm: Omit<RepairConfirmSectionProps, 'holds'>;
}

export function PanelRepairSection({ hold, userId, markPanelsRepaired, confirm }: Props) {
  const zones = orderZones(hold.damageZones ?? []);
  const parts = descriptionParts(hold.damageDescription);
  const photos = hold.photos ?? [];
  const picked = usePanelPick(zones);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const plan = planPanelRepair(hold, picked);
  const picker = <PanelPicker title="What got fixed?" zones={zones} photos={photos} parts={parts} picked={picked} split={plan.kind === 'split'} />;

  if (plan.kind === 'whole') {
    return <RepairConfirmSection holds={[hold]} {...confirm}>{picker}</RepairConfirmSection>;
  }

  const confirmSplit = async () => {
    setBusy(true);
    setError(false);
    try {
      await markPanelsRepaired(hold.id, plan.fixed, plan.standing, {
        repairedById: userId, repairedAt: new Date().toISOString(),
        notes: confirm.repairNotes.trim(), outcome: confirm.repairOutcome,
      });
      hapticMedium();
      confirm.onCancel();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const names = (ids: string[]) => ids.map(zoneLabel).join(', ');
  return (
    <RepairConfirmSection
      holds={[hold]}
      {...confirm}
      repairing={busy}
      error={error}
      onConfirm={confirmSplit}
      actionLabel={`Mark ${plan.fixed.zones.length} of ${zones.length} as Repaired`}
      summary={<>Marks <strong>{names(plan.fixed.zones)}</strong> repaired. <strong>{names(plan.standing.zones)}</strong> stays on this hold, so the car's status doesn't change.</>}
    >
      {picker}
    </RepairConfirmSection>
  );
}
