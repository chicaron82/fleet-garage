import { useState, useRef } from 'react';
import { hapticLight } from '../../lib/haptics';
import { compressImage } from '../../lib/image';
import { DAMAGE_PRESETS } from '../../lib/hold-presets';
import type { HoldType, User } from '../../types';

const MAX_PHOTOS = 4;

interface NewIssueReHoldFormProps {
  user: User;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (
    description: string,
    notes: string,
    photos: string[],
    holdTypes: HoldType[]
  ) => Promise<void>;
  getName: (id: string) => string;
  reHoldContext?: 'exception' | 'auction';
}

export function NewIssueReHoldForm({
  user,
  submitting,
  onCancel,
  onSubmit,
  getName,
  reHoldContext,
}: NewIssueReHoldFormProps) {
  const [newIssueHoldType, setNewIssueHoldType] = useState<HoldType>('damage');
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');
  const [reHoldNotes, setReHoldNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [detailOdourChecked, setDetailOdourChecked] = useState(false);
  const [mechanicalPMChecked, setMechanicalPMChecked] = useState(false);
  const [mechanicalSafetyRecallChecked, setMechanicalSafetyRecallChecked] = useState(false);
  const [noNewDamageChecked, setNoNewDamageChecked] = useState(false);
  const [saleCarReturnChecked, setSaleCarReturnChecked] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const toggleDamageType = (preset: string) => {
    setDamageTypes((prev) =>
      prev.includes(preset) ? prev.filter((d) => d !== preset) : [...prev, preset]
    );
  };

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);
    const compressed = await Promise.all(toAdd.map(compressImage));
    setPhotos((prev) => [...prev, ...compressed]);
    e.target.value = '';
  };

  const handleLocalSubmit = async () => {
    if (noNewDamageChecked) {
      const desc = reHoldNotes.trim()
        ? `No new damage — ${reHoldNotes.trim()}`
        : 'No new damage — returned to hold';
      await onSubmit(desc, '', photos, [newIssueHoldType]);
      return;
    }
    if (saleCarReturnChecked) {
      const desc = reHoldNotes.trim()
        ? `Sale car — ${reHoldNotes.trim()}`
        : 'Sale car — returned from short-term circulation';
      await onSubmit(desc, '', photos, [newIssueHoldType]);
      return;
    }

    let finalDescription: string;
    if (newIssueHoldType === 'damage') {
      finalDescription =
        damageTypes.includes('Other') && customDamage.trim()
          ? [
              ...damageTypes.filter((d) => d !== 'Other'),
              customDamage.trim(),
            ].join(', ')
          : damageTypes.join(', ');
    } else if (newIssueHoldType === 'detail' && detailOdourChecked) {
      finalDescription = newIssueDescription.trim()
        ? `Odour/smoke/vape — ${newIssueDescription.trim()}`
        : 'Odour/smoke/vape';
    } else if (newIssueHoldType === 'mechanical' && mechanicalPMChecked) {
      finalDescription = newIssueDescription.trim()
        ? `PM due — ${newIssueDescription.trim()}`
        : 'PM due';
    } else if (newIssueHoldType === 'mechanical' && mechanicalSafetyRecallChecked) {
      finalDescription = newIssueDescription.trim()
        ? `Safety / recall — ${newIssueDescription.trim()}`
        : 'Safety / recall — no visible defect';
    } else {
      finalDescription =
        newIssueDescription.trim() ||
        (newIssueHoldType === 'detail' ? 'Detail required' : 'Mechanical concern');
    }

    await onSubmit(finalDescription, reHoldNotes, photos, [newIssueHoldType]);
  };

  const photoBypassActive =
    (newIssueHoldType === 'detail' && detailOdourChecked) ||
    (newIssueHoldType === 'mechanical' && (mechanicalPMChecked || mechanicalSafetyRecallChecked)) ||
    noNewDamageChecked ||
    saleCarReturnChecked;

  const canSubmitReHold =
    (newIssueHoldType === 'damage' && !photoBypassActive ? damageTypes.length > 0 : true) &&
    (photos.length > 0 || photoBypassActive) &&
    !submitting;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
        New Issue
      </p>

      {/* Hold type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Hold Type *
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['damage', 'detail', 'mechanical'] as HoldType[]).map((ht) => (
            <button
              key={ht}
              type="button"
              onClick={() => {
                hapticLight();
                setNewIssueHoldType(ht);
                setDamageTypes([]);
                setDetailOdourChecked(false);
                setMechanicalPMChecked(false);
                setMechanicalSafetyRecallChecked(false);
              }}
              className={`py-2 rounded-lg border text-sm font-medium transition cursor-pointer capitalize ${
                newIssueHoldType === ht
                  ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              {ht === 'damage'
                ? '🔧 Damage'
                : ht === 'detail'
                ? '🧹 Detail'
                : '⚙️ Mechanical'}
            </button>
          ))}
        </div>
      </div>

      {/* Damage presets — only for damage holds */}
      {newIssueHoldType === 'damage' && (
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Damage Type *
            </label>
            {damageTypes.length > 0 && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                {damageTypes.length} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DAMAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => toggleDamageType(preset)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition cursor-pointer ${
                  damageTypes.includes(preset)
                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100 font-medium'
                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          {damageTypes.includes('Other') && (
            <input
              type="text"
              placeholder="Describe the damage…"
              value={customDamage}
              onChange={(e) => setCustomDamage(e.target.value)}
              className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
            />
          )}
        </div>
      )}

      {/* Description — for detail / mechanical */}
      {newIssueHoldType !== 'damage' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
              Description (optional)
            </label>
            <textarea
              rows={2}
              placeholder={
                newIssueHoldType === 'detail'
                  ? 'e.g. Full detail needed, pet hair in rear…'
                  : 'e.g. Vibration at highway speed, noise from engine…'
              }
              value={newIssueDescription}
              onChange={(e) => setNewIssueDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
            />
          </div>
          {newIssueHoldType === 'detail' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={detailOdourChecked}
                onChange={(e) => {
                  hapticLight();
                  setDetailOdourChecked(e.target.checked);
                }}
                className="w-4 h-4 rounded accent-yellow-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Odour / smoke / vape — photo not possible
              </span>
            </label>
          )}
          {newIssueHoldType === 'mechanical' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mechanicalPMChecked}
                onChange={(e) => {
                  hapticLight();
                  setMechanicalPMChecked(e.target.checked);
                  if (e.target.checked) setMechanicalSafetyRecallChecked(false);
                }}
                className="w-4 h-4 rounded accent-yellow-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                PM due — no visible defect to photograph
              </span>
            </label>
          )}
          {newIssueHoldType === 'mechanical' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mechanicalSafetyRecallChecked}
                onChange={(e) => {
                  hapticLight();
                  setMechanicalSafetyRecallChecked(e.target.checked);
                  if (e.target.checked) setMechanicalPMChecked(false);
                }}
                className="w-4 h-4 rounded accent-yellow-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Safety concern or recall notice — no visible defect to photograph
              </span>
            </label>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Notes (optional)
        </label>
        <textarea
          rows={2}
          placeholder="Additional context…"
          value={reHoldNotes}
          onChange={(e) => setReHoldNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
        />
      </div>

      {/* Context-based photo bypass */}
      {reHoldContext === 'exception' && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={noNewDamageChecked}
            onChange={(e) => {
              hapticLight();
              setNoNewDamageChecked(e.target.checked);
            }}
            className="w-4 h-4 rounded accent-yellow-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            No new damage found — returning to prior hold status
          </span>
        </label>
      )}
      {reHoldContext === 'auction' && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={saleCarReturnChecked}
            onChange={(e) => {
              hapticLight();
              setSaleCarReturnChecked(e.target.checked);
            }}
            className="w-4 h-4 rounded accent-yellow-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Sale car returning from short-term — no new damage to document
          </span>
        </label>
      )}

      {/* Photos */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          {photoBypassActive
            ? `Photos (optional · max ${MAX_PHOTOS})`
            : `Photos * (required · max ${MAX_PHOTOS})`}
        </label>
        <div className="flex flex-wrap gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative">
              <img
                src={src}
                alt={`New damage photo ${i + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer leading-none transition"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
              >
                <span className="text-lg leading-none">📷</span>
                <span className="text-xs font-medium">Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
              >
                <span className="text-lg leading-none">🖼</span>
                <span className="text-xs font-medium">Gallery</span>
              </button>
            </div>
          )}
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoAdd}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoAdd}
          className="hidden"
        />
        {photos.length === 0 && !photoBypassActive && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
            At least one photo required.
          </p>
        )}
      </div>

      {/* Entering as */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Flagging as: <span className="font-semibold">{getName(user.id)}</span> ·{' '}
        {user.role}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmitReHold}
          onClick={handleLocalSubmit}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : 'Confirm Re-hold'}
        </button>
      </div>
    </div>
  );
}
