// Lot Lookout's map, drawn like the printed WINNIPEG AIRPORT PARKING LOT sheet (1965 Wellington): the Tesla/EV
// row by the sliding doors on top; then P | the lane | O and N back to back | the return lane | Alamo.
// O1 is the cart return and N1–N2 the HIR booth, so they are drawn but never tappable.
//
// Aaron's rulings (2026-10-14, over the mockup): the colours live ON the stall — three swatches to tap, the stall
// itself filled with the full colour so the lot reads at a glance; open stays uncoloured; a stall nobody has
// looked at in 2 hours fades to its tint. With no `onTap` the map is read-only (FG's My Day view).
//
// TAKEN (2026-10-15): HOLD a stall to grey it out — a customer's or staff car is in it. His ruling: *"so even if
// the finger lands on a colour as long as it's on the right stall it works"*. So the hold lives on the whole stall,
// swatches included, and a hold that fires swallows the click that follows it: a long press on green never also
// marks the stall clean. A finger that moves (a scroll) cancels the hold.
import { useRef } from 'react';
import { HOLD_MS, initialsOf, isMisparked, isStale, LOT_STATES, minutesAgo, shortAgo, type LotAisle, type LotColour, type LotState, type LotStall } from '../../lib/lotLookout';

interface Props {
  stalls: LotStall[];
  aisle: LotAisle;
  nowMs: number;
  nPulse: boolean;
  onTap?: (stall: string, state: LotState) => void;
  onAisle?: (delta: 1 | -1) => void;
}

const FILL: Record<string, string> = {
  'clean-fresh': 'bg-green-700 border-green-700 text-white',
  'dirty-fresh': 'bg-red-700 border-red-700 text-white',
  'clean-stale': 'bg-green-200 border-green-200 text-gray-900 dark:bg-green-900 dark:border-green-900 dark:text-gray-100',
  'dirty-stale': 'bg-red-200 border-red-200 text-gray-900 dark:bg-red-900 dark:border-red-900 dark:text-gray-100',
  taken: 'bg-gray-500 border-gray-500 text-white dark:bg-gray-600 dark:border-gray-600',
  open: 'bg-white border-gray-400 text-gray-900 dark:bg-gray-900 dark:border-gray-500 dark:text-gray-100',
  none: 'bg-white border-gray-200 text-gray-400 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-500',
};
const SWATCH: Record<LotColour, string> = {
  open: 'bg-white border-gray-300',
  clean: 'bg-green-200 border-green-200 dark:bg-green-800 dark:border-green-800',
  dirty: 'bg-red-200 border-red-200 dark:bg-red-800 dark:border-red-800',
};

/** A finger that drifts further than this is scrolling, not holding. */
const HOLD_SLOP_PX = 10;

/** Hold the stall → `onHold`, once; the click that ends the hold is swallowed so no swatch fires with it. */
function useHold(onHold: (() => void) | undefined) {
  const timer = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => { if (timer.current) { clearTimeout(timer.current.t); timer.current = null; } };
  if (!onHold) return {};
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      cancel();
      timer.current = {
        x: e.clientX, y: e.clientY,
        t: setTimeout(() => { timer.current = null; fired.current = true; navigator.vibrate?.(30); onHold(); }, HOLD_MS),
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer.current && Math.hypot(e.clientX - timer.current.x, e.clientY - timer.current.y) > HOLD_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { fired.current = false; e.stopPropagation(); e.preventDefault(); } },
    // A long press on a phone opens the browser's own menu or selects text; the hold is ours.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function Cell({ s, nowMs, vertical, pulse, onTap }: { s: LotStall; nowMs: number; vertical: boolean; pulse: boolean; onTap?: Props['onTap'] }) {
  const hold = useHold(onTap ? () => onTap(s.stall, 'taken') : undefined);
  const stale = isStale(s, nowMs);
  const fresh = !stale;
  const key = s.state === 'clean' || s.state === 'dirty' ? `${s.state}-${fresh ? 'fresh' : 'stale'}`
    : s.state === 'taken' ? 'taken' : s.state === 'open' ? 'open' : 'none';
  const solid = (fresh && (s.state === 'clean' || s.state === 'dirty')) || s.state === 'taken';
  const ago = minutesAgo(s.tappedAt, nowMs);
  const mis = isMisparked(s);
  const who = ago == null ? '' : `${initialsOf(s.tappedBy)} ${shortAgo(ago)}`;
  return (
    <div className={`relative min-w-0 rounded-md border-[1.5px] p-[3px] grid gap-[3px] ${FILL[key]} ${pulse || mis ? 'lot-pulse' : ''} ${onTap ? 'select-none' : ''}`}
      style={{ gridTemplateRows: 'auto 1fr', WebkitTouchCallout: 'none' }} data-stall={s.stall} {...hold}>
      <div className={`flex min-w-0 gap-0.5 ${vertical ? 'flex-col' : 'items-baseline justify-between pl-0.5'}`}>
        {/* Not mono: in a monospace face "O2" reads as "02". */}
        <span className="font-bold text-xs leading-tight">{s.stall}</span>
        <span className={`text-[9px] leading-tight whitespace-nowrap overflow-hidden ${solid ? 'text-white/85' : 'text-gray-500 dark:text-gray-400'}`}>{who}</span>
      </div>
      {onTap && (
        <div className={`grid gap-[3px] ${vertical ? 'grid-cols-1 grid-rows-3' : 'grid-cols-3'}`} role="group" aria-label={`${s.stall}${s.state === 'taken' ? ', taken' : ''}${who ? `, ${s.tappedBy} ${shortAgo(ago)} ago` : ', not looked at'}`}>
          {LOT_STATES.map(v => (
            <button key={v} type="button" onClick={() => onTap(s.stall, v)} aria-label={`${s.stall} ${v}`} aria-pressed={s.state === v}
              className={`rounded border-[1.5px] cursor-pointer ${vertical ? 'min-h-5' : 'min-h-[22px]'} ${SWATCH[v]} ${
                s.state === v ? `outline outline-[2.5px] outline-offset-1 ${solid ? 'outline-white' : 'outline-gray-900 dark:outline-gray-100'}` : ''}`} />
          ))}
        </div>
      )}
      {mis && (
        <span aria-hidden="true" className="absolute -top-2 -right-1.5 w-4 h-4 rounded-full bg-red-700 text-white text-[10px] font-extrabold grid place-items-center border-2 border-white dark:border-gray-900">!</span>
      )}
    </div>
  );
}

