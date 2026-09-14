import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleImportGrid } from '../../src/components/schedule/ScheduleImportGrid';
import type { ParsedSchedule } from '../../api/_lib/scheduleParse';

// The import preview marks a cell that puts someone on a day they can't work (lib/workDays,
// migration 144). The live preview needs a paid vision read, so the seam is pinned here instead.
const cell = (date: string, type: 'mid' | 'pto') => ({ date, type, raw: type, startTime: type === 'mid' ? '09:00' : null, endTime: type === 'mid' ? '15:00' : null });
const schedule = { staff: [{ name: 'GRANT', cells: [cell('2026-09-15', 'pto'), cell('2026-09-16', 'mid')] }] } as unknown as ParsedSchedule;

describe('ScheduleImportGrid — a day they can\'t work', () => {
  const setup = (conflictCells: Set<string>) => render(
    <ScheduleImportGrid schedule={schedule} roster={[{ id: 'g', name: 'Grant' }]} assignments={['g']}
      types={[['pto', 'mid']]} conflictCells={conflictCells} onAssign={vi.fn()} onCycleCell={vi.fn()} />,
  );

  it('⭐ rings the conflicting cell red and says why on hover', () => {
    setup(new Set(['0-1']));
    const [tue, wed] = screen.getAllByRole('button');
    expect(wed.className).toContain('ring-red-500');
    expect(wed.getAttribute('title')).toMatch(/a day they can't work/);
    expect(tue.className).not.toContain('ring-red-500');
  });

  it('marks nothing when there is no conflict', () => {
    setup(new Set());
    expect(screen.getAllByRole('button').some(b => b.className.includes('ring-red-500'))).toBe(false);
  });
});
