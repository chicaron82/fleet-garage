// The /lot pages and FG's offline copy (2026-10-18). `1fcc47e` gave /lot the update prompt, which also REGISTERS the
// service worker, so every phone opening the link downloaded ~6 MB. Aaron: *"some may not want to use their data ...
// an explicit opt in?"* Now the prompt (and the download) comes only with a copy already here, or an earlier yes.
// (The offer itself lived on the drivers' airport page, retired 2026-10-29; /lot is the read-only view now.)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { pwaMock } from '../stubs/pwa-register';

vi.mock('../../src/components/lot/LotBayPage', () => ({ LotBayPage: () => <p>erin page</p> }));
vi.mock('../../src/components/lot/LotViewPage', () => ({ LotViewPage: () => <p>view page</p> }));
const { LotEntry } = await import('../../src/components/lot/LotEntry');

const setController = (has: boolean) =>
  Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: has ? { controller: {} } : { controller: null } });

beforeEach(() => { pwaMock.needRefresh = true; localStorage.clear(); setController(false); });
afterEach(() => { setController(false); });

describe('LotEntry — the offline copy only when asked', () => {
  it('⭐ a phone with no copy that never asked: no worker, no download, no prompt', async () => {
    render(<LotEntry page="view" />);
    expect(await screen.findByText('view page')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });
  it('opted in on an earlier visit: the prompt is there', async () => {
    localStorage.setItem('lot_offline', '1');
    render(<LotEntry page="erin" />);
    expect(await screen.findByText('erin page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
  it('⭐ a phone that already has a copy (a driver who saved the old airport page) keeps the prompt, so it learns /lot moved', async () => {
    setController(true);
    for (const page of ['erin', 'view'] as const) {
      const { unmount } = render(<LotEntry page={page} />);
      expect(await screen.findByRole('button', { name: 'Reload' })).toBeTruthy();
      unmount();
    }
  });
});
