import { useState } from 'react';
import { useUserResolver } from '../../hooks/useUserResolver';
import { HoldRecordFooter } from './HoldRecordFooter';
import { StatusBadge } from './StatusBadge';
import { PhotoLightbox } from '../shared/PhotoLightbox';
import type { Hold, HoldType, User, Vehicle } from '../../types';
import { PriorDamageReHoldForm } from './PriorDamageReHoldForm';
import { NewIssueReHoldForm } from './NewIssueReHoldForm';

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
  onReHold: (vehicleId: string, description: string, notes: string, photos: string[], linkedHoldId: string, holdTypes: HoldType[]) => Promise<void>;
  autoExpand?: boolean;
  reHoldContext?: 'exception' | 'auction';
}

export function HoldContextPanel({ vehicle, holds, user, onReHold, autoExpand, reHoldContext }: Props) {
  const { getName, getRole, getEmpId } = useUserResolver();
  const [expanded, setExpanded] = useState(autoExpand ?? false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showReHoldForm, setShowReHoldForm] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [reHolded, setReHolded] = useState(false);
  const [reHoldError, setReHoldError] = useState(false);
  const [showPriorDamageForm, setShowPriorDamageForm] = useState(false);

  if (holds.length === 0) return null;

  const sorted = [...holds].sort((a, b) =>
    new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()
  );
  const mostRecent = sorted[0];
  const olderHolds = sorted.slice(1);

  const canReHold = vehicle.status !== 'HELD' && !reHolded;

  const handlePriorDamageSubmit = async (notes: string, photosToSubmit: string[]) => {
    setSubmitting(true);
    setReHoldError(false);
    try {
      await onReHold(vehicle.id, mostRecent.damageDescription, notes, photosToSubmit, mostRecent.id, mostRecent.holdTypes ?? ['damage']);
      setReHolded(true);
      setShowPriorDamageForm(false);
    } catch {
      setReHoldError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewIssueSubmit = async (description: string, notes: string, photosToSubmit: string[], holdTypes: HoldType[]) => {
    setSubmitting(true);
    setReHoldError(false);
    try {
      await onReHold(vehicle.id, description, notes, photosToSubmit, mostRecent.id, holdTypes);
      setReHolded(true);
      setShowReHoldForm(false);
    } catch {
      setReHoldError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const resetReHoldForms = () => {
    setShowReHoldForm(false);
    setShowPriorDamageForm(false);
  };


  const renderHoldCard = (hold: Hold, isFirst: boolean) => (
    <div key={hold.id} className={isFirst ? '' : 'mt-4 pt-4 border-t border-gray-100 dark:border-gray-800'}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {hold.damageDescription}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Flagged {fmtDate(hold.flaggedAt)} · {getName(hold.flaggedById, hold.flaggedByName)} ({getEmpId(hold.flaggedById, hold.flaggedByEmployeeId) || '—'} · {getRole(hold.flaggedById) || '—'}){hold.flaggedSource === 'effie' ? ' · via Effie' : ''}
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
            {!reHolded && canReHold && !showReHoldForm && !showPriorDamageForm && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">How does the vehicle return?</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPriorDamageForm(true)}
                    className="w-full px-4 py-2.5 border-2 border-fg-yellow dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 font-semibold text-sm rounded-lg transition cursor-pointer text-left"
                  >
                    Prior damage/issue — re-hold
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReHoldForm(true)}
                    className="w-full px-4 py-2.5 border-2 border-red-400 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm rounded-lg transition cursor-pointer text-left"
                  >
                    New damage/issue — re-hold
                  </button>
                </div>
              </div>
            )}

            {reHolded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Vehicle re-held. Issue logged.</p>
              </div>
            )}

            {reHoldError && (showPriorDamageForm || showReHoldForm) && (
              <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-xs text-red-700 dark:text-red-300">
                Couldn't save the re-hold — check your connection and try again.
              </div>
            )}

            {showPriorDamageForm && (
              <PriorDamageReHoldForm
                vehicleId={vehicle.id}
                mostRecent={mostRecent}
                user={user}
                submitting={submitting}
                onCancel={resetReHoldForms}
                onSubmit={handlePriorDamageSubmit}
                getName={getName}
              />
            )}

            {showReHoldForm && (
              <NewIssueReHoldForm
                user={user}
                submitting={submitting}
                onCancel={resetReHoldForms}
                onSubmit={handleNewIssueSubmit}
                getName={getName}
                reHoldContext={reHoldContext}
              />
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
