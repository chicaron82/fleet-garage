// "Batch register keytags" — snap/attach a stack of key tags and stage them all into the
// pending queue in one pass (docs/ticket-misc-effie-batch-stage.md). A thin surface over
// useBatchKeytagStage (which loops the shipped single-read engine); it owns the photo
// capture + the result list. Lives on My Shift by the pending queue: the staged rows land
// right below for a one-pass approve/reject. Collapsed by default — an action you invoke.
import { useRef, useState } from 'react';
import { useBatchKeytagStage, type BatchResult } from '../../hooks/useBatchKeytagStage';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { PhotoError } from '../../components/shared/PhotoError';

export function BatchKeytagScan() {
  const { running, progress, results, stagedCount, runBatch, reset } = useBatchKeytagStage();
  const [collapsed, setCollapsed] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const { photoError, takeMany } = usePhotoIntake();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const base64s = await takeMany(Array.from(files));
    if (base64s.length) void runBatch(base64s);
  };

  const open = !collapsed;
  const done = !running && results.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-colors">
      <button type="button" onClick={() => setCollapsed(c => !c)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">📸 Batch register key tags</span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Attach a stack of key tags — each is read and staged (register or backfill) into the queue below.
          </p>
          <PhotoError message={photoError} />

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => { reset(); fileRef.current?.click(); }}
              className="rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 text-sm font-bold text-gray-900 transition cursor-pointer"
            >
              {running ? 'Reading…' : 'Attach key tags'}
            </button>
            {running && progress && (
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{progress.done} / {progress.total}</span>
            )}
          </div>

          {results.length > 0 && (
            <ul className="space-y-1.5">
              {results.map(r => <ResultRow key={r.index} r={r} />)}
            </ul>
          )}

          {done && (
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {stagedCount > 0
                ? `${stagedCount} staged — approve or reject them in the queue below.`
                : 'Nothing staged — see the notes above.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ r }: { r: BatchResult }) {
  const { plan, staged, stageError } = r;
  const tone = stageError
    ? 'text-red-600 dark:text-red-400'
    : staged
      ? 'text-green-700 dark:text-green-400'
      : 'text-gray-400 dark:text-gray-500';
  const badge = stageError ? 'error' : staged ? plan.action : 'skip';
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0">
        <span className="font-mono font-semibold text-gray-800 dark:text-gray-100">{plan.plate || '—'}</span>
        {plan.wasCorrected && plan.rawPlate && (
          <span className="text-[11px] text-amber-700 dark:text-amber-400"> (read {plan.rawPlate})</span>
        )}
        <span className="text-gray-500 dark:text-gray-400"> · {plan.detail}</span>
      </span>
      <span className={`text-[11px] font-bold uppercase shrink-0 ${tone}`}>{badge}</span>
    </li>
  );
}
