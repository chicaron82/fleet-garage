import { useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import type { useNewHold } from '../../hooks/useNewHold';
import { hapticLight } from '../../lib/haptics';
import { DETAIL_REASON_LABELS } from '../../types';
import type { DetailReason } from '../../types';
import { DamagePresetsSelector } from './DamagePresetsSelector';
import { MechanicalConcernSelector } from './MechanicalConcernSelector';

interface Props {
  h: ReturnType<typeof useNewHold>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  galleryInputRef: RefObject<HTMLInputElement | null>;
}

/** The "What are you flagging?" card — hold-type toggles, type-specific inputs,
 *  notes and photos. Rendered once a vehicle is selected and not already held. */
export function NewHoldDetailsSection({ h, cameraInputRef, galleryInputRef }: Props) {
  // Scroll a newly-revealed category sub-section into view so a second-category
  // tap doesn't look like it did nothing. (useRef values are stable — no dep needed.)
  const hailRef       = useRef<HTMLDivElement>(null);
  const damageRef     = useRef<HTMLDivElement>(null);
  const detailRef     = useRef<HTMLDivElement>(null);
  const mechanicalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ref: RefObject<HTMLDivElement | null> | null =
      h.lastRevealedType === 'hail'       ? hailRef :
      h.lastRevealedType === 'damage'     ? damageRef :
      h.lastRevealedType === 'detail'     ? detailRef :
      h.lastRevealedType === 'mechanical' ? mechanicalRef : null;
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [h.lastRevealedType]);

  return (
    <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
        What are you flagging?
      </h2>

      {/* Hold Type Toggle — multi-select (sale_car is mutually exclusive) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { hapticLight(); h.toggleHoldType('damage'); }}
          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
            h.holdTypes.includes('damage')
              ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-gray-100'
              : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          }`}
        >
          <span className="block font-semibold">Damage</span>
          <span className="block text-xs opacity-70 mt-0.5">Dents, scratches…</span>
        </button>
        <button
          type="button"
          onClick={() => { hapticLight(); h.toggleHoldType('detail'); }}
          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
            h.holdTypes.includes('detail')
              ? 'border-teal-300 bg-teal-50 dark:bg-teal-900/20 text-gray-900 dark:text-gray-100'
              : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          }`}
        >
          <span className="block font-semibold">Detail</span>
          <span className="block text-xs opacity-70 mt-0.5">Pet hair, smoke…</span>
        </button>
        <button
          type="button"
          onClick={() => { hapticLight(); h.toggleHoldType('mechanical'); }}
          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
            h.holdTypes.includes('mechanical')
              ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 text-gray-900 dark:text-gray-100'
              : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          }`}
        >
          <span className="block font-semibold">Mechanical</span>
          <span className="block text-xs opacity-70 mt-0.5">PM, tires, repairs…</span>
        </button>
        <button
          type="button"
          onClick={() => { hapticLight(); h.toggleHoldType('sale_car'); }}
          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
            h.holdTypes.includes('sale_car')
              ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/20 text-gray-900 dark:text-gray-100'
              : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          }`}
        >
          <span className="block font-semibold">🏷️ Sale Car</span>
          <span className="block text-xs opacity-70 mt-0.5">Auction — don't clean</span>
        </button>
        <button
          type="button"
          onClick={() => { hapticLight(); h.toggleHoldType('hail'); }}
          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
            h.holdTypes.includes('hail')
              ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 text-gray-900 dark:text-gray-100'
              : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          }`}
        >
          <span className="block font-semibold">⛈️ Hail</span>
          <span className="block text-xs opacity-70 mt-0.5">Storm batch — assess</span>
        </button>
      </div>

      {/* Sale Car info */}
      {h.isSaleCarOnly && (
        <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 px-4 py-3 text-xs text-purple-800 dark:text-purple-300">
          No photos required — this is a disposition flag, not a damage record. Add an auction date or reference in notes if known.
        </div>
      )}

      {/* Hail info */}
      {h.holdTypes.includes('hail') && (
        <div ref={hailRef} className="scroll-mt-24 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 px-4 py-3 text-xs text-indigo-800 dark:text-indigo-300">
          Storm batch — photograph the hail damage for assessment. Held pending management's call; the whole batch can be released short-term if rentals get tight.
        </div>
      )}

      {/* Damage Type */}
      {h.holdTypes.includes('damage') && (
        <div ref={damageRef} className="scroll-mt-24">
          <DamagePresetsSelector
            damageTypes={h.damageTypes}
            toggleDamageType={h.toggleDamageType}
            customDamage={h.customDamage}
            setCustomDamage={h.setCustomDamage}
          />
        </div>
      )}

      {/* Detail Reason */}
      {h.holdTypes.includes('detail') && (
      <div ref={detailRef} className="scroll-mt-24">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Detail Reason *
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.entries(DETAIL_REASON_LABELS) as [DetailReason, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { hapticLight(); h.setDetailReason(key); }}
              className={`text-left px-3 py-2.5 rounded-lg border text-sm transition cursor-pointer ${
                h.detailReason === key
                  ? 'border-yellow-400 bg-yellow-50 text-gray-900 dark:text-gray-100 font-medium'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Mechanical Type */}
      {h.holdTypes.includes('mechanical') && (
        <div ref={mechanicalRef} className="scroll-mt-24">
          <MechanicalConcernSelector
            mechanicalTypes={h.mechanicalTypes}
            toggleMechanicalType={h.toggleMechanicalType}
            customMechanical={h.customMechanical}
            setCustomMechanical={h.setCustomMechanical}
          />
        </div>
      )}

      {/* Safety / Recall bypass */}
      {h.holdTypes.includes('mechanical') && h.mechanicalSubType === 'safety-recall' && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={h.safetyRecallBypassChecked}
            onChange={e => { hapticLight(); h.setSafetyRecallBypassChecked(e.target.checked); }}
            className="w-4 h-4 rounded accent-yellow-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Safety concern or recall notice — no visible defect to photograph
          </span>
        </label>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Notes (optional)
        </label>
        <textarea
          rows={3}
          placeholder="Location, customer context, circumstances…"
          value={h.notes}
          onChange={e => h.setNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
        />
      </div>

      {/* Photos — hidden for sale_car (no damage to document) */}
      {!h.isSaleCarOnly && <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Photos {(h.holdTypes.includes('damage') || h.holdTypes.includes('hail')) ? <span className="text-red-500">*</span> : <span className="normal-case font-normal text-gray-400 dark:text-gray-500">(optional)</span>} · max {h.MAX_PHOTOS}
        </label>
        {(h.holdTypes.includes('damage') || h.holdTypes.includes('hail')) && h.photos.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
            At least one photo is required for damage and hail holds.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {h.photos.map((src, i) => {
            const isPinned = h.pinnedPhotoIndex === i;
            return (
              <div key={i} className={`relative rounded-lg ${isPinned ? 'ring-2 ring-yellow-400' : ''}`}>
                <img
                  src={src}
                  alt={`Damage photo ${i + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-800"
                />
                <button
                  type="button"
                  onClick={() => h.removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer leading-none transition"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => h.togglePinPhoto(i)}
                  title={isPinned ? 'Card photo — tap to unpin' : 'Set as card photo'}
                  className={`absolute -bottom-1.5 -left-1.5 w-5 h-5 rounded-full text-[10px] flex items-center justify-center cursor-pointer leading-none transition ${isPinned ? 'bg-yellow-400 text-white shadow' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-400 hover:text-yellow-500'}`}
                >
                  📌
                </button>
              </div>
            );
          })}
          {h.photos.length < h.MAX_PHOTOS && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
              >
                <span className="text-lg leading-none">📷</span>
                <span className="text-xs font-medium">Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
              >
                <span className="text-lg leading-none">🖼️</span>
                <span className="text-xs font-medium">Upload from Gallery</span>
              </button>
            </div>
          )}
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={h.handlePhotoAdd}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={h.handlePhotoAdd}
          className="hidden"
        />
      </div>}

      {/* Flagging as */}
      <div className="bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        Flagging as <span className="font-medium text-gray-700 dark:text-gray-300">{h.user.name}</span> · {h.user.role}
      </div>
    </div>
  );
}
