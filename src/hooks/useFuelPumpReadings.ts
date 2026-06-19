import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { localDateStr } from './useFleetBalance';
import { analogPumped, digitalDelta, pump2Drifted, digitalWentUp, DEFAULT_PUMP2 } from '../lib/fuelReadings';
import type { User } from '../types';

/**
 * Owns the Shift Duties fuel section: the six readings, the derived maths (via
 * the pure lib), the persisted "last recorded Pump 2" baseline, and the save.
 * The tripwire (pump2Warn) reads the entered Pump 2 against lastPump2 — loaded
 * from the most recent row for this branch so a shift-to-shift drift surfaces.
 */
export function useFuelPumpReadings(user: User) {
  const [lastPump2, setLastPump2] = useState<number>(DEFAULT_PUMP2);

  const [pump1Open, setPump1Open]     = useState('');
  const [pump1Close, setPump1Close]   = useState('');
  const [pump2Reading, setPump2Reading] = useState('');
  const [digitalOpen, setDigitalOpen] = useState('');
  const [digitalClose, setDigitalClose] = useState('');
  const [topupNote, setTopupNote]     = useState('');

  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Read the last recorded Pump 2 for this branch — the tripwire baseline.
  useEffect(() => {
    supabase
      .from('fuel_pump_readings')
      .select('pump2_reading')
      .eq('branch_id', user.branchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const v = data?.[0]?.pump2_reading;
        if (typeof v === 'number') setLastPump2(v);
      });
  }, [user.branchId]);

  const pump1Pumped = analogPumped(pump1Open, pump1Close);
  const digitalNet  = digitalDelta(digitalOpen, digitalClose);
  const pump2Warn   = pump2Drifted(pump2Reading, lastPump2);
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
    // A saved Pump 2 becomes the new baseline immediately (the drift, if any, has
    // already been flagged — the warning fired and the reading is now on record).
    const saved2 = intOrNull(pump2Reading);
    if (saved2 !== null) setLastPump2(saved2);
    setSaved(true);
  };

  return {
    lastPump2,
    pump1Open, setPump1Open, pump1Close, setPump1Close,
    pump2Reading, setPump2Reading,
    digitalOpen, setDigitalOpen, digitalClose, setDigitalClose,
    topupNote, setTopupNote,
    pump1Pumped, digitalNet, pump2Warn, digitalUp,
    canSave, saving, saved, saveError,
    handleSave,
    clearSaved: () => setSaved(false),
  };
}
