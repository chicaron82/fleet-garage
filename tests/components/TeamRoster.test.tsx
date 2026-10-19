import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// ⭐ 2026-10-18, his three rulings: a grid three across (*"what i wanted to tap next is moved because the first person's
// pill grew"*), no ✓/✗ (*"the colour already signifies the status"*), and the box for VSAs and drivers.
describe('TeamRoster — the grid and the box', () => {
  const crewNone = () => undefined;
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
  it('⭐ the box is empty until present, and present ticks it by itself', () => {
    const team = [mate('Geoff', '06:45', '15:15'), mate('Erick', '06:45', '15:15', 'VSA', 'present')];
    render(<TeamRoster team={team} setShiftAttendance={vi.fn()} now="10:00" crewOf={crewNone} onCrew={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Geoff: mark present first' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Erick on the usual job/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('⭐ untick pulls them (VSA → moving, driver → other); tick again clears back to the default', async () => {
    const onCrew = vi.fn();
    const team = [mate('Erick', '06:45', '15:15', 'VSA', 'present'), mate('Carlos', '07:00', '15:30', 'Driver', 'present'), mate('Jose', '07:00', '15:30', 'Driver', 'present')];
    const crewOf = (u: string) => (u === 'u-Jose' ? { state: 'other' as const, marked: true } : undefined);
    render(<TeamRoster team={team} setShiftAttendance={vi.fn()} now="10:00" crewOf={crewOf} onCrew={onCrew} />);
    await userEvent.click(screen.getByRole('button', { name: /Erick on the usual job/ }));
    await userEvent.click(screen.getByRole('button', { name: /Carlos on the usual job/ }));
    await userEvent.click(screen.getByRole('button', { name: /Jose pulled/ }));
    expect(onCrew.mock.calls).toEqual([['u-Erick', 'moving'], ['u-Carlos', 'other'], ['u-Jose', 'clear']]);
  });
  it('a box that is off writes nothing', async () => {
    const onCrew = vi.fn();
    render(<TeamRoster team={[mate('Geoff', '06:45', '15:15')]} setShiftAttendance={vi.fn()} now="10:00" crewOf={crewNone} onCrew={onCrew} />);
    await userEvent.click(screen.getByRole('button', { name: 'Geoff: mark present first' }));
    expect(onCrew).not.toHaveBeenCalled();
  });
  it('a name tap still sets attendance, and clears a pull so the new attendance shows on the crew line', async () => {
    const setAttendance = vi.fn().mockResolvedValue(undefined);
    const onCrew = vi.fn();
    const crewOf = () => ({ state: 'moving' as const, marked: true });
    render(<TeamRoster team={[mate('Erick', '06:45', '15:15', 'VSA', 'present')]} setShiftAttendance={setAttendance} now="10:00" crewOf={crewOf} onCrew={onCrew} />);
    await userEvent.click(screen.getByRole('button', { name: /^Erick→/ }));
    expect(setAttendance).toHaveBeenCalledWith('Erick', 'absent');
    expect(onCrew).toHaveBeenCalledWith('u-Erick', 'clear');
  });
  it('⚠️ a name tap with no signal says so, and the crew line is NOT written (they would disagree)', async () => {
    const setAttendance = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const onCrew = vi.fn();
    const onFail = vi.fn();
    const crewOf = () => ({ state: 'moving' as const, marked: true });
    render(<TeamRoster team={[mate('Erick', '06:45', '15:15', 'VSA', 'present')]} setShiftAttendance={setAttendance} now="10:00" crewOf={crewOf} onCrew={onCrew} onFail={onFail} />);
    await userEvent.click(screen.getByRole('button', { name: /^Erick→/ }));
    await waitFor(() => expect(onFail).toHaveBeenCalledWith('No signal. Nobody was marked.'));
    expect(onCrew).not.toHaveBeenCalled();
  });
  it('counter and HIR get the grid but no box', () => {
    render(<TeamRoster team={[mate('Jagdeep', '06:45', '15:15', 'CSR', 'present')]} setShiftAttendance={vi.fn()} now="10:00" crewOf={crewNone} onCrew={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('⭐ his flash (17:00): before the crew line answers, a present pill\'s box is "loading", never ticked, and writes nothing', async () => {
    const onCrew = vi.fn();
    render(<TeamRoster team={[mate('Moaz', '14:30', '23:00', 'VSA', 'present')]} setShiftAttendance={vi.fn()} now="16:00" crewOf={crewNone} onCrew={onCrew} crewKnown={false} />);
    const box = screen.getByRole('button', { name: 'Moaz: crew line loading' });
    expect(box).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(box);
    expect(onCrew).not.toHaveBeenCalled();
  });
});
