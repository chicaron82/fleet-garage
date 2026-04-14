import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { canRelease } from '../types';
import { StatusBadge } from './StatusBadge';
import { ReleaseForm } from './ReleaseForm';
import { USERS } from '../data/mock';

interface Props {
  vehicleId: string;
  onBack: () => void;
  onNewHold: (vehicleId: string) => void;
}

const MAX_PHOTOS = 4;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

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

export function VehicleHistory({ vehicleId, onBack, onNewHold }: Props) {
  const { user } = useAuth();
  const { getVehicle, getHoldsForVehicle, getActiveHold, addPhotosToHold, markRepaired } = useGarage();
  const [showReleaseForm, setShowReleaseForm] = useState<string | null>(null); // holdId
  const [showRepairConfirm, setShowRepairConfirm] = useState<string | null>(null); // holdId
  const [repairNotes, setRepairNotes] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null); // holdId
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingHoldId = useRef<string | null>(null);

  const handleAddPhotoClick = (holdId: string) => {
    pendingHoldId.current = holdId;
    photoInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !pendingHoldId.current) return;
    const holdId = pendingHoldId.current;
    setUploadingFor(holdId);
    const compressed = await Promise.all(files.map(compressImage));
    await addPhotosToHold(holdId, compressed);
    setUploadingFor(null);
    e.target.value = '';
  };

  const vehicle = getVehicle(vehicleId);
  const holds = getHoldsForVehicle(vehicleId);
  const activeHold = getActiveHold(vehicleId);

  const getName = (userId: string) => USERS.find(u => u.id === userId)?.name ?? 'Unknown';
  const getRole = (userId: string) => USERS.find(u => u.id === userId)?.role ?? '';
  const getEmpId = (userId: string) => USERS.find(u => u.id === userId)?.employeeId ?? '';

  if (!vehicle) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Nav */}
      <nav className="bg-white dark:bg-gray-900 transition-colors border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition cursor-pointer text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{vehicle.unitNumber}</span>
        <StatusBadge status={vehicle.status} />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Vehicle Card */}
        <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{vehicle.unitNumber}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Plate: {vehicle.licensePlate}</p>
            </div>
            <StatusBadge status={vehicle.status} />
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {(vehicle.status === 'RETURNED' || vehicle.status === 'PRE_EXISTING' || vehicle.status === 'CLEAR') && (
              <button
                onClick={() => onNewHold(vehicleId)}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                + Flag Damage
              </button>
            )}
            {activeHold && canRelease(user!.role) && (
              <>
                <button
                  onClick={() => { setShowReleaseForm(activeHold.id); setShowRepairConfirm(null); }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  Approve Release
                </button>
                <button
                  onClick={() => { setShowRepairConfirm(activeHold.id); setShowReleaseForm(null); }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  ✓ Mark as Repaired
                </button>
              </>
            )}
            {activeHold && !canRelease(user!.role) && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 text-sm rounded-lg">
                Held — management approval required to release
              </div>
            )}
          </div>
        </div>

        {/* Release Form */}
        {showReleaseForm && (
          <ReleaseForm
            holdId={showReleaseForm}
            vehicleId={vehicleId}
            onClose={() => setShowReleaseForm(null)}
          />
        )}

        {/* Repair Confirm */}
        {showRepairConfirm && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/40 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-widest">
              Confirm Repair
            </h2>
            <p className="text-sm text-green-900 dark:text-green-200">
              This marks the damage as fully repaired. The vehicle will be set to <strong>Clear</strong> and returned to service.
            </p>
            <div>
              <label className="block text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                placeholder="Repair details, shop, completion date…"
                value={repairNotes}
                onChange={e => setRepairNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-green-300 dark:border-green-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowRepairConfirm(null); setRepairNotes(''); }}
                className="flex-1 py-2.5 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-medium text-sm rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={repairing}
                onClick={async () => {
                  setRepairing(true);
                  await markRepaired(showRepairConfirm, {
                    holdId: showRepairConfirm,
                    repairedById: user!.id,
                    repairedAt: new Date().toISOString(),
                    notes: repairNotes.trim(),
                  });
                  setShowRepairConfirm(null);
                  setRepairNotes('');
                  setRepairing(false);
                }}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
              >
                {repairing ? 'Saving…' : 'Confirm Repair'}
              </button>
            </div>
          </div>
        )}

        {/* Damage History */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
            Damage History · {holds.length} record{holds.length !== 1 ? 's' : ''}
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
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{hold.damageDescription}</p>
                    <StatusBadge status={hold.status} />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{vehicle.unitNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Flagged by <span className="font-medium text-gray-700 dark:text-gray-300">{getName(hold.flaggedById)}</span>
                    {' '}· {getEmpId(hold.flaggedById)} ({getRole(hold.flaggedById)}) · {fmt(hold.flaggedAt)}
                  </p>
                  {hold.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 italic">"{hold.notes}"</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                    {(hold.photos ?? []).map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightboxSrc(src)}
                        className="cursor-pointer"
                      >
                        <img
                          src={src}
                          alt={`Damage photo ${i + 1}`}
                          className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-800 hover:opacity-80 transition"
                        />
                      </button>
                    ))}
                    {(hold.photos ?? []).length < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => handleAddPhotoClick(hold.id)}
                        disabled={uploadingFor === hold.id}
                        className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingFor === hold.id ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <>
                            <span className="text-lg leading-none">+</span>
                            <span className="text-xs leading-none">Photo</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Release Record */}
                {hold.release && (() => {
                  const isPre = hold.release.releaseType === 'PRE_EXISTING';
                  return (
                    <div className={`p-4 border-t ${isPre ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 dark:bg-amber-900/30 border-amber-100'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isPre ? 'text-blue-800' : 'text-amber-800'}`}>
                        {isPre ? 'Pre-existing — Cleared for Rental' : 'Release Approval'}
                      </p>
                      <p className={`text-xs ${isPre ? 'text-blue-900' : 'text-amber-900'}`}>
                        Approved by <span className="font-semibold">{getName(hold.release.approvedById)}</span>
                        {' '}· {getEmpId(hold.release.approvedById)} ({getRole(hold.release.approvedById)}) · {fmt(hold.release.approvedAt)}
                      </p>
                      <p className={`text-xs mt-1 ${isPre ? 'text-blue-700' : 'text-amber-700 dark:text-amber-400'}`}>
                        Reason: {hold.release.reason}
                      </p>
                      {hold.release.expectedReturn && (
                        <p className={`text-xs mt-0.5 ${isPre ? 'text-blue-700' : 'text-amber-700 dark:text-amber-400'}`}>
                          Expected return: {fmtDate(hold.release.expectedReturn)}
                          {hold.release.actualReturn && (
                            <> · Returned: {fmtDate(hold.release.actualReturn)}</>
                          )}
                        </p>
                      )}
                      {isPre && !hold.release.expectedReturn && (
                        <p className="text-xs text-blue-600 mt-0.5">No repair planned — renting as-is</p>
                      )}
                      {hold.release.notes && (
                        <p className={`text-xs mt-1 italic ${isPre ? 'text-blue-600' : 'text-amber-600'}`}>
                          "{hold.release.notes}"
                        </p>
                      )}
                    </div>
                  );
                })()}
                {hold.repair && (
                  <div className="p-4 border-t bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-green-800 dark:text-green-300">
                      ✓ Damage Repaired
                    </p>
                    <p className="text-xs text-green-900 dark:text-green-200">
                      Confirmed by <span className="font-semibold">{getName(hold.repair.repairedById)}</span>
                      {' '}· {getEmpId(hold.repair.repairedById)} ({getRole(hold.repair.repairedById)}) · {fmt(hold.repair.repairedAt)}
                    </p>
                    {hold.repair.notes && (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1 italic">"{hold.repair.notes}"</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden photo input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelected}
        className="hidden"
      />

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="Damage photo"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl leading-none opacity-70 hover:opacity-100 transition cursor-pointer"
            onClick={() => setLightboxSrc(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
