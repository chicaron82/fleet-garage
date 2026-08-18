import { useState } from 'react';
import type { WashbayLog, HandoffNote, LotStatus, BranchId } from '../types';
import type { User } from '../types';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import { mapWashbayLog, mapHandoffNote } from '../lib/garage-mappers';
import { localDateStr } from '../hooks/useFleetBalance';
import { uploadShiftLogPhoto } from '../lib/garage-uploads';

export interface WashbayHandoffSlice {
  washbayLogs: WashbayLog[];
  handoffNotes: HandoffNote[];
  latestHandoff: HandoffNote | undefined;
  /** `targetDate` (a shift-date string) backfills a prior shift-day's log; omit it
   *  for the normal "today" close. Upserts on (branch_id, date) either way. */
  submitWashbayLog: (data: Omit<WashbayLog, 'id' | 'branchId' | 'date' | 'loggedById' | 'loggedAt'>, targetDate?: string, photo?: string | null) => Promise<boolean>;
  getTodayWashbayLog: () => WashbayLog | undefined;
  submitHandoff: (data: { fullPages: number; lastPageEntries: number; teamSize: number; lotStatus: LotStatus; notes?: string; morningHours?: number; carryOverCleared?: number; airportFlipping?: boolean; photo?: string | null }) => Promise<boolean>;
}

export function useWashbayHandoff(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): WashbayHandoffSlice & {
  setWashbayLogs: React.Dispatch<React.SetStateAction<WashbayLog[]>>;
  setHandoffNotes: React.Dispatch<React.SetStateAction<HandoffNote[]>>;
} {
  const [washbayLogs, setWashbayLogs] = useState<WashbayLog[]>([]);
  const [handoffNotes, setHandoffNotes] = useState<HandoffNote[]>([]);

  const latestHandoff = handoffNotes[0];

  const submitWashbayLog = async (
    data: Omit<WashbayLog, 'id' | 'branchId' | 'date' | 'loggedById' | 'loggedAt'>,
    targetDate?: string,
    /** Compressed base64 of the optional board photo — see submitHandoff for why a failed upload
     *  degrades to null rather than failing the log. */
    photo?: string | null,
  ): Promise<boolean> => {
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const date = targetDate ?? localDateStr(0);
    const loggedAt = new Date().toISOString();
    // Keyed on branch+date so re-opening the same day's close overwrites its own photo instead of
    // orphaning the first — the row itself upserts on the same pair.
    //
    // ⚠️ NO NEW PHOTO MUST MEAN "DON'T TOUCH", NOT "SET NULL". This first shipped as
    // `data.photoUrl ?? null`, which looked like it preserved an existing photo — but the closing
    // form never passes `photoUrl` back, so it resolved to null and **silently destroyed the photo
    // any time he re-opened a same-day close to fix a car count.** Worse, the form kept displaying
    // the old photo (via `existingUrl`) right up until save.
    // The fix is structural rather than a reminder to callers: when there's no new photo we OMIT
    // the column from the upsert entirely. Postgres' ON CONFLICT DO UPDATE only touches the
    // columns supplied, so an absent `photo_url` leaves the stored one alone on an update and
    // defaults to NULL on a fresh insert — both correct, and no caller can forget to pass it.
    const photoUrl = photo
      ? await uploadShiftLogPhoto(photo, `closing/${branchId}-${date}`)
      : null;
    try {
      const { data: row, error } = await writeWithRefresh(() =>
        supabase.from('washbay_logs').upsert({
          branch_id:           branchId,
          date,
          full_pages:          data.fullPages,
          last_page_entries:   data.lastPageEntries,
          cars_remaining:      data.carsRemaining,
          clean_not_picked_up: data.cleanNotPickedUp,
          non_rentables_fuelled: data.nonRentablesFuelled,
          deferred_completions:  data.deferredCompletions,
          non_rentables_note:    data.nonRentablesNote ?? null,
          carry_over:            data.carryOver,
          team_size:             data.teamSize,
          shift_hours:         data.shiftHours,
          overtime_hours:      data.overtimeHours,
          lot_status:          data.lotStatus,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
          airport_flipping:    data.airportFlipping,
          logged_by:           user!.id,
          logged_at:           loggedAt,
        }, { onConflict: 'branch_id, date' }).select().single()
      );
      if (error) throw error;
      const newLog = mapWashbayLog(row);
      setWashbayLogs(prev => {
        const filtered = prev.filter(l => !(l.branchId === branchId && l.date === date));
        return [newLog, ...filtered];
      });
      return true;
    } catch (err) {
      console.error('Failed to submit washbay log:', err);
      return false;
    }
  };

  const getTodayWashbayLog = (): WashbayLog | undefined => {
    return washbayLogs.find(l => l.date === localDateStr(0));
  };

  const submitHandoff = async (data: {
    fullPages: number;
    lastPageEntries: number;
    teamSize: number;
    lotStatus: LotStatus;
    notes?: string;
    morningHours?: number;
    carryOverCleared?: number;
    airportFlipping?: boolean;
    /** Compressed base64 of the optional context photo. Uploaded BEFORE the row is written, and a
     *  failed upload degrades to photo_url = null — the counts are the part that can never be
     *  reconstructed, so they must never be lost to a flaky camera or a slow bay signal. */
    photo?: string | null;
  }): Promise<boolean> => {
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const loggedAt = new Date().toISOString();
    // Each insert mints a fresh row, so a same-frame double-tap files two handoff
    // notes for the shift. Guard on branch + reporter + day; a dropped re-entrant
    // tap resolves undefined → report false (no insert performed).
    // Uploaded outside the lock and before the insert: a slow upload must not extend the
    // double-tap guard's window, and a failed one must not abort the log.
    const photoUrl = data.photo
      ? await uploadShiftLogPhoto(data.photo, `handoff/${branchId}-${localDateStr(0)}-${user!.id}`)
      : null;

    const result = await withSubmitLock(`handoff:${branchId}:${user!.id}:${localDateStr(0)}`, async (): Promise<boolean> => {
      try {
        const { data: row, error } = await writeWithRefresh(() =>
          supabase.from('handoff_notes').insert({
            branch_id:          branchId,
            logged_by:          user!.id,
            logged_by_name:     user!.name,
            logged_at:          loggedAt,
            full_pages:         data.fullPages,
            last_page_entries:  data.lastPageEntries,
            team_size:          data.teamSize,
            lot_status:         data.lotStatus,
            notes:              data.notes ?? null,
            morning_hours:      data.morningHours ?? 8.0,
            carry_over_cleared: data.carryOverCleared ?? 0,
            airport_flipping:   data.airportFlipping ?? false,
            photo_url:          photoUrl,
          }).select().single()
        );
        if (error) throw error;
        setHandoffNotes(prev => [mapHandoffNote(row), ...prev]);
        return true;
      } catch (err) {
        console.error('Failed to submit handoff note:', err);
        return false;
      }
    });
    return result ?? false;
  };

  return { washbayLogs, handoffNotes, latestHandoff, submitWashbayLog, getTodayWashbayLog, submitHandoff, setWashbayLogs, setHandoffNotes };
}
