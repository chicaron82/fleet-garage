// The airport, as drivers tap it: two rows of five notches and the aisle flag (migration 157). Used by the drivers'
// /lot page and FG's Lot Lookout module, so both tap the same way.
//
// ⭐ His design and rulings, 2026-10-18 (docs/ticket-lot-lookout-swatches-too-many-targets.md): *"picking between three
// states is a little much. especially when moving quickly"*; *"notches are fine, scrap the stale time and stall map"*.
// Each notch is ONE tap, never a drag: a slider on a scrolling page is the classic stray write, and his rule for a path
// a thumb scrolls through is that a stray touch may open, never write. The whole thing fits a phone without scrolling.
import { agoLabel, minutesAgo } from '../../lib/lotLookout';
import { CLEANS_NOTCHES, NOTCH_HEX, RETURNS_NOTCHES, ROOM_TEXT, type AirportField, type AirportReadings, type Notch } from '../../lib/lotAirport';

interface Props {
  shown: AirportReadings;
  nowMs: number;
  onTap: (field: AirportField, value: number) => void;
}

const CARD = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2.5';

function age(at: string | null, nowMs: number): string {
  const m = minutesAgo(at, nowMs);
  return m == null ? 'not read yet' : agoLabel(m);
}

function NotchRow({ label, notches, value, onPick }: {
  label: string; notches: readonly string[]; value: Notch | null; onPick: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
      {notches.map((name, i) => {
        const on = value === i;
        const filled = value != null && i <= value;
        return (
          <button key={name} type="button" onClick={() => onPick(i)} aria-pressed={on} aria-label={`${label}: ${name}`}
            className={`min-h-14 rounded-xl border-[3px] px-0.5 text-sm font-bold cursor-pointer active:scale-95 transition ${
              on ? 'border-gray-900 dark:border-white text-white' : filled ? 'border-transparent text-white' : 'border-transparent text-gray-800 dark:text-gray-100'}`}
            style={filled ? { background: NOTCH_HEX[i] } : { background: `${NOTCH_HEX[i]}26` }}>
            {name}
          </button>
        );
      })}
    </div>
  );
}

export function AirportNotches({ shown, nowMs, onTap }: Props) {
  return (
    <div className="space-y-3">
      <section className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold">Cleans on the lot</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{age(shown.cleansAt, nowMs)}</span>
        </div>
        <NotchRow label="Cleans on the lot" notches={CLEANS_NOTCHES} value={shown.cleans} onPick={v => onTap('cleans', v)} />
        {shown.cleans != null && (
          <p className="text-sm font-semibold" style={{ color: NOTCH_HEX[shown.cleans] }}>The bay reads: {ROOM_TEXT[shown.cleans]}</p>
        )}
      </section>

      <section className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold">Returns waiting</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{age(shown.returnsAt, nowMs)}</span>
        </div>
        <NotchRow label="Returns waiting" notches={RETURNS_NOTCHES} value={shown.returns} onPick={v => onTap('returns', v)} />
      </section>

      <button type="button" onClick={() => onTap('aisle', shown.aisle ? 0 : 1)} aria-pressed={shown.aisle}
        className={`w-full min-h-16 rounded-2xl border-[3px] flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-[0.98] transition ${
          shown.aisle ? 'bg-red-700 border-red-900 text-white' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'}`}>
        <span className="text-base font-bold">{shown.aisle ? 'Cars in the aisle' : 'Aisle is clear'}</span>
        <span className="text-xs font-medium opacity-90">
          {shown.aisle ? 'Tap when it clears' : 'Tap if cars get parked in it'} · {age(shown.aisleAt, nowMs)}
        </span>
      </button>
    </div>
  );
}
