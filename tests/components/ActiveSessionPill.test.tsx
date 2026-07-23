import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActiveSessionPill } from '../../src/components/layout/ActiveSessionPill';
import type { ActiveSession } from '../../src/context/ActiveSessionsContext';

// Simulate a desktop viewport so the overlay variant doesn't bail out early.
// jsdom has no matchMedia; without this mock useMediaQuery returns false (mobile)
// and every overlay render returns null, breaking the suppression logic tests.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const mockTrip: ActiveSession = { id: 't1', startedAt: new Date(Date.now() - 900_000).toISOString(), label: 'In Transit', emoji: '🚗' };
const mockOth:  ActiveSession = { id: 'o1', startedAt: new Date(Date.now() - 300_000).toISOString(), label: 'OTH',        emoji: '⏱' };

const mockContext = (overrides: {
  trip?: ActiveSession | null;
  oth?: ActiveSession | null;
  movementTab?: 'movement-log' | 'off-standard';
}) => ({
  trip: overrides.trip ?? null,
  oth:  overrides.oth  ?? null,
  nowMs: Date.now(),
  refresh: vi.fn(),
  movementTab: overrides.movementTab ?? 'movement-log',
  setMovementTab: vi.fn(),
  openingDutiesTrigger: 0,
  signalOpeningDuties: vi.fn(),
});

vi.mock('../../src/context/ActiveSessionsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/context/ActiveSessionsContext')>();
  return {
    ...actual,
    useActiveSessions: vi.fn(),
  };
});

import { useActiveSessions } from '../../src/context/ActiveSessionsContext';
const mockUseActiveSessions = vi.mocked(useActiveSessions);

describe('ActiveSessionPill — suppression logic', () => {
  it('renders nothing when no session is active', () => {
    mockUseActiveSessions.mockReturnValue(mockContext({}));
    const { container } = render(
      <ActiveSessionPill activeModule="my-day" onNavigate={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows trip pill on any screen other than movement-log', () => {
    mockUseActiveSessions.mockReturnValue(mockContext({ trip: mockTrip }));
    render(<ActiveSessionPill activeModule="holds" onNavigate={vi.fn()} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  it('suppresses trip pill on movement-log / movement-log tab', () => {
    mockUseActiveSessions.mockReturnValue(
      mockContext({ trip: mockTrip, movementTab: 'movement-log' })
    );
    const { container } = render(
      <ActiveSessionPill activeModule="movement-log" onNavigate={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows OTH pill on movement-log while movement-log tab is active (OTH not suppressed)', () => {
    mockUseActiveSessions.mockReturnValue(
      mockContext({ oth: mockOth, movementTab: 'movement-log' })
    );
    render(<ActiveSessionPill activeModule="movement-log" onNavigate={vi.fn()} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  it('suppresses OTH pill on movement-log / off-standard tab', () => {
    mockUseActiveSessions.mockReturnValue(
      mockContext({ oth: mockOth, movementTab: 'off-standard' })
    );
    const { container } = render(
      <ActiveSessionPill activeModule="movement-log" onNavigate={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows trip pill on movement-log / off-standard tab (trip not suppressed there)', () => {
    mockUseActiveSessions.mockReturnValue(
      mockContext({ trip: mockTrip, movementTab: 'off-standard' })
    );
    render(<ActiveSessionPill activeModule="movement-log" onNavigate={vi.fn()} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  it('when both active on movement-log/movement tab: only OTH pill shows', () => {
    mockUseActiveSessions.mockReturnValue(
      mockContext({ trip: mockTrip, oth: mockOth, movementTab: 'movement-log' })
    );
    render(<ActiveSessionPill activeModule="movement-log" onNavigate={vi.fn()} />);
    const btns = screen.getAllByRole('button');
    expect(btns).toHaveLength(1);
    expect(btns[0]).toHaveTextContent('⏱');
  });

  it('when both active on off-standard tab: only trip pill shows', () => {
    mockUseActiveSessions.mockReturnValue(
      mockContext({ trip: mockTrip, oth: mockOth, movementTab: 'off-standard' })
    );
    render(<ActiveSessionPill activeModule="movement-log" onNavigate={vi.fn()} />);
    const btns = screen.getAllByRole('button');
    expect(btns).toHaveLength(1);
    expect(btns[0]).toHaveTextContent('🚗');
  });
});
