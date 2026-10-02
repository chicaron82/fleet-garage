import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// A clipped tag identifies the car and nothing else (`932e44d`). The resolution obeyed that from the
// start; `useScanPipeline` did not — it wrote owning area, model code and last-9 straight from the raw
// read, if-missing and permanently. Found in /reflect the same evening. The hook has no unit test (it
// is wiring), so the rule is pinned here: every value it WRITES comes from `seen.trustedRead`.

describe('scan writes come from the trusted read', () => {
  const src = readFileSync('src/hooks/useScanPipeline.ts', 'utf8');

  it('⭐ takes the trusted read from the resolution', () => {
    expect(src).toMatch(/const tag = seen\.trustedRead;/);
  });

  it('⭐⭐ never hands a raw-read field to a record* / teach write', () => {
    const writes = src.split('\n').filter(l => /\b(recordOwningArea|recordClassCode|recordVinLast9|teachClassCode|classCodeLessonFromScan)\(/.test(l));
    expect(writes.length).toBeGreaterThanOrEqual(4);
    for (const line of writes) expect(line, line.trim()).not.toMatch(/\bread\./);
    for (const line of writes) expect(line, line.trim()).not.toMatch(/\(read[,)]/);
  });
});
