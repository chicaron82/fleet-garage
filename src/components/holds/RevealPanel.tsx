import { useRevealScroll } from '../../hooks/useRevealScroll';
import type { ReactNode } from 'react';

/**
 * Wrapper for a conditionally-rendered action panel that should scroll itself into view the moment
 * it appears. Mounting IS the reveal, so the scroll lives in a component that mounts with the
 * panel — the parent screen never remounts, so a hook called up there would fire once on page load
 * and never again.
 *
 * Wrapping at the call site rather than inside each panel keeps ReleaseForm / RepairResolution
 * untouched: both early-return sub-components and have no single root element to hold a ref.
 */
export function RevealPanel({ children }: { children: ReactNode }) {
  const ref = useRevealScroll<HTMLDivElement>();
  return <div ref={ref}>{children}</div>;
}
