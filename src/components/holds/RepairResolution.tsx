import { RepairConfirmSection } from './RepairConfirmSection';
import type { RepairConfirmSectionProps } from './RepairConfirmSection';
import { IssueResolutionSection } from './IssueResolutionSection';
import type { Hold, HoldType, Repair } from '../../types';

interface RepairResolutionProps {
  confirmHolds: Hold[];
  userId: string;
  markIssueRepaired: (holdId: string, type: HoldType, repair?: Omit<Repair, 'id'>) => Promise<void>;
  /** The whole-hold / batch confirm controls (forwarded to RepairConfirmSection). */
  confirm: Omit<RepairConfirmSectionProps, 'holds'>;
}

/** Routes the repair affordance: a single multi-type hold → the per-issue
 *  checklist; a single-type hold or a multi-hold batch → the whole-hold confirm
 *  (unchanged). Keeps the multi-type branching out of VehicleHistory (at the cap). */
export function RepairResolution({ confirmHolds, userId, markIssueRepaired, confirm }: RepairResolutionProps) {
  if (confirmHolds.length === 0) return null;
  if (confirmHolds.length === 1 && confirmHolds[0].holdTypes.length > 1) {
    return (
      <IssueResolutionSection
        hold={confirmHolds[0]}
        userId={userId}
        markIssueRepaired={markIssueRepaired}
        onDone={confirm.onCancel}
      />
    );
  }
  return <RepairConfirmSection holds={confirmHolds} {...confirm} />;
}
