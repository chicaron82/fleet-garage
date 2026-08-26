// Backfill `vehicles.vin_last9` by RE-READING the key-tag photos FG already stored.
//
//   npx tsx scripts/backfill-vin-from-tags.ts             # dry run — writes NOTHING
//   npx tsx scripts/backfill-vin-from-tags.ts --apply     # writes only the clean reads
//   npx tsx scripts/backfill-vin-from-tags.ts --limit 5   # a small validation pass
//
// Aaron, 2026-08-25: *"start capturing the vin info from keytags. then back fill that data from the
// keytags FG already has."* Same machine as backfill-class-code-from-tags.ts, which wrote 97 rows
// with zero disagreements — but the verification problem here is genuinely different, and worth
// stating because it changes what this script is allowed to do.
//
// ── HOW THIS IS CHECKED, AND THE ASSERTION I GOT WRONG ─────────────────────────────────────────
// The class-code backfill was safe because a code RESOLVES: read CKSV, look it up, and if it says
// "Nissan Kicks" on a car FG has as a Mazda, the read is wrong and gets parked. The codex was an
// independent oracle.
//
// ⚠️ THIS FILE ORIGINALLY SAID "A VIN HAS NO ORACLE" and rested its whole safety case on that.
// **It was wrong.** The last nine characters are VIN positions 9–17 and are POSITIONALLY
// MEANINGFUL — position 9 is the CHECK DIGIT (0-9 or X, absolute) and position 10 is the MODEL
// YEAR, which FG already stores for every car. Two free, independent checks were inside the string
// the entire time; I had reasoned "nine characters resolve to nothing FG holds" without once asking
// what the characters individually MEAN.
//
// It cost data. Of 374 rows written under two-model agreement alone, an audit found TWO wrong:
// `VXSL47717` (illegal check digit, year 2029) and `5SW414560` (year says 2025; the car's tag and
// record both say 2024). BOTH had been agreed on by both models. **"Unverifiable" was a claim about
// my imagination, not about the data.**
//
// So the guard is structural AND semantic:
//
//   1. BLANKS ONLY — restated at the write (`vin_last9.is.null`). A VIN is immutable; the first
//      good read is the only one ever taken, so this must never overwrite.
//   2. SHAPE OR NOTHING — `normalizeVinLast9` demands exactly nine VIN-legal characters. A partial
//      is rejected, never salvaged: it would wear the shape of an identity key while identifying
//      nothing.
//   3. TWO MODELS MUST AGREE — the real safeguard. Every tag is read by haiku AND opus, and the VIN
//      is written ONLY when both return the identical nine characters. Two independent readers
//      agreeing on nine arbitrary characters is strong evidence; one reader is a guess with a
//      confident tone. This costs roughly double the class-code run and is worth it, because a
//      wrong VIN is undetectable afterwards — there is nothing to notice it against.
//   4. THE YEAR MUST AGREE — and here the backfill is STRICTER than the live scan, deliberately.
//      VIN position 10 is the model year, which is the 2nd character of the last nine, and FG
//      already stores every car's year. At the scan that mismatch is ADVISORY, because Aaron is
//      standing there and FG's own `year` can be the wrong half — refusing would let a bad year
//      permanently block a good VIN. In a batch there is NOBODY to adjudicate, so the same signal
//      becomes a refusal. Same evidence, different handling, because the difference is whether a
//      human is present.
//      This is not hypothetical: `5SW414560` (LFJ285) passed the two-model guard — both models
//      agreed — and its year character said 2025 on a car whose TAG and record both say 2024.
//      Without this rule a re-run would cheerfully write it again.
//   5. COLLISIONS ARE REPORTED, NEVER RESOLVED. If two cars read the same VIN, at least one is
//      wrong and this script cannot know which. Both are skipped and listed for Aaron.
//
// The endpoint's own PROMPT is reused by extraction, so a backfill reads tags exactly the way
// production does — and running this IS the real send that validates the vision tool-schema change,
// which the test gate is structurally blind to (see FG CLAUDE.md, "the gate is silent at the SDK
// boundary").
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { normalizeVinLast9, vinYearDisagrees } from '../api/_lib/vinLast9.js';

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? Number(process.argv[i + 1]) : 0;
})();
const FAST = 'claude-haiku-4-5';
const STRONG = 'claude-opus-4-8';

const PROMPT = readFileSync(new URL('../api/keytag-read.ts', import.meta.url), 'utf8')
  .match(/const PROMPT = `([\s\S]*?)`;/)?.[1];

const TOOL = {
  name: 'report_keytag',
  description: 'Report the fields read off the vehicle key tag.',
  input_schema: {
    type: 'object' as const,
    properties: {
      plate: { type: 'string' }, unitNumber: { type: 'string' },
      vinLast9: { type: 'string', description: 'The NINE characters printed after "Last9vin:", exactly as shown, no spaces.' },
      classCode: { type: 'string' }, rentalClass: { type: 'string' },
    },
    required: [] as string[],
  },
};

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const SB = env.VITE_SUPABASE_URL;
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

