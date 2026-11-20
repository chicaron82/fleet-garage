// The first size step that fits (docs/ticket-lot-view-left-column-fits.md). Aaron, 2026-11-19, on the read-only
// desktop's pinned column: *"Maybe a custom sizer? To make it smaller incrementally if things don't fit"*.
//
// `heightAt(t)` measures the column at step t; `room` is what the window has for it. Steps 0..last-1 are sizes, full
// first. If none fits, the answer is `last`: the column scrolls on its own, so nothing is ever out of reach.
export function fitTier(heightAt: (tier: number) => number, room: number, last: number): number {
  for (let t = 0; t < last; t++) if (heightAt(t) <= room) return t;
  return last;
}
