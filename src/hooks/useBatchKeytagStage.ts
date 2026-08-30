// Batch keytag staging (docs/ticket-misc-effie-batch-stage.md): loop the SHIPPED single-read
// engine over a stack of photos — read each, resolve against the fleet, and stage the
// actionable ones (register / backfill) into the pending queue for a one-pass review. No new
// read/resolve/stage logic; batch is that producer, looped. The per-read decision is the pure
// planBatchStage; this hook owns the sequential run + the result list.
import { useCallback, useState , useRef } from 'react';
import { useKeytagRead } from './useKeytagRead';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { usePendingWritesContext } from '../context/PendingWritesContext';
import { resolveKeytagScan } from '../lib/resolveKeytagScan';
import { planBatchStage, type BatchStagePlan } from '../lib/planBatchStage';
import { passesDeterministicAutoClear } from '../lib/autoClearGate';

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
  /** Stage ONE skipped row's plate-only fallback, on his tap. Per-row, never bulk. */
  stageOffer: (index: number) => Promise<void>;
  reset: () => void;
}

export function useBatchKeytagStage(): BatchKeytagState {
  const { readKeytag } = useKeytagRead();
  const { vehicles, attachKeytagPhotoIfMissing } = useVehicleHoldContext();
  const { stage } = usePendingWritesContext();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  // ⭐ The photos outlive the run, because "Add anyway" is tapped AFTER it finishes. The whole
  // point of the offer is to keep the tag photo the read couldn't use, so it has to still be here.
  const photosRef = useRef<string[]>([]);

  const runBatch = useCallback(async (base64s: string[]) => {
    if (running || base64s.length === 0) return;
    setRunning(true);
    setResults([]);
    photosRef.current = base64s;
    setProgress({ done: 0, total: base64s.length });
    const out: BatchResult[] = [];

    for (let i = 0; i < base64s.length; i++) {
      const read = await readKeytag(base64s[i]);
      if (!read) {
        // Endpoint/vision failure — nothing to plan; record an honest skip.
        out.push({ index: i, plan: { plate: '', wasCorrected: false, action: 'skip', detail: 'could not read the key tag' }, staged: false, stageError: false });
      } else {
        const resolved = resolveKeytagScan(read, vehicles);
        const plan = planBatchStage(read, resolved);

        // ⭐⭐ KEEP THE PHOTO ON EVERY MATCHED ROW, whatever the action was. Aaron, 2026-08-30:
        // *"i don't think batch register is storing the keytag if its missing… i may be missing a
        // keytag which the first batch probably has but was discarded."* He was right — and nine of
        // the twenty-six cars in that batch had no tag on file while he was uploading photos of
        // theirs.
        //
        // ⚠️ The photo rode ONLY on the proposal, and a `skip` has no proposal — so every
        // "already in the fleet — nothing to add" row binned the tag it was holding. That detail was
        // a false statement: the planner reasons about FIELDS, decided every column was full, and
        // never had the ARTIFACT in its model of what a scan can contribute.
        //
        // Automatic here, unlike the `Add anyway` offer on an unmatched row: this fills a NULL on a
        // car already matched by plate, cannot overwrite anything (attach-if-missing is guarded
        // twice, including a race-safe `.is(null)` in the write), and needs no judgement. The
        // junk-car hazard that made the other one a button does not exist when no record is created.
        if (resolved.vehicle && !resolved.vehicle.keytagPhotoUrl) {
          await attachKeytagPhotoIfMissing(resolved.vehicle.id, base64s[i]);
        }
        if (plan.action === 'skip' || !plan.proposal) {
          out.push({ index: i, plan, staged: false, stageError: false });
        } else {
          // Shadow-mode auto-clear verdict (L2, observe-only) — false for a register (kind), the
          // real verdict for a backfill. Recorded on the row; nothing fires.
          const wouldAutoClear = passesDeterministicAutoClear(plan.proposal, { plateCorrected: plan.wasCorrected });
          // Phase 3 (ticket-universal-keytag-capture): thread the KEY-TAG photo through the
          // pending-write's `photos` channel so it survives stage→approve. register/backfill
          // proposals never carry a damage hold, so `photos` is otherwise unused for them — a
          // clean, collision-free carrier. useProposalConfirm attaches it on approve via
          // attachKeytagPhotoIfMissing (if-missing, best-effort).
          const ok = await stage(plan.proposal, 'keytag-batch', [base64s[i]], wouldAutoClear);
          out.push({ index: i, plan, staged: ok, stageError: !ok });
        }
      }
      // Snapshot after each tag so the list fills in live as the stack processes.
      setResults([...out]);
      setProgress({ done: i + 1, total: base64s.length });
    }
    setRunning(false);
  }, [running, readKeytag, vehicles, stage, attachKeytagPhotoIfMissing]);

  /**
   * ⭐ Stage the plate-only fallback for ONE row, on his tap. Aaron, 2026-08-30: *"the tag should
   * upload, and i can add the details myself from the tag by hand."*
   *
   * ⚠️ Deliberately per-row and never bulk. The batch is exactly where a misread PLATE goes
   * unnoticed, so this stays a decision he makes while looking at that row — not a "stage all the
   * skips" button that would mint junk cars from bad plate reads in one tap.
   */
  const stageOffer = useCallback(async (index: number) => {
    const row = results.find(r => r.index === index);
    if (!row?.plan.offer || row.staged) return;
    const photo = photosRef.current[index];
    const ok = await stage(row.plan.offer.proposal, 'keytag-batch', photo ? [photo] : [], false);
    setResults(prev => prev.map(r => (r.index === index ? { ...r, staged: ok, stageError: !ok } : r)));
  }, [results, stage]);

  const reset = useCallback(() => { setResults([]); setProgress(null); photosRef.current = []; }, []);

  return { running, progress, results, stagedCount: results.filter(r => r.staged).length, runBatch, stageOffer, reset };
}
