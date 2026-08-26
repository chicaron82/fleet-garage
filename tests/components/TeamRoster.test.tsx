import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamRoster } from '../../src/components/my-day/TeamRoster';
import type { TeamMate } from '../../src/lib/myDay';
import type { UserRole } from '../../src/types';

const mate = (displayName: string, start: string, end: string, role: UserRole = 'VSA'): TeamMate =>
  ({ id: displayName, displayName, start, end, role });

// Aaron's actual roster from the screenshot he sent (2026-08-26), trimmed.
const TEAM = [
  mate('Geoff', '06:45', '15:15'),
  mate('Krish', '11:30', '20:00'),
  mate('Larry C', '08:00', '16:30', 'Driver'),
  mate('Ray', '14:30', '23:00', 'Driver'),
];

describe('TeamRoster', () => {
  it('renders VSAs and Drivers as separate groups, in a fixed order', () => {
    render(<TeamRoster team={TEAM} setShiftAttendance={vi.fn()} now="10:00" />);
    const headings = screen.getAllByText(/VSAs|Drivers/).map(el => el.textContent!.trim());
    expect(headings[0]).toMatch(/^VSAs/);
    expect(headings[1]).toMatch(/^Drivers/);
  });

  // ⭐⭐⭐ THE ONE THAT MATTERS. Aaron asked for ended teammates to disappear; they must not, because
  // the pill is the only way to record an attendance he forgot. A test that only checked ordering
  // would pass on an implementation that filtered them out.
  it('keeps an ENDED teammate on screen and still tappable', async () => {
    const setAttendance = vi.fn().mockResolvedValue(undefined);
    render(<TeamRoster team={TEAM} setShiftAttendance={setAttendance} now="18:26" />);

    const geoff = screen.getByRole('button', { name: /Geoff/ });   // ended 15:15, three hours ago
    expect(geoff).toBeInTheDocument();

    await userEvent.click(geoff);
    expect(setAttendance).toHaveBeenCalledWith('Geoff', 'present');
  });

  it('dims the ended ones instead of removing them', () => {
    render(<TeamRoster team={TEAM} setShiftAttendance={vi.fn()} now="18:26" />);
    expect(screen.getByRole('button', { name: /Geoff/ }).className).toContain('opacity-45');   // done
    expect(screen.getByRole('button', { name: /Ray/ }).className).not.toContain('opacity-45'); // til 23:00
  });

  it('says how many of each group are on the floor right now', () => {
    const { rerender } = render(<TeamRoster team={TEAM} setShiftAttendance={vi.fn()} now="10:00" />);
    expect(screen.getByText(/VSAs/).textContent).toMatch(/1 on now/);      // Geoff only
    rerender(<TeamRoster team={TEAM} setShiftAttendance={vi.fn()} now="21:00" />);
    expect(screen.getByText(/VSAs/).textContent).toMatch(/none on now/);   // all gone
    expect(screen.getByText(/Drivers/).textContent).toMatch(/1 on now/);   // Ray til 23:00
  });

  it('orders on-now ahead of done inside a group', () => {
    render(<TeamRoster team={TEAM} setShiftAttendance={vi.fn()} now="16:00" />);
    const vsaGroup = screen.getByText(/VSAs/).parentElement!;
    const names = within(vsaGroup).getAllByRole('button').map(b => b.textContent!);
    expect(names[0]).toMatch(/Krish/);   // still on til 20:00
    expect(names[1]).toMatch(/Geoff/);   // finished at 15:15
  });

  it('says so plainly when nobody else is scheduled', () => {
    render(<TeamRoster team={[]} setShiftAttendance={vi.fn()} now="10:00" />);
    expect(screen.getByText('Nobody else scheduled.')).toBeInTheDocument();
  });
});
