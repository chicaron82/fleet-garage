// The three action panels the vehicle screen reveals — release, verbal override, repair confirm.
// Extracted from VehicleHistory when wrapping each in RevealPanel pushed that file past the
// 330-line cap: thin parent, section module, per CLAUDE.md's orchestrator pattern.
//
// Each is wrapped in RevealPanel so it scrolls itself into view on reveal — the buttons that open
// them sit in the action card at the top of the screen, so on a phone they'd otherwise open below
// the fold and the tap would read as a no-op.
import { ReleaseForm } from './ReleaseForm';
import { VerbalOverrideForm } from './VerbalOverrideForm';
import { RepairResolution } from './RepairResolution';
import { RevealPanel } from './RevealPanel';
import type { useVehicleHistory } from '../../hooks/useVehicleHistory';

interface Props {
  h: ReturnType<typeof useVehicleHistory>;
  vehicleId: string;
  streak: number;
}

export function HoldActionPanels({ h, vehicleId, streak }: Props) {
  return (
    <>
      {h.showReleaseForm && (
        <RevealPanel>
          <ReleaseForm
            holdId={h.showReleaseForm}
            vehicleId={vehicleId}
            onClose={h.closeReleaseForm}
            streak={streak}
          />
        </RevealPanel>
      )}

      {h.showVerbalOverride && (
        <RevealPanel>
          <VerbalOverrideForm
            holdId={h.showVerbalOverride}
            onClose={h.closeVerbalOverride}
          />
        </RevealPanel>
      )}

      {h.showRepairConfirm && (
        <RevealPanel>
          <RepairResolution
            confirmHolds={h.holds.filter(hold => h.showRepairConfirm!.includes(hold.id))}
            userId={h.user.id}
            markIssueRepaired={h.markIssueRepaired}
            confirm={{
              repairNotes: h.repairNotes,
              setRepairNotes: h.setRepairNotes,
              repairOutcome: h.repairOutcome,
              setRepairOutcome: h.setRepairOutcome,
              repairing: h.repairing,
              error: h.repairError,
              onCancel: h.cancelRepair,
              onConfirm: h.handleRepair,
            }}
          />
        </RevealPanel>
      )}
    </>
  );
}
