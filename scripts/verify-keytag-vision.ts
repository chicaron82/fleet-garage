// Live verification for the keytag vision read — same discipline as verify-schedule-vision.ts.
// The endpoint's model call is unreachable by the test suite, and a prompt/schema change is
// invisible to tsc/eslint/vitest, so it gets sent for real before it's trusted.
//
//   npx tsx scripts/verify-keytag-vision.ts <tag-image> [field=expected ...]
//   e.g. npx tsx scripts/verify-keytag-vision.ts us-tag.jpg rentalClass=Q4 classCode= model=TUCSON
//   MODEL=claude-opus-4-8 npx tsx scripts/verify-keytag-vision.ts …   (default: the reader's FAST pass)
//
// Reads ANTHROPIC_API_KEY from .env.local. Costs tokens — manual, not in the gate.
//
// ⚠️⚠️ IT WAS BROKEN FOR FIVE DAYS AND NOBODY KNEW. This probe used to regex `const PROMPT = `…``
// out of `api/keytag-read.ts` and hand-copy the tool schema. `82eff6e` (2026-09-09) moved the prompt
// into `api/_lib/keytagReader.ts` — which EXPORTS it, with a comment saying so *"so a probe can measure
// the REAL read"* — and the probe was never pointed at it. Found 2026-09-14 when a prompt change needed
// proving. It now imports the live PROMPT and REPORT_TOOL, so there is no copy left to drift.
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { PROMPT, REPORT_TOOL } from '../api/_lib/keytagReader.js';

function loadKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('ANTHROPIC_API_KEY='));
  if (line) return line.slice('ANTHROPIC_API_KEY='.length).trim();
  throw new Error('ANTHROPIC_API_KEY not found');
}

const MEDIA: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};

async function main(): Promise<void> {
  const [path, ...expectations] = process.argv.slice(2);
  if (!path) throw new Error('usage: npx tsx scripts/verify-keytag-vision.ts <tag-image> [field=expected ...]');
  const model = process.env.MODEL || 'claude-haiku-4-5';

  const data = readFileSync(path).toString('base64');
  const anthropic = new Anthropic({ apiKey: loadKey() });
  const message = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: PROMPT,
    tools: [REPORT_TOOL],
    tool_choice: { type: 'tool', name: 'report_keytag' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Read this key tag.' },
      { type: 'image', source: { type: 'base64', media_type: MEDIA[extname(path).toLowerCase()] ?? 'image/jpeg', data } },
    ] }],
  }, { timeout: 60_000, maxRetries: 1 });

  const tool = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  const r = (tool?.input ?? {}) as Record<string, unknown>;
  console.log(`model: ${model}\n${JSON.stringify(r, null, 2)}\n`);

  // `field=` with nothing after it asserts the field came back EMPTY — the claim a model name is
  // not a class code needs exactly that.
  let failed = 0;
  for (const exp of expectations) {
    const [field, ...rest] = exp.split('=');
    const want = rest.join('=').toUpperCase();
    const got = String(r[field] ?? '').toUpperCase();
    const ok = got === want;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${field}: expected "${want}", got "${got}"`);
  }
  if (failed) throw new Error(`${failed} expectation(s) failed`);
}

main().catch((err) => { console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`); process.exit(1); });
