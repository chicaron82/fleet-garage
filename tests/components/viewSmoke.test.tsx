import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Smoke renders for the highest-traffic screens that had zero render coverage:
// each test asserts only "mounts without throwing, renders SOMETHING" with
// realistic-but-empty context data. The goal is cheap insurance — a broken
// import, renamed prop, or undefined destructure in these views should fail CI,
// not wait for a human on the lot. Behaviour stays covered by the lib tests.

// ── Universal supabase stub: any query chain resolves { data: null } ─────────
function makeQuery() {
  const q: Record<string, unknown> = {};
  const self = () => q;
  for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'gte', 'gt', 'lt', 'lte', 'in', 'is', 'not', 'filter', 'insert', 'update', 'delete', 'upsert', 'maybeSingle', 'single']) {
    q[m] = self;
  }
  (q as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) => resolve({ data: null, error: null });
  return q;
}

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => makeQuery(),
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => {},
  },
  writeWithRefresh: vi.fn(async (fn: () => unknown) => { fn(); return { data: null, error: null }; }),
}));

// ── Context mocks: VSA user + empty-but-shaped domain data ───────────────────
const VSA = { id: 'u-1', employeeId: 'E001', name: 'Smoke VSA', role: 'VSA', branchId: 'YWG' };

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: VSA, activeBranch: 'YWG', login: vi.fn(), logout: vi.fn(), setActiveBranch: vi.fn() }),
}));

vi.mock('../../src/context/WashbayContext', () => ({
  useWashbayContext: () => ({
    washbayLogs: [], handoffNotes: [], shiftCheckpoints: [],
    latestHandoff: null, loadError: null,
    getTodayCheckpoint: () => null, getLatestGasSheetReading: () => null,
    addWashbayLog: vi.fn(), addHandoffNote: vi.fn(), addShiftCheckpoint: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock('../../src/context/ScheduleContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual, // keep pure exports like toISO
    useSchedule: () => ({
      shifts: [], todayShifts: [], myShifts: [], blockedDays: [], isPeakSeason: false,
      getShiftsForDate: () => [], addShift: vi.fn(), updateShift: vi.fn(), removeShift: vi.fn(),
    }),
  };
});

vi.mock('../../src/context/FleetBalanceContext', () => ({
  useFleetBalanceContext: () => ({
    entries: [], getTodayEntry: () => null, getProjection: () => null, upsertEntry: vi.fn(),
  }),
}));

vi.mock('../../src/context/IssueContext', () => ({
  useIssueContext: () => ({
    facilityIssues: [], addIssue: vi.fn(), clearIssue: vi.fn(), reopenIssue: vi.fn(),
    addIssuePhoto: vi.fn(), deleteIssue: vi.fn(),
  }),
}));

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles: [], holds: [], staleHolds: [],
    getActiveHold: () => null, getActiveHolds: () => [], getHoldsForVehicle: () => [],
    addHold: vi.fn(), addVehicle: vi.fn(), releaseStreak: 0,
  }),
}));

vi.mock('../../src/context/PendingWritesContext', () => ({
  usePendingWritesContext: () => ({ pending: [], stage: vi.fn(), markResolved: vi.fn(), reload: vi.fn() }),
}));

vi.mock('../../src/context/LostFoundContext', () => ({
  useLostFoundContext: () => ({
    items: [], addItem: vi.fn(), updateItem: vi.fn(), markReturned: vi.fn(), deleteItem: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useUserResolver', () => ({
  useUserResolver: () => ({ resolveName: () => 'Someone', resolveUser: () => null }),
}));

// jsdom has no scrollIntoView; ManifestView scrolls its now-line on mount.
Element.prototype.scrollIntoView = vi.fn();

describe('view smoke renders', () => {
  it('MyShiftView mounts', async () => {
    const { MyShiftView } = await import('../../src/components/my-shift/MyShiftView');
    const { container } = render(<MyShiftView />);
    expect(container.firstChild).not.toBeNull();
  });

  it('ManifestView mounts', async () => {
    const { ManifestView } = await import('../../src/components/manifest/ManifestView');
    const { container } = render(<ManifestView />);
    expect(container.firstChild).not.toBeNull();
  });

  it('IssueLogView mounts', async () => {
    const { IssueLogView } = await import('../../src/components/issue-log/IssueLogView');
    const { container } = render(<IssueLogView />);
    expect(container.firstChild).not.toBeNull();
  });
});
