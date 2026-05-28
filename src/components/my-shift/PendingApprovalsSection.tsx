import { useState } from 'react';
import type { Hold, Vehicle } from '../../types';
import { hapticLight } from '../../lib/haptics';

interface PendingApprovalsSectionProps {
  holds: Hold[];
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function PendingApprovalsSection({
  holds,
  vehicles,
  onSelectVehicle,
}: PendingApprovalsSectionProps) {
  const pending = holds
    .filter(h => h.status === 'ACTIVE')
    .sort((a, b) => new Date(a.flaggedAt).getTime() - new Date(b.flaggedAt).getTime()); // oldest first

  const [open, setOpen] = useState(pending.length > 0);

  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-950/20 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => {
          hapticLight();
          setOpen(!open);
        }}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-orange-800 dark:text-orange-300">
            Pending Approval
          </span>
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {pending.length}
          </span>
        </div>
        <span className="text-xs text-orange-400 dark:text-orange-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-orange-200 dark:border-orange-800/40">
          {pending.map(hold => {
            const vehicle = vehicles.find(v => v.id === hold.vehicleId);
            return (
              <button
                key={hold.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  onSelectVehicle(hold.vehicleId);
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-orange-100 dark:hover:bg-orange-900/30 border-b border-orange-100 dark:border-orange-900/30 last:border-0 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {vehicle?.unitNumber ?? '—'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      {vehicle?.licensePlate ?? ''}
                    </span>
                    <span className="text-xs text-orange-500 dark:text-orange-400 font-medium">
                      {timeAgo(hold.flaggedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {hold.damageDescription.slice(0, 55)}{hold.damageDescription.length > 55 ? '…' : ''}
                  </p>
                </div>
                <span className="text-orange-400 dark:text-orange-500 text-xs ml-3 shrink-0">→</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
