// Backfill `vehicles.class_code` by RE-READING the key-tag photos FG already stored.
//
//   npx tsx scripts/backfill-class-code-from-tags.ts            # dry run — writes NOTHING
//   npx tsx scripts/backfill-class-code-from-tags.ts --apply    # writes only the AGREE rows
//
// WHY THIS ISN'T THE SAME AS MIGRATION 121 (Aaron's ask, 2026-08-20): 121 filled 479 codes by
// DEDUCING them from make+model, and correctly refused the rest — a Versa's code splits on IGNITION
// (CVSS turn-key vs CVRS push-button), a field FG doesn't record, so the mapping doesn't invert.
// A tag PHOTO doesn't have to invert anything. It just says what the code IS. So this reaches
// exactly the cars deduction couldn't, and it's an honest `tag`-source read — the same act as
// reading the tag at the car, only delayed.
//
// ── The guardrail that makes it safe ────────────────────────────────────────────────────────────
// A vision misread that gets written is how `VAN → Tesla Model 3` happened (R59). So every read is
// CROSS-CHECKED against what FG already knows: resolve the code through the curated codex and
// compare its make/model to the car's. A code that resolves to a RAV4 on a car FG has as a Mazda is
// a bad read or a photo of a different car — either way it is NOT written, it is listed.
//
// Three hard rules:
//   1. BLANKS ONLY — never overwrite a code that's already there.
//   2. NEVER TEACH THE CODEX — this writes `vehicles.class_code` and nothing else. One misread must
//      not become the whole fleet's mapping.
//   3. AGREEMENT REQUIRED — a code neither codex can resolve can't be checked, so it isn't written.
//      It's reported for Aaron, who is the authority on what a code means.
//
// BOTH codices are consulted, curated first then taught — the same order api/keytag-read.ts uses.
// The first pass of this script checked only the curated table and parked 20 perfectly good cars as
// "unverifiable"; every one of them resolved against codes AARON HIMSELF had taught. A verifier
// that knows less than the endpoint it's verifying will manufacture doubt about correct data.
//
// Cheap-first, same as the endpoint: haiku reads all of them, and only the DISAGREEMENTS are
// re-read by opus — the strong model earns its cost on exactly the tags the cheap one found hard.
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { lookupVehicleClass, normalizeClassCode } from '../api/_lib/vehicleClassCodex.js';

const APPLY = process.argv.includes('--apply');
const FAST = 'claude-haiku-4-5';
const STRONG = 'claude-opus-4-8';

// Reuse the ENDPOINT's own prompt so a backfill reads tags exactly the way the app does —
// same trick as verify-keytag-vision.ts. A drifted copy would read a different tag than production.
const PROMPT = readFileSync(new URL('../api/keytag-read.ts', import.meta.url), 'utf8')
  .match(/const PROMPT = `([\s\S]*?)`;/)?.[1];

