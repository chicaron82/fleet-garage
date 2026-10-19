import { getTireSwapSeason } from '../lib/holdBadge';
import { makeRecordWinterTires } from './winterTiresWrite';
import type { Hold, HoldType, Vehicle } from '../types';

/** A finished seasonal tire swap IS the winter-tires observation (docs/ticket-tire-swap-marks-winters.md).
 *
 * ⭐ Aaron, 2026-10-18, on the idea that the swap hold does double duty: *"yes!! love it!!"*. In season, winter
 * tires are an extra charge, so the manual inspection slip has to say so, and he reads it off FG's ❄️. A batch
 * of cars to Bramer Tire or Canadian Tire would otherwise need a second tap per car that nobody remembers.
 *
 * ⚠️ The direction is the swap pill's own rule (`getTireSwapSeason`, May–Aug = ☀️ off, else ❄️ on), read at the
 * REPAIR time, so the flag can never disagree with the pill the crew saw on the hold.
 *
 * Only once the MECHANICAL issue is resolved: a multi-type hold can close its damage first. Never throws; the
 * repair is the primary write and has already landed. */
export async function recordSwapTires(
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>,
  hold: Hold,
  resolved: HoldType[],
  at: string,
): Promise<boolean> {
  if (hold.mechanicalSubType !== 'tire-swap' || !resolved.includes('mechanical')) return false;
  try {
    return await makeRecordWinterTires({ setAllVehicles })(hold.vehicleId, getTireSwapSeason(new Date(at)) === '❄️', at);
  } catch {
    return false;
  }
}
