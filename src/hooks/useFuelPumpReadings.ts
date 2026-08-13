import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import { localDateStr } from './useFleetBalance';
import { analogPumped, digitalDelta, digitalWentUp } from '../lib/fuelReadings';
import type { User } from '../types';

/**
 * Owns the Shift Duties fuel section: the readings, the derived maths (via the
 * pure lib), and the save. Pump 1 and Pump 2 are both analog gauges tracked
 * open→close (Pump 2 returned to service 2026-08-13, retiring the locked-tripwire
 * model); the digital tank keeps decimals. Opening readings pre-fill from the
 * prior shift's close so the running sheet carries forward.
 */
export function useFuelPumpReadings(user: User) {
  const [pump1Open, setPump1Open]       = useState('');
  const [pump1Close, setPump1Close]     = useState('');
  const [pump2Open, setPump2Open]       = useState('');
  const [pump2Close, setPump2Close]     = useState('');
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
  // readings from the prior shift's closing values (both analog pumps + the tank).
  useEffect(() => {
    void (async () => {
      // Today first — user may have saved and navigated away.
      const { data: today } = await supabase
        .from('fuel_pump_readings')
        .select('id, pump1_open, pump1_close, pump2_open, pump2_close, digital_open, digital_close, topup_note')
        .eq('branch_id', user.branchId)
        .eq('date', localDateStr(0))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (today) {
        setSavedId(today.id);
        if (today.pump1_open    != null) setPump1Open(String(today.pump1_open));
        if (today.pump1_close   != null) setPump1Close(String(today.pump1_close));
        if (today.pump2_open    != null) setPump2Open(String(today.pump2_open));
        if (today.pump2_close   != null) setPump2Close(String(today.pump2_close));
        if (today.digital_open  != null) setDigitalOpen(String(today.digital_open));
        if (today.digital_close != null) setDigitalClose(String(today.digital_close));
        if (today.topup_note)            setTopupNote(today.topup_note);
        setSaved(true);
        return;
      }

      // No today row — pre-fill opening readings from the previous shift's close.
      const { data: prev } = await supabase
        .from('fuel_pump_readings')
        .select('pump1_close, pump2_close, digital_close')
        .eq('branch_id', user.branchId)
        .lt('date', localDateStr(0))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prev) return;
      if (prev.pump1_close   != null) setPump1Open(String(prev.pump1_close));
      if (prev.pump2_close   != null) setPump2Open(String(prev.pump2_close));
      if (prev.digital_close != null) setDigitalOpen(String(prev.digital_close));
    })();
  }, [user.branchId]);

  const pump1Pumped = analogPumped(pump1Open, pump1Close);
  const pump2Pumped = analogPumped(pump2Open, pump2Close);
  const digitalNet  = digitalDelta(digitalOpen, digitalClose);
  const digitalUp   = digitalWentUp(digitalOpen, digitalClose);

  // Save needs at least one reading typed — don't write an all-null row.
  const canSave = [pump1Open, pump1Close, pump2Open, pump2Close, digitalOpen, digitalClose]
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
      pump2_open:     intOrNull(pump2Open),
      pump2_close:    intOrNull(pump2Close),
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
    setSaved(true);
  };

  return {
    pump1Open, setPump1Open, pump1Close, setPump1Close,
    pump2Open, setPump2Open, pump2Close, setPump2Close,
    digitalOpen, setDigitalOpen, digitalClose, setDigitalClose,
    topupNote, setTopupNote,
    pump1Pumped, pump2Pumped, digitalNet, digitalUp,
    canSave, saving, saved, saveError,
    handleSave,
    clearSaved: () => setSaved(false),
  };
}
