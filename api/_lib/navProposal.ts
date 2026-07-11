// A 'navigate' proposal — the assistant offers to take the user to a screen for
// something that lives there (flagship: importing a schedule from a photo). Unlike the
// write proposals, confirming it just NAVIGATES (no DB write) — safe by construction. The
// proxy carries a string destination; the client maps it to a real Screen. Pure + tested.

export const NAV_DESTINATIONS = [
  'schedule-import',
  'lost-found',
  'issue-log',
  'my-shift',
  'movement-log',
] as const;
export type NavDestination = (typeof NAV_DESTINATIONS)[number];

const LABELS: Record<NavDestination, string> = {
  'schedule-import': 'Schedule — Import from photo',
  'lost-found': 'Lost & Found',
  'issue-log': 'Issue Log',
  'my-shift': 'My Shift',
  'movement-log': 'Movement Log',
};

export interface NavigateProposal {
  kind: 'navigate';
  destination: NavDestination;
  label: string;
}

/** Build a navigate proposal for a known destination, else null (ignored). */
export function buildNavigateProposal(dest: string): NavigateProposal | null {
  const d = dest.trim() as NavDestination;
  if (!(NAV_DESTINATIONS as readonly string[]).includes(d)) return null;
  return { kind: 'navigate', destination: d, label: LABELS[d] };
}

/** Short echo for the tool result. */
export function describeNavigate(p: NavigateProposal): string {
  return `offer to open ${p.label}`;
}
