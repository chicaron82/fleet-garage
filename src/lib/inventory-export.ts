// Matches the Hertz "Location Daily Vehicle Inventory" form (8073-16)
// Columns: Owning · Unit # · License · Class · Status · Notes

interface ExportEntry {
  unitNumber: string;
  licensePlate: string;
  classification: string | null;
  holdType?: string;
  zone: string | null;
  row: string | null;
  locationText: string;
  rentalClass?: string;
  owningArea?: string;
}

interface ExportMeta {
  date: string;
  location: string;
  loggedByName: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Single-letter status matching what goes on the paper form
function statusLetter(entry: ExportEntry): string {
  if (entry.classification === 'Rentable') return 'A';
  if (entry.classification === 'Dirty')    return 'D';
  if (entry.classification === 'Held') {
    // Hail is body damage too — both print as 'B' on the paper form.
    return entry.holdType === 'damage' || entry.holdType === 'hail' ? 'B' : 'M';
  }
  return '';
}

// Pre-fill notes with lot location so the closer doesn't have to retype it
function defaultNotes(entry: ExportEntry): string {
  if (entry.classification === 'Held') {
    return entry.holdType === 'damage' ? 'Body damage — see hold'
      : entry.holdType === 'hail' ? 'Hail damage — see hold'
      : entry.holdType === 'mechanical' ? 'Mechanical — see hold'
      : 'Held';
  }
  if (entry.zone === 'Other') return entry.locationText || '';
  if (entry.row && entry.zone) return `${entry.row}, ${entry.zone}`;
  return '';
}

// Unit number formatted as printed on tag: 5426408 → 542 6408
function formatUnit(unit: string): string {
  const digits = unit.replace(/\D/g, '');
  if (digits.length === 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return unit;
}

export function generateInventoryExport(entries: ExportEntry[], meta: ExportMeta, logoUrl?: string): string {
  const rows = entries
    .map(e => `
      <tr>
        <td>${esc(e.owningArea ?? '')}</td>
        <td>${esc(formatUnit(e.unitNumber))}</td>
        <td>${esc(e.licensePlate)}</td>
        <td>${esc(e.rentalClass ?? '')}</td>
        <td class="status ${statusLetter(e).toLowerCase()}">${esc(statusLetter(e))}</td>
        <td><input type="text" class="note-input" value="${esc(defaultNotes(e))}" placeholder="Notes…" /></td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Fleet Inventory · ${esc(meta.date)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
  body { padding: 20px; font-size: 13px; color: #111; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
  .sign-row { display: flex; gap: 24px; margin-bottom: 16px; }
  .sign-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
  .sign-field label { font-weight: 600; color: #444; }
  .sign-field input { border: none; border-bottom: 1px solid #aaa; padding: 2px 4px; font-size: 13px; width: 180px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; border: 1px solid #ddd; }
  td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafafa; }
  td.status { text-align: center; font-weight: 700; font-size: 15px; }
  td.status.a { color: #16a34a; }
  td.status.d { color: #d97706; }
  td.status.b { color: #dc2626; }
  td.status.m { color: #ea580c; }
  .note-input { border: none; width: 100%; background: transparent; font-size: 12px; outline: none; }
  .note-input:focus { background: #fffde7; }
  @media print {
    .no-print { display: none !important; }
    input { border-bottom-color: transparent !important; }
    body { padding: 8px; }
  }
</style>
</head>
<body>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #111827;">
  ${logoUrl ? `<img src="${logoUrl}" alt="Fleet Garage" style="height:40px;width:auto;flex-shrink:0;" />` : ''}
  <div>
    <h1 style="margin:0;">Location Daily Vehicle Inventory</h1>
    <div class="meta" style="margin:0;">${esc(meta.location)} · ${esc(meta.date)} · Logged by: ${esc(meta.loggedByName)}</div>
  </div>
</div>

<div class="sign-row">
  <div class="sign-field">
    <label>PM Complete</label>
    <input type="text" placeholder="Name / time" />
  </div>
  <div class="sign-field">
    <label>AM Complete</label>
    <input type="text" placeholder="Name / time" />
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Owning</th>
      <th>Unit #</th>
      <th>License</th>
      <th>Class</th>
      <th>Status</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<div class="no-print" style="margin-top:16px;text-align:right">
  <button onclick="copyCSV()" style="padding:6px 14px;font-size:12px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff">
    Copy as CSV
  </button>
  <button onclick="window.print()" style="margin-left:8px;padding:6px 14px;font-size:12px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff">
    Print
  </button>
</div>

<script>
function copyCSV() {
  const rows = [['Owning','Unit #','License','Class','Status','Notes']];
  document.querySelectorAll('tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    rows.push(Array.from(cells).map(td => {
      const input = td.querySelector('input');
      return input ? input.value : td.textContent.trim();
    }));
  });
  const csv = rows.map(r => r.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\\n');
  navigator.clipboard.writeText(csv).then(() => alert('Copied!'));
}
</script>
</body>
</html>`;
}

export function inventoryExportFilename(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-CA');
  const time = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '-');
  return `fleet-inventory-${date}-${time}.html`;
}
