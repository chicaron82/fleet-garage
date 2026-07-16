// The single write path for an AI-drafted proposal. Effie's proxy (api/fg-chat.ts)
// NEVER writes — it only drafts a Proposal; the user's Confirm tap on the card is
// what turns it into the real mutation. This hook owns that per-kind write dispatch
// (navigate / lost_item / memory / reminder / register_and_hold / hold), lifted out
// of FgAssistantFab so the component stays a surface and the growing logic has one
// tested home. Deps are passed in (not re-read from context) so shared instances —
// the auth user, the effie-memory store — stay single across the component.
import { useCallback } from 'react';
import { addWhiteboardReminder } from '../lib/addWhiteboardReminder';
import { buildOverflowTrip } from '../lib/overflowTrip';
import { writeOrEnqueue } from '../lib/vsaTripWrite';
import type { useAuth } from '../context/AuthContext';
import type { useVehicleHoldContext } from '../context/VehicleHoldContext';
import type { useLostFoundContext } from '../context/LostFoundContext';
import type { useEffieMemory } from './useEffieMemory';
import type { Proposal, RegisterAssetChoice } from '../../api/_lib/holdProposal';
import type { NavDestination } from '../../api/_lib/navProposal';
import type { HoldType, Screen } from '../types';

/** Map a navigate proposal's destination to a real app Screen (flagship: the importer). */
function navDestinationToScreen(dest: NavDestination): Screen {
  switch (dest) {
    case 'schedule-import': return { name: 'schedule', openImport: true };
    case 'lost-found': return { name: 'lost-and-found' };
    case 'issue-log': return { name: 'issue-log' };
    case 'my-shift': return { name: 'my-shift' };
    case 'movement-log': return { name: 'movement-log' };
  }
}

interface ProposalConfirmDeps {
  user: ReturnType<typeof useAuth>['user'];
  addHold: ReturnType<typeof useVehicleHoldContext>['addHold'];
  addVehicle: ReturnType<typeof useVehicleHoldContext>['addVehicle'];
  updateVehicleFields: ReturnType<typeof useVehicleHoldContext>['updateVehicleFields'];
  setCoverPhoto: ReturnType<typeof useVehicleHoldContext>['setCoverPhoto'];
  addLostFoundItem: ReturnType<typeof useLostFoundContext>['addLostFoundItem'];
  effieMemory: Pick<ReturnType<typeof useEffieMemory>, 'add'>;
  onNavigate?: (screen: Screen) => void;
  setOpen: (open: boolean) => void;
}

/**
 * Returns the confirm handler for a drafted proposal → the REAL writes happen here
 * (the proxy never wrote; this tap is the only write path). 'hold' → addHold on the
 * existing vehicle; 'register_and_hold' → addVehicle (defaults to HELD) then addHold
 * on the new id. Both reuse the battle-tested mutations (status flip, mgmt ntfy,
 * dedup) for free. Throws on failure so the card surfaces its error state.
 */
