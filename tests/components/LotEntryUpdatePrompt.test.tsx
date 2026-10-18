// The /lot pages render ahead of FG (main.tsx), so they need their own update prompt. Without it, a phone whose service
// worker cached the old /lot kept the retired stall map after the pivot shipped (Aaron, 2026-10-18).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { pwaMock } from '../stubs/pwa-register';

vi.mock('../../src/components/lot/LotPage', () => ({ LotPage: () => <p>airport page</p> }));
vi.mock('../../src/components/lot/LotBayPage', () => ({ LotBayPage: () => <p>erin page</p> }));
vi.mock('../../src/components/lot/LotViewPage', () => ({ LotViewPage: () => <p>view page</p> }));
const { LotEntry } = await import('../../src/components/lot/LotEntry');

beforeEach(() => { pwaMock.needRefresh = false; });

describe('LotEntry — the update prompt reaches the /lot pages', () => {
  it.each(['airport', 'erin', 'view'] as const)('⭐ %s: a waiting new version shows Reload', async page => {
    pwaMock.needRefresh = true;
    render(<LotEntry page={page} />);
    expect(await screen.findByText(`${page} page`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });

  it('nothing waiting: just the page', async () => {
    render(<LotEntry page="airport" />);
    expect(await screen.findByText('airport page')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });
});
