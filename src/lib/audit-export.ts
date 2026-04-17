import type { AuditSection, AuditStatus } from '../types';

interface ExportData {
  auditorName: string;
  owningArea: string;
  vehicleNumber: string;
  plate: string;
  crew: { driverSide: string; passengerSide: string; sprayer: string };
  sections: AuditSection[];
  status: AuditStatus;
  date: string;
}

function resultBadge(result: string): string {
  if (result === 'pass') return `<span style="display:inline-block;padding:2px 10px;border-radius:4px;background:#dcfce7;color:#15803d;font-weight:700;font-size:11px;letter-spacing:.05em;">PASS</span>`;
  if (result === 'fail') return `<span style="display:inline-block;padding:2px 10px;border-radius:4px;background:#fee2e2;color:#dc2626;font-weight:700;font-size:11px;letter-spacing:.05em;">FAIL</span>`;
  return `<span style="color:#9ca3af;font-size:11px;">—</span>`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function exportAuditToHtml(data: ExportData): void {
  const statusColor = data.status === 'PASSED' ? '#15803d' : '#dc2626';
  const statusBg    = data.status === 'PASSED' ? '#dcfce7' : '#fee2e2';
  const statusLabel = data.status === 'PASSED' ? '✅ PASSED' : '❌ FAILED';

  const sectionsHtml = data.sections.map(section => {
    const itemsHtml = section.items.map(item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${item.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">${resultBadge(item.result)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
          ${item.photoUrl ? `<img src="${item.photoUrl}" style="max-width:120px;max-height:80px;border-radius:4px;object-fit:cover;" alt="Failure photo" />` : ''}
        </td>
      </tr>`).join('');

    const notesHtml = section.notes.trim()
      ? `<tr><td colspan="3" style="padding:8px 12px 12px;font-size:12px;color:#6b7280;font-style:italic;border-bottom:1px solid #e5e7eb;">Notes: ${section.notes}</td></tr>`
      : '';

    return `
      <tr>
        <td colspan="3" style="padding:10px 12px 6px;background:#f9fafb;font-size:11px;font-weight:700;letter-spacing:.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;">${section.label}</td>
      </tr>
      ${itemsHtml}${notesHtml}`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vehicle Audit — ${data.vehicleNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; padding: 32px; max-width: 760px; margin: 0 auto; }
    @media print { body { padding: 0; } }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111827;">
    <div style="width:36px;height:36px;background:#facc15;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">FG</div>
    <div>
      <div style="font-size:18px;font-weight:700;">Vehicle Audit Report</div>
      <div style="font-size:12px;color:#6b7280;">Fleet Garage · ${fmtDate(data.date)}</div>
    </div>
    <div style="margin-left:auto;padding:6px 16px;border-radius:6px;background:${statusBg};color:${statusColor};font-weight:700;font-size:14px;">${statusLabel}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
    <div style="background:#f9fafb;border-radius:8px;padding:16px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#6b7280;margin-bottom:8px;">VEHICLE</div>
      <div style="font-size:13px;margin-bottom:4px;"><strong>Owning Area:</strong> ${data.owningArea}</div>
      <div style="font-size:13px;margin-bottom:4px;"><strong>Unit #:</strong> ${data.vehicleNumber}</div>
      <div style="font-size:13px;"><strong>Plate:</strong> ${data.plate}</div>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#6b7280;margin-bottom:8px;">CREW</div>
      <div style="font-size:13px;margin-bottom:4px;"><strong>Auditor:</strong> ${data.auditorName}</div>
      <div style="font-size:13px;margin-bottom:4px;"><strong>Driver Side:</strong> ${data.crew.driverSide}</div>
      <div style="font-size:13px;margin-bottom:4px;"><strong>Passenger Side:</strong> ${data.crew.passengerSide}</div>
      <div style="font-size:13px;"><strong>Sprayer / Prep:</strong> ${data.crew.sprayer}</div>
    </div>
  </div>

  <table style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="background:#111827;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#f9fafb;letter-spacing:.08em;font-weight:700;">ITEM</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;color:#f9fafb;letter-spacing:.08em;font-weight:700;width:80px;">RESULT</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#f9fafb;letter-spacing:.08em;font-weight:700;width:140px;">PHOTO</th>
      </tr>
    </thead>
    <tbody>${sectionsHtml}</tbody>
  </table>

  <div style="margin-top:24px;padding:16px;border-radius:8px;background:${statusBg};border:1px solid ${statusColor}40;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-weight:700;color:${statusColor};font-size:15px;">Overall: ${statusLabel}</span>
    <span style="font-size:12px;color:#6b7280;">Audited by ${data.auditorName} · ${fmtDate(data.date)}</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
