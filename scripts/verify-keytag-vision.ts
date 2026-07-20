// Live verification for the keytag vision read — same discipline as verify-schedule-vision.ts.
// The endpoint's model call is unreachable by the test suite, and a prompt/schema change is
// invisible to tsc/eslint/vitest, so it gets sent for real before it's trusted.
//
//   npx tsx scripts/verify-keytag-vision.ts <tag-image> [expectedRentalClass]
//
// Reads ANTHROPIC_API_KEY from .env.local. Costs tokens — manual, not in the gate.
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

// Mirror of api/keytag-read.ts (kept in sync by hand; this is a probe, not the endpoint).
const PROMPT = readFileSync(new URL('../api/keytag-read.ts', import.meta.url), 'utf8')
  .match(/const PROMPT = `([\s\S]*?)`;/)?.[1];
const TOOL = { name: 'report_keytag', description: 'Report the fields read off the vehicle key tag.', input_schema: {
  type: 'object' as const,
  properties: {
    plate: { type: 'string' }, unitNumber: { type: 'string' }, classCode: { type: 'string' },
    rentalClass: { type: 'string' }, year: { type: 'integer' }, color: { type: 'string' }, bodyStyle: { type: 'string' },
  },
  required: [] as string[],
} };

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
  const path = process.argv[2];
  const expected = process.argv[3];
  if (!path) throw new Error('usage: npx tsx scripts/verify-keytag-vision.ts <tag-image> [expectedRentalClass]');
  if (!PROMPT) throw new Error('could not extract PROMPT from api/keytag-read.ts');

  const data = readFileSync(path).toString('base64');
  const anthropic = new Anthropic({ apiKey: loadKey() });
  const message = await anthropic.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: PROMPT,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'report_keytag' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Read this key tag.' },
      { type: 'image', source: { type: 'base64', media_type: MEDIA[extname(path).toLowerCase()] ?? 'image/jpeg', data } },
    ] }],
  }, { timeout: 60_000, maxRetries: 1 }).finalMessage();

  const tool = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  const r = (tool?.input ?? {}) as Record<string, unknown>;
  console.log(JSON.stringify(r, null, 2));

  const got = String(r.rentalClass ?? '').toUpperCase();
  if (!got) throw new Error('rentalClass came back EMPTY — the prompt did not capture the top-corner class');
  console.log(`\nrentalClass = ${got}`);
  if (expected && got !== expected.toUpperCase()) {
    throw new Error(`expected rentalClass ${expected.toUpperCase()}, got ${got}`);
  }
  console.log(expected ? `✓ matches expected ${expected.toUpperCase()}` : '✓ captured (no expected value given)');
}

main().catch((err) => { console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`); process.exit(1); });
