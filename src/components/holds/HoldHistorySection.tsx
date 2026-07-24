import { useRef } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { hapticHeavy } from '../../lib/haptics';
import type { RefObject, ChangeEvent } from 'react';
import { HoldRecordCard } from './HoldRecordCard';
import { groupHolds } from '../../lib/holdGrouping';
import type { Hold, Vehicle } from '../../types';

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
  vehicle: Pick<Vehicle, 'id' | 'unitNumber' | 'branchId' | 'coverPhotoUrl' | 'status'>;
  holds: Hold[];
  showHoldPicker: boolean;
  repairableHolds: Hold[];
  closeHoldPicker: () => void;
  toggleRepairPick: (holdId: string) => void;
  pickedForRepair: string[];
  confirmRepairSelection: () => void;
  showReleasePicker: boolean;
  activeHolds: Hold[];
  closeReleasePicker: () => void;
  pickHoldForRelease: (holdId: string) => void;
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
  closeHoldPicker, toggleRepairPick, pickedForRepair, confirmRepairSelection,
  showReleasePicker, activeHolds, closeReleasePicker, pickHoldForRelease,
  uploadingFor, addPhotoClick, handlePhotoSelected, openLightbox, setCoverPhoto,
  getName, getEmpId, getRole,
}: Props) {
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  useEscapeKey(closeHoldPicker);
  useEscapeKey(closeReleasePicker);

  // A finished hold stays on the record but must stop reading as active — the record-level twin of
  // unresolvedHoldTypes. Grouping key is "is this still acting on the car?", never "is it done?":
  // RETURNED means came-back-needs-re-eval, not repaired (see lib/holdGrouping).
  const { open: openHolds, closed: closedHolds } = groupHolds(holds, vehicle.status);

  const renderCard = (hold: Hold, muted: boolean) => (
    <HoldRecordCard
      key={hold.id}
      hold={hold}
      vehicle={vehicle}
      muted={muted}
      uploadingFor={uploadingFor}
      addPhotoClick={addPhotoClick}
      cameraInputRef={cameraInputRef}
      galleryInputRef={galleryInputRef}
      openLightbox={openLightbox}
      setCoverPhoto={setCoverPhoto}
      getName={getName}
      getEmpId={getEmpId}
      getRole={getRole}
      fmt={fmt}
      fmtDate={fmtDate}
    />
  );

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
                  Which hold(s) are you resolving?
                </p>
                <button
                  type="button"
                  onClick={closeHoldPicker}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[50vh] overflow-y-auto">
                {repairableHolds.map(hold => {
                  const checked = pickedForRepair.includes(hold.id);
                  return (
                    <button
                      key={hold.id}
                      type="button"
                      onClick={() => toggleRepairPick(hold.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer flex items-start gap-3"
                    >
                      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs font-bold leading-none ${
                        checked
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-gray-300 dark:border-gray-600 text-transparent'
                      }`}>
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                            {hold.damageDescription}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            hold.status === 'ACTIVE'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          }`}>
                            {hold.status === 'ACTIVE' ? 'ACTIVE' : 'RELEASED'}
                          </span>
                        </span>
                        <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {hold.holdTypes.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')} · {fmt(hold.flaggedAt)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={confirmRepairSelection}
                  disabled={pickedForRepair.length === 0}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
                >
                  {pickedForRepair.length === 0
                    ? 'Select hold(s) to resolve'
                    : `Mark ${pickedForRepair.length} as Done`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Release Picker — shown when multiple active holds need individual release */}
      {showReleasePicker && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={closeReleasePicker} />
          <div className="fixed inset-x-0 bottom-0 z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden max-w-sm mx-auto">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Which hold are you releasing?</p>
                <button type="button" onClick={closeReleasePicker} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none cursor-pointer">×</button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {activeHolds.map(hold => (
                  <button
                    key={hold.id}
                    type="button"
                    onClick={() => { hapticHeavy(); pickHoldForRelease(hold.id); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                  >
                    <p className="text-base font-medium text-gray-900 dark:text-gray-100">{hold.damageDescription}</p>
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

        {openHolds.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-2">
              Needs action · {openHolds.length}
            </p>
            <div className="space-y-3">{openHolds.map(hold => renderCard(hold, false))}</div>
          </div>
        )}

        {closedHolds.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
              No action needed · {closedHolds.length}
            </p>
            <div className="space-y-3">{closedHolds.map(hold => renderCard(hold, true))}</div>
          </div>
        )}
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
