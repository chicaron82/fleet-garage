// One-off: render the REGISTER form's EV asset block at PHONE width, where Aaron actually uses it.
// verify-fg.mjs renders 1280px desktop only and can't reach this screen (register-vehicle has no
// URL of its own — it's behind Holds → search-with-no-match → "Add to FG & flag").
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const BASE = 'http://localhost:5174';
const statePath = '.verify/state-dizee.json';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 1400 },        // phone, like his screenshot
  deviceScaleFactor: 2,
  ...(existsSync(statePath) ? { storageState: statePath } : {}),
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
if (await page.locator('input[type=password]').count()) {
  await page.locator('input[type=text]').first().fill(env.VERIFY_EMPLOYEE_ID);
  await page.locator('input[type=password]').fill(env.VERIFY_PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await ctx.storageState({ path: statePath });
}

// Holds → a search that matches nothing → the button flips to "Add to FG & flag"
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// GM lands on Analytics; at 390px the nav lives behind the hamburger (md:hidden header).
if (!(await page.getByPlaceholder(/Search unit/i).count())) {
  await page.getByLabel('Toggle sidebar').click();
  await page.waitForTimeout(1200);                    // drawer transition
  await page.locator('div.fixed.inset-y-0').getByText('Holds', { exact: true }).first().click();
  await page.waitForTimeout(1500);
}
const search = page.getByPlaceholder(/Search unit/i);
await search.waitFor({ timeout: 15000 });
await search.fill('ZZQQ9');
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Add to FG/i }).click();
await page.waitForTimeout(900);

// Make = Tesla is what reveals the EV block
await page.getByLabel(/^MAKE$/i).selectOption('Tesla').catch(async () => {
  await page.locator('select').first().selectOption('Tesla');
});
await page.waitForTimeout(700);

const evBlock = page.getByText('EV Asset Check');
await evBlock.waitFor({ timeout: 8000 });
await evBlock.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: '.verify/register-ev-default.png', fullPage: false });
console.log('SHOT default (zero taps)');

// Now the escape hatch
await page.getByText(/Didn't check/).click();
await page.waitForTimeout(500);
await page.screenshot({ path: '.verify/register-ev-notchecked.png', fullPage: false });
console.log('SHOT not-assessed');

console.log('ERRORS', errs);
await browser.close();
