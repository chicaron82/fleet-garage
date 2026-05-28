import { useState, useEffect } from 'react';

interface ElapsedTickerProps {
  startTime: string;
}

export function ElapsedTicker({ startTime }: ElapsedTickerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  return (
    <span className="font-mono tabular-nums">
      {m}:{String(s).padStart(2, '0')}
    </span>
  );
}
