// ONE tap opens the camera — the behaviour, not just the code placement.
//
// tests/architecture/scan-gesture-contract.test.ts asserts the file input lives in the provider.
// This asserts what that placement BUYS: a single tap on either entry point fires the input AND
// opens the overlay. Aaron flagged the two-tap flow on shift 2026-08-21 ("tapping the header scan
// or scan a keytag opens up the camera directly instead of another screen where I have to tap
// scan a keytag again").
//
// The click is intercepted with preventDefault so the real file chooser never opens — we're
// measuring that the input RECEIVED the click inside the tap, which is the whole mechanism.
import { test, expect } from '@playwright/test';

declare global {
  interface Window { __scanClicks?: number }
}

/** Count clicks reaching the app-scope file input, without letting a chooser open. */
async function watchInput(page: import('@playwright/test').Page) {
  page.on('filechooser', () => { /* never opened — the listener below preventDefaults */ });
  await page.evaluate(() => {
    window.__scanClicks = 0;
    const input = document.querySelector('[data-testid="scan-router-file"]');
    if (!input) throw new Error('no app-scope scan input — it belongs in ScanRouterProvider');
    input.addEventListener('click', (e) => { e.preventDefault(); window.__scanClicks!++; });
  });
}

const clicks = (page: import('@playwright/test').Page) => page.evaluate(() => window.__scanClicks ?? -1);

test('header 📷 → camera fires and the overlay opens, in ONE tap', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await watchInput(page);

  await page.getByRole('button', { name: 'Scan a key tag' }).first().click();

  expect(await clicks(page)).toBe(1);
  await expect(page.getByRole('dialog', { name: 'Scan a key tag' })).toBeVisible();
});

test('My Day card → same one tap, same overlay', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await watchInput(page);

  // The card carries its subtitle; the header button does not.
  await page.getByText('Register, flag, log a found item, or start a trip').click();

  expect(await clicks(page)).toBe(1);
  await expect(page.getByRole('dialog', { name: 'Scan a key tag' })).toBeVisible();
});

test('cancelling the camera leaves the snap prompt as a fallback, not a dead end', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await watchInput(page);

  await page.getByRole('button', { name: 'Scan a key tag' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Scan a key tag' });
  await expect(dialog).toBeVisible();

  // No photo arrived (chooser cancelled): the prompt is still there and still works.
  const snap = dialog.getByRole('button', { name: /Snap the key tag/ });
  await expect(snap).toBeVisible();
  await snap.click();
  expect(await clicks(page)).toBe(2);
});
