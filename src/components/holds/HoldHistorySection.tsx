import { useRef } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import type { RefObject, ChangeEvent } from 'react';
import { holdTypePillClass, getTireSwapSeason } from '../../lib/holdBadge';
import { StatusBadge } from './StatusBadge';
import { HoldRecordFooter } from './HoldRecordFooter';
import type { Hold, Vehicle } from '../../types';

const MAX_PHOTOS = 4;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

interface Props {
  vehicle: Pick<Vehicle, 'id' | 'unitNumber' | 'branchId' | 'coverPhotoUrl'>;
  holds: Hold[];
  showHoldPicker: boolean;
  repairableHolds: Hold[];
  closeHoldPicker: () => void;
  pickHoldForRepair: (holdId: string) => void;
  uploadingFor: string | null;
  addPhotoClick: (holdId: string, ref: RefObject<HTMLInputElement | null>) => void;
  handlePhotoSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  openLightbox: (photos: string[], index: number) => void;
  setCoverPhoto: (vehicleId: string, url: string | null) => Promise<void>;
  getName: (id: string, snapshot?: string) => string;
  getEmpId: (id: string, snapshot?: string) => string;
  getRole: (id: string) => string;
}

export function HoldHistorySection({
  vehicle, holds, showHoldPicker, repairableHolds,
  closeHoldPicker, pickHoldForRepair,
  uploadingFor, addPhotoClick, handlePhotoSelected, openLightbox, setCoverPhoto,
  getName, getEmpId, getRole,
}: Props) {
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  useEscapeKey(closeHoldPicker);

  return (
    <>
      {/* Hold Picker — shown when multiple holds are repairable */}
      {showHoldPicker && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={closeHoldPicker} />
          <div className="fixed inset-x-0 bottom-0 z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden max-w-sm mx-auto">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Which hold are you resolving?
                </p>
                <button
                  type="button"
                  onClick={closeHoldPicker}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {repairableHolds.map(hold => (
                  <button
                    key={hold.id}
                    type="button"
                    onClick={() => pickHoldForRepair(hold.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                        {hold.damageDescription}
                      </p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        hold.status === 'ACTIVE'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {hold.status === 'ACTIVE' ? 'ACTIVE' : 'RELEASED'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {hold.holdTypes.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')} · {fmt(hold.flaggedAt)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Damage History */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
          Hold History · {holds.length} record{holds.length !== 1 ? 's' : ''}
        </h2>

        {holds.length === 0 && (
          <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No damage records on file. Clean history.</p>
          </div>
        )}

        <div className="space-y-3">
          {holds.map(hold => (
            <div key={hold.id} className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              {/* Hold Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <p className="text-base font-medium text-gray-900 dark:text-gray-100">{hold.damageDescription}</p>
                    {(hold.holdTypes.length > 1 || hold.holdTypes[0] !== 'damage') && hold.holdTypes.map(type => (
                      <span key={type} className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${holdTypePillClass(type)}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    ))}
                    {hold.mechanicalSubType === 'tire-swap' && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {getTireSwapSeason()} Tire Swap
                      </span>
                    )}
                    {hold.mechanicalSubType === 'tire-repair' && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        🛞 Tire Repair
                      </span>
                    )}
                    {hold.mechanicalSubType === 'pm-due' && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        ⚙️ PM Due
                      </span>
                    )}
                    {hold.branchId !== vehicle.branchId && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        🛫 Flagged at {hold.branchId}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={hold.status} holdTypes={hold.holdTypes} mechanicalSubType={hold.mechanicalSubType} />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{vehicle.unitNumber}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Flagged by <span className="font-medium text-gray-700 dark:text-gray-300">{getName(hold.flaggedById, hold.flaggedByName)}</span>
                  {' '}· {getEmpId(hold.flaggedById, hold.flaggedByEmployeeId)} · {fmt(hold.flaggedAt)}
                </p>
                {hold.notes && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 italic">"{hold.notes}"</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                  {(hold.photos ?? []).map((src, i) => {
                    const isCover = vehicle.coverPhotoUrl === src;
                    return (
                      <div key={i} className="relative">
                        <button
                          type="button"
                          onClick={() => openLightbox(hold.photos ?? [], i)}
                          className="cursor-pointer block"
                        >
                          <img
                            src={src}
                            alt={`Damage photo ${i + 1}`}
                            className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-800 hover:opacity-80 transition"
                          />
                        </button>
                        <button
                          type="button"
                          title={isCover ? 'Remove card photo' : 'Set as card photo'}
                          onClick={() => setCoverPhoto(vehicle.id, isCover ? null : src)}
                          className={`absolute bottom-0.5 right-0.5 w-5 h-5 rounded text-[10px] flex items-center justify-center transition cursor-pointer ${
                            isCover
                              ? 'bg-yellow-400 text-black'
                              : 'bg-black/50 text-white hover:bg-black/70'
                          }`}
                        >
                          📌
                        </button>
                      </div>
                    );
                  })}
                  {(hold.photos ?? []).length < MAX_PHOTOS && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => addPhotoClick(hold.id, cameraInputRef)}
                        disabled={uploadingFor === hold.id}
                        className="h-14 px-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingFor === hold.id ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <>
                            <span className="text-lg leading-none">📷</span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold leading-none">Camera</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => addPhotoClick(hold.id, galleryInputRef)}
                        disabled={uploadingFor === hold.id}
                        className="h-14 px-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingFor === hold.id ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <>
                            <span className="text-lg leading-none">🖼️</span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold leading-none">Gallery</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <HoldRecordFooter
                hold={hold}
                getName={getName}
                getRole={getRole}
                getEmpId={getEmpId}
                fmt={fmt}
                fmtDate={fmtDate}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Hidden photo inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handlePhotoSelected}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelected}
        className="hidden"
      />
    </>
  );
}
