import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useVehicleChanges } from '../../hooks/useVehicleChanges';
import { changeLines, describeChangeTime, changeCountLabel, describeActor } from '../../lib/vehicleChanges';
import { useProfiles } from '../../context/ProfilesContext';
import { hapticLight } from '../../lib/haptics';

// What this record has been edited to, and when (migrations/118).
//
// Collapsed by default and silent when empty. The trail starts on 2026-08-18, so almost every car
// has nothing here — and an empty section shouting at him on every vehicle screen would teach him
// to scroll past the one car that eventually does have something.
//
// ⚠️ It never says WHO. FG writes with the anon key under allow-all RLS, so no honest actor exists
// to name (project_fg_scope_boundary). Better a trail that admits what it doesn't know than one
// that quietly implies a person.
export function VehicleChangeLog({ vehicleId }: { vehicleId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const rows = useVehicleChanges(vehicleId, refreshKey);
  const profiles = useProfiles();
  const { revertVehicleChange } = useVehicleHoldContext();
  const [open, setOpen] = useState(false);
  // Armed by key, so one confirm can be showing at a time and a stray tap never writes.
  const [arming, setArming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ key: string; msg: string } | null>(null);

  const undo = async (key: string, row: { changed: Record<string, unknown>; op: 'UPDATE' | 'DELETE' }) => {
    setBusy(key); setErr(null);
    try {
      await revertVehicleChange(vehicleId, row.changed, row.op);
      setArming(null);
      setRefreshKey(k => k + 1);   // the revert wrote a new entry — re-read, or the trail lies
    } catch (e) {
      // The refusal ("colour has changed since") is the useful half — show it, don't swallow it.
      setErr({ key, msg: e instanceof Error ? e.message : 'Could not undo it.' });
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(o => !o); }}
        className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
      >
        <span>🕓 {changeCountLabel(rows)}</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {rows.map((row, i) => {
            const lines = changeLines(row);
            if (lines.length === 0) return null;
            const key = `${row.changedAt}-${i}`;
            return (
              <li key={key} className="text-xs">
                <div className="text-gray-400 dark:text-gray-500">
                  {describeChangeTime(row.changedAt)}
                  {/* ⭐ WHO, at last — migration 132. ⚠️ And silent when there is nobody to name:
                      every row before 132, and any script that did not name itself, renders exactly
                      as it always did. A trail that quietly implies a person is worse than one that
                      admits it does not know, and that rule outlived the limitation that created it. */}
                  {(() => {
                    const who = describeActor(row.actor, id => profiles.get(id)?.name);
                    return who ? <span className="ml-1">· by {who}</span> : null;
                  })()}
                  {row.op === 'DELETE' && <span className="ml-1 text-red-500 font-semibold">· record deleted</span>}
                </div>
                {lines.map(l => (
                  <div key={l.field} className="flex flex-wrap items-baseline gap-1.5 text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">{l.label}</span>
                    {/* No strikethrough. The arrow already says "became", and on short values the
                        line renders as a glyph rather than a deletion — a struck "1" reads as "+",
                        a struck em dash reads as anything but empty. Both showed up on the verify
                        shot. Muted-vs-solid carries the same meaning without inventing symbols. */}
                    <span className="opacity-50">{l.from}</span>
                    <span className="opacity-60">→</span>
                    <span className="font-mono">{l.to}</span>
                  </div>
                ))}

                {/* Undo, and only for entries that can still be undone honestly. A key-tag scan
                    landing on the wrong car overwrote eleven fields at once (2026-08-22) — the log
                    already knew every previous value; this is it reading itself backwards. */}
                {row.op === 'UPDATE' && (
                  <div className="mt-0.5 flex items-center gap-2">
                    {arming === key ? (
                      <>
                        <button type="button" disabled={busy === key} onClick={() => void undo(key, row)}
                                className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50">
                          {busy === key ? 'Undoing…' : `Undo these ${lines.length === 1 ? 'change' : lines.length + ' changes'}?`}
                        </button>
                        <button type="button" onClick={() => { setArming(null); setErr(null); }}
                                className="text-[11px] text-gray-400 hover:underline cursor-pointer">Cancel</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => { setArming(key); setErr(null); }}
                              className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline cursor-pointer">
                        Undo
                      </button>
                    )}
                    {err?.key === key && (
                      <span className="text-[11px] text-red-600 dark:text-red-400">{err.msg}</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
