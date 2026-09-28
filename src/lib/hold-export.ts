import type { Hold, Vehicle } from '../types';
import { vehicleLabel } from './vehicleName';
import { holdTypeLabel } from './holdTypeLabels';

const HOLD_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#fee2e2', color: '#dc2626' },
  RELEASED: { bg: '#fef9c3', color: '#ca8a04' },
  RETURNED: { bg: '#dbeafe', color: '#2563eb' },
  REPAIRED: { bg: '#dcfce7', color: '#16a34a' },
  VOIDED:   { bg: '#f3f4f6', color: '#6b7280' },
};

const VEHICLE_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  HELD:               { bg: '#fee2e2', color: '#dc2626', label: 'HELD' },
  OUT_ON_EXCEPTION:   { bg: '#fef9c3', color: '#ca8a04', label: 'OUT ON EXCEPTION' },
  PRE_EXISTING:       { bg: '#dbeafe', color: '#1d4ed8', label: 'PRE-EXISTING' },
  RETURNED:           { bg: '#f3f4f6', color: '#6b7280', label: 'RETURNED' },
  CLEAR:              { bg: '#dcfce7', color: '#16a34a', label: 'CLEAR' },
  SALE_CAR:           { bg: '#f3e8ff', color: '#7e22ce', label: 'SALE CAR' },
  AUCTION_SHORT_TERM: { bg: '#f3e8ff', color: '#7e22ce', label: 'AUCTION' },
};

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * ⚠️ The report is now also rendered INSIDE FG's own document (to rasterize it for sharing), not only
 * into a throwaway tab — so anything typed into a hold (a description, a note, a name) is escaped
 * rather than trusted as markup. A note reading `<b>` must print as `<b>`.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function holdTypePills(holdTypes: string[]): string {
  return holdTypes.map(t => {
    const label = escapeHtml(holdTypeLabel(t));
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;letter-spacing:.05em;margin-right:4px;">${label}</span>`;
  }).join('');
}

function holdStatusBadge(status: string): string {
  const s = HOLD_STATUS_STYLES[status] ?? HOLD_STATUS_STYLES.VOIDED;
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ');
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;background:${s.bg};color:${s.color};font-weight:700;font-size:12px;white-space:nowrap;">${label}</span>`;
}

