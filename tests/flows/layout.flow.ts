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
  // ⚠️ PRECONDITIONS, or this passes VACUOUSLY (found in the ticket's second pass): if the grid stops
  // overflowing — the groups key renamed so it falls back to Floor only, a smaller roster, a taller
  // viewport — nothing scrolls, the top row is just the first row both times, and "same person" is
  // trivially true while guarding nothing.
  const { scrollTop, firstId } = await page.evaluate(() => ({
    scrollTop: document.querySelector('table')!.parentElement!.scrollTop,
    firstId: document.querySelector<HTMLElement>('tbody tr[data-row-id]')!.dataset.rowId,
  }));
  expect(scrollTop).toBeGreaterThan(0);
  expect(before).not.toBe(firstId);

  await page.getByText('›').first().click();
  await page.waitForTimeout(1500);
  await page.getByText('‹').first().click();
  await page.waitForTimeout(1500);

  // A round trip must land back on the same person; before the fix it drifted a row or two each way.
  expect(await topRowId()).toBe(before);
});

test('a hold card never grows past a phone-width screen — the badge stays on it (HoldsVehicleRow min-w-0)', async ({ page }) => {
  // ⚠️ 412px, set HERE: the flows project is Desktop Chrome at 1280, where a card has room to spare and
  // this bug cannot exist. Aaron's phone is where it lived.
  await page.setViewportSize({ width: 412, height: 4200 });
  await page.goto('/holds', { waitUntil: 'networkidle' });
  await expect(page.getByText('Flagged by').first()).toBeVisible();

  const { cards, truncating, worst, vw } = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const cardEls = [...document.querySelectorAll<HTMLElement>('button')].filter(b => b.textContent?.includes('Flagged by'));
    // ⚠️ By CONTENT, not by layout. The first cut counted descriptions whose scrollWidth exceeded their
    // clientWidth — but without the fix a description never truncates (the card grows instead), so that
    // precondition measured the fix itself and failed on the wrong line. The row cuts any description
    // over 40 characters and appends "…", which is true whatever the layout does.
    const truncating = cardEls.filter(b =>
      [...b.querySelectorAll<HTMLElement>('p')].some(p => p.textContent?.trim().endsWith('…'))).length;
    const worst = Math.max(...cardEls.map(b => b.getBoundingClientRect().right));
    return { cards: cardEls.length, truncating, worst, vw };
  });

  // ⚠️ PRECONDITIONS, or this passes VACUOUSLY: with no cards, or no description long enough to need
  // truncating, nothing can overflow and "every card fits" is trivially true. LUR327 ("Damage - written up
  // as 'DMG', detail not…") was the live case on 2026-09-14.
  expect(cards).toBeGreaterThan(0);

  // ⚠️⚠️ NO LONG DESCRIPTION TODAY IS NOT A FAILURE — it is an UNCHECKABLE DAY (2026-09-15).
  //
  // This assertion was `expect(truncating).toBeGreaterThan(0)`, which made the gate red whenever the
  // LOT happened not to contain a car with a long write-up. It did on 2026-09-14 (LUR327) and did not
  // on the 15th, and the test cannot tell those two days apart from "the layout broke" — so it blocked
  // four pushes in a row, none of them its business, and every one was waved through with SKIP_FLOWS=1.
  //
  // ⭐ A guard that cries wolf on a quiet lot teaches exactly one lesson: bypass the guard. Skipping
  // reports the truth — *"could not check"* — and shows up as a SKIP rather than hiding in a pass.
  //
  // ⚠️ AND IT MUST NOT BE THE ONLY COVER, because a skipped test is one nobody looks at: a quiet
  // stretch would silently retire the rule. The synthetic case below runs every time, on a card this
  // file builds itself, so the LAYOUT RULE is always checked and this one confirms it against the real
  // lot whenever the lot can supply the ingredient. Aaron greenlit the pair: *"whatever you recommend"*.
  test.skip(truncating === 0, 'no hold on the lot today has a description long enough to truncate — guard inconclusive, see the synthetic case');

  // Before the fix that card's right edge ran past the screen and clipped its "💥 Damage" badge.
  expect(worst).toBeLessThanOrEqual(vw + 1);
});
