import { useState } from 'react';
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
  const { getVehicle, getHoldsForVehicle, getActiveHold } = useGarage();
  const [showReleaseForm, setShowReleaseForm] = useState<string | null>(null); // holdId
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const vehicle = getVehicle(vehicleId);
  const holds = getHoldsForVehicle(vehicleId);
  const activeHold = getActiveHold(vehicleId);

  const getName = (userId: string) => USERS.find(u => u.id === userId)?.name ?? 'Unknown';
  const getRole = (userId: string) => USERS.find(u => u.id === userId)?.role ?? '';
  const getEmpId = (userId: string) => USERS.find(u => u.id === userId)?.employeeId ?? '';

  if (!vehicle) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-900 transition cursor-pointer text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 text-sm">{vehicle.unitNumber}</span>
        <StatusBadge status={vehicle.status} />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Vehicle Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{vehicle.unitNumber}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
              <p className="text-sm text-gray-400 mt-0.5">Plate: {vehicle.licensePlate}</p>
            </div>
            <StatusBadge status={vehicle.status} />
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {(vehicle.status === 'RETURNED' || vehicle.status === 'PRE_EXISTING') && (
              <button
                onClick={() => onNewHold(vehicleId)}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                + Flag Damage
              </button>
            )}
            {activeHold && canRelease(user!.role) && (
              <button
                onClick={() => setShowReleaseForm(activeHold.id)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                Approve Release
              </button>
            )}
            {activeHold && !canRelease(user!.role) && (
              <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
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

        {/* Damage History */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Damage History · {holds.length} record{holds.length !== 1 ? 's' : ''}
          </h2>

          {holds.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <p className="text-gray-400 text-sm">No damage records on file. Clean history.</p>
            </div>
          )}

          <div className="space-y-3">
            {holds.map(hold => (
              <div key={hold.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Hold Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-medium text-gray-900">{hold.damageDescription}</p>
                    <StatusBadge status={hold.status} />
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{vehicle.unitNumber}</p>
                  <p className="text-xs text-gray-500">
                    Flagged by <span className="font-medium text-gray-700">{getName(hold.flaggedById)}</span>
                    {' '}· {getEmpId(hold.flaggedById)} ({getRole(hold.flaggedById)}) · {fmt(hold.flaggedAt)}
                  </p>
                  {hold.notes && (
                    <p className="text-xs text-gray-400 mt-1.5 italic">"{hold.notes}"</p>
                  )}
                  {hold.photos && hold.photos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {hold.photos.map((src, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxSrc(src)}
                          className="cursor-pointer"
                        >
                          <img
                            src={src}
                            alt={`Damage photo ${i + 1}`}
                            className="w-14 h-14 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Release Record */}
                {hold.release && (() => {
                  const isPre = hold.release.releaseType === 'PRE_EXISTING';
                  return (
                    <div className={`p-4 border-t ${isPre ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isPre ? 'text-blue-800' : 'text-amber-800'}`}>
                        {isPre ? 'Pre-existing — Cleared for Rental' : 'Release Approval'}
                      </p>
                      <p className={`text-xs ${isPre ? 'text-blue-900' : 'text-amber-900'}`}>
                        Approved by <span className="font-semibold">{getName(hold.release.approvedById)}</span>
                        {' '}· {getEmpId(hold.release.approvedById)} ({getRole(hold.release.approvedById)}) · {fmt(hold.release.approvedAt)}
                      </p>
                      <p className={`text-xs mt-1 ${isPre ? 'text-blue-700' : 'text-amber-700'}`}>
                        Reason: {hold.release.reason}
                      </p>
                      {hold.release.expectedReturn && (
                        <p className={`text-xs mt-0.5 ${isPre ? 'text-blue-700' : 'text-amber-700'}`}>
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
              </div>
            ))}
          </div>
        </div>
      </div>

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
