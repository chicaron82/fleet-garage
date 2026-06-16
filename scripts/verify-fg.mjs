// DiZee's authed-verify helper. Logs in as the verify bot (creds from
// .env.local — VERIFY_EMPLOYEE_ID / VERIFY_PASSWORD), caches the session in
// .verify/ (gitignored), and screenshots a screen so visual/flow changes can be
// eyeballed before they reach the crew. READ/RENDER ONLY — never drives writes
// to crew tables (trusted-PoC RLS is allow-all; the bot could, so it mustn't).
//
//   node scripts/verify-fg.mjs <path> <name> [clickText]
//   e.g. node scripts/verify-fg.mjs /schedule schedule "Share PTO request"
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const env = Object.fromEntries(
  readFileSync(new URL('.env.local', root), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
// Identity: VID=vsa → the Lead VSA mock account; default → DiZee (GM). Sessions
// cache per-identity so they don't clobber each other.
const ID = (process.env.VID || 'dizee').toLowerCase();
const EMP = ID === 'vsa' ? env.VERIFY_VSA_EMPLOYEE_ID : env.VERIFY_EMPLOYEE_ID;
const PW  = ID === 'vsa' ? env.VERIFY_VSA_PASSWORD     : env.VERIFY_PASSWORD;
if (!EMP || !PW) { console.error(`Missing creds for identity '${ID}' in .env.local`); process.exit(1); }

const BASE = 'http://localhost:5173';
const verifyDir = fileURLToPath(new URL('.verify/', root));
const statePath = fileURLToPath(new URL(`.verify/state-${ID}.json`, root));
mkdirSync(verifyDir, { recursive: true });

const path = process.argv[2] || '/';
const name = process.argv[3] || 'shot';
const clickText = process.argv[4];
const shot = `${verifyDir}${name}.png`;

const fresh = existsSync(statePath) && (Date.now() - statSync(statePath).mtimeMs < 30 * 60 * 1000);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  ...(fresh ? { storageState: statePath } : {}),
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
if (await page.locator('input[type=password]').count()) {
  await page.locator('input[type=text]').first().fill(EMP);
  await page.locator('input[type=password]').fill(PW);
  await page.locator('button[type=submit]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await ctx.storageState({ path: statePath });
  console.log('LOGGED_IN as', EMP);
}

await page.goto(BASE + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
if (clickText) {
  await page.getByText(clickText, { exact: false }).first().click();
  await page.waitForTimeout(900);
}
await page.screenshot({ path: shot, fullPage: true });
console.log('SHOT', shot);
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
