import { supabase, writeWithRefresh } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import type { PanelSide, IssueSplit } from '../lib/panelRepair';
import type { Hold, HoldType, Repair } from '../types';

// The write behind a part repair — see lib/panelRepair for why a part repair is a SPLIT. Its own file
// because holdResolution is past the line cap.
//
// ⭐ THE VEHICLE IS NOT TOUCHED. The original hold stays ACTIVE with the panels still damaged, so the
// car is grounded exactly as before and no re-derive can move it. No linked exception closes either:
// the new row carries no `linked_hold_id`, because whatever the original's link covers is the damage
// still on the car.
//
// ⚠️ ORDER IS THE SAFETY. Not a transaction, like every repair path beside it — so each step fails
// toward OVER-reporting damage, never losing it:
//   1. insert the fixed row, born REPAIRED      — fails: nothing changed.
//   2. its repairs row                          — fails: the fixed row is deleted again, nothing changed.
//   3. shrink the original to what still stands — fails: the fixed panels show on both rows until a
//      retry; the map still paints them, which is wrong in the safe direction.
//
// ⭐ ONE ISSUE OF A MULTI-TYPE HOLD (`issue`, 2026-11-21, LJF720). The fixed row is typed to that issue
// alone: the hail repair is a hail row. `resolves` says whether the issue is now done (it joins the
// original's resolved_types in step 3) or still stands on the panels left (a last issue fixed in part).

interface Deps {
  holds: Hold[];
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
}

export function makeMarkPanelsRepaired({ holds, setAllHolds }: Deps) {
  return async (holdId: string, fixed: PanelSide, standing: PanelSide, repair: Omit<Repair, 'id' | 'holdId'>, issue?: IssueSplit) =>
    // Same key as the whole-hold repair: a double tap, or a race with the other path, must not split twice.
    withSubmitLock(`repair:${holdId}`, async () => {
      const hold = holds.find(h => h.id === holdId);
      if (!hold) throw new Error(`Hold not found: ${holdId}`);
      const fixedId = crypto.randomUUID();
      const repairId = crypto.randomUUID();
      const types: HoldType[] = issue ? [issue.type] : hold.holdTypes;
      const resolvedTypes = issue?.resolves && !hold.resolvedTypes.includes(issue.type)
        ? [...hold.resolvedTypes, issue.type] : hold.resolvedTypes;

      const { error } = await writeWithRefresh(() =>
        supabase.from('holds').insert({
          id: fixedId, vehicle_id: hold.vehicleId,
          hold_type: types[0], hold_types: types, resolved_types: types,
          // A split typed to one panel issue carries no detail reason or service of the hold's other issues.
          detail_reason: issue ? null : hold.detailReason ?? null,
          mechanical_sub_type: issue ? null : hold.mechanicalSubType ?? null,
          disposition: hold.disposition ?? null,
          damage_description: fixed.description,
          // Who flagged it and when is history, and history does not change because a panel got fixed.
          flagged_by_id: hold.flaggedById,
          flagged_by_name: hold.flaggedByName,
          flagged_by_employee_id: hold.flaggedByEmployeeId,
          flagged_source: hold.flaggedSource ?? null,
          flagged_at: hold.flaggedAt,
          notes: hold.notes, photos: fixed.photos, damage_zones: fixed.zones,
          status: 'REPAIRED', linked_hold_id: null, branch_id: hold.branchId,
        })
      );
      if (error) throw new Error(`Failed to split the hold: ${(error as { message?: string }).message}`);

      const { error: repErr } = await writeWithRefresh(() =>
        supabase.from('repairs').insert({
          id: repairId, hold_id: fixedId,
          repaired_by_id: repair.repairedById, repaired_at: repair.repairedAt, notes: repair.notes,
          outcome: repair.outcome,
        })
      );
      if (repErr) {
        await writeWithRefresh(() => supabase.from('holds').delete().eq('id', fixedId));
        throw new Error(`Failed to record repair: ${(repErr as { message?: string }).message}`);
      }

      const { error: shrinkErr } = await writeWithRefresh(() =>
        supabase.from('holds').update({
          damage_zones: standing.zones, photos: standing.photos, damage_description: standing.description,
          ...(issue ? { resolved_types: resolvedTypes } : {}),
        }).eq('id', holdId)
      );

      const fixedHold: Hold = {
        ...hold, id: fixedId, status: 'REPAIRED', holdTypes: types, holdType: types[0], resolvedTypes: types,
        ...(issue ? { detailReason: undefined, mechanicalSubType: undefined } : {}),
        damageDescription: fixed.description, photos: fixed.photos, damageZones: fixed.zones,
        linkedHoldId: undefined, release: undefined, zonesReviewedAt: null,
        repair: { ...repair, id: repairId, holdId: fixedId },
      };
      setAllHolds(prev => [
        ...prev.map(h => (shrinkErr || h.id !== holdId) ? h : {
          ...h, damageZones: standing.zones, photos: standing.photos, damageDescription: standing.description, resolvedTypes,
        }),
        fixedHold,
      ]);
      if (shrinkErr) throw new Error(`Repair saved, but the hold still lists the fixed panels: ${(shrinkErr as { message?: string }).message}`);
    });
}
