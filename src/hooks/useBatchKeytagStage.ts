// Batch keytag staging (docs/ticket-misc-effie-batch-stage.md): loop the SHIPPED single-read
// engine over a stack of photos — read each, resolve against the fleet, and stage the
// actionable ones (register / backfill) into the pending queue for a one-pass review. No new
// read/resolve/stage logic; batch is that producer, looped. The per-read decision is the pure
// planBatchStage; this hook owns the sequential run + the result list.
import { useCallback, useState } from 'react';
import { useKeytagRead } from './useKeytagRead';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { usePendingWrites } from './usePendingWrites';
import { resolveKeytagScan } from '../lib/resolveKeytagScan';
import { planBatchStage, type BatchStagePlan } from '../lib/planBatchStage';

export interface BatchResult {
  /** Position in the submitted stack (stable key + "tag 3 of 5"). */
  index: number;
  plan: BatchStagePlan;
  /** True once its register/backfill actually staged (skips are false). */
  staged: boolean;
  /** The stage write was attempted but failed (offline/error) — distinct from a skip. */
  stageError: boolean;
}

export interface BatchKeytagState {
  running: boolean;
  progress: { done: number; total: number } | null;
  results: BatchResult[];
  stagedCount: number;
  /** Read + resolve + stage a stack of key-tag photos (base64), in order. */
  runBatch: (base64s: string[]) => Promise<void>;
  reset: () => void;
}

export function useBatchKeytagStage(): BatchKeytagState {
  const { readKeytag } = useKeytagRead();
  const { vehicles } = useVehicleHoldContext();
  const { stage } = usePendingWrites();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);

  const runBatch = useCallback(async (base64s: string[]) => {
    if (running || base64s.length === 0) return;
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: base64s.length });
    const out: BatchResult[] = [];

    for (let i = 0; i < base64s.length; i++) {
      const read = await readKeytag(base64s[i]);
      if (!read) {
        // Endpoint/vision failure — nothing to plan; record an honest skip.
        out.push({ index: i, plan: { plate: '', wasCorrected: false, action: 'skip', detail: 'could not read the key tag' }, staged: false, stageError: false });
      } else {
        const plan = planBatchStage(read, resolveKeytagScan(read, vehicles));
        if (plan.action === 'skip' || !plan.proposal) {
          out.push({ index: i, plan, staged: false, stageError: false });
        } else {
          const ok = await stage(plan.proposal, 'keytag-batch');
          out.push({ index: i, plan, staged: ok, stageError: !ok });
        }
      }
      // Snapshot after each tag so the list fills in live as the stack processes.
      setResults([...out]);
      setProgress({ done: i + 1, total: base64s.length });
    }
    setRunning(false);
  }, [running, readKeytag, vehicles, stage]);

  const reset = useCallback(() => { setResults([]); setProgress(null); }, []);

  return { running, progress, results, stagedCount: results.filter(r => r.staged).length, runBatch, reset };
}
