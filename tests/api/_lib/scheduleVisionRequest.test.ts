import { describe, it, expect } from 'vitest';
import {
  buildScheduleRequest,
  SCHEDULE_MAX_TOKENS,
  SDK_NONSTREAMING_MAX_TOKENS,
  VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from '../../../api/_lib/scheduleVisionRequest';

// These pin the request SHAPE — the one part of this endpoint that no test covered, and
// which broke twice in one day on Aaron's phone while the whole gate stayed green.

const docBlock = {
  type: 'image' as const,
  source: { type: 'base64' as const, media_type: 'image/png' as const, data: 'AAAA' },
};

describe('schedule vision request shape', () => {
  it('carries enough output budget for a worst-case 4-week sheet', () => {
    // ~390 cells x ~45-50 tokens/cell ~= 19.5k. Below this and multi-week sheets truncate,
    // which is the original bug: the model got cut off and the UI blamed the photo.
    expect(SCHEDULE_MAX_TOKENS).toBeGreaterThan(20_000);
  });

  it('DOCUMENTS THE STREAMING COUPLING: this max_tokens forces .stream(), never .create()', () => {
    // The SDK throws "Streaming is required..." client-side, before sending, when
    // 3600 * max_tokens / 128000 > 600 — i.e. max_tokens > 21333. If someone lowers
    // max_tokens below that line this assertion flips and they can reconsider; if someone
    // swaps .stream() back to .create() at the current value, production throws on every
    // request. This test is the note that keeps those two decisions tied together.
    expect(SCHEDULE_MAX_TOKENS).toBeGreaterThan(SDK_NONSTREAMING_MAX_TOKENS);
  });

  it('matches the SDK formula for the non-streaming ceiling', () => {
    // Mirrors @anthropic-ai/sdk client.js calculateNonstreamingTimeout, so an SDK change
    // to that formula shows up here rather than as a production throw.
    expect(SDK_NONSTREAMING_MAX_TOKENS).toBe(Math.floor((10 / 60) * 128000));
  });

  it('forces the report_schedule tool so output is always structured', () => {
    const req = buildScheduleRequest(docBlock);
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'report_schedule' });
    expect(req.tools?.[0]).toMatchObject({ name: 'report_schedule' });
  });

  it('puts the image in the user turn alongside the instruction', () => {
    const req = buildScheduleRequest(docBlock);
    const content = req.messages[0].content;
    expect(Array.isArray(content)).toBe(true);
    expect(content).toContainEqual(docBlock);
  });

  it('resolves the year from the supplied date so undated sheets land in the right year', () => {
    const req = buildScheduleRequest(docBlock, new Date('2026-07-20T12:00:00Z'));
    expect(req.system).toContain('2026-07-20');
  });

  it('uses distinct primary and fallback models', () => {
    expect(VISION_MODEL).not.toBe(FALLBACK_VISION_MODEL);
  });
});
