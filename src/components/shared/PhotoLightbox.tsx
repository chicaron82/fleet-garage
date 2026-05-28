import { useState, useRef, useEffect } from 'react';

interface Props {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX    = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);

  const total = photos.length;
  const single = total === 1;

  useEffect(() => {
    const handlePopState = () => { onClose(); };
    window.history.pushState({ lightbox: true }, '');
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [onClose]);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex(i => Math.max(0, i - 1));
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex(i => Math.min(total - 1, i + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current    = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartTime.current === null) return;
    const delta   = touchStartX.current - e.changedTouches[0].clientX;
    const elapsed = Date.now() - touchStartTime.current;
    touchStartX.current    = null;
    touchStartTime.current = null;
    if (elapsed > 250) return;
    if (delta > 50)       setIndex(i => Math.min(total - 1, i + 1));
    else if (delta < -50) setIndex(i => Math.max(0, i - 1));
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="text-white text-2xl leading-none opacity-70 hover:opacity-100 transition cursor-pointer"
          onClick={onClose}
        >
          ×
        </button>
        {!single && (
          <span className="text-white text-sm font-medium tabular-nums opacity-70">
            {index + 1} / {total}
          </span>
        )}
      </div>

      {/* Photo + arrows */}
      <div
        className="flex items-center justify-center w-full px-12 select-none"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {!single && (
          <button
            onClick={prev}
            disabled={index === 0}
            className="absolute left-2 text-white text-3xl font-light opacity-70 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer p-2"
          >
            ‹
          </button>
        )}

        <img
          src={photos[index]}
          alt={`Damage photo ${index + 1}`}
          className="max-w-full max-h-[80vh] rounded-xl object-contain"
        />

        {!single && (
          <button
            onClick={next}
            disabled={index === total - 1}
            className="absolute right-2 text-white text-3xl font-light opacity-70 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer p-2"
          >
            ›
          </button>
        )}
      </div>

      {/* Dot indicators */}
      {!single && (
        <div
          className="absolute bottom-6 flex gap-2 items-center"
          onClick={e => e.stopPropagation()}
        >
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                i === index ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
