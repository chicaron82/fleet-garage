// The "Log damage" drop-n-go intake: two photos (key tag + damage) → a staged damage hold for
// later approval. Step 1 captures both photos (the tag reads → resolves the vehicle; the damage
// reads → a draft description); Step 2 reviews the resolved branch + editable description and
// stages the branch-correct hold-bearing proposal (register_and_hold / hold / update_and_hold).
// Nothing writes to the fleet here — it lands in the pending-writes queue for Aaron's confirm.
// The orchestration lives in useDamageIntake; this is the capture UI. See
// docs/ticket-effie-damage-drop-intake.md.
import { useRef, useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { compressImage } from '../../lib/image';
import { PhotoSlot } from '../shared/PhotoSlot';
import { useDamageIntake } from '../../hooks/useDamageIntake';
import { newVehicleFromRead } from '../../lib/resolveKeytagScan';
import type { User } from '../../types';

/** A one-line summary of what staging will do, per resolved branch. */
function branchSummary(intake: ReturnType<typeof useDamageIntake>): { tone: 'ok' | 'warn'; text: string } | null {
  if (!intake.scan) return null;
  const { read, result } = intake.scan;
  const { plate, vehicle, resolution } = result;
  if (resolution.kind === 'new') {
    return newVehicleFromRead(read, plate)
      ? { tone: 'ok', text: `${plate} — not in the fleet. Will register it + open a damage hold.` }
      : { tone: 'warn', text: `${plate} — couldn't read enough to register (need make/model/unit/year). Add it via Effie chat first.` };
  }
  if (resolution.kind === 'partial' && vehicle) {
    const fields = resolution.fills.map((f) => f.field).join(', ');
    return { tone: 'ok', text: `${plate} — Unit ${vehicle.unitNumber}. Will fill in ${fields} + open a damage hold.` };
  }
  if (vehicle) {
    return { tone: 'ok', text: `${plate} — Unit ${vehicle.unitNumber}, ${vehicle.year} ${vehicle.make} ${vehicle.model}. Damage hold.` };
  }
  return null;
}

export function LogDamageModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  useEscapeKey(onClose);
  const [step, setStep] = useState<1 | 2>(1);
  // The key-tag photo is kept locally only for its thumbnail preview — it is deliberately NOT
  // attached to the hold (it's identity, not damage evidence; the read already used it).
  const [keyTagPhoto, setKeyTagPhoto] = useState<string | null>(null);
  const intake = useDamageIntake();
  const keyTagCamRef = useRef<HTMLInputElement>(null);
  const damageCamRef = useRef<HTMLInputElement>(null);
  const damageGalleryRef = useRef<HTMLInputElement>(null);

  const capture = (after: (photo: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const photo = await compressImage(file);
    e.target.value = '';
    after(photo);
  };

  const summary = branchSummary(intake);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl transition-colors max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Log damage — Step {step} of 2</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer transition">×</button>
        </div>

        <div className="p-4 space-y-5">
          {/* Step 1 — the two photos */}
          {step === 1 && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Photo the key tag, then the damage — circle the damage so it reads clean. Effie
                reads both; you confirm the hold later.
              </p>
              <div className="flex gap-6">
                <PhotoSlot
                  label="Key tag"
                  photo={keyTagPhoto}
                  onCapture={capture((p) => { setKeyTagPhoto(p); void intake.scanKeytag(p); })}
                  onClear={() => setKeyTagPhoto(null)}
                  cameraRef={keyTagCamRef}
                />
                <PhotoSlot
                  label="Damage"
                  photo={intake.damagePhoto}
                  onCapture={capture((p) => void intake.readDamagePhoto(p))}
                  onGallery={capture((p) => void intake.readDamagePhoto(p))}
                  onClear={() => { /* re-shoot by recapturing */ }}
                  cameraRef={damageCamRef}
                  galleryRef={damageGalleryRef}
                />
              </div>

              {/* Live read feedback */}
              <div className="space-y-1 min-h-[1rem]">
                {intake.scanning && <p className="text-xs text-gray-500 dark:text-gray-400">Reading the key tag…</p>}
                {intake.scanErr && <p className="text-xs text-red-500">{intake.scanErr}</p>}
                {summary && (
                  <p className={`text-xs ${summary.tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-teal-700 dark:text-teal-400'}`}>{summary.text}</p>
                )}
                {intake.reading && <p className="text-xs text-gray-500 dark:text-gray-400">Reading the damage…</p>}
                {intake.readErr && <p className="text-xs text-amber-700 dark:text-amber-400">{intake.readErr}</p>}
              </div>

              <button
                type="button"
                disabled={!intake.canStage}
                onClick={() => { hapticLight(); setStep(2); }}
                className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                Next: Review →
              </button>
            </>
          )}

          {/* Step 2 — review + stage */}
          {step === 2 && (
            <>
              <button type="button" onClick={() => { hapticLight(); setStep(1); }} className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer transition">← Back to photos</button>

              {intake.damagePhoto && (
                <img src={intake.damagePhoto} alt="Damage" className="w-full max-h-52 rounded-lg object-contain bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700" />
              )}

              {summary && (
                <div className={`rounded-lg px-3 py-2 text-sm ${summary.tone === 'warn' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300' : 'bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-300'}`}>{summary.text}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Damage description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Scrape on the rear driver-side quarter panel"
                  value={intake.description}
                  onChange={(e) => intake.setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition resize-none"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Effie's read — edit if it's off. You approve the hold later on My Shift.</p>
              </div>

              {user && (
                <p className="text-xs text-gray-400 dark:text-gray-500">Staging as: <span className="font-semibold">{user.name}</span> · {user.role}</p>
              )}

              {intake.stageErr && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">{intake.stageErr}</p>
                </div>
              )}

              {intake.staged ? (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg px-4 py-3">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">✓ Staged — approve it on My Shift.</p>
                  </div>
                  <button type="button" onClick={onClose} className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi text-black font-semibold text-sm rounded-lg transition cursor-pointer">Done</button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={intake.staging || !intake.canStage}
                  onClick={() => { hapticMedium(); void intake.submit(); }}
                  className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  {intake.staging ? 'Staging…' : 'Stage damage hold for approval'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
