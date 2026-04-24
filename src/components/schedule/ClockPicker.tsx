import { useState, useRef, useEffect } from 'react';

interface ClockPickerProps {
  value: string;       // "HH:mm" 24-hour format
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Which direction the popover opens. Default: 'down'. Use 'up' inside bottom sheets. */
  direction?: 'up' | 'down';
}

const SIZE = 164;
const CENTER = SIZE / 2;
const RADIUS = 60;

const HOUR_POSITIONS = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 1;
  const angle = (hour / 12) * 2 * Math.PI - Math.PI / 2;
  return { hour, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
});

const MINUTE_POSITIONS = Array.from({ length: 12 }, (_, i) => {
  const minute = i * 5;
  const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
  return { minute, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
});

function parse(value: string): { h: number; m: number } {
  const [h, m] = value.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

function format(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function to24(hour12: number, pm: boolean): number {
  if (pm) return hour12 === 12 ? 12 : hour12 + 12;
  return hour12 === 12 ? 0 : hour12;
}

export function ClockPicker({ value, onChange, disabled, direction = 'down' }: ClockPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'hour' | 'minute'>('hour');
  const ref = useRef<HTMLDivElement>(null);

  const { h, m } = parse(value);
  const isPM = h >= 12;
  const hour12 = h % 12 || 12;
  const snappedM = Math.round(m / 5) * 5 % 60;

  const displayLabel = `${hour12}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setStep('hour');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleOpen = () => {
    setStep('hour');
    setIsOpen(o => !o);
  };

  const handleHour = (clickedHour: number) => {
    onChange(format(to24(clickedHour, isPM), m));
    setStep('minute');
  };

  const handleMinute = (clickedMin: number) => {
    onChange(format(to24(hour12, isPM), clickedMin));
    setIsOpen(false);
    setStep('hour');
  };

  const handleAmPm = (pm: boolean) => {
    onChange(format(to24(hour12, pm), m));
  };

  const popoverPos = direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700
                   bg-white dark:bg-gray-950 text-left text-gray-900 dark:text-gray-100
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:border-gray-400 dark:hover:border-gray-500
                   focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent
                   transition font-mono tracking-wide cursor-pointer"
      >
        {displayLabel}
      </button>

      {isOpen && !disabled && (
        <div
          className={`absolute z-50 ${popoverPos} p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl`}
          style={{ width: SIZE + 24 }}
        >
          {/* AM / PM */}
          <div className="flex gap-2 mb-3">
            {(['AM', 'PM'] as const).map(period => (
              <button
                key={period}
                type="button"
                onClick={() => handleAmPm(period === 'PM')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  (period === 'PM') === isPM
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Time display — click to jump to that step */}
          <div className="flex items-center justify-center gap-0.5 mb-2">
            <button
              type="button"
              onClick={() => setStep('hour')}
              className={`px-2 py-0.5 rounded font-mono text-lg font-semibold transition-colors ${
                step === 'hour'
                  ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {String(hour12).padStart(2, '0')}
            </button>
            <span className="text-lg font-semibold text-gray-400 dark:text-gray-500 select-none">:</span>
            <button
              type="button"
              onClick={() => setStep('minute')}
              className={`px-2 py-0.5 rounded font-mono text-lg font-semibold transition-colors ${
                step === 'minute'
                  ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {String(m).padStart(2, '0')}
            </button>
          </div>

          {/* Clock face */}
          <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
            <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-700" />
            <div
              className="absolute w-2 h-2 rounded-full bg-gray-400/40"
              style={{ left: CENTER - 4, top: CENTER - 4 }}
            />

            {step === 'hour' && HOUR_POSITIONS.map(({ hour, x, y }) => (
              <button
                key={hour}
                type="button"
                onClick={() => handleHour(hour)}
                style={{ position: 'absolute', left: x - 15, top: y - 15, width: 30, height: 30 }}
                className={`rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                  hour === hour12
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {hour}
              </button>
            ))}

            {step === 'minute' && MINUTE_POSITIONS.map(({ minute, x, y }) => (
              <button
                key={minute}
                type="button"
                onClick={() => handleMinute(minute)}
                style={{ position: 'absolute', left: x - 15, top: y - 15, width: 30, height: 30 }}
                className={`rounded-full text-xs font-medium transition-colors flex items-center justify-center ${
                  minute === snappedM
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {String(minute).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
