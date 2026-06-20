import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
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
  const [pump1Open, setPump1Open]     = useState('');
  const [pump1Close, setPump1Close]   = useState('');
  const [pump2Reading, setPump2Reading] = useState('');
  const [digitalOpen, setDigitalOpen] = useState('');
  const [digitalClose, setDigitalClose] = useState('');

  // Pre-fill opening readings from the most recent prior shift's closing values.
  // Pump 2 is intentionally never pre-filled — typing the value is its loss-prevention control.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('fuel_pump_readings')
        .select('pump1_close, digital_close')
        .eq('branch_id', user.branchId)
        .lt('date', localDateStr(0))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      if (data.pump1_close != null) setPump1Open(String(data.pump1_close));
      if (data.digital_close != null) setDigitalOpen(String(data.digital_close));
    })();
  }, [user.branchId]);
  const [topupNote, setTopupNote]     = useState('');

  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState(false);

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

    const { error } = await writeWithRefresh(() => supabase.from('fuel_pump_readings').insert({
      branch_id:      user.branchId,
      date:           localDateStr(0),
      pump1_open:     intOrNull(pump1Open),
      pump1_close:    intOrNull(pump1Close),
      pump2_reading:  intOrNull(pump2Reading),
      digital_open:   numOrNull(digitalOpen),
      digital_close:  numOrNull(digitalClose),
      topup_note:     topupNote.trim() || null,
      logged_by_id:   user.id,
      logged_by_name: user.name ?? null,
    }));

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