function renderHoldCard(
  hold: Hold,
  isActive: boolean,
  getName: (id: string, snapshot?: string) => string,
  getEmpId: (id: string, snapshot?: string) => string,
): string {
  const photosHtml = (hold.photos ?? []).length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;">
        ${(hold.photos ?? []).map(src =>
          `<img src="${escapeHtml(src)}" alt="Damage photo" style="width:260px;height:180px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;display:block;" />`
        ).join('')}
       </div>`
    : '';

  const borderColor = isActive ? '#fca5a5' : '#e5e7eb';

  return `
    <div style="border:1.5px solid ${borderColor};border-radius:10px;padding:18px;margin-bottom:16px;background:#fff;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <div>
          <span style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(hold.damageDescription)}</span>
          <div style="margin-top:6px;">${holdTypePills(hold.holdTypes)}</div>
        </div>
        ${holdStatusBadge(hold.status)}
      </div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">
        Flagged by <strong style="color:#374151;">${escapeHtml(getName(hold.flaggedById, hold.flaggedByName))}</strong>
        · ${escapeHtml(getEmpId(hold.flaggedById, hold.flaggedByEmployeeId))}
        · ${fmtTs(hold.flaggedAt)}${hold.flaggedSource === 'effie' ? ' · via Effie' : ''}
      </div>
      ${hold.notes ? `<div style="font-size:13px;color:#6b7280;font-style:italic;margin-top:6px;">"${escapeHtml(hold.notes)}"</div>` : ''}
      ${photosHtml}
    </div>`;
}

export interface HoldReportParams {
  vehicle: Pick<Vehicle, 'unitNumber' | 'licensePlate' | 'make' | 'model' | 'year' | 'color' | 'status'>;
  holds: Hold[];
  getName: (id: string, snapshot?: string) => string;
  getEmpId: (id: string, snapshot?: string) => string;
}

export interface HoldReport {
  /** "Hold Report — Unit 5422852" — the tab title, and the share sheet's title. */
  title: string;
  /** The report card alone (no <html>/<body>), for rendering inside FG to make an image of it. */
  card: string;
  /** The whole standalone page, for the printable tab. */
  html: string;
  /** `hold-report-LUR300.png` — what the shared image is called on the other end. */
  fileName: string;
}

/**
 * The report, built once. ⭐ Two consumers share this exact markup so they can never drift: the
 * image that "↗ Share" now sends (Aaron, 2026-09-28: the old share mailed an empty about:blank
 * page — *"Is it supposed to be blank?"*), and the printable tab it falls back to.
 */
export function buildHoldReport({ vehicle, holds, getName, getEmpId }: HoldReportParams): HoldReport {
  const activeHolds  = holds.filter(h => h.status === 'ACTIVE');
  const historicHolds = holds.filter(h => h.status !== 'ACTIVE');
  const vs = VEHICLE_STATUS_STYLES[vehicle.status] ?? { bg: '#f3f4f6', color: '#6b7280', label: vehicle.status };
  const generatedAt = fmtTs(new Date().toISOString());
  const title = `Hold Report — Unit ${vehicle.unitNumber ?? 'Unknown'}`;

  const activeSection = activeHolds.length > 0 ? `
    <div style="margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">
        Active Holds (${activeHolds.length})
      </div>
      ${activeHolds.map(h => renderHoldCard(h, true, getName, getEmpId)).join('')}
    </div>` : '';

  const historySection = historicHolds.length > 0 ? `
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">
        Hold History (${historicHolds.length})
      </div>
      ${historicHolds.map(h => renderHoldCard(h, false, getName, getEmpId)).join('')}
    </div>` : '';

  const card = `  <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:2px solid #111827;margin-bottom:24px;">
      <img src="${window.location.origin}/FG.webp" alt="Fleet Garage" style="height:44px;width:auto;flex-shrink:0;" />
      <div>
        <div style="font-size:20px;font-weight:700;">Hold Report</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">Fleet Garage · ${generatedAt}</div>
      </div>
    </div>

    <!-- Vehicle Card -->
    <div style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:28px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
      <div>
        <div style="font-size:24px;font-weight:800;color:#111827;margin-bottom:4px;">
          Unit ${escapeHtml(vehicle.unitNumber ?? '—')}
        </div>
        <div style="font-size:14px;color:#6b7280;margin-bottom:2px;">
          ${escapeHtml(vehicleLabel(vehicle))} · ${escapeHtml(vehicle.color)}
        </div>
        <div style="font-size:14px;color:#9ca3af;">Plate: ${escapeHtml(vehicle.licensePlate)}</div>
      </div>
      <span style="display:inline-block;padding:6px 14px;border-radius:6px;background:${vs.bg};color:${vs.color};font-weight:700;font-size:13px;white-space:nowrap;">● ${escapeHtml(vs.label)}</span>
    </div>

    <!-- Holds -->
    ${activeSection}
    ${historySection}
    ${holds.length === 0
      ? '<p style="color:#9ca3af;font-size:14px;text-align:center;padding:32px 0;">No hold records on file.</p>'
      : ''}

    <!-- Footer -->
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:#9ca3af;">Generated by Fleet Garage</span>
      <span style="font-size:12px;color:#9ca3af;">${generatedAt}</span>
    </div>

  </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #f3f4f6; padding: 32px; max-width: 820px; margin: 0 auto; }
    @media print { body { background: #fff; padding: 0; } }
  </style>
</head>
<body>
${card}
</body>
</html>`;

  const plate = (vehicle.licensePlate || vehicle.unitNumber || 'vehicle').replace(/[^A-Za-z0-9-]/g, '');
  return { title, card, html, fileName: `hold-report-${plate}.png` };
}

/** Open the report as a printable page in a new tab — the fallback when an image can't be made. */
export function exportHoldToHtml(params: HoldReportParams): void {
  const { html } = buildHoldReport(params);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