interface Row {
  id: string; unit_number: string | null; license_plate: string;
  make: string; model: string; year: number | null; keytag_photo_url: string;
}

async function readVin(anthropic: Anthropic, b64: string, mime: string, model: string): Promise<string> {
  const msg = await anthropic.messages.stream({
    model, max_tokens: 1024, system: PROMPT!, tools: [TOOL],
    tool_choice: { type: 'tool', name: 'report_keytag' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Read this key tag.' },
      { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg', data: b64 } },
    ] }],
  }, { timeout: 60_000, maxRetries: 1 }).finalMessage();
  const tool = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  return normalizeVinLast9((tool?.input as { vinLast9?: string } | undefined)?.vinLast9);
}

async function main(): Promise<void> {
  if (!PROMPT) throw new Error('could not extract PROMPT from api/keytag-read.ts');
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  let rows: Row[] = await (await fetch(
    `${SB}/rest/v1/vehicles?archived_at=is.null&vin_last9=is.null&keytag_photo_url=not.is.null` +
    `&select=id,unit_number,license_plate,make,model,year,keytag_photo_url&limit=800`, { headers: H })).json();
  if (LIMIT) rows = rows.slice(0, LIMIT);

  console.log(`${rows.length} cars with a stored tag photo and no VIN${APPLY ? '' : '  (DRY RUN — writing nothing)'}\n`);

  const agree: string[] = [], disagree: string[] = [], unread: string[] = [], wrongYear: string[] = [];
  const writes: Array<{ id: string; vin: string; label: string }> = [];

  for (const [i, v] of rows.entries()) {
    const label = `${v.unit_number ?? '?'} ${v.license_plate} · ${v.make} ${v.model}`;
    try {
      const res = await fetch(v.keytag_photo_url);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      const b64 = buf.toString('base64');

      // BOTH models, every time. There is no oracle for a VIN, so agreement between two
      // independent readers IS the verification — see the header.
      const [fast, strong] = await Promise.all([
        readVin(anthropic, b64, mime, FAST),
        readVin(anthropic, b64, mime, STRONG),
      ]);

      if (!fast && !strong) unread.push(`${label} — no VIN legible on the tag`);
      else if (fast && strong && fast === strong) {
        // Both models agreeing is NOT enough on its own — 5SW414560 proved that. The VIN's own
        // model-year character is an independent witness, and in a batch it gets a veto.
        if (vinYearDisagrees(fast, v.year)) {
          wrongYear.push(`${label} — read ${fast}, its year char says ${fast[1]} but the record says ${v.year} → NOT written`);
        } else {
          agree.push(`${label} → ${fast}`);
          writes.push({ id: v.id, vin: fast, label });
        }
      } else {
        disagree.push(`${label} — haiku "${fast || '—'}" vs opus "${strong || '—'}" → NOT written`);
      }
    } catch (err) {
      unread.push(`${label} — ${err instanceof Error ? err.message : String(err)}`);
    }
    if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${rows.length}`);
  }

  // A VIN is supposed to be unique. Two cars reading the same one means at least one is wrong, and
  // nothing here can tell which — so BOTH are dropped rather than guessed at.
  const seen = new Map<string, string[]>();
  for (const w of writes) seen.set(w.vin, [...(seen.get(w.vin) ?? []), w.label]);
  const collided = new Set([...seen.entries()].filter(([, l]) => l.length > 1).map(([vin]) => vin));
  const safe = writes.filter(w => !collided.has(w.vin));

  const show = (title: string, list: string[]) => {
    console.log(`\n${title} (${list.length})`);
    for (const l of list) console.log('  ' + l);
  };
  show('✅ BOTH MODELS AGREE', agree);
  show('⚠️  MODELS DISAGREE — not written', disagree);
  show('📅 YEAR CONTRADICTS THE RECORD — not written', wrongYear);
  show('🚫 NO VIN LEGIBLE', unread);
  if (collided.size) {
    console.log(`\n🔴 VIN COLLISIONS — dropped, needs your eye (${collided.size})`);
    for (const vin of collided) console.log(`  ${vin} → ${seen.get(vin)!.join('  ||  ')}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. ${safe.length} rows would be filled. Re-run with --apply.`);
    return;
  }
  for (const w of safe) {
    await fetch(`${SB}/rest/v1/vehicles?id=eq.${w.id}&vin_last9=is.null`, {   // blanks-only, at the write
      method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin_last9: w.vin }),
    });
  }
  console.log(`\n✓ wrote ${safe.length} VINs (blanks-only, both models agreeing).`);
}

main().catch(err => { console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`); process.exit(1); });
