import { useState } from 'react';
import { RepairConfirmSection, type RepairConfirmSectionProps } from './RepairConfirmSection';
import { descriptionParts, planPanelRepair } from '../../lib/panelRepair';
import { orderZones, zoneLabel } from '../../lib/damageZones';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import type { PanelSide } from '../../lib/panelRepair';
import type { Hold, Repair } from '../../types';

// "Which panels got fixed?" — the repair confirm for one hold that sits on two or more panels.
//
// Aaron, 2026-10-21, 0ET075: the windshield chips came back fixed the same day, the rear rim did not,
// and both were on one hold. See lib/panelRepair for the split this drives.
//
// ⭐ EVERY PANEL STARTS TICKED. Most multi-panel holds are ONE damage spread wide — hail across the
// hood, roof and liftgate; low tread on all four — and get fixed all at once. Ticked-by-default keeps
// that the same one tap it always was; only unticking a panel turns this into a part repair.
//
// ⚠️ The photo and description picks only appear once it IS a part repair. FG cannot know which photo
// is the rim, so it asks — but asking on every hail repair would be noise for a question with no answer.

interface Props {
  hold: Hold;
  userId: string;
  markPanelsRepaired: (holdId: string, fixed: PanelSide, standing: PanelSide, repair: Omit<Repair, 'id' | 'holdId'>) => Promise<void>;
  /** The whole-hold confirm — used untouched when every panel is ticked. */
  confirm: Omit<RepairConfirmSectionProps, 'holds'>;
}

const toggle = (list: readonly string[], v: string) =>
  list.includes(v) ? list.filter(x => x !== v) : [...list, v];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-pressed={on} onClick={() => { hapticLight(); onClick(); }}
      className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold text-left cursor-pointer transition ${on
        ? 'border-green-500 bg-green-600 text-white dark:border-green-500'
        : 'border-green-300 bg-white text-gray-600 dark:border-green-800 dark:bg-gray-900 dark:text-gray-400'}`}
    >
      {on ? '✓ ' : ''}{children}
    </button>
  );
}

export function PanelRepairSection({ hold, userId, markPanelsRepaired, confirm }: Props) {
  const zones = orderZones(hold.damageZones ?? []);
  const parts = descriptionParts(hold.damageDescription);
  const photos = hold.photos ?? [];
  const [pickedZones, setPickedZones] = useState<string[]>(zones);
  const [pickedPhotos, setPickedPhotos] = useState<string[]>([]);
  const [pickedParts, setPickedParts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const plan = planPanelRepair(hold, { zones: pickedZones, photos: pickedPhotos, parts: pickedParts });

  const picker = (
    <div className="space-y-3" data-testid="panel-repair-picker">
      <div>
        <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">What got fixed?</p>
        <div className="flex flex-wrap gap-1.5">
          {zones.map(z => (
            <Chip key={z} on={pickedZones.includes(z)} onClick={() => setPickedZones(p => toggle(p, z))}>{zoneLabel(z)}</Chip>
          ))}
        </div>
      </div>
      {plan.kind === 'split' && photos.length > 0 && (
        <div>
          <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">Photos of what got fixed</p>
          <div className="flex flex-wrap gap-1.5">
            {photos.map((src, i) => {
              const on = pickedPhotos.includes(src);
              return (
                <button key={src} type="button" aria-pressed={on} onClick={() => { hapticLight(); setPickedPhotos(p => toggle(p, src)); }}
                        className={`relative rounded-lg cursor-pointer ${on ? 'ring-4 ring-green-500' : 'opacity-70'}`}>
                  <img src={src} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                  {on && <span className="absolute right-0.5 top-0.5 rounded bg-green-600 px-1 text-[10px] font-bold text-white">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {plan.kind === 'split' && parts.length > 1 && (
        <div>
          <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">Which of these got fixed</p>
          <div className="flex flex-wrap gap-1.5">
            {parts.map(p => (
              <Chip key={p} on={pickedParts.includes(p)} onClick={() => setPickedParts(x => toggle(x, p))}>{p}</Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (plan.kind === 'whole') {
    return <RepairConfirmSection holds={[hold]} {...confirm}>{picker}</RepairConfirmSection>;
  }

  const confirmSplit = async () => {
    setBusy(true);
    setError(false);
    try {
      await markPanelsRepaired(hold.id, plan.fixed, plan.standing, {
        repairedById: userId, repairedAt: new Date().toISOString(),
        notes: confirm.repairNotes.trim(), outcome: confirm.repairOutcome,
      });
      hapticMedium();
      confirm.onCancel();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const names = (ids: string[]) => ids.map(zoneLabel).join(', ');
  return (
    <RepairConfirmSection
      holds={[hold]}
      {...confirm}
      repairing={busy}
      error={error}
      onConfirm={confirmSplit}
      actionLabel={`Mark ${plan.fixed.zones.length} of ${zones.length} as Repaired`}
      summary={<>Marks <strong>{names(plan.fixed.zones)}</strong> repaired. <strong>{names(plan.standing.zones)}</strong> stays on this hold, so the car's status doesn't change.</>}
    >
      {picker}
    </RepairConfirmSection>
  );
}
