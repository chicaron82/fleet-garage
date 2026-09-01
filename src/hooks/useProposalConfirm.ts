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
import { addPersonalEvent } from '../lib/addPersonalEvent';
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
  /** Optional (queue only): attach a batch-staged KEY-TAG photo to the car on approve
   *  (if-missing, best-effort — the helper never throws). Absent for the chat card, where
   *  the attach simply no-ops. See ticket-universal-keytag-capture Phase 3. */
  attachKeytagPhotoIfMissing?: ReturnType<typeof useVehicleHoldContext>['attachKeytagPhotoIfMissing'];
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
  const { user, addHold, addVehicle, updateVehicleFields, setCoverPhoto, attachKeytagPhotoIfMissing, addLostFoundItem, effieMemory, onNavigate, setOpen } = deps;
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
      // Event → a dated note in personal_events; My Day surfaces it in "Heads up today" ON the
      // day (lib/eventInsights) and it's simply past afterwards. Distinct from a reminder (next
      // shift, auto-clears) and a memory (durable, undated). The locked write lives in
      // lib/addPersonalEvent — this stays a dispatcher, like every other kind here.
      if (proposal.kind === 'event') {
        const ok = await addPersonalEvent({
          userId: user.id, title: proposal.title, date: proposal.date, time: proposal.time,
        });
        if (!ok) throw new Error('Could not save that date — check connection and try again.');
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
      // Unsend → VOID the row, never DELETE it (migration 135). Every read filters
      // voided_at IS NULL, so from his side it is gone from every manifest and count — which is
      // exactly what he asked for ("I just need to know what was actually sent"). The row itself
      // stays so a mis-tap from a phone in the washbay is recoverable.
      // ⚠️ Scoped by trip id and nothing else. An unscoped or plate-scoped update here would void
      // every send that car ever made.
      if (proposal.kind === 'unsend') {
        const { ok } = await writeOrEnqueue(
          'update',
          { voided_at: new Date().toISOString(), void_reason: proposal.reason ?? null },
          'id',
          proposal.trip.id,
        );
        if (!ok) throw new Error('Could not remove that send — check connection and try again.');
        return;
      }
      // Register-only → add the vehicle to the fleet, NO hold. addVehicle throws on
      // failure, which the card turns into its error state.
      if (proposal.kind === 'register_vehicle') {
        const nv = proposal.newVehicle;
        // For a Tesla, the card captured cable/adapter presence at intake — store them
        // (present by default if a typed "confirm" skipped the toggles). Non-Tesla stays
        // null (unknown), exactly as before.
        const newVehicleId = await addVehicle({
          unitNumber: nv.unitNumber,
          licensePlate: nv.plate,
          make: nv.make,
          model: nv.model,
          year: nv.year,
          color: nv.color,
          // ⚠️ FOUR FIELDS THE PROPOSAL HAS ALWAYS CARRIED AND THIS CALL DROPPED. `rentalClass` was
          // on NewVehicle since the scan-register landed and never made it into addVehicle; the
          // other three joined it 2026-08-30. A car registered from a batch therefore arrived
          // knowing its colour and not its VIN, and queued itself into the key-tag auditor to be
          // hand-typed off the photo FG had just read correctly.
          rentalClass: nv.rentalClass ?? null,
          classCode:   nv.classCode ?? null,
          owningArea:  nv.owningArea ?? null,
          vinLast9:    nv.vinLast9 ?? null,
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
        // Phase 3 (ticket-universal-keytag-capture): a batch-staged register carries its KEY-TAG
        // photo in photosOverride — attach it to the freshly-created car (if-missing, best-effort;
        // the helper never throws, so it can't fail the approve). No-op for the chat card (unwired)
        // or a dropped re-entrant register (no id returned).
        if (newVehicleId && attachKeytagPhotoIfMissing && photosOverride?.[0]) {
          await attachKeytagPhotoIfMissing(newVehicleId, photosOverride[0]);
        }
        return;
      }
      // Backfill — the keytag-scan partial branch. Only ever FILLS (resolveKeytag never
      // proposes a conflicting field), so this is a plain field update, no status change.
      if (proposal.kind === 'update_vehicle') {
        await updateVehicleFields(proposal.vehicleId, proposal.fills);
        // Phase 3 (ticket-universal-keytag-capture): a batch-staged backfill carries its KEY-TAG
        // photo in photosOverride — attach it to the known car (if-missing, best-effort).
        if (attachKeytagPhotoIfMissing && photosOverride?.[0]) {
          await attachKeytagPhotoIfMissing(proposal.vehicleId, photosOverride[0]);
        }
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
          // ⚠️ FOUR FIELDS THE PROPOSAL HAS ALWAYS CARRIED AND THIS CALL DROPPED. `rentalClass` was
          // on NewVehicle since the scan-register landed and never made it into addVehicle; the
          // other three joined it 2026-08-30. A car registered from a batch therefore arrived
          // knowing its colour and not its VIN, and queued itself into the key-tag auditor to be
          // hand-typed off the photo FG had just read correctly.
          rentalClass: nv.rentalClass ?? null,
          classCode:   nv.classCode ?? null,
          owningArea:  nv.owningArea ?? null,
          vinLast9:    nv.vinLast9 ?? null,
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
    [user, addHold, addVehicle, updateVehicleFields, setCoverPhoto, attachKeytagPhotoIfMissing, addLostFoundItem, effieMemory, onNavigate, setOpen],
  );
}
