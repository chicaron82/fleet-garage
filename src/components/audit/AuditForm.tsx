import { useRef } from 'react';
import { useAudit } from '../../hooks/useAudit';
import { exportAuditToHtml } from '../../lib/audit-export';
import { hapticMedium, hapticLight } from '../../lib/haptics';
import type { AuditStatus } from '../../types';
import { CrewRow } from './AuditCrewRow';
import { ChecklistSection } from './AuditFormSections';

interface Props {
  onBack: () => void;
}

export function AuditForm({ onBack }: Props) {
  const audit = useAudit();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportAuditToHtml({
      auditorName:   audit.auditorName,
      owningArea:    audit.owningArea,
      vehicleNumber: audit.vehicleNumber,
      plate:         audit.plate,
      crew:          audit.crewMembers,
      sections: audit.sections,
      status:   (audit.overallStatus === 'IN_PROGRESS' ? 'FAILED' : audit.overallStatus) as AuditStatus,
      date:     new Date().toISOString(),
    });
    hapticMedium();
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
          <InputField label="Owning Area" value={audit.owningArea} onChange={audit.setOwningArea} placeholder="e.g. 8199" />
          <InputField label="Vehicle Number" value={audit.vehicleNumber} onChange={audit.setVehicleNumber} placeholder="e.g. 5421234" />
          <InputField label="Plate" value={audit.plate} onChange={audit.setPlate} placeholder="e.g. GHK 294" />
        </div>
      </section>

      {/* Crew */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 transition-colors">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Crew Assignment</p>
        {audit.crewMembers.map((member, index) => (
          <CrewRow
            key={index}
            member={member}
            showRemove={audit.crewMembers.length > 1}
            onChange={patch => audit.updateCrewMember(index, patch)}
            onRemove={() => { hapticLight(); audit.removeCrewMember(index); }}
          />
        ))}
        <button
          type="button"
          onClick={() => { hapticLight(); audit.addCrewMember(); }}
          className="flex items-center gap-1.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 transition cursor-pointer"
        >
          + Add crew member
        </button>
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
          onPhoto={(itemId, source) => {
            audit.preparePhotoCapture(section.id, itemId);
            if (source === 'camera') cameraInputRef.current?.click();
            else galleryInputRef.current?.click();
          }}
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
        ref={cameraInputRef}
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
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
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
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
      />
    </div>
  );
}
