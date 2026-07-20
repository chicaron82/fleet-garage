// Live verification for the schedule-photo vision request. Run it after ANY change to the
// request shape, model, max_tokens, or streaming mode.
//
//   npx tsx scripts/verify-schedule-vision.ts <path-to-sheet-image>
//
// Why this exists: the endpoint's model call is the one part of fg-schedule-parse that unit
// tests structurally cannot cover, and it broke TWICE in one day (2026-07-20) — a max_tokens
// raise that crossed a client-side SDK guard, and a timeout set in the wrong options object.
// Both passed tsc, eslint and 1740 tests, and failed on the operator's phone. "Gate green"
// says the code compiles; only this says the request is actually accepted.
//
// Costs real tokens, so it is deliberately manual — not wired into the gate or the pre-push
// hook. Reads ANTHROPIC_API_KEY from .env.local (or the environment).
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { buildScheduleRequest, SCHEDULE_MAX_TOKENS, VISION_MODEL } from '../api/_lib/scheduleVisionRequest.js';

function loadKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('ANTHROPIC_API_KEY='));
    if (line) return line.slice('ANTHROPIC_API_KEY='.length).trim();
  } catch { /* fall through to the error below */ }
  throw new Error('ANTHROPIC_API_KEY not found in the environment or .env.local');
}

const MEDIA: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('usage: npx tsx scripts/verify-schedule-vision.ts <path-to-sheet-image>');

  const ext = extname(path).toLowerCase();
  const isPdf = ext === '.pdf';
  const data = readFileSync(path).toString('base64');
  const docBlock: Anthropic.ContentBlockParam = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: MEDIA[ext] ?? 'image/png', data } };

  console.log(`→ ${VISION_MODEL}, max_tokens=${SCHEDULE_MAX_TOKENS}, streaming, sheet=${path}`);
  const started = Date.now();
  const anthropic = new Anthropic({ apiKey: loadKey() });
  const message = await anthropic.messages
    .stream(buildScheduleRequest(docBlock), { timeout: 150_000, maxRetries: 0 })
    .finalMessage();
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  const staff = ((toolUse?.input as { staff?: unknown[] })?.staff ?? []) as { name?: string; cells?: unknown[] }[];
  const cells = staff.reduce((n, s) => n + (s.cells?.length ?? 0), 0);

  console.log(`  stop_reason   ${message.stop_reason}`);
  console.log(`  output_tokens ${message.usage.output_tokens} / ${SCHEDULE_MAX_TOKENS}`);
  console.log(`  staff × cells ${staff.length} × ${cells}`);
  console.log(`  elapsed       ${secs}s`);

  if (message.stop_reason === 'max_tokens') throw new Error('TRUNCATED — max_tokens is still too low for this sheet');
  if (!toolUse) throw new Error('no tool_use block — the model did not report a schedule');
  if (staff.length === 0) throw new Error('empty staff array — nothing was read');
  console.log(`\n✓ request accepted and parsed (${staff.length} staff, ${cells} cells)`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
