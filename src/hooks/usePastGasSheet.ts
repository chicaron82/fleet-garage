// The rows of a past gas sheet, each written to the sheet's own day (migration 168's record_sheet_odometer), each with
// its Undo, and a doesn't-fit row's Save anyway. docs/ticket-odometer-history-and-past-gas-sheet.md.
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sheetDayBounds, type SheetCar, type SheetResult } from '../lib/sheetDay';

export interface SheetRow {
  key: number;
  car: SheetCar;
  odo: number;
  day: string;
  state: 'saving' | 'done' | 'undone' | 'failed';
  result?: SheetResult;
}

let nextKey = 1;

export function usePastGasSheet() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SheetRow[]>([]);
  const patch = (key: number, p: Partial<SheetRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));

  const send = useCallback(async (key: number, car: SheetCar, odo: number, day: string, force: boolean) => {
    const b = sheetDayBounds(day);
    const { data, error } = await supabase.rpc('record_sheet_odometer', {
      p_vehicle: car.id, p_km: odo, p_read_at: b.readAt, p_day_start: b.start, p_day_end: b.end,
      p_by_id: user?.id ?? '', p_by_name: user?.name ?? '', p_branch: user?.branchId ?? '', p_force: force,
    });
    if (error || !data) { patch(key, { state: 'failed' }); return; }
    patch(key, { state: 'done', result: data as unknown as SheetResult });
  }, [user]);

  /** A new row: newest on top. */
  const add = useCallback((car: SheetCar, odo: number, day: string) => {
    const key = nextKey++;
    setRows(rs => [{ key, car, odo, day, state: 'saving' }, ...rs]);
    void send(key, car, odo, day, false);
  }, [send]);

  /** A doesn't-fit row, saved because he says the sheet is right. */
  const saveAnyway = useCallback((row: SheetRow) => {
    patch(row.key, { state: 'saving', result: undefined });
    void send(row.key, row.car, row.odo, row.day, true);
  }, [send]);

  const retry = useCallback((row: SheetRow) => {
    patch(row.key, { state: 'saving', result: undefined });
    void send(row.key, row.car, row.odo, row.day, false);
  }, [send]);

  /** Takes a saved row back: the reading, its visit, and the car's odo if this row had become it. */
  const undo = useCallback(async (row: SheetRow) => {
    if (row.result?.status !== 'saved') { patch(row.key, { state: 'undone' }); return; }
    patch(row.key, { state: 'saving' });
    const { error } = await supabase.rpc('undo_sheet_odometer', { p_reading: row.result.reading_id, p_sighting: row.result.sighting_id ?? undefined });
    patch(row.key, error ? { state: 'done' } : { state: 'undone' });
  }, []);

  return { rows, add, saveAnyway, retry, undo };
}
