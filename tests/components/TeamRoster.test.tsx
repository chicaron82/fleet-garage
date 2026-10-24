import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamRoster } from '../../src/components/my-day/TeamRoster';
import type { TeamMate } from '../../src/lib/myDay';
import type { UserRole } from '../../src/types';

const mate = (displayName: string, start: string, end: string, role: UserRole = 'VSA', attendance?: TeamMate['attendance']): TeamMate =>
  ({ id: displayName, userId: `u-${displayName}`, displayName, start, end, role, attendance });

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
    expect(screen.getByRole('button', { name: /Geoff/ }).closest('[data-pill]')!.className).toContain('opacity-45');   // done
    expect(screen.getByRole('button', { name: /Ray/ }).closest('[data-pill]')!.className).not.toContain('opacity-45'); // →23:00
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

// ⭐ 2026-10-18, his rulings: a grid three across (*"what i wanted to tap next is moved because the first person's pill
// grew"*) and no ✓/✗ (*"the colour already signifies the status"*). ⭐ 2026-10-24: no box (the crew line is the
// schedule, *"Keeping track is too much"*), so a pill is one button: attendance.
describe('TeamRoster — the grid', () => {
  it('⭐ three across in a fixed grid, and a present pill adds nothing that could widen it', () => {
    render(<TeamRoster team={[mate('Geoff', '06:45', '15:15', 'VSA', 'present'), mate('Krish', '11:30', '20:00')]} setShiftAttendance={vi.fn()} now="10:00" />);
    const geoff = screen.getByRole('button', { name: /Geoff/ });
    expect(geoff.closest('.grid')!.className).toContain('grid-cols-3');
    expect(geoff.textContent).toBe('Geoff→15:15');   // no ✓, and "→END" not "til END"
  });
  it('a no-show reads by colour and strikethrough, no ✗', () => {
    render(<TeamRoster team={[mate('Ray', '14:30', '23:00', 'Driver', 'absent')]} setShiftAttendance={vi.fn()} now="15:00" />);
    expect(screen.getByRole('button', { name: /Ray/ }).textContent).not.toContain('✗');
    expect(screen.getByText('Ray').className).toContain('line-through');
  });
  it('⭐ no box on anyone: VSAs and drivers get one button each, same as the counter', () => {
    const team = [mate('Erick', '06:45', '15:15', 'VSA', 'present'), mate('Carlos', '07:00', '15:30', 'Driver', 'present'), mate('Jagdeep', '06:45', '15:15', 'CSR')];
    render(<TeamRoster team={team} setShiftAttendance={vi.fn()} now="10:00" />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText(/usual job/)).toBeNull();
  });
  it('a name tap sets attendance', async () => {
    const setAttendance = vi.fn().mockResolvedValue(undefined);
    render(<TeamRoster team={[mate('Erick', '06:45', '15:15', 'VSA', 'present')]} setShiftAttendance={setAttendance} now="10:00" />);
    await userEvent.click(screen.getByRole('button', { name: /^Erick→/ }));
    expect(setAttendance).toHaveBeenCalledWith('Erick', 'absent');
  });
  it('⚠️ a name tap with no signal says so', async () => {
    const setAttendance = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    render(<TeamRoster team={[mate('Erick', '06:45', '15:15', 'VSA', 'present')]} setShiftAttendance={setAttendance} now="10:00" />);
    await userEvent.click(screen.getByRole('button', { name: /^Erick→/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No signal. Nobody was marked.');
  });
});
