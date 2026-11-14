// "Wrong odo? Back to X (day)" on the car's record: the newest reading taken back days later, after the moment's Undo
// is gone (Aaron, 2026-11-14, LJF712's 37,331 off a Nov 8 sheet). The sighting stays; the car goes back to the reading
// before it, with that reading's own date. docs/November/ticket-odo-take-back-newest.md.
//
// Two taps, like Clear beside it (his 2026-10-10 "Yes for the guard"): the first arms and says what it will do, an
// unconfirmed arm lapses on its own. Offered only when there IS a reading before it.
import { useEffect, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { takeBackLabel, takeBackWords } from '../../lib/odometerTakeBack';
import { usePriorReading, useTakeBackOdometer } from '../../hooks/useTakeBackOdometer';
import { CLEAR_ARM_MS } from '../shared/OdometerCapture';

export function OdometerTakeBack({ vehicleId, currentKm, currentAt, unit }: {
  vehicleId: string;
  currentKm: number | null | undefined;
  currentAt: string | null | undefined;
  unit: string;
}) {
  const { prior } = usePriorReading(vehicleId, currentKm, currentAt);
  const takeBack = useTakeBackOdometer();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), CLEAR_ARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const tap = async () => {
    if (!prior || currentKm == null || !currentAt) return;
    hapticLight();
    if (!armed) { setSaid(null); setArmed(true); return; }
    setArmed(false);
    setBusy(true);
    const r = await takeBack(vehicleId, currentKm, currentAt).catch(() => null);
    setBusy(false);
    setSaid(takeBackWords(r, unit));
  };

  return (
    <>
      {prior && !said?.ok && (
        <button type="button" onClick={() => void tap()} disabled={busy}
          aria-label={armed ? 'Tap again to take the reading back' : undefined}
          className={`w-full h-11 mt-1.5 px-3 rounded-lg border text-xs disabled:opacity-40 cursor-pointer transition ${
            armed
              ? 'border-red-500 bg-red-50 dark:bg-red-950/40 font-semibold text-red-700 dark:text-red-300'
              : 'border-gray-300 dark:border-gray-700 font-medium text-gray-600 dark:text-gray-400'}`}>
          {busy ? 'Taking it back…' : takeBackLabel(prior, unit, armed)}
        </button>
      )}
      {said && (
        <p role={said.ok ? 'status' : 'alert'} className={`mt-1 text-[11px] font-semibold ${said.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {said.text}
        </p>
      )}
    </>
  );
}
