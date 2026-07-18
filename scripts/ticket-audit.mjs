// Ticket-coverage audit — cross-references FG commits against the docs/ ticket record.
// Turns Aaron's manual eyeball-audit into a reliable command (recall→knowing on the ticket
// record itself). Handles what a naive hash-grep can't: whitespace in `commit:` stamps,
// multi-commit tickets (comma / · / annotated), and open-but-already-shipped tickets.
//
//   node scripts/ticket-audit.mjs [since]     # since defaults to 2026-07-08 (the "everything
//                                             # gets a ticket" era); pre-rule commits are exempt.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const docsDir = fileURLToPath(new URL('docs/', root));
const SINCE = process.argv[2] || '2026-07-08';
const HEX = /\b[0-9a-f]{7,40}\b/g;

// ── Gather tickets ────────────────────────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = dir + name;
    if (statSync(p).isDirectory()) out.push(...walk(p + '/'));
    else if (name.endsWith('.md') && /^(ticket|bug)-/.test(name)) out.push(p);
  }
  return out;
}

function field(body, key) {
  const m = body.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

const tickets = walk(docsDir).map(path => {
  const body = readFileSync(path, 'utf8');
  const commitLine = field(body, 'commit');
  return {
    file: path.replace(docsDir, ''),
    status: field(body, 'status').split(/\s+/)[0], // strip trailing template comment
    hashes: commitLine.match(HEX) ?? [],
    title: field(body, 'title'),
  };
});

// Every hash any ticket claims → the coverage set.
const claimed = tickets.flatMap(t => t.hashes);
const isTicketed = (full) => claimed.some(h => full.startsWith(h));

// ── Gather commits ────────────────────────────────────────────────────────────
const log = execSync(
  `git -C ${fileURLToPath(root)} log --since="${SINCE} 00:00" --pretty=%H%x09%cd%x09%s --date=format:'%a %m-%d'`,
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean);

let missing = 0;
const rows = log.map(line => {
  const [full, date, subject] = line.split('\t');
  const ok = isTicketed(full);
  if (!ok) missing++;
  return { short: full.slice(0, 7), date, ok, subject };
});

// ── Anomalies ─────────────────────────────────────────────────────────────────
const gitHashes = log.map(l => l.split('\t')[0]);
const shippedNoStamp = tickets.filter(t => t.status === 'shipped' && t.hashes.length === 0);
const openButShipped = tickets.filter(t =>
  (t.status === 'open' || t.status === 'in-progress') &&
  t.hashes.some(h => gitHashes.some(g => g.startsWith(h))));

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\nTicket audit — FG commits since ${SINCE}\n`);
for (const r of rows) {
  console.log(`  ${r.ok ? '✓' : '✗ MISSING'}\t${r.short}  ${r.date}  ${r.subject}`);
}
console.log(`\n${rows.length} commits · ${rows.length - missing} ticketed · ${missing} MISSING\n`);

if (shippedNoStamp.length) {
  console.log('⚠️  Shipped tickets with NO commit stamp (fill the commit hash):');
  for (const t of shippedNoStamp) console.log(`      ${t.file}`);
  console.log('');
}
if (openButShipped.length) {
  console.log('⚠️  Tickets still OPEN whose commit already shipped (flip to shipped + archive):');
  for (const t of openButShipped) console.log(`      ${t.file} — ${t.hashes.join(', ')}`);
  console.log('');
}
if (!missing && !shippedNoStamp.length && !openButShipped.length) {
  console.log('✅ Clean — every commit ticketed, every shipped ticket stamped.\n');
}
