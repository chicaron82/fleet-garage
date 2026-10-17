// The Erin pill (top bar, every screen) and its sheet, built to Aaron's layout (2026-10-16): "Erin 7/3", drain on
// the cleans, fill on the dirties, both sized to the drivers on now; no hint text in the boxes; Copy is exactly "7/3".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const NOW = Date.now();
let bay: unknown = {
  cleans: 7, cleansBy: 'AS', cleansAt: new Date(NOW - 60000).toISOString(),
  dirties: 3, dirtiesBy: 'AS', dirtiesAt: new Date(NOW - 60000).toISOString(), used: 2, usedOn: '2026-10-16',
};
vi.mock('../../src/hooks/useLotBay', () => ({ useLotBay: () => ({ bay, log: [], loaded: true, nowMs: NOW, setBay: () => {} }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
let airport = 3;
vi.mock('../../src/hooks/useLotCrew', () => ({
  useLotCrew: () => ({ crew: { summary: { vsa: { cleaning: 1, moving: 0, out: 0 }, driver: { airport, other: 1, out: 0 } }, changedAt: null } }),
}));
const taps = { tapCleans: vi.fn(), stepDirties: vi.fn(), setCount: vi.fn(async () => true), drain: vi.fn(), fill: vi.fn() };
let toastFn: (msg: string, undo?: () => void) => void = () => {};
vi.mock('../../src/hooks/useBayTaps', () => ({
  useBayTapsSignedIn: (_s: unknown, t: typeof toastFn) => { toastFn = t; return taps; },
}));

const { ErinPill } = await import('../../src/components/lot/ErinPill');

const open = () => { render(<ErinPill />); fireEvent.click(screen.getByRole('button', { name: /Erin St: 7 cleans, 3 dirties/ })); };
beforeEach(() => { Object.values(taps).forEach(f => f.mockClear()); airport = 3; });

describe('ErinPill', () => {
  it('⭐ reads the way he says it: Erin 7/3', () => {
    render(<ErinPill />);
    expect(screen.getByRole('button', { name: /Erin St/ }).textContent).toBe('Erin7/3');
  });

  it('no Erin St row yet: no pill at all', () => {
    const was = bay; bay = null;
    const { container } = render(<ErinPill />);
    expect(container.textContent).toBe('');
    bay = was;
  });

  it('⭐ his layout: drain − set − 0 on cleans, 0 − set − fill on dirties, and no hint text in either box', () => {
    open();
    const order = (name: string) => [...within(screen.getByRole('region', { name })).getByRole('button', { name: 'Set' }).parentElement!.children]
      .map(el => el.tagName === 'INPUT' ? 'input' : el.textContent);
    expect(order('Cleans')).toEqual(['−3drain', 'input', 'Set', '0']);
    expect(order('Dirties')).toEqual(['0', 'input', 'Set', '+3fill']);
    for (const box of screen.getAllByRole('textbox')) expect(box.getAttribute('placeholder')).toBeNull();
  });

  it('⭐ drain and fill move one car per driver on now', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /drain 3/ }));
    fireEvent.click(screen.getByRole('button', { name: /fill 3/ }));
    expect(taps.drain).toHaveBeenCalledWith(3);
    expect(taps.fill).toHaveBeenCalledWith(3);
  });

  it('no drivers on: drain and fill sit out', () => {
    airport = 0;
    open();
    expect(screen.getByRole('button', { name: /drain: no drivers on/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /fill: no drivers on/ })).toHaveProperty('disabled', true);
  });

  it('Set types a count; 0 zeroes; a bad number never goes out', async () => {
    open();
    const cleans = screen.getByRole('region', { name: 'Cleans' });
    fireEvent.change(within(cleans).getByRole('textbox'), { target: { value: '6' } });
    fireEvent.click(within(cleans).getByRole('button', { name: 'Set' }));
    await vi.waitFor(() => expect(taps.setCount).toHaveBeenCalledWith('cleans', 6));
    fireEvent.click(screen.getByRole('button', { name: 'dirties to zero' }));
    expect(taps.setCount).toHaveBeenCalledWith('dirties', 0);
    fireEvent.change(within(cleans).getByRole('textbox'), { target: { value: '2300' } });
    fireEvent.click(within(cleans).getByRole('button', { name: 'Set' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(taps.setCount).toHaveBeenCalledTimes(2);
  });

  it('⭐ Copy is exactly "7/3"', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    open();
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith('7/3');
  });

  it('a note that can be undone shows Undo, and Undo runs it', async () => {
    open();
    const undo = vi.fn();
    await vi.waitFor(() => toastFn('Drained 3 · 4 cleans', undo));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledOnce();
  });
});
