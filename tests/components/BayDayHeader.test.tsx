// The bay log's day header (docs/ticket-lot-lookout-bay-log.md, Phase 2): the day and its quiet states.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BayDayHeader } from '../../src/components/lot/BayDayHeader';

const base = { label: 'Today · Tuesday, November 3', isToday: true, canForward: false, onBack: vi.fn(), onForward: vi.fn(), onToday: vi.fn() };
const at = (hhmm: string) => new Date(`2026-11-03T${hhmm}:00`).getTime();

describe('BayDayHeader', () => {
  it('⭐ during his shift: the day and nothing else, no crew blocks (removed 2026-11-05, his ask: the crew is at the bottom)', () => {
    render(<BayDayHeader {...base} nowMs={at('12:00')} mine={{ working: true, window: { start: '06:45', end: '15:15' } }} />);
    const header = screen.getByRole('region', { name: 'The day' });
    expect(header.textContent).not.toMatch(/VSA/);
    expect(screen.queryByText(/ended/)).toBeNull();
  });

  it('after his shift today: "Bay log ended 15:15"', () => {
    render(<BayDayHeader {...base} nowMs={at('16:00')} mine={{ working: true, window: { start: '06:45', end: '15:15' } }} />);
    expect(screen.getByText('Bay log ended 15:15')).toBeTruthy();
  });

  it('an earlier day: › and Today step forward; a day off says so', () => {
    const onForward = vi.fn(), onToday = vi.fn();
    render(<BayDayHeader {...base} isToday={false} canForward label="Saturday, October 31" nowMs={at('12:00')}
      onForward={onForward} onToday={onToday} mine={{ working: false, window: null }} />);
    expect(screen.getByText('Not a logging day: you were off.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('The day after')); fireEvent.click(screen.getByText('Today'));
    expect(onForward).toHaveBeenCalledOnce(); expect(onToday).toHaveBeenCalledOnce();
  });

  it('today, › is shut', () => {
    render(<BayDayHeader {...base} nowMs={at('12:00')} mine={null} />);
    expect((screen.getByLabelText('The day after') as HTMLButtonElement).disabled).toBe(true);
  });
});
