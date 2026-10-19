// The /lot pages and FG's offline copy (2026-10-18). `1fcc47e` gave /lot the update prompt, which also REGISTERS the
// service worker, so every phone opening the link downloaded ~6 MB. Aaron: *"some may not want to use their data ...
// an explicit opt in?"* Now the prompt (and the download) comes only with a copy already here, or his tap.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { pwaMock } from '../stubs/pwa-register';
import type { LotOfflineState } from '../../src/lib/lotOffline';

vi.mock('../../src/components/lot/LotPage', () => ({
  LotPage: ({ offline }: { offline?: { state: LotOfflineState; save: () => void } }) => (
    <div>
      <p>airport page · {offline?.state}</p>
      {offline?.state === 'offer' && <button type="button" onClick={offline.save}>Save it</button>}
    </div>
  ),
}));
vi.mock('../../src/components/lot/LotBayPage', () => ({ LotBayPage: () => <p>erin page</p> }));
vi.mock('../../src/components/lot/LotViewPage', () => ({ LotViewPage: () => <p>view page</p> }));
const { LotEntry } = await import('../../src/components/lot/LotEntry');

const setController = (has: boolean) =>
  Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: has ? { controller: {} } : { controller: null } });

beforeEach(() => { pwaMock.needRefresh = true; localStorage.clear(); setController(false); });
afterEach(() => { setController(false); });

describe('LotEntry — the offline copy only when asked', () => {
  it('⭐ a phone with no copy that never asked: no worker, no download, no prompt; the page offers it', async () => {
    render(<LotEntry page="airport" />);
    expect(await screen.findByText('airport page · offer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });
  it('⭐ his tap: the choice is remembered and the worker registers', async () => {
    render(<LotEntry page="airport" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save it' }));
    expect(localStorage.getItem('lot_offline')).toBe('1');
    expect(screen.getByText('airport page · saving')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
  it('opted in on an earlier visit: the prompt is there', async () => {
    localStorage.setItem('lot_offline', '1');
    render(<LotEntry page="erin" />);
    expect(await screen.findByText('erin page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
  it('⭐ a phone that already has a copy (FG installed) keeps the prompt on every /lot page (1fcc47e\'s fix)', async () => {
    setController(true);
    for (const page of ['airport', 'erin', 'view'] as const) {
      const { unmount } = render(<LotEntry page={page} />);
      expect(await screen.findByRole('button', { name: 'Reload' })).toBeTruthy();
      unmount();
    }
  });
});
