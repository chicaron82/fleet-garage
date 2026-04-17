import { useAudit } from '../hooks/useAudit';
import { exportAuditToHtml } from '../lib/audit-export';
import type { AuditSection, AuditStatus } from '../types';

interface Props {
  onBack: () => void;
}

export function AuditForm({ onBack }: Props) {
  const audit = useAudit();

  const handleExport = () => {
    exportAuditToHtml({
      auditorName:   audit.auditorName,
      owningArea:    audit.owningArea,
      vehicleNumber: audit.vehicleNumber,
      plate:         audit.plate,
      crew: {
        driverSide:    audit.resolveCrewName(audit.crew.driverSide),
        passengerSide: audit.resolveCrewName(audit.crew.passengerSide),
        sprayer:       audit.resolveCrewName(audit.crew.sprayer),
      },
      sections: audit.sections,
      status:   (audit.overallStatus === 'IN_PROGRESS' ? 'FAILED' : audit.overallStatus) as AuditStatus,
      date:     new Date().toISOString(),
    });
    audit.handleDispatch();
  };

  const statusColor = audit.overallStatus === 'PASSED'
    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300'
    : audit.overallStatus === 'FAILED'
      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Audit</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Auditor: {audit.auditorName}</p>
        </div>
      </div>

      {/* Vehicle fields */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 transition-colors">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Vehicle</p>
        <div className="grid grid-cols-1 gap-3">
          <InputField label="Owning Area" value={audit.owningArea} onChange={audit.setOwningArea} placeholder="e.g. Ready Line A" />
          <InputField label="Vehicle Number" value={audit.vehicleNumber} onChange={audit.setVehicleNumber} placeholder="e.g. HRZ-4821" />
          <InputField label="Plate" value={audit.plate} onChange={audit.setPlate} placeholder="e.g. GHK 294" />
        </div>
      </section>

      {/* Crew */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 transition-colors">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Crew Assignment</p>
        <CrewSelect label="Driver Side" value={audit.crew.driverSide} users={audit.vsaUsers}
          onChange={v => audit.setCrew({ ...audit.crew, driverSide: v })} />
        <CrewSelect label="Passenger Side" value={audit.crew.passengerSide} users={audit.vsaUsers}
          onChange={v => audit.setCrew({ ...audit.crew, passengerSide: v })} />
        <CrewSelect label="Sprayer / Prep" value={audit.crew.sprayer} users={audit.vsaUsers}
          onChange={v => audit.setCrew({ ...audit.crew, sprayer: v })} />
      </section>

      {/* Status banner */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between transition-colors ${statusColor}`}>
        <span className="text-sm font-semibold">
          {audit.overallStatus === 'PASSED' ? '✅ PASSED' : audit.overallStatus === 'FAILED' ? '❌ FAILED AUDIT' : '⏳ In Progress'}
        </span>
        {audit.failCount > 0 && (
          <span className="text-xs font-medium">{audit.failCount} item{audit.failCount !== 1 ? 's' : ''} failed</span>
        )}
      </div>

      {/* Checklist sections */}
      {audit.sections.map(section => (
        <ChecklistSection
          key={section.id}
          section={section}
          onToggle={() => audit.toggleSection(section.id)}
          onResult={(itemId, result) => audit.setResult(section.id, itemId, result)}
          onPhoto={(itemId) => audit.triggerPhotoCapture(section.id, itemId)}
          onNotes={(notes) => audit.setSectionNotes(section.id, notes)}
        />
      ))}

      {/* Export footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 transition-colors">
        <button
          disabled={!audit.isReadyToExport || audit.dispatchStatus === 'dispatching'}
          onClick={handleExport}
          className="w-full py-3.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-white dark:text-gray-900 font-semibold text-sm rounded-xl transition cursor-pointer"
        >
          {audit.dispatchStatus === 'dispatching' ? '⏳ Dispatching...' : '✉️ Export & Send Audit'}
        </button>
      </div>

      {/* Hidden file input for camera capture */}
      <input
        ref={audit.fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) audit.handleFileSelected(file);
          e.target.value = '';
        }}
      />

      {/* Glassmorphism toast */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '5rem',
          left: '50%',
          transform: `translateX(-50%) translateY(${audit.dispatchStatus === 'dispatched' ? '0' : '1rem'})`,
          opacity: audit.dispatchStatus === 'dispatched' ? 1 : 0,
          transition: 'opacity 250ms ease, transform 250ms ease',
          pointerEvents: 'none',
          zIndex: 50,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          background: 'rgba(17, 24, 39, 0.75)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.75rem',
          padding: '0.75rem 1.25rem',
          color: '#f9fafb',
          fontSize: '0.875rem',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        🟢 Audit HTML Exported to Management.
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InputField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
      />
    </div>
  );
}

function CrewSelect({ label, value, users, onChange }: {
  label: string; value: string; users: { id: string; name: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition cursor-pointer"
      >
        <option value="">Select VSA</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </div>
  );
}

function ChecklistSection({ section, onToggle, onResult, onPhoto, onNotes }: {
  section: AuditSection;
  onToggle: () => void;
  onResult: (itemId: string, result: 'pass' | 'fail') => void;
  onPhoto: (itemId: string) => void;
  onNotes: (notes: string) => void;
}) {
  const failCount = section.items.filter(i => i.result === 'fail').length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer"
      >
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">{section.label}</span>
        <div className="flex items-center gap-2">
          {failCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              {failCount} fail
            </span>
          )}
          <span className="text-gray-400 text-xs">{section.isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {section.isOpen && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {section.items.map(item => (
            <div key={item.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">{item.label}</span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onResult(item.id, 'pass')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      item.result === 'pass'
                        ? 'bg-green-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-500 hover:text-green-600'
                    }`}
                  >Pass</button>
                  <button
                    onClick={() => onResult(item.id, 'fail')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      item.result === 'fail'
                        ? 'bg-red-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-500 hover:text-red-600'
                    }`}
                  >Fail</button>
                </div>
              </div>
              {item.result === 'fail' && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <button
                    onClick={() => onPhoto(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                  >
                    📸 {item.photoUrl ? 'Retake Photo' : 'Capture Photo'}
                  </button>
                  {item.photoUrl && (
                    <img src={item.photoUrl} alt="Failure" className="h-10 w-14 object-cover rounded-lg border border-red-200 dark:border-red-800" />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Section notes */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <textarea
              rows={2}
              value={section.notes}
              onChange={e => onNotes(e.target.value)}
              placeholder={`Notes for ${section.label.toLowerCase()} (optional)`}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
