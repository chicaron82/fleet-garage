import type { Hold, Vehicle } from '../types';

const HOLD_TYPE_LABELS: Record<string, string> = {
  damage:              'Damage',
  hail:                'Hail',
  detail:              'Detail',
  mechanical:          'Mechanical',
  sale_car:            'Sale Car',
  missing_accessories: 'Missing Accessories',
};

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

function holdTypePills(holdTypes: string[]): string {
  return holdTypes.map(t => {
    const label = HOLD_TYPE_LABELS[t] ?? (t.charAt(0).toUpperCase() + t.slice(1));
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
          `<img src="${src}" alt="Damage photo" style="width:260px;height:180px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;display:block;" />`
        ).join('')}
       </div>`
    : '';

  const borderColor = isActive ? '#fca5a5' : '#e5e7eb';

  return `
    <div style="border:1.5px solid ${borderColor};border-radius:10px;padding:18px;margin-bottom:16px;background:#fff;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <div>
          <span style="font-size:16px;font-weight:700;color:#111827;">${hold.damageDescription}</span>
          <div style="margin-top:6px;">${holdTypePills(hold.holdTypes)}</div>
        </div>
        ${holdStatusBadge(hold.status)}
      </div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">
        Flagged by <strong style="color:#374151;">${getName(hold.flaggedById, hold.flaggedByName)}</strong>
        · ${getEmpId(hold.flaggedById, hold.flaggedByEmployeeId)}
        · ${fmtTs(hold.flaggedAt)}
      </div>
      ${hold.notes ? `<div style="font-size:13px;color:#6b7280;font-style:italic;margin-top:6px;">"${hold.notes}"</div>` : ''}
      ${photosHtml}
    </div>`;
}

export function exportHoldToHtml(params: {
  vehicle: Pick<Vehicle, 'unitNumber' | 'licensePlate' | 'make' | 'model' | 'year' | 'color' | 'status'>;
  holds: Hold[];
  getName: (id: string, snapshot?: string) => string;
  getEmpId: (id: string, snapshot?: string) => string;
}): void {
  const { vehicle, holds, getName, getEmpId } = params;

  const activeHolds  = holds.filter(h => h.status === 'ACTIVE');
  const historicHolds = holds.filter(h => h.status !== 'ACTIVE');
  const vs = VEHICLE_STATUS_STYLES[vehicle.status] ?? { bg: '#f3f4f6', color: '#6b7280', label: vehicle.status };
  const generatedAt = fmtTs(new Date().toISOString());

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hold Report — Unit ${vehicle.unitNumber ?? 'Unknown'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #f3f4f6; padding: 32px; max-width: 820px; margin: 0 auto; }
    @media print { body { background: #fff; padding: 0; } }
  </style>
</head>
<body>
  <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08);">

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
          Unit ${vehicle.unitNumber ?? '—'}
        </div>
        <div style="font-size:14px;color:#6b7280;margin-bottom:2px;">
          ${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.color}
        </div>
        <div style="font-size:14px;color:#9ca3af;">Plate: ${vehicle.licensePlate}</div>
      </div>
      <span style="display:inline-block;padding:6px 14px;border-radius:6px;background:${vs.bg};color:${vs.color};font-weight:700;font-size:13px;white-space:nowrap;">● ${vs.label}</span>
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

  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
