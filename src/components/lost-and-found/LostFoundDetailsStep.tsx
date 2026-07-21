// Step 2 of the Log-Found-Item sheet — description, location, plate, notes, submit.
// Extracted from LogLostFoundItemModal (330-cap split); state lives in
// useLostFoundItemForm.
import { useRef } from 'react';
import { hapticLight } from '../../lib/haptics';
import { LOST_FOUND_LOCATION_LABELS } from '../../types';
import type { LostFoundLocation, User } from '../../types';
import { PlateInput } from '../shared/VehicleFields';
import { ScanBranch } from '../holds/KeytagScan';
import { describeKnownPlate } from '../../lib/vehicleByPlate';
import { SOURCE_PILLS } from '../../lib/lostFoundSourcePills';
import type { LostFoundForm } from '../../hooks/useLostFoundItemForm';

const LOCATION_ORDER: LostFoundLocation[] = [
  'visor',
  'front_seat',
  'back_seat',
  'trunk',
  'under_seat',
  'other',
];

export function LostFoundDetailsStep({ form, user }: { form: LostFoundForm; user: User | null }) {
  // Ref lives here, not on the form object (react-hooks/refs). handleSourcePill returns true for
  // the free-text pill so we focus the notes field it just armed.
  const notesRef = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticLight();
          form.setStep(1);
        }}
        className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer transition"
      >
        ← Back to photos
      </button>

      {/* Photo preview row */}
      {(form.keyTagPhoto || form.itemPhoto) && (
        <div className="flex gap-2">
          {form.keyTagPhoto && (
            <img
              src={form.keyTagPhoto}
              alt="Key tag"
              className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
            />
          )}
          {form.itemPhoto && (
            <img
              src={form.itemPhoto}
              alt="Item"
              className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
            />
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Description
        </label>
        <textarea
          rows={2}
          placeholder="e.g. Black garage door opener, visor…"
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition resize-none"
        />
      </div>

      {/* Location pills */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Location found
        </label>
        <div className="flex flex-wrap gap-2">
          {LOCATION_ORDER.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => {
                hapticLight();
                form.setLocation((l) => (l === loc ? null : loc));
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                form.location === loc
                  ? 'bg-fg-yellow border-fg-yellow text-black'
                  : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {LOST_FOUND_LOCATION_LABELS[loc]}
            </button>
          ))}
        </div>
      </div>

      {/* License plate */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          License plate
        </label>
        <PlateInput
          placeholder="e.g. LUR 224"
          value={form.licensePlate}
          onValueChange={form.setLicensePlate}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
        />
        {/* The Step-1 key-tag photo already read the tag → plate filled above, branch here. */}
        {form.keytag.err && <p className="text-xs text-red-500 mt-2">{form.keytag.err}</p>}
        {form.keytag.scan && <div className="mt-2"><ScanBranch scan={form.keytag.scan} staged={form.keytag.staged} onRegister={form.keytag.register} onBackfill={form.keytag.backfill} /></div>}
        {form.licensePlate.trim().length >= 4 ? (
          form.plateMatch ? (
            <p className="text-xs text-teal-700 dark:text-teal-400 mt-1">
              ✓ Recognized{describeKnownPlate(form.plateMatch) ? ` — ${describeKnownPlate(form.plateMatch)}` : ' from a previous log'}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
              New plate — we'll remember it for next time.
            </p>
          )
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
            Auto-matches unit number from vehicles on file
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Notes
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {SOURCE_PILLS.map(({ label, text }) => (
            <button
              key={label}
              type="button"
              onClick={() => { if (form.handleSourcePill(label, text)) notesRef.current?.focus(); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                form.sourceTag === label
                  ? 'bg-fg-yellow border-fg-yellow text-black'
                  : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          ref={notesRef}
          rows={2}
          placeholder="Any additional context…"
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition resize-none"
        />
      </div>

      {/* Logging as */}
      {user && (
        <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
          Logging as: <span className="font-semibold">{user.name}</span> ·{' '}
          {user.role}
        </p>
      )}

      {form.submitError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3 transition-colors">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            Couldn't save — check connection and try again.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={form.submitting}
        onClick={form.handleSubmit}
        className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        {form.submitting ? 'Saving…' : 'Submit Found Item'}
      </button>
    </>
  );
}
