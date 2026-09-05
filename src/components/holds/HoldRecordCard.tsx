// One hold record in the vehicle's Hold History — header (description, type pills, status,
// provenance, notes), the damage-photo strip (view / pin-cover / add), and the resolution
// footer. Extracted verbatim from HoldHistorySection (which was at the 330 cap) so the edit
// controls (delete / void / remove-photo, docs/ticket-holds-history-edit.md) have a home.
import { useState, type RefObject } from 'react';
import { holdTypePillClass, getTireSwapSeason, unresolvedHoldTypes } from '../../lib/holdBadge';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useAuth } from '../../context/AuthContext';
import { canMarkPreExisting } from '../../types';
import { StatusBadge } from './StatusBadge';
import { HoldRecordFooter } from './HoldRecordFooter';
import { HoldDamageZones } from './HoldDamageZones';
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
  /** Closed hold — stays fully on the record, but must not read as active (see holdGrouping). */
  muted?: boolean;
}

export function HoldRecordCard({
  hold, vehicle, uploadingFor, addPhotoClick, cameraInputRef, galleryInputRef,
  openLightbox, setCoverPhoto, getName, getEmpId, getRole, fmt, fmtDate, muted = false,
}: Props) {
  // Only the still-OPEN types drive the badge + pills — a resolved type stays in
  // holdTypes (the record) but shouldn't read as active.
  const unresolvedTypes = unresolvedHoldTypes(hold);
  const mechanicalOpen = unresolvedTypes.includes('mechanical');

  // Hold-history edits (edit-description / delete / void / remove-photo) — from context.
  const { voidHold, deleteHold, deleteHoldPhoto, editHoldDescription, convertToPreExisting } = useVehicleHoldContext();
  const { user } = useAuth();
  // An OPEN exception (released on exception, never returned) keeps the vehicle at OUT_ON_EXCEPTION.
  // For a cosmetic issue that won't be repaired, the operator can accept it as pre-existing in place —
  // closing the exception without a re-flag (which used to orphan the original). Per-hold + explicit.
  const isOpenException = hold.status === 'RELEASED'
    && hold.release?.releaseType === 'EXCEPTION' && !hold.release?.actualReturn;
  const canAccept = !muted && isOpenException && !!user && canMarkPreExisting(user.role);
  const [acceptArmed, setAcceptArmed] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptErr, setAcceptErr] = useState('');
  const runAccept = async () => {
    if (!user) return;
    setAcceptBusy(true); setAcceptErr('');
    try {
      await convertToPreExisting(hold.id, 'Accepted as pre-existing — cosmetic, no repair planned', user.name);
      setAcceptArmed(false);
    } catch (e) {
      setAcceptErr(e instanceof Error ? e.message : 'Could not accept as pre-existing.');
    } finally {
      setAcceptBusy(false);
    }
  };
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set()); // photos staged for deletion
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [descDraft, setDescDraft] = useState(hold.damageDescription); // reset on each edit open
  const descChanged = descDraft.trim().length > 0 && descDraft.trim() !== hold.damageDescription;

  const startEdit = () => { setDescDraft(hold.damageDescription); setEditing(true); };
  const exitEdit = () => { setEditing(false); setPending(null); setMarked(new Set()); setErrMsg(''); };

  const saveDescription = async () => {
    if (!descChanged) return;
    setBusy(true);
    setErrMsg('');
    try {
      await editHoldDescription(hold.id, descDraft);
      exitEdit();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Could not save the description.');
    } finally {
      setBusy(false);
    }
  };
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
    <div className={`transition-colors rounded-xl border overflow-hidden ${
      muted
        ? 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-200/70 dark:border-gray-800/60'
        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
    }`}>
      {/* Hold Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {editing ? (
              <div className="w-full min-w-0">
                <textarea
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  rows={2}
                  aria-label="Edit hold description"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-fg-yellow"
                />
                <button
                  type="button"
                  disabled={busy || !descChanged}
                  onClick={saveDescription}
                  className="mt-1 rounded-lg bg-fg-yellow px-3 py-1 text-xs font-semibold text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {busy ? 'Saving…' : 'Save text'}
                </button>
                {errMsg && !pending && <p className="text-xs text-red-500 mt-1">{errMsg}</p>}
              </div>
            ) : (
              <p className={`text-base font-medium ${
                muted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
              }`}>{hold.damageDescription}</p>
            )}
            {!editing && (unresolvedTypes.length > 1 || unresolvedTypes[0] !== 'damage') && unresolvedTypes.map(type => (
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
              onClick={() => (editing ? exitEdit() : startEdit())}
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
        {/* WHERE the damage is — chips, and the diagram behind an Edit tap. Lives in its own
            component: this file is at the 330-line cap and the map is not a two-liner. */}
        <HoldDamageZones hold={hold} />

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
                  <img loading="lazy" src={src} alt={`Damage photo ${i + 1}`} className={`w-14 h-14 object-cover rounded-lg border transition ${isMarked ? 'opacity-30 grayscale border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-800 hover:opacity-80'}`} />
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

      {/* Accept an open exception as pre-existing in place — cosmetic damage that won't be repaired,
          so it stops circulating as an exception and the vehicle re-derives out of OUT_ON_EXCEPTION.
          Only this damage is affected; other holds are untouched. */}
      {canAccept && (
        <div className="mt-2.5 border-t border-gray-100 dark:border-gray-800 pt-2.5">
          {acceptArmed ? (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                ↩ Accept this exception as pre-existing? It stops circulating as an exception and the vehicle reads pre-existing (renting as-is). Only this damage changes.
              </p>
              {acceptErr && <p className="text-xs text-red-500 mb-2">{acceptErr}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={acceptBusy} onClick={() => { setAcceptArmed(false); setAcceptErr(''); }} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 disabled:opacity-40 cursor-pointer">Cancel</button>
                <button type="button" disabled={acceptBusy} onClick={runAccept} className="flex-1 rounded-lg bg-slate-700 hover:bg-slate-600 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer">{acceptBusy ? 'Working…' : 'Accept as pre-existing'}</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setAcceptArmed(true)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600/60 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
              ↩ Accept as pre-existing
            </button>
          )}
        </div>
      )}
    </div>
  );
}
