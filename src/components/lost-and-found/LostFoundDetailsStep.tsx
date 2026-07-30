// Step 2 of the Log-Found-Item sheet — description, location, plate, notes, submit.
// Extracted from LogLostFoundItemModal (330-cap split); state lives in
// useLostFoundItemForm.
import { useRef } from 'react';
import { hapticLight } from '../../lib/haptics';
import { LOST_FOUND_LOCATION_LABELS } from '../../types';
import type { LostFoundLocation, User } from '../../types';
import { PlateInput } from '../shared/VehicleFields';
import { PhotoSlot } from '../shared/PhotoSlot';
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
  // Refs live here, not on the form object (react-hooks/refs). handleSourcePill returns true for
  // the free-text pill so we focus the notes field it just armed.
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const itemCamRef = useRef<HTMLInputElement>(null);
  const itemGalleryRef = useRef<HTMLInputElement>(null);
  // Inline key-tag scan on the plate field — the same scan-to-fill Step 1 does, surfaced here so
  // filling the plate from the tag doesn't require detouring back to the photo step.
  const keyTagCamRef = useRef<HTMLInputElement>(null);
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

      {/* Item photo — capturable HERE so a scan-routed log (which lands straight on this step) can
          add the found-item image without going back to Step 1. The Step-1 key-tag photo, if taken,
          previews alongside. */}
      <div className="flex items-start gap-3">
        {form.keyTagPhoto && (
          <div className="shrink-0">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wide">Key tag</p>
            <img
              src={form.keyTagPhoto}
              alt="Key tag"
              className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
            />
          </div>
        )}
        <PhotoSlot
          label="Item photo"
          photo={form.itemPhoto}
          onCapture={form.handlePhotoCapture(form.setItemPhoto)}
          onGallery={form.handlePhotoCapture(form.setItemPhoto)}
          onClear={() => form.setItemPhoto(null)}
          cameraRef={itemCamRef}
          galleryRef={itemGalleryRef}
        />
      </div>

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
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            License plate
          </label>
          {/* Scan-to-fill from the key tag without leaving this step — mirrors Step 1's key-tag
              PhotoSlot: capture the tag → set the preview → read it → fill the plate (+ ScanBranch
              register/backfill offer renders below). */}
          <button
            type="button"
            disabled={form.keytag.reading}
            onClick={() => { hapticLight(); keyTagCamRef.current?.click(); }}
            className="flex items-center gap-1 text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
          >
            📷 {form.keytag.reading ? 'Reading…' : 'Scan tag'}
          </button>
        </div>
        <input
          ref={keyTagCamRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={form.handlePhotoCapture(form.setKeyTagPhoto, (p) => void form.keytag.scanPhoto(p, form.setLicensePlate))}
        />
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