export function useProposalConfirm(deps: ProposalConfirmDeps) {
  const { user, addHold, addVehicle, updateVehicleFields, setCoverPhoto, addLostFoundItem, effieMemory, onNavigate, setOpen } = deps;
  return useCallback(
    async (proposal: Proposal, extra?: RegisterAssetChoice, photosOverride?: string[]) => {
      // Navigate offer → just change screens + close the panel (no write, no user needed).
      if (proposal.kind === 'navigate') {
        onNavigate?.(navDestinationToScreen(proposal.destination));
        setOpen(false);
        return;
      }
      if (!user) throw new Error('Not signed in.');
      // Lost & found log → the existing addLostFoundItem (resolves plate, stamps
      // found_by/found_at, status 'holding'). It returns false (not throw) on failure,
      // so convert that to a throw for the card's error state.
      if (proposal.kind === 'lost_item') {
        const ok = await addLostFoundItem({
          description: proposal.description,
          location: proposal.location ?? undefined,
          licensePlate: proposal.licensePlate ?? undefined,
          notes: proposal.notes ?? undefined,
        });
        if (!ok) throw new Error('Could not log the item — check connection and try again.');
        return;
      }
      // Memory — the only write path for an AI-drafted memory: save on the tap.
      if (proposal.kind === 'memory') {
        const ok = await effieMemory.add(proposal.content);
        if (!ok) throw new Error('Could not save that memory — check connection and try again.');
        return;
      }
      // Reminder → a shift_board whiteboard note filed under the user's NEXT shift, so it
      // surfaces on My Shift then and auto-clears the shift after (addWhiteboardReminder).
      if (proposal.kind === 'reminder') {
        const ok = await addWhiteboardReminder({
          body: proposal.text,
          branchId: user.branchId,
          user: { id: user.id, name: user.name, role: user.role },
        });
        if (!ok) throw new Error('Could not leave that reminder — check connection and try again.');
        return;
      }
      // Overflow log → one completed one-way vsa_trips row per vehicle, stamped with the
      // real destination. writeOrEnqueue falls back to the offline queue on network loss,
      // so a bad connection queues rather than fails; a real DB error throws to the card.
      if (proposal.kind === 'overflow_log') {
        const nowMs = Date.now();
        let allOk = true;
        for (let i = 0; i < proposal.vehicles.length; i++) {
          const payload = buildOverflowTrip(proposal.vehicles[i], proposal.destination, user.id, user.branchId, nowMs, i);
          const { ok } = await writeOrEnqueue('insert', payload);
          if (!ok) allOk = false;
        }
        if (!allOk) throw new Error('Could not log all those sends — check connection and try again.');
        return;
      }
      // Register-only → add the vehicle to the fleet, NO hold. addVehicle throws on
      // failure, which the card turns into its error state.
      if (proposal.kind === 'register_vehicle') {
        const nv = proposal.newVehicle;
        // For a Tesla, the card captured cable/adapter presence at intake — store them
        // (present by default if a typed "confirm" skipped the toggles). Non-Tesla stays
        // null (unknown), exactly as before.
        await addVehicle({
          unitNumber: nv.unitNumber,
          licensePlate: nv.plate,
          make: nv.make,
          model: nv.model,
          year: nv.year,
          color: nv.color,
          branchId: user.branchId,
          isTesla: proposal.isTesla,
          hasMobileCable: proposal.isTesla ? (extra?.cable ?? true) : null,
          hasJ1772Adapter: proposal.isTesla ? (extra?.adapter ?? true) : null,
          // No hold is added here, so override addVehicle's HELD default — a clean
          // new-to-fleet car is CLEAR, not falsely held (matches RegisterVehicleForm's
          // returnTo:'fleet' path). Without this it shows "Held" until the detail
          // view's syncVehicleStatus heals it.
          status: 'CLEAR',
        });
        return;
      }
      // Backfill — the keytag-scan partial branch. Only ever FILLS (resolveKeytag never
      // proposes a conflicting field), so this is a plain field update, no status change.
      if (proposal.kind === 'update_vehicle') {
        await updateVehicleFields(proposal.vehicleId, proposal.fills);
        return;
      }
      const holdTypes: HoldType[] = [proposal.holdType as HoldType];
      // Save the photo(s) the user attached in this conversation onto the hold. The
      // proxy only *analysed* them for the AI draft; this confirm is the only write
      // path, so without this the damage photo never lands on the record. addHold
      // uploads them and returns their URLs; auto-pin the first as the vehicle cover
      // so it shows as the holds-list thumbnail ("one photo → pin it").
      // Callers ALWAYS pass the scoped photos: chat via photosForProposal (the damage
      // turn only — never the whole conversation), the queue via what it captured at
      // stage time. No conversation-wide flatMap here — that swept up keytag photos onto
      // holds (docs/bug-misc-effie-hold-attaches-all-photos.md).
      const photos = photosOverride ?? [];
      const attach = photos.length > 0 ? photos : undefined;
      if (proposal.kind === 'register_and_hold') {
        const nv = proposal.newVehicle;
        const vehicleId = await addVehicle({
          unitNumber: nv.unitNumber,
          licensePlate: nv.plate,
          make: nv.make,
          model: nv.model,
          year: nv.year,
          color: nv.color,
          branchId: user.branchId,
          isTesla: nv.make === 'Tesla',
          hasMobileCable: null,
          hasJ1772Adapter: null,
        });
        // Dropped re-entrant confirm (same plate in flight) — the first confirm owns the hold.
        if (!vehicleId) return;
        // Attach + pin the scoped damage photo — SAME as the plain-hold path. (This used to
        // hardcode `undefined` on the assumption the chat image was a KEY TAG only there to
        // read the vehicle's details. That held when register_and_hold came from a keytag
        // registration; the log-damage DROP-N-GO inverted it — the scoped photo IS the damage
        // evidence. photosForProposal already excludes an earlier keytag turn, so `attach`
        // here is the damage the user dropped.) flaggedSource 'effie' → "· via Effie".
        const held = await addHold(vehicleId, proposal.damageDescription, '', user.id, attach, holdTypes, undefined, undefined, undefined, 'effie');
        if (held && held.photoUrls.length > 0) await setCoverPhoto(vehicleId, held.photoUrls[0]);
        return;
      }
      // Partial vehicle + damage → backfill the blanks first (blanks-only, same contract as
      // update_vehicle — resolveKeytag never proposes a conflicting field), then hold the SAME
      // vehicle with the damage photo attached + pinned, exactly like the plain-hold path.
      if (proposal.kind === 'update_and_hold') {
        if (proposal.fills.length > 0) await updateVehicleFields(proposal.vehicleId, proposal.fills);
        const held = await addHold(proposal.vehicleId, proposal.damageDescription, '', user.id, attach, holdTypes, undefined, undefined, undefined, 'effie');
        if (held && held.photoUrls.length > 0) await setCoverPhoto(proposal.vehicleId, held.photoUrls[0]);
        return;
      }
      const result = await addHold(proposal.vehicle.vehicleId, proposal.damageDescription, '', user.id, attach, holdTypes, undefined, undefined, undefined, 'effie');
      if (result && result.photoUrls.length > 0) await setCoverPhoto(proposal.vehicle.vehicleId, result.photoUrls[0]);
    },
    [user, addHold, addVehicle, updateVehicleFields, setCoverPhoto, addLostFoundItem, effieMemory, onNavigate, setOpen],
  );
}
