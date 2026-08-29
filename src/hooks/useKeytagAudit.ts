import { useMemo, useState, useCallback } from 'react';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import {
  buildAuditQueue,
  auditQueueStats,
  type AuditCandidate,
  type AuditQueueStats,
} from '../lib/keytagAuditQueue';
import type { KeytagAuditEdits } from '../context/keytagAuditWrite';
import type { Vehicle } from '../types';

/**
 * The key-tag auditor's queue, one car at a time.
 *
 * ⭐ NO INDEX, DELIBERATELY. The obvious shape is an index into a frozen list, and it goes wrong the
 * moment a save lands: the audited car leaves the queue, every position after it shifts, and the
 * index now points at a car he never saw. Instead the queue is derived live from the fleet and the
 * current car is simply *the first one he has not skipped* — saving removes a car from the queue by
 * itself, so advancing needs no bookkeeping and cannot skip anyone.
 *
 * ⚠️ `skipped` is session-only and NOT persisted, on purpose. A skip means "not this one right now";
 * an audit is what means "done with this one", and that lives in the database. Persisting skips
 * would quietly build a second, invisible queue of cars that never come back.
 */
export interface KeytagAuditState {
  /** The car in front of him, or null when the queue is empty. */
  current: AuditCandidate<Vehicle> | null;
  /** How many are left in this sitting (queue minus skips). */
  remaining: number;
  /** Fleet-wide counts for the collapsed headline. */
  stats: AuditQueueStats;
  /** Every rental class in use, upper-cased — feeds the wrong-box guard. Derived rather than
   *  hard-coded: a class FG has never seen cannot be flagged as one, and a list I typed by hand
   *  would go stale the first time the fleet gained a group. */
  knownRentalClasses: ReadonlySet<string>;
  /** Every model code in use, MINUS anything that is also a rental class. */
  knownModelCodes: ReadonlySet<string>;
  saving: boolean;
  /** A failed write, said out loud rather than swallowed. */
  error: string;
  /** Set when the unit number he typed is already on another live record — that one field was not
   *  applied; everything else he read was. */
  unitConflict: Vehicle | null;
  save: (edits: KeytagAuditEdits) => Promise<void>;
  skip: () => void;
  flagUnreadable: () => Promise<void>;
  dismissConflict: () => void;
}

export function useKeytagAudit(): KeytagAuditState {
  const { allVehicles, saveKeytagAudit, flagKeytagUnreadable } = useVehicleHoldContext();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [unitConflict, setUnitConflict] = useState<Vehicle | null>(null);

  const queue = useMemo(() => buildAuditQueue(allVehicles), [allVehicles]);
  const stats = useMemo(() => auditQueueStats(allVehicles), [allVehicles]);
  const pending = useMemo(() => queue.filter(c => !skipped.has(c.vehicle.id)), [queue, skipped]);
  const knownRentalClasses = useMemo(() => {
    const set = new Set<string>();
    for (const v of allVehicles) if (v.rentalClass) set.add(v.rentalClass.trim().toUpperCase());
    return set;
  }, [allVehicles]);

  // ⚠️ RENTAL CLASSES ARE SUBTRACTED, and that is load-bearing rather than tidy. A misfiled value
  // lands in `class_code` and immediately makes itself a "known model code" — so E9, sitting in the
  // wrong column on FVB4297, would teach the guard that E9 is a legitimate code and switch off the
  // check for the very mistake that put it there. An error that legitimises itself is the same trap
  // as a bogus mapping taught into the codex. Subtracting the rental classes means the guard heals
  // instead of learning the wrong lesson.
  const knownModelCodes = useMemo(() => {
    const set = new Set<string>();
    for (const v of allVehicles) {
      const code = v.classCode?.trim().toUpperCase();
      if (code && !knownRentalClasses.has(code)) set.add(code);
    }
    return set;
  }, [allVehicles, knownRentalClasses]);
  const current = pending[0] ?? null;

  const save = useCallback(async (edits: KeytagAuditEdits) => {
    if (!current) return;
    setSaving(true);
    setError('');
    try {
      const { unitConflict: clash } = await saveKeytagAudit(current.vehicle.id, edits);
      // The car leaves the queue on its own once the fleet state updates — but a blocked unit
      // number is worth stopping for, so it is surfaced instead of scrolling past.
      setUnitConflict(clash ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that audit.');
    } finally {
      setSaving(false);
    }
  }, [current, saveKeytagAudit]);

  const flagUnreadable = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    setError('');
    try {
      await flagKeytagUnreadable(current.vehicle.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not flag that photo.');
    } finally {
      setSaving(false);
    }
  }, [current, flagKeytagUnreadable]);

  const skip = useCallback(() => {
    if (!current) return;
    const id = current.vehicle.id;
    setSkipped(prev => new Set(prev).add(id));
    setError('');
  }, [current]);

  const dismissConflict = useCallback(() => setUnitConflict(null), []);

  return {
    current, remaining: pending.length, stats, knownRentalClasses, knownModelCodes,
    saving, error, unitConflict,
    save, skip, flagUnreadable, dismissConflict,
  };
}
