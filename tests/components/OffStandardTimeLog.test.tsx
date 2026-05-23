import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OffStandardTimeLog } from '../../src/components/OffStandardTimeLog';
import { enqueueOfflineAction } from '../../src/lib/offlineQueue';

// Mocks
const TEST_USER = {
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

vi.mock('../../src/context/GarageContext', () => ({
  useGarage: () => ({
    holds: [],
    vehicles: [],
  }),
}));

vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({
    shifts: [],
  }),
}));

// Date Proxy Setup
const RealDate = global.Date;
let mockTime: number | null = null;

const MockDate = new Proxy(RealDate, {
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

  it('renders quick start buttons initially', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);
    const button = await screen.findByText('Opening Duties');
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Closing Duties')).toBeInTheDocument();
  });

  it('starts a timer online and saves it to supabase', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);

    const btn = await screen.findByText('Opening Duties');
    mockTime = new Date('2026-05-22T21:00:00.000Z').getTime();
    global.Date = MockDate as any;
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
    global.Date = MockDate as any;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    // Should call enqueueOfflineAction immediately
    expect(enqueueOfflineAction).toHaveBeenCalled();

    // Should transition UI optimistically to running timer
    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('ends a timer online and updates supabase if ran >= 5 mins', async () => {
    render(<OffStandardTimeLog user={TEST_USER} />);

    // Start
    const btn = await screen.findByText('Opening Duties');
    mockTime = new Date('2026-05-22T21:00:00.000Z').getTime();
    global.Date = MockDate as any;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    // Wait for start to resolve and timer UI to transition
    const endBtn = await screen.findByText('End');

    // Advance mock time by 10 minutes
    mockTime = new Date('2026-05-22T21:10:00.000Z').getTime();
    global.Date = MockDate as any;
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
    global.Date = MockDate as any;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    const endBtn = await screen.findByText('End');

    // Go offline
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });

    // Advance mock time by 10 minutes
    mockTime = new Date('2026-05-22T21:10:00.000Z').getTime();
    global.Date = MockDate as any;
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
    global.Date = MockDate as any;
    fireEvent.click(btn);
    global.Date = RealDate;
    mockTime = null;

    const endBtn = await screen.findByText('End');

    // Advance mock time by only 2 minutes (less than the 5-minute threshold)
    mockTime = new Date('2026-05-22T21:02:00.000Z').getTime();
    global.Date = MockDate as any;
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
