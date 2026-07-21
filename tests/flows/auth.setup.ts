// Logs in as the VSA verify bot once and saves the session for the flow project to reuse.
// Creds come from .env.local (gitignored), same account the authed-verify helper uses.
import { test as setup, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

setup('authenticate the VSA bot', async ({ page }) => {
  const EMP = env.VERIFY_VSA_EMPLOYEE_ID;
  const PW = env.VERIFY_VSA_PASSWORD;
  if (!EMP || !PW) throw new Error('Missing VERIFY_VSA_EMPLOYEE_ID / VERIFY_VSA_PASSWORD in .env.local');

  await page.goto('/', { waitUntil: 'networkidle' });
  if (await page.locator('input[type=password]').count()) {
    await page.locator('input[type=text]').first().fill(EMP);
    await page.locator('input[type=password]').fill(PW);
    await page.locator('button[type=submit]').click();
    await page.waitForLoadState('networkidle');
  }
  // Confirm we're past the login wall before saving the session.
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.context().storageState({ path: '.verify/state-flows.json' });
});
