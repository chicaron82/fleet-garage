import { useState } from 'react';
import { asRotation } from '../../lib/keytagPhotoRotation';

/**
 * The key-tag photo, turned and zoomed without breaking the page.
 *
 * ⚠️⚠️ WHY A COMPONENT AND NOT A STYLE HELPER. `rotationStyle` returned width/height/objectFit for a
 * quarter-turn, and BOTH of Aaron's rotation bugs (2026-08-30) come from that being the wrong shape
 * for the job:
 *
 *   *"rotating before zooming, goes over the keycount"* — a CSS `transform` does not affect LAYOUT.
 *   The turned image kept its upright footprint in the flow and painted outside it, straight over
 *   the controls below.
 *
 *   *"rotating after zooming, i can't zoom in further"* — the style was spread AFTER the zoom width
 *   (`{ width: scale*100%, ...rotationStyle(rotation) }`), so a quarter-turn's `width: '100%'`
 *   silently clobbered it. Tapping still moved `scale`; nothing moved on screen.
 *
 * ⭐ Both are the same root cause: rotation was being expressed as properties ON the image, where it
 * cannot reserve space and can collide with the sizing the caller already set. Here the rotation
 * belongs to a BOX that holds the correct footprint, and the image is positioned inside it.
 */
export function KeytagPhoto({ src, alt, rotation, scale, onClick, title }: {
  src: string;
  alt: string;
  rotation: number | null | undefined;
  /** Zoom stage only: 1-3. Omit for the card thumbnail, which is a fixed square. */
  scale?: number;
  onClick?: () => void;
  title?: string;
}) {
  const deg = asRotation(rotation);
  const swapped = deg === 90 || deg === 270;
  // The photo's own proportions, which decide how much room a quarter-turn actually needs. Read off
  // the element rather than guessed — 1 until it loads, which is square and therefore safe.
  const [ratio, setRatio] = useState(1);        // natural width / height

  const img = (
    <img
      src={src} alt={alt}
      onLoad={e => {
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
        if (w > 0 && h > 0) setRatio(w / h);
      }}
      className="absolute top-1/2 left-1/2 max-w-none"
      style={{
        // ⭐ THE ONE PIECE OF ARITHMETIC. Rotated a quarter turn, an image renders its HEIGHT as
        // width and its WIDTH as height. To land a box of width W, the image must be drawn at
        // W × ratio wide — then its own height is W, which becomes the rendered width. The box
        // below carries the matching aspect, so the footprint is real and nothing spills.
        width: swapped ? `${ratio * 100}%` : '100%',
        transform: `translate(-50%, -50%) rotate(${deg}deg)`,
      }}
    />
  );

  // ⚠️ SQUARE ON THE CARD, deliberately. A square box is the only shape where every quarter-turn
  // fits with no arithmetic at all, and the thumbnail's job is "tap this to read it" — not reading.
  // `overflow-hidden` is the belt to that braces: whatever happens in here cannot reach the form.
  if (scale === undefined) {
    return (
      <div className="relative mx-auto aspect-square w-full max-w-[18rem] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
        {img}
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} title={title}
      className="block w-full cursor-zoom-in">
      <div
        className="relative mx-auto"
        style={{
          width: `${scale * 100}%`,
          // The box a quarter-turn actually occupies: the photo's aspect, inverted. Declaring it
          // means the scroll container can see the rotated size and lets him pan to the corner of
          // a 3× tag, which was the whole point of zooming.
          aspectRatio: String(swapped ? 1 / ratio : ratio),
        }}
      >
        {img}
      </div>
    </button>
  );
}
