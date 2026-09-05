// DiZee's authed-verify helper. Logs in as the verify bot (creds from
// .env.local — VERIFY_EMPLOYEE_ID / VERIFY_PASSWORD), caches the session in
// .verify/ (gitignored), and screenshots a screen so visual/flow changes can be
// eyeballed before they reach the crew. READ/RENDER ONLY — never drives writes
// to crew tables (trusted-PoC RLS is allow-all; the bot could, so it mustn't).
//
//   node scripts/verify-fg.mjs <path> <name> [steps]      (IMG=1 to load real photos)
//   e.g. node scripts/verify-fg.mjs /schedule schedule "Share PTO request"
//        node scripts/verify-fg.mjs /my-shift inv "Closing Inventory > type:Look up a vehicle=LUR306"
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

// FG's dev server is PINNED to 5174 by `vite.config.ts` (`server.port`), so that is the default
// here — it must track that config, not Vite's generic 5173.
//
// It said 5173 until 2026-08-25, on the old assumption that Vite would auto-bump off a busy port.
// It doesn't need to: the port is explicit in the config. So the standing "always render-verify
// visual work" cure failed on its very first command with a connection error, which is the worst
// possible failure mode for a habit — friction on the step you already have to talk yourself into.
// Found by a line-check actually running it, not by reading it.
//
// FG_URL still overrides, for a preview build or a non-default port.
const BASE = process.env.FG_URL || 'http://localhost:5174';
const verifyDir = fileURLToPath(new URL('.verify/', root));
const statePath = fileURLToPath(new URL(`.verify/state-${ID}.json`, root));
mkdirSync(verifyDir, { recursive: true });

const path = process.argv[2] || '/';
const name = process.argv[3] || 'shot';
/**
 * ⭐⭐⭐ STEPS, NOT JUST A CLICK — because a helper that can only click can only ever verify EMPTY
 * states, and the standing lesson is to verify where the new code FIRES.
 *
 * That gap had been standing in for a real one: the closing inventory went six passes with "nobody
 * can reach it without a scanner" as the excuse, and the excuse outlived its cause by a day. Aaron,
 * 2026-09-04: *"what does the closing log have to wait for, for verification? if it scans it
 * properly? if it copies things?"*
 *
 * One argument, steps separated by ` > `:
 *   "Closing Inventory > type:Look up a vehicle=LUR306 > Look up > Add to sheet"
 *   • `type:<aria-label substring>=<value>` fills a field and presses nothing
 *   • anything else is text to click
 */
const steps = (process.argv[4] || '').split(' > ').map(x => x.trim()).filter(Boolean);
const shot = `${verifyDir}${name}.png`;

const fresh = existsSync(statePath) && (Date.now() - statSync(statePath).mtimeMs < 30 * 60 * 1000);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  // ⭐ So a `clip` step can read back what a copy-out actually put on the clipboard. Aaron asked the
  // question this exists to answer: *"if it copies things?"* — and a button that fires is not the
  // same claim as a clipboard that holds the right text.
  permissions: ['clipboard-read', 'clipboard-write'],
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  ...(fresh ? { storageState: statePath } : {}),
});
// ⚠️⚠️ SUPABASE STORAGE IMAGES ARE BLOCKED BY DEFAULT — set IMG=1 when the screenshot is ABOUT
// a photo. The app is served from a local dev server, but every damage/keytag photo on a page is a
// `getPublicUrl` link straight to Supabase's storage CDN, and a fresh Playwright context starts
// with an EMPTY HTTP cache — so each run re-downloads every photo on the screen at full size.
//
// That is *cached egress*, which is the exact quota chicaron82's Org blew through (2026-09-04:
// "reduce your cached egress bandwidth below 5.5 GB"). Disk was nowhere near a limit — 34 MB of
// 500 MB database, 121 MB of 1 GB storage — so bandwidth was the whole overage, and dozens of
// verify runs (four of them wasted on a bad selector the same day) were a real share of it.
//
// Only the REMOTE fetches are aborted; local assets, icons and the logo still render, so a run
// looks normal except where an actual photo would be. That absence is loud, not silent — a missing
// photo is visible in the screenshot, so the failure mode announces itself and costs one re-run
// with IMG=1 rather than hiding a wrong claim.
if (process.env.IMG !== '1') {
  await ctx.route(/supabase\.(co|in)\/storage\//, route => route.abort());
}

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
for (const step of steps) {
  if (step === 'clip') {
    const text = await page.evaluate(() => navigator.clipboard.readText()).catch(e => `UNREADABLE: ${e.message}`);
    console.log('CLIPBOARD >>>\n' + text + '\n<<< CLIPBOARD');
    continue;
  }
  // ⚠️ `btn:` EXISTS BECAUSE A LOOSE TEXT MATCH LIES QUIETLY. Driving a status chip with the plain
  // text step, `D` matched the first element merely CONTAINING a D — "Shift Duties" — so the click
  // landed somewhere harmless, the chip never changed, and the run still went green. A selector that
  // hits the wrong thing produces a screenshot of the wrong claim.
  if (step.startsWith('btn:')) {
    await page.getByRole('button', { name: step.slice(4), exact: true }).first().click();
    await page.waitForTimeout(900);
    continue;
  }
  if (step.startsWith('type:')) {
    const [label, ...rest] = step.slice(5).split('=');
    const value = rest.join('=');
    // ⚠️ `fill` alone does not fire the events a controlled React input listens for on every
    // keystroke, so a typeahead would never search. Type it like a person.
    const field = page.getByLabel(new RegExp(label ?? '', 'i')).first();
    await field.click();
    await field.pressSequentially(value, { delay: 40 });
  } else {
    await page.getByText(step, { exact: false }).first().click();
  }
  await page.waitForTimeout(900);
}
await page.screenshot({ path: shot, fullPage: true });
console.log('SHOT', shot);

// ⚠️⚠️ SAY WHAT WAS ACTUALLY VERIFIED. Found during /reflect 68 (2026-08-30): this helper defaults
// to a LOCAL DEV SERVER, and the one on :5174 had been running for four days and twenty hours. Its
// build stamp — the single signal that says which code a screen is running — was frozen 81 commits
// behind HEAD by vite's `define`, while the code it served was read fresh off disk. A screenshot
// came back clean and said nothing about WHICH app it was a screenshot of.
//
// ⭐ A verification that does not name its target is not a verification. So every run now prints the
// URL it hit and the stamp the page itself renders, and warns when it is a dev server — where `dev`
// is now the honest stamp, because a live dev server has no commit identity to claim.
const stamp = await page.locator('div.font-mono').last().textContent().catch(() => null);
console.log('TARGET', BASE, '· stamp:', (stamp ?? 'not found').trim());
if (/localhost|127\.0\.0\.1/.test(BASE)) {
  console.log('NOTE  dev server — code is whatever is on disk NOW, not a released build.',
              'Set FG_URL to verify a deploy.');
}
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
