// A dead network used to build a complete-looking shift report of ZEROS: none of its 14 reads checked for an error,
// and neither export button had a catch, so a failure was either a report that lied or a spinner that just stopped.
// (2026-10-18, docs/ticket-waited-on-reads-still-wait-seven-seconds.md.)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const DEAD = { data: null, error: { message: 'TypeError: Failed to fetch' } };
const chain: Record<string, unknown> = {};
for (const m of ['from', 'select', 'eq', 'is', 'in', 'or', 'not', 'gte', 'lte', 'lt', 'order', 'limit', 'maybeSingle']) chain[m] = () => chain;
chain.retry = () => Promise.resolve(DEAD);
vi.mock('../../src/lib/supabase', () => ({ supabase: chain, writeWithRefresh: (op: () => PromiseLike<unknown>) => op() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branchId: 'YWG', name: 'Aaron S.' } }) }));
vi.mock('../../src/context/PreferencesContext', () => ({ usePreferences: () => ({ prefs: { throughputBasis: 'gas-sheet' } }) }));
vi.mock('../../src/context/ScheduleContext', () => ({ useSchedule: () => ({ shifts: [] }) }));
vi.mock('../../src/hooks/useAirportFlip', () => ({ useAirportFlip: () => ({ rows: [] }) }));
const share = vi.fn();
vi.mock('../../src/hooks/useShareText', () => ({ useShareText: () => ({ copied: false, share }) }));

const { ShiftReportExport } = await import('../../src/components/analytics/ShiftReportExport');

describe('ShiftReportExport — a shift that could not load', () => {
  it('⭐ refuses to build the report and says why, instead of sharing a report of zeros', async () => {
    render(<ShiftReportExport date="2026-10-18" />);
    fireEvent.click(screen.getByRole('button', { name: /Plain Text/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your whole shift");
    expect(share).not.toHaveBeenCalled();
  });
  it('the PDF button says the same', async () => {
    render(<ShiftReportExport date="2026-10-18" />);
    fireEvent.click(screen.getByRole('button', { name: /Download PDF/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your whole shift");
  });
});
