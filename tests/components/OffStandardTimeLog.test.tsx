import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OffStandardTimeLog } from '../../src/components/off-standard/OffStandardTimeLog';
import { enqueueOfflineAction } from '../../src/lib/offlineQueue';
import type { User } from '../../src/types';

// Mocks
const TEST_USER: User = {
  id: 'u1',
  employeeId: 'EMP100',
  name: 'Test VSA',
  role: 'VSA',
  branchId: 'YWG',
};

const insertSpy = vi.fn().mockResolvedValue({ error: null });
const updateSpy = vi.fn().mockResolvedValue({ error: null });
const deleteSpy = vi.fn().mockResolvedValue({ error: null });

vi.mock('../../src/lib/supabase', () => {
  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    insert: vi.fn((...args) => {
      insertSpy(...args);
      return queryBuilder;
    }),
    update: vi.fn((...args) => {
      updateSpy(...args);
      return queryBuilder;
    }),
    delete: vi.fn((...args) => {
      deleteSpy(...args);
      return queryBuilder;
    }),
    eq: vi.fn(() => queryBuilder),
    gte: vi.fn(() => queryBuilder),
    not: vi.fn(() => queryBuilder),
    or: vi.fn(() => queryBuilder),
    limit: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
    single: vi.fn(() => Promise.resolve({ data: { id: 'mock-id' }, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn((resolve) => {
      if (resolve) {
        resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
  };

  return {
    writeWithRefresh: vi.fn().mockImplementation((cb) => cb()),
    supabase: {
      from: vi.fn(() => queryBuilder),
    },
  };
});

vi.mock('../../src/lib/offlineQueue', () => ({
  enqueueOfflineAction: vi.fn().mockReturnValue('mock-action-uuid'),
  getOfflineQueue: vi.fn().mockReturnValue([]),
  saveOfflineQueue: vi.fn(),
  flushOfflineQueue: vi.fn(),
}));

vi.mock('../../src/context/ProfilesContext', () => ({
  useProfiles: () => [],
}));

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    holds: [],
    vehicles: [],
  }),
}));

vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({
    shifts: [],
  }),
}));

// The active-session pill context — stub it (no trip/oth running) so the timer
// test stays focused; covers both OffStandardTimeLog and the nested session hook.
vi.mock('../../src/context/ActiveSessionsContext', () => ({
  useActiveSessions: () => ({
    trip: null, oth: null, refresh: vi.fn(),
    movementTab: 'movement-log', setMovementTab: vi.fn(),
  }),
}));

// EDV plate recognition composes useVehicleByPlate (Auth + VehicleHold context);
// stub it so the timer test stays focused on the off-standard write path.
vi.mock('../../src/hooks/useVehicleByPlate', () => ({
  useVehicleByPlate: () => ({ resolve: async () => null, remember: async () => null }),
}));

// Date Proxy Setup
const RealDate = global.Date;
let mockTime: number | null = null;

const MockDate: DateConstructor = new Proxy(RealDate, {
  construct(target, args) {
    if (args.length === 0 && mockTime !== null) {
      return new RealDate(mockTime);
    }
    return Reflect.construct(target, args);
  }
});

describe('OffStandardTimeLog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTime = null;
    global.Date = RealDate;
    
    // Default online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    mockTime = null;
    global.Date = RealDate;
    vi.restoreAllMocks();
  });

  it('shows the top 4 quick-starts with the rest behind a chevron', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);
    // No rostered shift in this test → default order; top 4 visible.
    expect(await screen.findByText('Opening Duties')).toBeInTheDocument();
    expect(screen.getByText('Closing Duties')).toBeInTheDocument();
    expect(screen.getByText('Fleeting Cars')).toBeInTheDocument();
    expect(screen.getByText('Lot Organization')).toBeInTheDocument();
    // The remaining 8 are collapsed until the chevron is tapped.
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/8 more/));
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    // The manual start flow (reason pills + Start button) is gone — quick-start
    // taps are the only way in now.
    expect(screen.queryByText('Reason')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('toggles Fleeting Cars between docking and sent-up-to-fleet presets', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);

    const btn = await screen.findByText('Fleeting Cars');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ preset_reason: 'fleeting_cars' }),
      );
    });

    const toggleOff = await screen.findByText('Sent up to fleet?');
    fireEvent.click(toggleOff);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ preset_reason: 'fleeting_sent' });
    });

    const toggleOn = await screen.findByText('✓ Sent up to fleet');
    fireEvent.click(toggleOn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ preset_reason: 'fleeting_cars' });
    });
  });

  it('starts a timer online and saves it to supabase', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);

    const btn = await screen.findByText('Opening Duties');
    mockTime = new Date('2026-05-22T21:00:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    // Should call insert on supabase
    await waitFor(() => {
      expect(insertSpy).toHaveBeenCalled();
    });

    // Should transition UI to show End button
    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('starts a timer offline and enqueues to offline action', async () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
    render(<OffStandardTimeLog user={TEST_USER} />);

    const btn = await screen.findByText('Opening Duties');
    mockTime = new Date('2026-05-22T21:00:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    // Should enqueue the offline action (no network wait) ...
    await waitFor(() => {
      expect(enqueueOfflineAction).toHaveBeenCalled();
    });

    // ... and optimistically transition the UI to the running timer.
    expect(await screen.findByText('End')).toBeInTheDocument();
  });

  it('ends a timer online and updates supabase if ran >= 5 mins', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);

    // Start
    const btn = await screen.findByText('Opening Duties');
    mockTime = new Date('2026-05-22T21:00:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    // Wait for start to resolve and timer UI to transition
    const endBtn = await screen.findByText('End');

    // Advance mock time by 10 minutes
    mockTime = new Date('2026-05-22T21:10:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(endBtn);
    global.Date = RealDate;
    mockTime = null;

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
      expect(screen.getByText(/✓ Entry saved/i)).toBeInTheDocument();
    });
  });

  it('ends a timer offline and enqueues offline update if ran >= 5 mins', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);

    // Start online
    const btn = await screen.findByText('Opening Duties');
    mockTime = new Date('2026-05-22T21:00:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    const endBtn = await screen.findByText('End');

    // Go offline
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });

    // Advance mock time by 10 minutes
    mockTime = new Date('2026-05-22T21:10:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(endBtn);
    global.Date = RealDate;
    mockTime = null;

    await waitFor(() => {
      expect(enqueueOfflineAction).toHaveBeenCalled();
      expect(screen.getByText(/✓ Entry saved/i)).toBeInTheDocument();
    });
  });

  it('discards/deletes the timer if ran for less than 5 minutes', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);

    // Start
    const btn = await screen.findByText('Opening Duties');
    mockTime = new Date('2026-05-22T21:00:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    const endBtn = await screen.findByText('End');

    // Advance mock time by only 2 minutes (less than the 5-minute threshold)
    mockTime = new Date('2026-05-22T21:02:00.000Z').getTime();
    global.Date = MockDate;
    fireEvent.click(endBtn);
    global.Date = RealDate;
    mockTime = null;

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalled();
    });

    // Since it was discarded, it should return to idle state
    const elements = await screen.findAllByText('Opening Duties');
    expect(elements.length).toBeGreaterThan(0);
  });
});
