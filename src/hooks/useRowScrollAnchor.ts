import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Keep a scroll box on the same PERSON across a re-render that changes row heights — not the same pixel.
 *
 * Aaron, 2026-09-14: *"one thing i've noticed while switching between weeks. i don't stay on the same set
 * of staff"*. Reproduced at 412px: Reo on top → next week Krish → back again John. The week grid is its
 * own scroll box (sticky edges, `ef7fb89`) and kept its offset in pixels; weeks differ in height (an
 * unposted driver block renders thinner rows), so a shorter week CLAMPED the offset and the taller week
 * coming back kept the clamped number. Every switch drifted a row or two.
 *
 * ⭐ So the anchor is the first visible row's id plus how far into the view it sits, recorded on every
 * scroll, and restored in a layout effect (before paint) whenever `restoreKey` changes.
 *
 * ⚠️⚠️ THE SCROLL EVENT A RESTORE CAUSES MUST NOT RE-RECORD. First draft did, and it failed exactly the
 * way the bug did: next week was too SHORT to put Reo on top (not enough rows below him), the browser
 * clamped, and the clamp's scroll event overwrote the anchor with Krish — so coming back restored
 * Krish. Only a scroll the PERSON makes may move the anchor; a clamped restore keeps the original
 * person, who returns to the top as soon as a tall-enough week does.
 *
 * Rows opt in with `data-row-id`. A row that no longer exists (a filter changed) restores nothing.
 */
export function useRowScrollAnchor(
  boxRef: RefObject<HTMLElement | null>,
  /** Change this whenever the rows may have re-laid-out — the week and its shifts. */
  restoreKey: unknown,
): () => void {
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  /** Set by a restore; the scroll events it produces are ours, not his. */
  const restoring = useRef(false);

  const viewTop = (box: HTMLElement) =>
    box.getBoundingClientRect().top + (box.querySelector('thead')?.getBoundingClientRect().height ?? 0);

  const capture = useCallback(() => {
    const box = boxRef.current;
    if (!box || restoring.current) return;
    const top = viewTop(box);
    for (const row of box.querySelectorAll<HTMLElement>('tbody tr[data-row-id]')) {
      const r = row.getBoundingClientRect();
      if (r.bottom > top) { anchor.current = { id: row.dataset.rowId!, offset: r.top - top }; return; }
    }
  }, [boxRef]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const a = anchor.current;
    if (!box || !a) return;                       // never scrolled — the top stays the top
    const row = box.querySelector<HTMLElement>(`tbody tr[data-row-id="${CSS.escape(a.id)}"]`);
    if (!row) return;
    restoring.current = true;
    box.scrollTop += (row.getBoundingClientRect().top - viewTop(box)) - a.offset;
    // Scroll events fire asynchronously; release after they have been delivered.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => { restoring.current = false; }));
    return () => { cancelAnimationFrame(id); restoring.current = false; };
  }, [boxRef, restoreKey]);

  return capture;
}
