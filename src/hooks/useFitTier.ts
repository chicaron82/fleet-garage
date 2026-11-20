import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { fitTier } from '../lib/fitTier';

/**
 * Size the read-only desktop's pinned column to the window (docs/ticket-lot-view-left-column-fits.md).
 *
 * The column carries `data-fit={tier}`; lotFit.css shrinks it per step. To pick a step, it tries each one directly on the
 * element (a forced layout, so no flicker), keeps the first that fits, and re-checks whenever the window or the
 * column's content changes size: an On-break banner, a held-cars tile, a resize. It grows back when there's room.
 *
 * `inner` is the column's content, measured at its natural height (the column itself is capped on the scroll step,
 * so it can't report a banner going away). Below `lg` it stays at 0: a phone scrolls the page, nothing is pinned.
 *
 * Callback refs that bump `attached`: the column only exists once the bay has loaded, after the first render. A plain
 * ref object's effect ran once against "Loading the bay…" and never saw it (caught on the first render, 2026-11-19).
 * Destructure the result: the react-hooks lint reads `x.tier` as a ref read once `x.outer` has been a ref.
 */
export function useFitTier(last: number, gap = 24) {
  const col = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const [attached, setAttached] = useState(0);
  const [tier, setTier] = useState(0);
  const outer = useCallback((el: HTMLDivElement | null) => { col.current = el; setAttached(n => n + 1); }, []);
  const inner = useCallback((el: HTMLDivElement | null) => { body.current = el; setAttached(n => n + 1); }, []);
  useLayoutEffect(() => {
    const c = col.current, b = body.current;
    if (!c || !b || typeof ResizeObserver === 'undefined') return;
    const wide = window.matchMedia('(min-width: 1024px)');
    const fit = () => {
      const t = wide.matches ? fitTier(s => { c.dataset.fit = String(s); return b.offsetHeight; },
        window.innerHeight - gap * 2, last) : 0;
      c.dataset.fit = String(t);
      setTier(t);
    };
    // Out of the observer's own callback: a step changes the size it is watching (the "ResizeObserver loop" warning).
    let frame = 0;
    const soon = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    fit();
    const ro = new ResizeObserver(soon);
    ro.observe(b);
    window.addEventListener('resize', soon);
    return () => { ro.disconnect(); window.removeEventListener('resize', soon); cancelAnimationFrame(frame); };
  }, [attached, last, gap]);
  return { outer, inner, tier };
}
