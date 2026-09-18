// Grade the fleet-balance projection — PAIRED, on fresh days, against the rule it replaced.
//
//   npx tsx scripts/grade-projection.mjs [since]   # since defaults to the blend's ship date
//
// ⚠️ `npx tsx`, not bare `node` — this imports fleetProjection.ts directly, which is the whole
// point (it grades the REAL module, not a copy of it that could drift).
//
// ⭐⭐ WHY THIS SCRIPT EXISTS AND NOT A SQL QUERY. Aaron, 2026-09-17: *"should we grade FG's
// estimates again next month?"* — yes, but not by reading `projected_out` back out of the table.
// That column records whichever rule wrote each row, so an accuracy figure across it averages every
// version that ever ran. Measuring it that way is exactly how the ticket behind `66bf1ed` started,
// with a confident wrong table. **Replay the code; never read the answer back.**
// ([[feedback_measure_the_running_thing]] · docs/ticket-fleet-projection-anchor.md)
//
// ⚠️⚠️ AND WHY *PAIRED*. A month yields ~20 new entries. That is far too few to confirm a ~7%
// MAE improvement — the edge measured at ship time needed 81 days to hold across two windows, and
// on 20 days ordinary noise swamps it. So this does not compare two independent MAEs. For each day
// it replays BOTH rules over the same prior history and asks which landed closer: a paired
// win/loss count is a much sharper instrument on a small sample than either average alone.
//
// ⚠️ The control below is a FROZEN COPY of the pre-blend rule, on purpose. It must not be imported,
// because the point is to compare against what the code used to do — and the code is what changed.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectFleetBalance, dayOfWeek, PROJECTION_WINDOW } from '../src/lib/fleetProjection.ts';

/** The blend shipped here; days from this date on are the fresh evidence. */
const SHIPPED = '2026-09-18';
const SINCE = process.argv[2] || SHIPPED;

const mean  = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const R     = n  => Math.round(n * 10) / 10;
const DAY   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** ⚠️ FROZEN CONTROL — the rule as it stood before 66bf1ed. Do not "tidy" this into an import. */
function oldRule(target, history) {
  const d = dayOfWeek(target);
  const avg = rows => ({
    out: Math.round(mean(rows.map(r => r.outCount))),
    in:  Math.round(mean(rows.map(r => r.inCount))),
  });
  if (d === 0 || d === 6) {
    const prior = history.slice(-7);
    return prior.length < 2 ? null : avg(prior);
  }
  const sameDay = history.filter(e => dayOfWeek(e.date) === d).slice(-PROJECTION_WINDOW);
  if (sameDay.length >= 2) return avg(sameDay);
  const weekdays = history.filter(e => { const w = dayOfWeek(e.date); return w >= 1 && w <= 5; })
                          .slice(-PROJECTION_WINDOW);
  return weekdays.length < 2 ? null : avg(weekdays);
}

const newRule = (target, history) => {
  const p = projectFleetBalance(target, history);
  return p && { out: p.avgOut, in: p.avgIn };
};

// ── History, straight from the DB via the Supabase Management API ─────────────
const root = fileURLToPath(new URL('../', import.meta.url));
const env  = readFileSync(root + '.env.local', 'utf8');
const TOK  = /^SUPABASE_ACCESS_TOKEN=(.+)$/m.exec(env)?.[1].trim().replace(/^['"]|['"]$/g, '');
if (!TOK) { console.error('No SUPABASE_ACCESS_TOKEN in .env.local'); process.exit(1); }

const sql = `select to_char(date,'YYYY-MM-DD') date, out_count "outCount", in_count "inCount"
             from fleet_balance order by date`;
const res = await fetch('https://api.supabase.com/v1/projects/gugxedtqvuhlwllyqpec/database/query', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json',
    // The Cloudflare-1010 workaround the other FG scripts use; a bare fetch UA is rejected.
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
  },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) { console.error('query failed', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const H = await res.json();

// ── Replay ────────────────────────────────────────────────────────────────────
const rows = [];
for (let i = 0; i < H.length; i++) {
  const t = H[i];
  if (t.date < SINCE) continue;
  const hist = H.slice(0, i);
  const a = newRule(t.date, hist), b = oldRule(t.date, hist);
  if (!a || !b) continue;                       // common subset only — a fair pairing or none
  rows.push({ date: t.date, dow: DAY[dayOfWeek(t.date)].slice(0, 3), t, a, b });
}

if (!rows.length) {
  console.log(`No entries on or after ${SINCE} yet — nothing to grade.`);
  console.log('⚠️ That is a real answer, not a zero: the blend has not been asked a question yet.');
  process.exit(0);
}

console.log(`\nGrading ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} from ${SINCE} — paired replay, new vs the rule it replaced.\n`);
console.log('date        dow   actual      new       old    winner');
let winN = 0, winO = 0, tie = 0;
const eN = { o: [], i: [] }, eO = { o: [], i: [] };
for (const r of rows) {
  const dN = Math.abs(r.a.out - r.t.outCount) + Math.abs(r.a.in - r.t.inCount);
  const dO = Math.abs(r.b.out - r.t.outCount) + Math.abs(r.b.in - r.t.inCount);
  const w = dN < dO ? (winN++, 'new') : dN > dO ? (winO++, 'old') : (tie++, '—');
  eN.o.push(r.a.out - r.t.outCount); eN.i.push(r.a.in - r.t.inCount);
  eO.o.push(r.b.out - r.t.outCount); eO.i.push(r.b.in - r.t.inCount);
  console.log(`${r.date}  ${r.dow}  ${String(r.t.outCount).padStart(3)}/${String(r.t.inCount).padEnd(3)} ` +
              `${String(r.a.out).padStart(4)}/${String(r.a.in).padEnd(3)} ${String(r.b.out).padStart(5)}/${String(r.b.in).padEnd(3)}   ${w}`);
}

console.log(`\n⭐ PAIRED RESULT: new won ${winN}, old won ${winO}${tie ? `, tied ${tie}` : ''} (of ${rows.length}).`);
const line = (name, e) => console.log(`${name.padEnd(6)} OUT mae ${String(R(mean(e.o.map(Math.abs)))).padStart(5)}  bias ${String(R(mean(e.o))).padStart(5)}   ` +
                                      `IN mae ${String(R(mean(e.i.map(Math.abs)))).padStart(5)}  bias ${String(R(mean(e.i))).padStart(5)}`);
line('new', eN); line('old', eO);
console.log(`\n⚠️ On a small sample read the WIN COUNT, not the means — see the header. A coin flip at
   n=${rows.length} lands near ${Math.round(rows.length / 2)}-${Math.round(rows.length / 2)}, so only a lopsided split says anything.`);

// A changed rule invalidates the comparison silently, so say which code was graded.
try {
  const sha = execSync('git log -1 --format=%h -- src/lib/fleetProjection.ts', { cwd: root }).toString().trim();
  console.log(`\nGraded fleetProjection.ts at ${sha}. ⚠️ If that is not 66bf1ed, the "new" column is a
THIRD rule and the control above is no longer the thing it was compared against — re-read the file.`);
} catch { /* not fatal; the numbers above still stand */ }
