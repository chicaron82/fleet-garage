import type { AuditSection } from '../../types';

// Presentational checklist section for AuditForm. The crew-assignment row lives
// in AuditCrewRow.tsx (name-search). Logic lives in useAudit.

export function ChecklistSection({ section, onToggle, onResult, onPhoto, onNotes }: {
  section: AuditSection;
  onToggle: () => void;
  onResult: (itemId: string, result: 'pass' | 'fail') => void;
  onPhoto: (itemId: string, source: 'camera' | 'gallery') => void;
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
                <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onPhoto(item.id, 'camera')}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                    >
                      📷 {item.photoUrl ? 'Retake Photo' : 'Take Photo'}
                    </button>
                    <button
                      onClick={() => onPhoto(item.id, 'gallery')}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                    >
                      🖼️ {item.photoUrl ? 'Upload Gallery' : 'Upload from Gallery'}
                    </button>
                  </div>
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
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
