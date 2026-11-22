import { zoneLabel } from '../../lib/damageZones';
import { hapticLight } from '../../lib/haptics';

// The "which panels?" chips, shared by a one-type part repair (PanelRepairSection) and an issue of a
// multi-type hold (IssuePanelSection). The photo and description picks appear only once it IS a split:
// FG cannot know which photo is which panel, so it asks, but asking on every whole repair would be noise.

export interface PanelPickerState {
  zones: string[];
  setZones: (f: (prev: string[]) => string[]) => void;
  photos: string[];
  setPhotos: (f: (prev: string[]) => string[]) => void;
  parts: string[];
  setParts: (f: (prev: string[]) => string[]) => void;
}

interface Props {
  title: string;
  zones: readonly string[];
  photos: readonly string[];
  parts: readonly string[];
  picked: PanelPickerState;
  /** The pick is a split, so ask which photos and words go with the fix. */
  split: boolean;
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

export function PanelPicker({ title, zones, photos, parts, picked, split }: Props) {
  return (
    <div className="space-y-3" data-testid="panel-repair-picker">
      <div>
        <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {zones.map(z => (
            <Chip key={z} on={picked.zones.includes(z)} onClick={() => picked.setZones(p => toggle(p, z))}>{zoneLabel(z)}</Chip>
          ))}
        </div>
      </div>
      {split && photos.length > 0 && (
        <div>
          <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">Photos of what got fixed</p>
          <div className="flex flex-wrap gap-1.5">
            {photos.map((src, i) => {
              const on = picked.photos.includes(src);
              return (
                <button key={src} type="button" aria-pressed={on} onClick={() => { hapticLight(); picked.setPhotos(p => toggle(p, src)); }}
                        className={`relative rounded-lg cursor-pointer ${on ? 'ring-4 ring-green-500' : 'opacity-70'}`}>
                  <img src={src} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                  {on && <span className="absolute right-0.5 top-0.5 rounded bg-green-600 px-1 text-[10px] font-bold text-white">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {split && parts.length > 1 && (
        <div>
          <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">Which of these got fixed</p>
          <div className="flex flex-wrap gap-1.5">
            {parts.map(p => (
              <Chip key={p} on={picked.parts.includes(p)} onClick={() => picked.setParts(x => toggle(x, p))}>{p}</Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
