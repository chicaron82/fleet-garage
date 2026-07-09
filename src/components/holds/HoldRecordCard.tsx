// One hold record in the vehicle's Hold History — header (description, type pills, status,
// provenance, notes), the damage-photo strip (view / pin-cover / add), and the resolution
// footer. Extracted verbatim from HoldHistorySection (which was at the 330 cap) so the edit
// controls (delete / void / remove-photo, docs/ticket-holds-history-edit.md) have a home.
import { useState, type RefObject } from 'react';
import { holdTypePillClass, getTireSwapSeason, unresolvedHoldTypes } from '../../lib/holdBadge';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { StatusBadge } from './StatusBadge';
import { HoldRecordFooter } from './HoldRecordFooter';
import type { Hold, Vehicle } from '../../types';

const MAX_PHOTOS = 4;

/** An armed destructive action awaiting confirm — one banner covers all three. Photos are
 *  batched: mark several (grey), then one 'commit-photos' confirm deletes them all. */
type Pending =
  | { type: 'delete-hold' }
  | { type: 'void-hold' }
  | { type: 'commit-photos' };

const HOLD_LABEL: Record<'delete-hold' | 'void-hold', string> = {
  'delete-hold': 'Permanently delete this hold and its photos? This can’t be undone.',
  'void-hold': 'Void this hold? It stays on record, marked Voided.',
};

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

  // Destructive edits (delete/void/remove-photo) — pulled from context, not prop-drilled.
  const { voidHold, deleteHold, deleteHoldPhoto } = useVehicleHoldContext();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set()); // photos staged for deletion
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const exitEdit = () => { setEditing(false); setPending(null); setMarked(new Set()); setErrMsg(''); };
  const toggleMark = (url: string) => setMarked(prev => {
    const next = new Set(prev);
    if (next.has(url)) next.delete(url); else next.add(url);
    return next;
  });

  const pendingLabel = pending?.type === 'commit-photos'
    ? `Delete ${marked.size} photo${marked.size === 1 ? '' : 's'} from this hold?`
    : pending ? HOLD_LABEL[pending.type] : '';

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    setErrMsg('');
    try {
      if (pending.type === 'delete-hold') await deleteHold(hold.id);
      else if (pending.type === 'void-hold') await voidHold(hold.id);
      else for (const url of marked) await deleteHoldPhoto(hold.id, url); // commit-photos batch
      exitEdit();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Could not complete that.');
    } finally {
      setBusy(false);
    }
  };

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
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={hold.status} holdTypes={unresolvedTypes} mechanicalSubType={hold.mechanicalSubType} />
            <button
              type="button"
              onClick={() => (editing ? exitEdit() : setEditing(true))}
              aria-label={editing ? 'Done editing' : 'Edit this hold'}
              title={editing ? 'Done' : 'Edit'}
              className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 text-sm leading-none cursor-pointer"
            >
              {editing ? '✕' : '✏️'}
            </button>
          </div>
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
            const isMarked = marked.has(src);
            return (
              <div key={i} className="relative">
                <button type="button" onClick={() => openLightbox(hold.photos ?? [], i)} className="cursor-pointer block">
                  <img src={src} alt={`Damage photo ${i + 1}`} className={`w-14 h-14 object-cover rounded-lg border transition ${isMarked ? 'opacity-30 grayscale border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-800 hover:opacity-80'}`} />
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
                {editing && (
                  <button
                    type="button"
                    aria-label={isMarked ? 'Undo remove' : 'Remove this photo'}
                    title={isMarked ? 'Undo' : 'Remove this photo'}
                    onClick={() => toggleMark(src)}
                    className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] leading-none flex items-center justify-center shadow cursor-pointer ${isMarked ? 'bg-gray-500 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    {isMarked ? '↺' : '✕'}
                  </button>
                )}
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
        {editing && (
          <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2.5">
            {pending ? (
              <>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">⚠️ {pendingLabel}</p>
                {errMsg && <p className="text-xs text-red-500 mb-2">{errMsg}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => { setPending(null); setErrMsg(''); }} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 disabled:opacity-40 cursor-pointer">Cancel</button>
                  <button type="button" disabled={busy} onClick={runPending} className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer">{busy ? 'Working…' : 'Confirm'}</button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {marked.size > 0 && (
                  <button type="button" onClick={() => setPending({ type: 'commit-photos' })} className="w-full rounded-lg bg-red-600 hover:bg-red-500 py-1.5 text-xs font-semibold text-white cursor-pointer">
                    Delete {marked.size} photo{marked.size === 1 ? '' : 's'}
                  </button>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPending({ type: 'void-hold' })} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">Void hold</button>
                  <button type="button" onClick={() => setPending({ type: 'delete-hold' })} className="flex-1 rounded-lg border border-red-300 dark:border-red-800 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer">Delete hold</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <HoldRecordFooter hold={hold} getName={getName} getRole={getRole} getEmpId={getEmpId} fmt={fmt} fmtDate={fmtDate} />
    </div>
  );
}
