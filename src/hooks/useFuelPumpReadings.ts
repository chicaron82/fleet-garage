import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import { localDateStr } from './useFleetBalance';
import { analogPumped, digitalDelta, pump2Status, digitalWentUp, EXPECTED_PUMP2 } from '../lib/fuelReadings';
import type { User } from '../types';

/**
 * Owns the Shift Duties fuel section: the six readings, the derived maths (via
 * the pure lib), and the save. The Pump 2 baseline is FIXED at EXPECTED_PUMP2 —
 * the locked side's meter is cumulative, so the tripwire compares against that
 * constant, never a drift-from-saves (a saved high reading must NOT become the
 * new normal — that would silence the very catch).
 */
export function useFuelPumpReadings(user: User) {
  const [pump1Open, setPump1Open]       = useState('');
  const [pump1Close, setPump1Close]     = useState('');
  const [pump2Reading, setPump2Reading] = useState('');
  const [digitalOpen, setDigitalOpen]   = useState('');
  const [digitalClose, setDigitalClose] = useState('');
  const [topupNote, setTopupNote]       = useState('');
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [saveError, setSaveError]       = useState(false);
  // ID of today's row if one already existed when the form mounted — used to
  // update in place rather than inserting a duplicate on re-save.
  const [savedId, setSavedId]           = useState<string | null>(null);

  // On mount: reload today's saved row if one exists; otherwise pre-fill opening
  // readings from the prior shift's closing values.
  // Pump 2 is intentionally never pre-filled from a prior shift — typing the value
  // is its loss-prevention control. It IS restored if today's own row is found.
  useEffect(() => {
    void (async () => {
      // Today first — user may have saved and navigated away.
      const { data: today } = await supabase
        .from('fuel_pump_readings')
        .select('id, pump1_open, pump1_close, pump2_reading, digital_open, digital_close, topup_note')
        .eq('branch_id', user.branchId)
        .eq('date', localDateStr(0))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (today) {
        setSavedId(today.id);
        if (today.pump1_open    != null) setPump1Open(String(today.pump1_open));
        if (today.pump1_close   != null) setPump1Close(String(today.pump1_close));
        if (today.pump2_reading != null) setPump2Reading(String(today.pump2_reading));
        if (today.digital_open  != null) setDigitalOpen(String(today.digital_open));
        if (today.digital_close != null) setDigitalClose(String(today.digital_close));
        if (today.topup_note)            setTopupNote(today.topup_note);
        setSaved(true);
        return;
      }

      // No today row — pre-fill opening readings from the previous shift's close.
      const { data: prev } = await supabase
        .from('fuel_pump_readings')
        .select('pump1_close, digital_close')
        .eq('branch_id', user.branchId)
        .lt('date', localDateStr(0))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prev) return;
      if (prev.pump1_close   != null) setPump1Open(String(prev.pump1_close));
      if (prev.digital_close != null) setDigitalOpen(String(prev.digital_close));
    })();
  }, [user.branchId]);

  const pump1Pumped = analogPumped(pump1Open, pump1Close);
  const digitalNet  = digitalDelta(digitalOpen, digitalClose);
  const pump2 = pump2Status(pump2Reading, EXPECTED_PUMP2);
  const digitalUp   = digitalWentUp(digitalOpen, digitalClose);

  // Save needs at least one reading typed — don't write an all-null row.
  const canSave = [pump1Open, pump1Close, pump2Reading, digitalOpen, digitalClose]
    .some(v => v.trim() !== '');

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(false);
    const intOrNull = (s: string) => (s.trim() === '' ? null : Math.round(Number(s)));
    const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));

    const payload = {
      pump1_open:     intOrNull(pump1Open),
      pump1_close:    intOrNull(pump1Close),
      pump2_reading:  intOrNull(pump2Reading),
      digital_open:   numOrNull(digitalOpen),
      digital_close:  numOrNull(digitalClose),
      topup_note:     topupNote.trim() || null,
      logged_by_id:   user.id,
      logged_by_name: user.name ?? null,
    };

    let error;
    if (savedId) {
      ({ error } = await writeWithRefresh(() =>
        supabase.from('fuel_pump_readings').update(payload).eq('id', savedId)
      ));
    } else {
      // First save of the day mints a row; `savedId` only flips on the next render,
      // so a same-frame double-tap would insert two readings for the same
      // branch+day (double-counting fuel). Guard on branch+date — a dropped
      // re-entrant tap resolves undefined, leaving `saving` to reset below.
      const res = await withSubmitLock(`fuelreading:${user.branchId}:${localDateStr(0)}`, () =>
        writeWithRefresh(() =>
          supabase.from('fuel_pump_readings').insert({
            branch_id: user.branchId,
            date:      localDateStr(0),
            ...payload,
          }).select('id').single()
        )
      );
      if (!res) { setSaving(false); return; }
      error = res.error;
      if (!error && res.data) setSavedId((res.data as { id: string }).id);
    }

    setSaving(false);
    if (error) { console.error('[useFuelPumpReadings] save failed', error); setSaveError(true); return; }
    // NB: the saved reading is recorded but does NOT become the baseline — the
    // locked pump's expected value is fixed (EXPECTED_PUMP2). A high reading is an
    // alarm to act on, not a new normal to accept.
    setSaved(true);
  };

  return {
    expectedPump2: EXPECTED_PUMP2,
    pump1Open, setPump1Open, pump1Close, setPump1Close,
    pump2Reading, setPump2Reading,
    digitalOpen, setDigitalOpen, digitalClose, setDigitalClose,
    topupNote, setTopupNote,
    pump1Pumped, digitalNet, pump2, digitalUp,
    canSave, saving, saved, saveError,
    handleSave,
    clearSaved: () => setSaved(false),
  };
}
