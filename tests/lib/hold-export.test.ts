import { describe, it, expect } from 'vitest';
import { buildHoldReport, escapeHtml } from '../../src/lib/hold-export';
import type { Hold, Vehicle } from '../../src/types';

// The report is built ONCE and used twice — the shared image and the printable fallback — so these
// pin the builder both depend on. docs/September/ticket-hold-report-shares-empty.md

const VEHICLE = {
  unitNumber: '5422852', licensePlate: 'LUR300', make: 'Nissan', model: 'Rogue', year: 2026,
  color: 'Gray', status: 'HELD',
} as unknown as Vehicle;

const hold = (over: Partial<Hold> = {}): Hold => ({
  id: 'h1', vehicleId: 'v1', status: 'ACTIVE', holdType: 'damage', holdTypes: ['damage'],
  damageDescription: 'Cracked windshield', flaggedById: 'u1', flaggedByName: 'Aaron S.',
  flaggedByEmployeeId: '331965', flaggedAt: '2026-09-23T14:30:00Z', photos: ['https://cdn/ws.jpg'],
  ...over,
} as unknown as Hold);

const build = (holds: Hold[]) => buildHoldReport({ vehicle: VEHICLE, holds, getName: (_i, s) => s ?? '', getEmpId: (_i, s) => s ?? '' });

describe('buildHoldReport', () => {
  it('⭐ the card carries the car, the hold and its photo', () => {
    const { card } = build([hold()]);
    expect(card).toContain('Unit 5422852');
    expect(card).toContain('Plate: LUR300');
    expect(card).toContain('Cracked windshield');
    expect(card).toContain('src="https://cdn/ws.jpg"');
    expect(card).toContain('Active Holds (1)');
  });

  it('splits active from history — LUR300 is one of each', () => {
    const { card } = build([hold(), hold({ id: 'h0', status: 'RELEASED', damageDescription: 'Bumper damage — cosmetic' })]);
    expect(card).toContain('Active Holds (1)');
    expect(card).toContain('Hold History (1)');
  });

  it('the printable page wraps the SAME card in a real document', () => {
    const { card, html, title } = build([hold()]);
    expect(html).toContain('<body>\n' + card + '\n</body>');
    expect(html).toContain(`<title>${escapeHtml(title)}</title>`);
    expect(title).toBe('Hold Report — Unit 5422852');
  });

  it('names the image after the plate', () => {
    expect(build([hold()]).fileName).toBe('hold-report-LUR300.png');
  });

  // ⚠️ The card is now rendered inside FG's own document to be photographed, so typed text is text.
  it('⚠️ escapes what was typed into a hold', () => {
    const { card } = build([hold({ damageDescription: '<img src=x onerror=alert(1)>', notes: 'a "b" & <c>' })]);
    expect(card).not.toContain('<img src=x');
    expect(card).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(card).toContain('a &quot;b&quot; &amp; &lt;c&gt;');
  });
});