function Blocked({ label, rows }: { label: string; rows: 1 | 2 }) {
  return (
    <div className={`rounded-md border-[1.5px] border-dashed border-gray-300 dark:border-gray-700 grid place-items-center text-center text-[9px] leading-tight text-gray-400 p-0.5 ${rows === 2 ? 'row-span-2' : ''}`}
      style={{ background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(156,163,175,0.35) 6px 7px)' }}>
      {label}
    </div>
  );
}

export function LotMap({ stalls, aisle, nowMs, nPulse, onTap, onAisle }: Props) {
  const byRun = (run: LotStall['run']) => stalls.filter(s => s.run === run).sort((a, b) => a.num - b.num);
  const rowH = onTap ? 58 : 34;
  const column = (run: 'P' | 'O' | 'N') => (
    <div className="grid gap-1" style={{ gridTemplateRows: `repeat(20, ${rowH}px)` }}>
      {run === 'O' && <Blocked label="O1 cart" rows={1} />}
      {run === 'N' && <Blocked label="N1–N2 HIR booth" rows={2} />}
      {byRun(run).map(s => <Cell key={s.stall} s={s} nowMs={nowMs} vertical={false} pulse={run === 'N' && nPulse && s.state === 'dirty'} onTap={onTap} />)}
    </div>
  );
  const cap = 'text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400';
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-950 p-2.5 space-y-2.5">
      <div className="grid gap-2.5 items-end" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
        <div>
          <div className={cap}>Tesla / EV</div>
          <div className="grid grid-cols-6 gap-[3px]">
            {byRun('S').map(s => <Cell key={s.stall} s={s} nowMs={nowMs} vertical pulse={false} onTap={onTap} />)}
          </div>
        </div>
        <div className="self-stretch grid place-items-center max-w-[46px] rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-1 text-center text-[9px] leading-tight text-gray-500">Sliding doors</div>
      </div>
      <div className="text-center text-[10px] tracking-wide text-gray-500">← to Hertz, Dollar, Thrifty</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'minmax(0,1fr) 14px minmax(0,2fr) 40px 22px' }}>
        <div><div className={cap}>P</div>{column('P')}</div>
        <div className="flex flex-col justify-around items-center text-gray-400 text-sm" aria-hidden="true"><span>↑</span><span>↑</span><span>↑</span><span>↑</span></div>
        <div>
          <div className="grid grid-cols-2 gap-1"><div className={cap}>O</div><div className={cap}>N</div></div>
          <div className="grid grid-cols-2 gap-1">
            <div className="border-r-2 border-gray-300 dark:border-gray-700 pr-1">{column('O')}</div>
            {column('N')}
          </div>
        </div>
        {/* ⭐ The aisle stepper sits at the TOP of the lane, level with the N1–N2 booth. Aaron, 2026-10-15: "how bout
            moving the aisle stepper up closer to the HIR booth, instead of have to scroll down further to reach it".
            It was centred on the lane, about ten stalls down, so every aisle tap cost a scroll past the board. */}
        <div className="flex flex-col items-center gap-1.5 pb-2 text-[10px] font-bold tracking-widest text-gray-500 text-center leading-tight">
          <div className={`grid justify-items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-0.5 py-1 ${aisle.cars > 0 ? 'lot-pulse' : ''}`} aria-label="Cars left in the aisle">
            <small className="text-[8px] font-semibold tracking-wide">AISLE</small>
            {onAisle && <button type="button" onClick={() => onAisle(1)} aria-label="One more in the aisle" className="w-[34px] h-[34px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-lg font-bold text-gray-900 dark:text-gray-100 cursor-pointer">+</button>}
            <output className={`text-lg font-extrabold tabular-nums ${aisle.cars > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{aisle.cars}</output>
            {onAisle && <button type="button" onClick={() => onAisle(-1)} aria-label="One fewer in the aisle" className="w-[34px] h-[34px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-lg font-bold text-gray-900 dark:text-gray-100 cursor-pointer">−</button>}
          </div>
          <span>R<br />E<br />T<br />U<br />R<br />N</span>
          <span className="mt-auto">L<br />A<br />N<br />E</span>
        </div>
        <div className="rounded-md border border-gray-200 dark:border-gray-700 grid place-items-center text-[10px] tracking-[0.25em] uppercase text-gray-400" style={{ writingMode: 'vertical-rl' }}>Alamo parking</div>
      </div>
    </div>
  );
}
