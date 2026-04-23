import { useState, useRef } from 'react';
import { USERS } from '../data/mock';
import { DAMAGE_PRESETS } from '../lib/hold-presets';
import { compressImage } from '../lib/image';
import { HoldRecordFooter } from './HoldRecordFooter';
import { StatusBadge } from './StatusBadge';
import { PhotoLightbox } from './PhotoLightbox';
import type { Hold, User, Vehicle } from '../types';

const MAX_PHOTOS = 4;

function getName(userId: string) {
  return USERS.find(u => u.id === userId)?.name ?? userId;
}
function getRole(userId: string) {
  return USERS.find(u => u.id === userId)?.role ?? '—';
}
function getEmpId(userId: string) {
  return USERS.find(u => u.id === userId)?.employeeId ?? '—';
}
function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  vehicle: Vehicle;
  holds: Hold[];
  user: User;
  onReHold: (vehicleId: string, description: string, notes: string, photos: string[], linkedHoldId: string) => Promise<void>;
}

export function CheckInHoldPanel({ vehicle, holds, user, onReHold }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showReHoldForm, setShowReHoldForm] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Re-hold form state
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');
  const [reHoldNotes, setReHoldNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reHolded, setReHolded] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  if (holds.length === 0) return null;

  const sorted = [...holds].sort((a, b) =>
    new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()
  );
  const mostRecent = sorted[0];
  const olderHolds = sorted.slice(1);

  const canReHold = vehicle.status !== 'HELD' && !reHolded;

  const toggleDamageType = (preset: string) => {
    setDamageTypes(prev =>
      prev.includes(preset) ? prev.filter(d => d !== preset) : [...prev, preset]
    );
  };

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotos(prev => [...prev, compressed]);
    e.target.value = '';
  };

  const handleReHoldSubmit = async () => {
    const finalDescription = damageTypes.includes('Other') && customDamage.trim()
      ? [...damageTypes.filter(d => d !== 'Other'), customDamage.trim()].join(', ')
      : damageTypes.join(', ');
    setSubmitting(true);
    await onReHold(vehicle.id, finalDescription, reHoldNotes, photos, mostRecent.id);
    setReHolded(true);
    setShowReHoldForm(false);
    setSubmitting(false);
  };

  const canSubmitReHold = damageTypes.length > 0 && photos.length > 0 && !submitting;

  const renderHoldCard = (hold: Hold, isFirst: boolean) => (
    <div key={hold.id} className={isFirst ? '' : 'mt-4 pt-4 border-t border-gray-100 dark:border-gray-800'}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {hold.damageDescription}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Flagged {fmtDate(hold.flaggedAt)} · {getName(hold.flaggedById)} ({getEmpId(hold.flaggedById)} · {getRole(hold.flaggedById)})
          </p>
          {hold.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">"{hold.notes}"</p>
          )}
        </div>
        <StatusBadge status={hold.status} />
      </div>

      {/* Photos */}
      <div className="mt-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">📷 Photos at time of hold:</p>
        {hold.photos && hold.photos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {hold.photos.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setLightboxPhotos(hold.photos!); setLightboxIndex(i); }}
                className="cursor-pointer"
              >
                <img
                  src={src}
                  alt={`Hold photo ${i + 1}`}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No photos on file for this hold.</p>
        )}
      </div>

      {/* Release / Repair footer */}
      {(hold.release || hold.repair) && (
        <div className="mt-3 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800">
          <HoldRecordFooter
            hold={hold}
            getName={getName}
            getRole={getRole}
            getEmpId={getEmpId}
            fmt={fmt}
            fmtDate={fmtDate}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Toggle affordance */}
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        className="w-full text-right text-xs font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition mt-1 cursor-pointer"
      >
        {expanded ? '▲ Hide hold details' : 'View hold details →'}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors">
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Hold Context
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Compare against current condition.
            </p>
          </div>

          <div className="p-4">
            {renderHoldCard(mostRecent, true)}

            {/* Older holds */}
            {olderHolds.length > 0 && (
              <>
                {showFullHistory
                  ? olderHolds.map(h => renderHoldCard(h, false))
                  : (
                    <button
                      type="button"
                      onClick={() => setShowFullHistory(true)}
                      className="mt-3 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
                    >
                      Show full history ({olderHolds.length} more record{olderHolds.length > 1 ? 's' : ''}) →
                    </button>
                  )
                }
              </>
            )}

            {/* Re-hold section */}
            {!reHolded && canReHold && !showReHoldForm && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">New damage found?</p>
                <button
                  type="button"
                  onClick={() => setShowReHoldForm(true)}
                  className="px-4 py-2 border-2 border-red-400 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  Re-hold — New Damage Found
                </button>
              </div>
            )}

            {reHolded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Vehicle re-held. Damage logged.</p>
              </div>
            )}

            {showReHoldForm && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-widest">New Damage Found</p>

                {/* Damage type grid */}
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
                    {DAMAGE_PRESETS.map(preset => (
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
                      onChange={e => setCustomDamage(e.target.value)}
                      className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                    />
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Additional context…"
                    value={reHoldNotes}
                    onChange={e => setReHoldNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
                  />
                </div>

                {/* Photos — required */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                    Photos * (required · max {MAX_PHOTOS})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((src, i) => (
                      <div key={i} className="relative">
                        <img
                          src={src}
                          alt={`New damage photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-800"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
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
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoAdd} className="hidden" />
                  <input ref={galleryRef} type="file" accept="image/*" onChange={handlePhotoAdd} className="hidden" />
                  {photos.length === 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">At least one photo required.</p>
                  )}
                </div>

                {/* Entering as */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Flagging as: <span className="font-semibold">{getName(user.id)}</span> · {user.role}
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowReHoldForm(false); setDamageTypes([]); setCustomDamage(''); setReHoldNotes(''); setPhotos([]); }}
                    className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmitReHold}
                    onClick={handleReHoldSubmit}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Saving...' : 'Confirm Re-hold'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxPhotos([])}
        />
      )}
    </>
  );
}
