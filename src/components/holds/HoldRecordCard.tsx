// One hold record in the vehicle's Hold History — header (description, type pills, status,
// provenance, notes), the damage-photo strip (view / pin-cover / add), and the resolution
// footer. Extracted verbatim from HoldHistorySection (which was at the 330 cap) so the edit
// controls (delete / void / remove-photo, docs/ticket-holds-history-edit.md) have a home.
import type { RefObject } from 'react';
import { holdTypePillClass, getTireSwapSeason, unresolvedHoldTypes } from '../../lib/holdBadge';
import { StatusBadge } from './StatusBadge';
import { HoldRecordFooter } from './HoldRecordFooter';
import type { Hold, Vehicle } from '../../types';

const MAX_PHOTOS = 4;

interface Props {
  hold: Hold;
  vehicle: Pick<Vehicle, 'id' | 'unitNumber' | 'branchId' | 'coverPhotoUrl'>;
  uploadingFor: string | null;
  addPhotoClick: (holdId: string, ref: RefObject<HTMLInputElement | null>) => void;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  galleryInputRef: RefObject<HTMLInputElement | null>;
  openLightbox: (photos: string[], index: number) => void;
  setCoverPhoto: (vehicleId: string, url: string | null) => Promise<void>;
  getName: (id: string, snapshot?: string) => string;
  getEmpId: (id: string, snapshot?: string) => string;
  getRole: (id: string) => string;
  fmt: (iso: string) => string;
  fmtDate: (iso: string) => string;
}

export function HoldRecordCard({
  hold, vehicle, uploadingFor, addPhotoClick, cameraInputRef, galleryInputRef,
  openLightbox, setCoverPhoto, getName, getEmpId, getRole, fmt, fmtDate,
}: Props) {
  // Only the still-OPEN types drive the badge + pills — a resolved type stays in
  // holdTypes (the record) but shouldn't read as active.
  const unresolvedTypes = unresolvedHoldTypes(hold);
  const mechanicalOpen = unresolvedTypes.includes('mechanical');

  return (
    <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Hold Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <p className="text-base font-medium text-gray-900 dark:text-gray-100">{hold.damageDescription}</p>
            {(unresolvedTypes.length > 1 || unresolvedTypes[0] !== 'damage') && unresolvedTypes.map(type => (
              <span key={type} className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${holdTypePillClass(type)}`}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            ))}
            {mechanicalOpen && hold.mechanicalSubType === 'tire-swap' && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {getTireSwapSeason()} Tire Swap
              </span>
            )}
            {mechanicalOpen && hold.mechanicalSubType === 'tire-repair' && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                🛞 Tire Repair
              </span>
            )}
            {mechanicalOpen && hold.mechanicalSubType === 'pm-due' && (
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
          <StatusBadge status={hold.status} holdTypes={unresolvedTypes} mechanicalSubType={hold.mechanicalSubType} />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{vehicle.unitNumber}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Flagged by <span className="font-medium text-gray-700 dark:text-gray-300">{getName(hold.flaggedById, hold.flaggedByName)}</span>
          {' '}· {getEmpId(hold.flaggedById, hold.flaggedByEmployeeId)} · {fmt(hold.flaggedAt)}
          {hold.flaggedSource === 'effie' ? ' · via Effie' : ''}
        </p>
        {hold.notes && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 italic">"{hold.notes}"</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          {(hold.photos ?? []).map((src, i) => {
            const isCover = vehicle.coverPhotoUrl === src;
            return (
              <div key={i} className="relative">
                <button type="button" onClick={() => openLightbox(hold.photos ?? [], i)} className="cursor-pointer block">
                  <img src={src} alt={`Damage photo ${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-800 hover:opacity-80 transition" />
                </button>
                <button
                  type="button"
                  title={isCover ? 'Remove card photo' : 'Set as card photo'}
                  onClick={() => setCoverPhoto(vehicle.id, isCover ? null : src)}
                  className={`absolute bottom-0.5 right-0.5 w-5 h-5 rounded text-[10px] flex items-center justify-center transition cursor-pointer ${
                    isCover ? 'bg-fg-yellow text-black' : 'bg-black/50 text-white hover:bg-black/70'
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
                className="h-14 px-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-fg-yellow hover:text-yellow-500 transition cursor-pointer gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFor === hold.id ? <span className="text-xs">…</span> : (
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
                className="h-14 px-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-fg-yellow hover:text-yellow-500 transition cursor-pointer gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFor === hold.id ? <span className="text-xs">…</span> : (
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

      <HoldRecordFooter hold={hold} getName={getName} getRole={getRole} getEmpId={getEmpId} fmt={fmt} fmtDate={fmtDate} />
    </div>
  );
}
