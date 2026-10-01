import { useMemo, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { liveFleet } from '../../lib/fleetHistory';
import { auditModelCodes, type AuditCar, type ModelCodeRow } from '../../lib/modelCodeAudit';
import { useLearnedCodes } from '../../hooks/useLearnedCodes';
import { useWriteGuard } from '../../hooks/useWriteGuard';
import { SaveNote } from '../shared/SaveNote';

// The model codes FG has learned, laid out to be audited — inside "What FG has recorded".
//
// ⭐ Aaron, 2026-10-01: *"just like the class codes, can we have somewhere i can see FG's learned model
// codes to audit"*. The rules live in src/lib/modelCodeAudit.ts; this file only lays them out and
// offers the one action an audit needs. docs/October/ticket-model-codes-he-can-audit.md
//
// ⚠️⚠️ FORGET IS THE ONLY WRITE, AND IT TAKES TWO TAPS. It is offered on a class FG LEARNED and a model
// he TAUGHT, never on the built-in list (that lives in a file) and never on a class he pinned (a pin is
// his decision; the lib answers `canForgetClass: false` and the delete itself refuses a pinned row).
//
// ⚠️ The card never corrects anything on its own. It says what differs and he decides.

type Car = AuditCar & { archivedAt?: string | null; unitNumber?: string | null };
type Group = 'check' | 'unbacked' | 'fine';

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4';
const CHIP = 'font-mono text-[10px] px-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400';
const QUIET = 'text-[11px] underline text-gray-500 dark:text-gray-400 cursor-pointer';

const groupOf = (r: ModelCodeRow): Group => (r.problems.length > 0 ? 'check' : r.liveCars === 0 ? 'unbacked' : 'fine');
const GROUPS: { id: Group; label: string }[] = [
  { id: 'check', label: 'To check' },
  { id: 'unbacked', label: 'No live car carries it' },
  { id: 'fine', label: 'Agrees with the cars' },
];

export function FleetModelCodesCard({ vehicles, archivedVehicles }: {
  vehicles: readonly Car[];
  archivedVehicles: readonly Car[];
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Record<Group, boolean>>({ check: true, unbacked: false, fine: false });
  const [armed, setArmed] = useState<string | null>(null);
  const { learned, taught, loading, error, reload, forgetClass, forgetModel } = useLearnedCodes(open);
  const { writeError, guard } = useWriteGuard();

  const audit = useMemo(() => {
    const live = liveFleet(vehicles);
    // Archived cars still vouch for a class the fleet has carried; a mock row never does.
    const everCarried = [...live, ...archivedVehicles.filter(v => !(v.unitNumber ?? '').startsWith('HRZ-'))];
    return auditModelCodes(live, everCarried, learned, taught);
  }, [vehicles, archivedVehicles, learned, taught]);

  const forget = async (what: string, run: () => Promise<void>) => {
    hapticLight();
    setArmed(null);
    await guard(run, `Couldn't forget ${what}. Nothing was removed — try again.`);
  };

  return (
    <div className={CARD}>
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(o => !o); }}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left cursor-pointer"
      >
        <span className="w-3 text-[11px] text-gray-400 dark:text-gray-500">{open ? '▾' : '▸'}</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Model codes FG has learned</span>
      </button>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        What FG fills in when it reads a model code off a tag, checked against the cars that carry it.
        FG only points at what differs. You decide.
      </p>

      {open && loading && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">Reading what FG learned…</p>}
      {/* ⚠️ A failed read is never drawn as an empty list — "nothing learned" would be an all-clear. */}
      {open && !loading && error && (
        <div className="mt-3">
          <SaveNote message="Couldn't read the learned codes." />
          <button type="button" onClick={() => { hapticLight(); reload(); }} className={`${QUIET} mt-1`}>Try again</button>
        </div>
      )}

      {open && !loading && !error && (
        <div className="mt-3">
          <p className="text-[11px] text-gray-600 dark:text-gray-300">
            {audit.rows.length} codes · <b>{audit.toCheck} to check</b> · {audit.unbacked} with no live car
          </p>
          {writeError && <SaveNote message={writeError} />}

          {GROUPS.map(g => {
            const rows = audit.rows.filter(r => groupOf(r) === g.id);
            if (rows.length === 0) return null;
            return (
              <div key={g.id} className="mt-3">
                <button
                  type="button"
                  onClick={() => { hapticLight(); setShown(s => ({ ...s, [g.id]: !s[g.id] })); }}
                  aria-expanded={shown[g.id]}
                  className="w-full flex items-center gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer"
                >
                  <span className="w-3">{shown[g.id] ? '▾' : '▸'}</span>
                  <span>{g.label}</span>
                  <span className="tabular-nums font-normal">{rows.length}</span>
                </button>
                {shown[g.id] && (
                  <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map(r => <CodeRow key={r.code} row={r} armed={armed} onArm={setArmed} onForget={forget} forgetClass={forgetClass} forgetModel={forgetModel} />)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CodeRow({ row: r, armed, onArm, onForget, forgetClass, forgetModel }: {
  row: ModelCodeRow;
  armed: string | null;
  onArm: (key: string | null) => void;
  onForget: (what: string, run: () => Promise<void>) => Promise<void>;
  forgetClass: (code: string) => Promise<void>;
  forgetModel: (code: string) => Promise<void>;
}) {
  // The taught model is the one that can go — whether it applies or the built-in list overrides it.
  const taughtName = r.shadowedTaught ?? (r.model?.source === 'taught' ? r.model.name : null);
  const actions = [
    r.canForgetClass && r.rentalClass
      ? { key: `${r.code}:class`, what: `class ${r.rentalClass.value}`, run: () => forgetClass(r.code) } : null,
    r.canForgetModel && taughtName
      ? { key: `${r.code}:model`, what: `taught ${taughtName}`, run: () => forgetModel(r.code) } : null,
  ].filter((a): a is { key: string; what: string; run: () => Promise<void> } => a !== null);

  return (
    <li className="py-1.5">
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className="font-mono font-semibold text-gray-900 dark:text-gray-100 w-14 shrink-0">{r.code}</span>
        <span className="flex-1 min-w-0 truncate text-gray-600 dark:text-gray-300">
          {r.model ? r.model.name : <span className="text-gray-400 dark:text-gray-500">no model</span>}
          {r.model && <span className="text-gray-400 dark:text-gray-500"> · {r.model.source}</span>}
        </span>
        {r.rentalClass && (
          <span className={CHIP} title={r.rentalClass.source}>
            {r.rentalClass.value}{r.rentalClass.source === 'pinned' ? ' 📌' : ''}
          </span>
        )}
        <span className="tabular-nums w-12 text-right text-gray-500 dark:text-gray-400">
          {r.liveCars} {r.liveCars === 1 ? 'car' : 'cars'}
        </span>
      </div>
      {r.problems.map(p => <p key={p} className="ml-16 text-[11px] text-amber-700 dark:text-amber-400">{p}</p>)}
      {r.notes.map(n => <p key={n} className="ml-16 text-[11px] text-gray-400 dark:text-gray-500">{n}</p>)}
      {actions.length > 0 && (
        <div className="ml-16 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
          {actions.map(a => armed === a.key ? (
            <span key={a.key} className="flex gap-3">
              <button type="button" aria-label={`Yes, forget ${a.what} for ${r.code}`} onClick={() => void onForget(`${a.what} for ${r.code}`, a.run)}
                className="text-[11px] font-semibold underline text-red-600 dark:text-red-400 cursor-pointer">Yes, forget it</button>
              <button type="button" aria-label={`Keep ${a.what} for ${r.code}`} onClick={() => { hapticLight(); onArm(null); }} className={QUIET}>Keep</button>
            </span>
          ) : (
            <button key={a.key} type="button" aria-label={`Forget ${a.what} for ${r.code}`} onClick={() => { hapticLight(); onArm(a.key); }} className={QUIET}>
              Forget {a.what}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
