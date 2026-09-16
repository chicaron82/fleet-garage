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

  // ⚠️⚠️ PAGE 1 IS NOT THE LOT — found on the second pass, 2026-09-15, and it invalidates the first
  // diagnosis entirely. The Holds board paginates at 20 (`paginatedVehicles`, 10 pages), so
  // `truncating === 0` never meant "no car has a long write-up" — it meant "page ONE doesn't". Both
  // ingredients existed the whole time (LUR367, 57 chars; LUR327, 54) sitting several pages deep,
  // pushed down by 34 sale cars. So the original red was not a quiet lot and the skip that replaced
  // it would have fired on nearly every run, silently retiring the guard while the evidence sat on
  // page 4.
  //
  // ⭐ So WALK the pages until the ingredient turns up, and measure the width on every page visited —
  // which also widens the check from 20 cards to the whole board. Bounded by the Next button, so it
  // stops at the end rather than trusting a page count.
  const measure = () => page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const cardEls = [...document.querySelectorAll<HTMLElement>('button')].filter(b => b.textContent?.includes('Flagged by'));
    const truncating = cardEls.filter(b =>
      [...b.querySelectorAll<HTMLElement>('p')].some(p => p.textContent?.trim().endsWith('…'))).length;
    const worst = cardEls.length ? Math.max(...cardEls.map(b => b.getBoundingClientRect().right)) : 0;
    return { cards: cardEls.length, truncating, worst, vw };
  });

  let seen = 0, sawTruncating = 0, worstOverall = 0, vwOverall = 0, pagesWalked = 0;
  for (let i = 0; i < 15; i++) {
    const m = await measure();
    seen += m.cards; sawTruncating += m.truncating;
    worstOverall = Math.max(worstOverall, m.worst); vwOverall = m.vw;
    pagesWalked++;
    // ⚠️ Every page is MEASURED even after the ingredient is found — a card can overflow on any page,
    // and stopping at the first truncating one would check less than the old single-page version did.
    // ⚠️ `getByRole('button', {name:/^Next$/})` broke the walk after ONE page on the first attempt and
    // did it SILENTLY, because both guards fell back to "stop" on error (`.catch(() => false)` /
    // `.catch(() => true)`). A locator that cannot resolve then looks exactly like the last page. Use
    // the plain text locator, and assert the pager is actually gone rather than inferring it.
    const next = page.locator('button', { hasText: /^Next$/ }).last();
    if (await next.count() === 0) break;
    if (await next.isDisabled()) break;
    await next.click();
    await page.waitForTimeout(400);
  }
  const cards = seen, truncating = sawTruncating, worst = worstOverall, vw = vwOverall;
  console.log(`[card-width] walked ${pagesWalked} page(s), ${cards} cards, ${truncating} truncating`);


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
  test.skip(truncating === 0, 'no card on ANY page has a description long enough to truncate — guard inconclusive, see HoldsVehicleRowWidth.test.tsx');

  // Before the fix that card's right edge ran past the screen and clipped its "💥 Damage" badge.
  expect(worst).toBeLessThanOrEqual(vw + 1);
});
