// End-to-end scan-router journeys — the seam unit tests can't see. Each drives an intended
// flow (scan → route → screen) and asserts the end-state. Scans are simulated by injecting the
// post-scan Screen state (see _support.ts). These are the exact journeys that kept surfacing as
// live-caught bugs (2026-07-19 → 21); the suite makes them a red gate instead of a lot surprise.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { injectScreen, FIXTURE, nextNonce } from './_support';

test.beforeEach(async ({ page }) => {
  await page.goto('/lost-and-found', { waitUntil: 'networkidle' });
});

test('scan → Log L&F opens item-entry: uploader + plate, no key-tag detour', async ({ page }) => {
  await injectScreen(page, { name: 'lost-and-found', prefillPlate: FIXTURE.plate, prefillNonce: nextNonce() });
  const sheet = page.locator('.fixed');
  // Scan-open header drops the step counter (operator never saw Step 1).
  await expect(sheet.getByText('Log Found Item', { exact: true })).toBeVisible();
  await expect(sheet.getByText('ITEM PHOTO')).toBeVisible();      // the uploader is right here
  await expect(page.getByPlaceholder('e.g. LUR 224')).toHaveValue(FIXTURE.plate);
  await expect(sheet.getByText(/Recognized/)).toBeVisible();
});

test('+ Log after a lingering scan opens the full two-step at Step 1 (no stale plate)', async ({ page }) => {
  // Precondition: a scan left its plate lingering on the screen.
  await injectScreen(page, { name: 'lost-and-found', prefillPlate: FIXTURE.plate, prefillNonce: nextNonce() });
  await expect(page.locator('.fixed').getByText('Log Found Item', { exact: true })).toBeVisible();
  await page.locator('.fixed').getByText('×', { exact: true }).click();

  // The manual button must ignore the lingering plate and start clean at Step 1.
  await page.getByText('+ Log', { exact: false }).first().click();
  await expect(page.getByText('Log Found Item — Step 1 of 2')).toBeVisible();
  await expect(page.getByText(/Photo the key tag/)).toBeVisible();
  await expect(page.getByPlaceholder('e.g. LUR 224')).toHaveCount(0); // Step 1 has no plate field
});

test('scan → Register carries EVERY field read off the tag', async ({ page }) => {
  await injectScreen(page, {
    name: 'register-vehicle', prefill: 'ABX931',
    scanned: { unitNumber: '5429931', plate: 'ABX931', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White', rentalClass: 'C' },
  });
  await expect(page.getByRole('button', { name: 'Add to Ledger' })).toBeVisible();
  await expect(page.getByRole('textbox').nth(0)).toHaveValue('5429931');   // unit
  await expect(page.getByRole('textbox').nth(1)).toHaveValue('ABX931');    // plate
  await expect(page.getByRole('combobox').nth(0)).toHaveValue('Toyota');   // make
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('Corolla');  // model
  await expect(page.getByText(/Rental class read off the tag/)).toBeVisible();
});

test('⭐ an UNKNOWN class code is shown and editable — it teaches the codex', async ({ page }) => {
  // `teachClassCode` is present only when the codex could not resolve the code, which means
  // registering this car WRITES a rule FG will apply to every future car wearing it. Until
  // 2026-08-19 that field was invisible: a Seltos tag read CKSE as CKSP, Aaron corrected the make
  // and model, and FG taught the MISREAD code the right car while the real code stayed unknown.
  await injectScreen(page, {
    name: 'register-vehicle', prefill: 'ABX931',
    scanned: {
      unitNumber: '5429931', plate: 'ABX931', make: 'Kia', model: 'Seltos',
      year: 2025, color: 'Blue', rentalClass: 'B5', teachClassCode: 'CKSP',
    },
  });
  const code = page.getByLabel(/Class code/);
  await expect(code).toBeVisible();
  await expect(code).toHaveValue('CKSP');
  await expect(page.getByText(/registering teaches CKSP/)).toBeVisible();

  // Correctable in place — the whole point.
  await code.fill('CKSE');
  await expect(page.getByText(/registering teaches CKSE/)).toBeVisible();

  // Blank teaches nothing, and says so rather than silently doing nothing.
  await code.fill('');
  await expect(page.getByText(/FG learns nothing from this tag/)).toBeVisible();
});

test('a code the codex already knows stays out of the way', async ({ page }) => {
  // No teachClassCode means nothing is being learned, so there is nothing to confirm — an amber
  // field on every registration would be noise, and noise is how a real warning gets ignored.
  await injectScreen(page, {
    name: 'register-vehicle', prefill: 'ABX931',
    scanned: { unitNumber: '5429931', plate: 'ABX931', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White', rentalClass: 'C' },
  });
  await expect(page.getByRole('button', { name: 'Add to Ledger' })).toBeVisible();
  await expect(page.getByLabel(/Class code/)).toHaveCount(0);
});

test('scan → Flag/hold opens the flag form on the scanned vehicle', async ({ page }) => {
  await injectScreen(page, { name: 'new-hold', vehicleId: FIXTURE.vehicleId });
  await expect(page.getByText('Flag Issue').first()).toBeVisible();
  await expect(page.getByText(FIXTURE.unit).first()).toBeVisible();
  await expect(page.getByText(`Plate: ${FIXTURE.plate}`)).toBeVisible();
});

test('scan → View opens the scanned vehicle (and its geotab hold reads Repaired)', async ({ page }) => {
  await injectScreen(page, { name: 'vehicle', vehicleId: FIXTURE.vehicleId });
  await expect(page.getByText(`Plate: ${FIXTURE.plate}`)).toBeVisible();
  await expect(page.getByText('Geotab not installed')).toBeVisible();
  await expect(page.getByText('Repaired', { exact: true })).toBeVisible(); // cleared, off the install list
});

test('scan → Start trip auto-fires a Routine run to the live timer — twice (repeat scan)', async ({ page }) => {
  // First scan → auto-start → running timer.
  await injectScreen(page, { name: 'movement-log', prefillPlate: FIXTURE.plate, prefillNonce: nextNonce(), autoStart: true });
  await expect(page.getByText('IN TRANSIT').first()).toBeVisible();
  await expect(page.getByText('Airport Run')).toBeVisible();
  // Abandon it (deletes the in_progress row) — back to the form.
  await page.getByText('Reset', { exact: false }).first().click();
  await expect(page.getByText('Routine Transport')).toBeVisible();

  // Repeat scan, SAME plate, new nonce → must fire again (nonce distinctness).
  await injectScreen(page, { name: 'movement-log', prefillPlate: FIXTURE.plate, prefillNonce: nextNonce(), autoStart: true });
  await expect(page.getByText('IN TRANSIT').first()).toBeVisible();
  await page.getByText('Reset', { exact: false }).first().click();
  await expect(page.getByText('Routine Transport')).toBeVisible();
});

// Belt-and-suspenders: even if a Reset failed, never leave an in_progress trip on the fixture car.
test.afterAll(async () => {
  try {
    const env = Object.fromEntries(
      readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
        .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
    );
    const url = env.VITE_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const H = { apikey: key, Authorization: `Bearer ${key}` };
    const rows = await (await fetch(`${url}/rest/v1/vsa_trips?vehicle_plate=eq.${FIXTURE.plate}&arrive_time=is.null&select=id`, { headers: H })).json();
    for (const r of rows as { id: string }[]) {
      await fetch(`${url}/rest/v1/vsa_trips?id=eq.${r.id}`, { method: 'DELETE', headers: H });
    }
  } catch { /* cleanup is best-effort */ }
});
