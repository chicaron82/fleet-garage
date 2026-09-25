import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GeotabInstall } from '../../src/hooks/useGeotabInstall';

// Aaron, 2026-09-25, on LJF707: "I cleared it off the list. The flag just moves to no action needed.
// I think it should also show that it was installed".
let install: GeotabInstall | null = null;
const seen: (string | null | undefined)[] = [];
vi.mock('../../src/hooks/useGeotabInstall', () => ({
  useGeotabInstall: (plate: string | null | undefined) => { seen.push(plate); return install; },
}));
const { HoldGeotabInstalled } = await import('../../src/components/holds/HoldGeotabInstalled');

const geotab = { damageDescription: 'Geotab not installed' };
const names: Record<string, string> = { u1: 'Aaron S.' };
const props = { plate: 'LJF707', getName: (id: string) => names[id] ?? id, fmt: () => 'Sep 25, 09:51' };

beforeEach(() => { install = null; seen.length = 0; });

describe('the geotab hold shows the install', () => {
  it('⭐ says when and who, once the unit is in', () => {
    install = { addedAt: '2026-07-10', installedAt: '2026-09-25T14:51:16Z', installedBy: 'u1' };
    render(<HoldGeotabInstalled hold={geotab} {...props} />);
    expect(screen.getByText(/Geotab installed Sep 25, 09:51/)).toBeTruthy();
    expect(screen.getByText(/by Aaron S\./)).toBeTruthy();
  });

  it('says nothing while the car is still waiting for its unit', () => {
    install = { addedAt: '2026-07-10', installedAt: null, installedBy: null };
    const { container } = render(<HoldGeotabInstalled hold={geotab} {...props} />);
    expect(container.textContent).toBe('');
  });

  // Every other hold on the car renders this component too, so it must not query or show anything.
  it('stays out of every other hold, and does not look the plate up for one', () => {
    install = { addedAt: '2026-07-10', installedAt: '2026-09-25T14:51:16Z', installedBy: 'u1' };
    const { container } = render(<HoldGeotabInstalled hold={{ damageDescription: 'Scratch rear bumper' }} {...props} />);
    expect(container.textContent).toBe('');
    expect(seen).toEqual([null]);
  });
});
