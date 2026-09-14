// Layout regressions no unit test can see — jsdom computes no layout, so these two only ever had a
// one-off live measurement behind them (Zee, /reflect 2026-09-14). Now they are guarded in the gate.
import { test, expect } from '@playwright/test';

test('Effie\'s home fills the content area — not a FAB-sized card (regression from e1644e8, fixed 50ba608)', async ({ page }) => {
  await page.goto('/effie', { waitUntil: 'networkidle' });
  const composer = page.locator('textarea').first();
  await expect(composer).toBeVisible();
  const { moduleH, areaH } = await page.evaluate(() => {
    const mod = document.querySelector('textarea')!.closest('.flex.h-full') as HTMLElement;
    const area = [...document.querySelectorAll('div')].find(d => d.className.includes('flex-1 overflow-auto'))!;
    return { moduleH: mod.getBoundingClientRect().height, areaH: area.clientHeight };
  });
  // The module was 243px in a 740px area when broken. Allow a couple of px for borders/rounding.
  expect(moduleH).toBeGreaterThanOrEqual(areaH - 2);
});

test('switching weeks keeps the same PERSON at the top of the grid (200ce99)', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('fg.schedule.groups', JSON.stringify(['floor', 'drivers', 'counter'])); } catch { /* ignore */ }
  });
  await page.goto('/schedule', { waitUntil: 'networkidle' });
  await expect(page.locator('tbody tr[data-row-id]').first()).toBeVisible();

  const topRowId = () => page.evaluate(() => {
    const box = document.querySelector('table')!.parentElement!;
    const top = box.getBoundingClientRect().top + document.querySelector('thead')!.getBoundingClientRect().height;
    const row = [...document.querySelectorAll<HTMLElement>('tbody tr[data-row-id]')].find(r => r.getBoundingClientRect().bottom > top + 1);
    return row?.dataset.rowId ?? null;
  });

  // Scroll the grid to a row two-thirds down, the way a thumb would.
  await page.evaluate(() => {
    const box = document.querySelector('table')!.parentElement!;
    const rows = document.querySelectorAll<HTMLElement>('tbody tr[data-row-id]');
    const target = rows[Math.floor(rows.length * 0.66)];
    box.scrollTop = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
      - document.querySelector('thead')!.getBoundingClientRect().height;
  });
  await page.waitForTimeout(300);
  const before = await topRowId();
  expect(before).not.toBeNull();

  await page.getByText('›').first().click();
  await page.waitForTimeout(1500);
  await page.getByText('‹').first().click();
  await page.waitForTimeout(1500);

  // A round trip must land back on the same person; before the fix it drifted a row or two each way.
  expect(await topRowId()).toBe(before);
});
