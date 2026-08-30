// A quarter-turn for a sideways key tag — display metadata, never a re-encode.
//
// Aaron, auditing the batch that landed 2026-08-30: *"some are shown on its side is there a way to
// rotate them here in the audit, and the saved photo as well?"* LFJ368's tag sits at ~30°, LFJ400's
// was fully sideways — and settling that VIN meant cropping and rotating the file by hand.
//
// ⭐ WHY THE FILE IS NEVER TOUCHED. Re-encoding to "bake in" a rotation is destructive and
// irreversible on an image whose entire job is being legible enough to read a VIN off — a JPEG
// round-trip costs exactly the detail that matters. Storing the angle instead makes a wrong turn
// one more tap rather than a re-upload, and keeps the captured file as the camera produced it.
// Migration 133.

export type Rotation = 0 | 90 | 180 | 270;

const TURNS: readonly Rotation[] = [0, 90, 180, 270];

/** Normalise anything the DB or a stale client hands us to a legal quarter-turn. */
export function asRotation(v: number | null | undefined): Rotation {
  const n = ((Math.round((v ?? 0) / 90) * 90) % 360 + 360) % 360;
  return (TURNS.includes(n as Rotation) ? n : 0) as Rotation;
}

/** The next quarter-turn clockwise — what the rotate button applies. Wraps 270 → 0 so four taps
 *  always return the photo to exactly how it was captured. */
export function nextRotation(v: number | null | undefined): Rotation {
  return asRotation(asRotation(v) + 90);
}

/**
 * The style for an `<img>` inside a fixed-size box.
 *
 * ⚠️ A QUARTER-TURN SWAPS THE AXES, so a portrait photo rotated 90° needs the box's HEIGHT as its
 * width or it renders letterboxed into a sliver — the whole point being defeated on exactly the
 * photos that need turning. Hence the swapped sizing on the odd turns.
 */
export function rotationStyle(v: number | null | undefined): React.CSSProperties {
  const deg = asRotation(v);
  if (deg === 0) return {};
  const swapped = deg === 90 || deg === 270;
  return {
    transform: `rotate(${deg}deg)`,
    ...(swapped ? { width: '100%', height: '100%', objectFit: 'contain' as const } : {}),
  };
}

/** Screen-reader / tooltip text. Silent at 0 — an unrotated photo needs no explanation. */
export function rotationLabel(v: number | null | undefined): string {
  const deg = asRotation(v);
  return deg === 0 ? '' : `rotated ${deg}°`;
}
