// The bay log's day header (docs/ticket-lot-lookout-bay-log.md, Phase 2): numbers, never names; the quiet states.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BayDayHeader } from '../../src/components/lot/BayDayHeader';

const base = { label: 'Today · Tuesday, November 3', isToday: true, canForward: false, onBack: vi.fn(), onForward: vi.fn(), onToday: vi.fn() };
const at = (hhmm: string) => new Date(`2026-11-03T${hhmm}:00`).getTime();

describe('BayDayHeader', () => {
  it('shows his shift in VSA blocks, numbers only', () => {
    render(<BayDayHeader {...base} nowMs={at('12:00')} crew={{ working: true, window: { start: '06:45', end: '15:15' },
      blocks: [{ start: '06:45', end: '10:00', vsas: 2 }, { start: '10:00', end: '15:15', vsas: 1 }] }} />);
    expect(screen.getByText('06:45–10:00 ·', { exact: false }).textContent).toBe('06:45–10:00 · 2 VSAs');
    expect(screen.getByText('10:00–15:15 ·', { exact: false }).textContent).toBe('10:00–15:15 · 1 VSA');
    expect(screen.queryByText(/ended/)).toBeNull();
  });

  it('after his shift today: "Bay log ended 15:15"', () => {
    render(<BayDayHeader {...base} nowMs={at('16:00')} crew={{ working: true, window: { start: '06:45', end: '15:15' }, blocks: [] }} />);
    expect(screen.getByText('Bay log ended 15:15')).toBeTruthy();
  });

  it('an earlier day: › and Today step forward; a day off says so', () => {
    const onForward = vi.fn(), onToday = vi.fn();
    render(<BayDayHeader {...base} isToday={false} canForward label="Saturday, October 31" nowMs={at('12:00')}
      onForward={onForward} onToday={onToday} crew={{ working: false, window: null, blocks: [] }} />);
    expect(screen.getByText('Not a logging day: you were off.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('The day after')); fireEvent.click(screen.getByText('Today'));
    expect(onForward).toHaveBeenCalledOnce(); expect(onToday).toHaveBeenCalledOnce();
  });

  it('today, › is shut', () => {
    render(<BayDayHeader {...base} nowMs={at('12:00')} crew={null} />);
    expect((screen.getByLabelText('The day after') as HTMLButtonElement).disabled).toBe(true);
  });
});