const TOOL = {
  name: 'report_keytag',
  description: 'Report the fields read off the vehicle key tag.',
  input_schema: {
    type: 'object' as const,
    properties: {
      plate: { type: 'string' }, unitNumber: { type: 'string' }, classCode: { type: 'string' },
      rentalClass: { type: 'string' }, year: { type: 'integer' }, color: { type: 'string' },
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

/** The taught table (migrations/104) — codes Aaron added at the car. Consulted only when the
 *  curated table misses, exactly as the endpoint does. */
async function loadTaught(): Promise<Record<string, { make: string; model: string }>> {
  const rows: Array<{ code: string; make: string; model: string }> =
    await (await fetch(`${SB}/rest/v1/vehicle_class_codex?select=code,make,model`, { headers: H })).json();
  return Object.fromEntries(rows.map(r => [r.code, { make: r.make, model: r.model }]));
}

interface Row {
  id: string; unit_number: string | null; license_plate: string;
  make: string; model: string; rental_class: string | null; keytag_photo_url: string;
}

async function readTag(anthropic: Anthropic, b64: string, mime: string, model: string) {
  const msg = await anthropic.messages.stream({
    model, max_tokens: 1024, system: PROMPT!, tools: [TOOL],
    tool_choice: { type: 'tool', name: 'report_keytag' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Read this key tag.' },
      { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg', data: b64 } },
    ] }],
  }, { timeout: 60_000, maxRetries: 1 }).finalMessage();
  const tool = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  return (tool?.input ?? {}) as { classCode?: string; rentalClass?: string; plate?: string };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function main(): Promise<void> {
  if (!PROMPT) throw new Error('could not extract PROMPT from api/keytag-read.ts');
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const taught = await loadTaught();
  const resolve = (code: string) => lookupVehicleClass(code) ?? taught[code] ?? null;

  const rows: Row[] = await (await fetch(
    `${SB}/rest/v1/vehicles?archived_at=is.null&class_code=is.null&keytag_photo_url=not.is.null` +
    `&select=id,unit_number,license_plate,make,model,rental_class,keytag_photo_url&limit=500`, { headers: H })).json();

  console.log(`${rows.length} cars with a stored tag photo and no class code${APPLY ? '' : '  (DRY RUN — writing nothing)'}\n`);

  const agree: string[] = [], disagree: string[] = [], unknown: string[] = [], unread: string[] = [];
  const writes: Array<{ id: string; code: string }> = [];

  for (const [i, v] of rows.entries()) {
    const label = `${v.unit_number ?? '?'} ${v.license_plate} · ${v.make} ${v.model}`;
    try {
      const res = await fetch(v.keytag_photo_url);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      const b64 = buf.toString('base64');

      let read = await readTag(anthropic, b64, mime, FAST);
      let code = normalizeClassCode(read.classCode);
      let hit = code ? resolve(code) : null;

      // Escalate ONLY what the cheap model got wrong or couldn't resolve — the strong model was
      // 13-0 on the tags haiku found hard (see api/_lib/keytagEscalation.ts).
      const needsSecondLook = !code || !hit || !same(hit.make, v.make);
      if (needsSecondLook) {
        read = await readTag(anthropic, b64, mime, STRONG);
        code = normalizeClassCode(read.classCode);
        hit = code ? resolve(code) : null;
      }

      if (!code) { unread.push(`${label} — no class code legible on the tag`); }
      else if (!hit) { unknown.push(`${label} — read ${code}, in NEITHER codex (can't verify → not written)`); }
      // Make must always agree. Model is waived when FG doesn't know it ("Tesla Unknown" from the
      // quick-add path) — fill blanks, flag conflicts, the same contract resolveKeytag runs on.
      else if (same(hit.make, v.make) && (same(hit.model, v.model) || !v.model || same(v.model, 'Unknown'))) {
        agree.push(`${label} → ${code}`);
        writes.push({ id: v.id, code });
      } else {
        disagree.push(`${label} — read ${code} = ${hit.make} ${hit.model} ✗ record says ${v.make} ${v.model}`);
      }
    } catch (err) {
      unread.push(`${label} — ${err instanceof Error ? err.message : String(err)}`);
    }
    if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${rows.length}`);
  }

  const show = (title: string, list: string[]) => {
    console.log(`\n${title} (${list.length})`);
    for (const l of list) console.log('  ' + l);
  };
  show('✅ AGREE — code resolves to the car FG already has', agree);
  show('⚠️  DISAGREE — NOT written, needs your eye', disagree);
  show('❓ CODE NOT IN CODEX — NOT written, you decide', unknown);
  show('🚫 UNREADABLE', unread);

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. ${writes.length} rows would be filled. Re-run with --apply.`);
    return;
  }
  for (const w of writes) {
    await fetch(`${SB}/rest/v1/vehicles?id=eq.${w.id}&class_code=is.null`, {   // blanks-only, at the write
      method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_code: w.code }),
    });
  }
  console.log(`\n✓ wrote ${writes.length} class codes (blanks-only). Codex untouched.`);
}

main().catch(err => { console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`); process.exit(1); });
