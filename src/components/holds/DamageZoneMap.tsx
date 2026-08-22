// The tap-a-panel diagram. Top-down car, passenger side up, driver side down, front left — the
// same orientation as the paper Vehicle Inspection slip (#9000501) Aaron fills by hand, so the two
// read the same way round and he never has to re-orient between them.
//
// ⭐ A PURE RENDERER, AND A PURE TOGGLE. No camera, no damage type, no dragging. Tapping a panel
// says "damage is on this one" and nothing more — the photos already on the hold carry the precise
// spot (he hand-circles them) and what kind of damage it is. Every richer version of this got cut,
// twice by Aaron, for the same reason: it was asking him to re-enter what the picture already held.
//
// No labels on the diagram itself: at phone width they render smaller than a fingernail. The chips
// beside it name what is selected, which is where a name is actually legible.
import { DAMAGE_ZONES, CAR_OUTLINE, zoneLabel } from '../../lib/damageZones';

interface Props {
  /** Currently tagged zone ids. */
  selected: readonly string[];
  /** Tap a panel. Parent decides whether that writes immediately or stages a draft. */
  onToggle: (id: string) => void;
  /** Read-only view — the diagram still shows what is tagged, it just does not accept taps. */
  disabled?: boolean;
  /** Panels the hold's own note suggests, drawn as a dashed OUTLINE rather than a fill.
   *  ⚠️ Visually distinct from `selected` on purpose: a proposal that looks like a selection is a
   *  proposal that gets confirmed without being read, which is how a guess becomes a record. */
  candidates?: readonly string[];
}

export function DamageZoneMap({ selected, onToggle, disabled = false, candidates = [] }: Props) {
  const isOn = (id: string) => selected.includes(id);
  const isCandidate = (id: string) => !selected.includes(id) && candidates.includes(id);

  return (
    <svg
      viewBox={CAR_OUTLINE.viewBox}
      className="w-full h-auto select-none"
      role="group"
      aria-label="Car diagram — tap a panel to record damage there"
      data-testid="damage-zone-map"
    >
      {/* Orientation. Without these the diagram is just a grid of boxes — this is the bit that
          makes it readable in one glance, and it matches the wording on the paper slip. */}
      <text x="26" y="356" transform="rotate(-90 26 356)" textAnchor="middle"
            className="fill-gray-400 text-[15px] font-semibold tracking-wide">FRONT</text>
      <text x="874" y="356" transform="rotate(90 874 356)" textAnchor="middle"
            className="fill-gray-400 text-[15px] font-semibold tracking-wide">REAR</text>
      <text x="450" y="132" textAnchor="middle"
            className="fill-gray-400 text-[15px] font-semibold tracking-wide">PASSENGER SIDE</text>
      <text x="450" y="588" textAnchor="middle"
            className="fill-gray-400 text-[15px] font-semibold tracking-wide">DRIVER SIDE</text>

      {/* Body shell + cabin, under everything — the shape that makes it read as a car. */}
      {CAR_OUTLINE.shells.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx}
              className="fill-none stroke-gray-300 dark:stroke-gray-600" strokeWidth={3} />
      ))}
      {CAR_OUTLINE.seams.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={2} />
      ))}

      {/* The zones themselves are the hit boxes — nothing is layered over them, because a
          decorative dot that eats a tap is a bug you only find on a real phone. */}
      {DAMAGE_ZONES.map(z => {
        const on = isOn(z.id);
        const suggested = isCandidate(z.id);
        return (
          <rect
            key={z.id}
            x={z.x} y={z.y} width={z.w} height={z.h} rx={z.rx}
            role="checkbox"
            aria-checked={on}
            aria-label={zoneLabel(z.id)}
            aria-disabled={disabled || undefined}
            data-zone={z.id}
            onClick={disabled ? undefined : () => onToggle(z.id)}
            strokeWidth={on || suggested ? 3 : 1.5}
            strokeDasharray={suggested ? '10 7' : undefined}
            data-suggested={suggested || undefined}
            className={[
              'transition-colors',
              disabled ? '' : 'cursor-pointer',
              on
                ? 'fill-red-500/35 stroke-red-500'
                : suggested
                  ? 'fill-amber-400/15 stroke-amber-500'
                  : 'fill-transparent stroke-gray-300/70 dark:stroke-gray-600/70' +
                    (disabled ? '' : ' hover:fill-gray-400/20'),
            ].join(' ')}
          />
        );
      })}
    </svg>
  );
}
