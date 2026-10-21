import { RepairConfirmSection } from './RepairConfirmSection';
import { projectRepair } from '../../lib/repairChains';
import type { RepairConfirmSectionProps } from './RepairConfirmSection';
import { IssueResolutionSection } from './IssueResolutionSection';
import { PanelRepairSection } from './PanelRepairSection';
import { offersPanelPick, type PanelSide } from '../../lib/panelRepair';
import type { Hold, HoldType, Repair } from '../../types';

interface RepairResolutionProps {
  confirmHolds: Hold[];
  /** Every hold on the car, so the confirm can say where the repair leaves it. */
  vehicleHolds: Hold[];
  userId: string;
  markIssueRepaired: (holdId: string, type: HoldType, repair?: Omit<Repair, 'id'>) => Promise<void>;
  markPanelsRepaired: (holdId: string, fixed: PanelSide, standing: PanelSide, repair: Omit<Repair, 'id' | 'holdId'>) => Promise<void>;
  /** The whole-hold / batch confirm controls (forwarded to RepairConfirmSection). */
  confirm: Omit<RepairConfirmSectionProps, 'holds'>;
}

/** Routes the repair affordance: a single multi-type hold → the per-issue
 *  checklist; a single one-type hold on 2+ panels → "what got fixed?" (a part
 *  repair splits it, 2026-10-21); anything else or a multi-hold batch → the
 *  whole-hold confirm (unchanged). Keeps the branching out of VehicleHistory (at the cap). */
export function RepairResolution({ confirmHolds, vehicleHolds, userId, markIssueRepaired, markPanelsRepaired, confirm }: RepairResolutionProps) {
  if (confirmHolds.length === 0) return null;
  const landing = projectRepair(confirmHolds.map(h => h.id), vehicleHolds);
  if (confirmHolds.length === 1 && confirmHolds[0].holdTypes.length > 1) {
    return (
      <IssueResolutionSection
        hold={confirmHolds[0]}
        landing={landing}
        userId={userId}
        markIssueRepaired={markIssueRepaired}
        onDone={confirm.onCancel}
      />
    );
  }
  if (confirmHolds.length === 1 && offersPanelPick(confirmHolds[0])) {
    return (
      <PanelRepairSection hold={confirmHolds[0]} userId={userId}
        markPanelsRepaired={markPanelsRepaired} confirm={{ ...confirm, landing }} />
    );
  }
  return <RepairConfirmSection holds={confirmHolds} landing={landing} {...confirm} />;
}
