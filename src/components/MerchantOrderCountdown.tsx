import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface MerchantOrderCountdownProps {
  createdAt?: string;
  serviceType?: string;
  status: string;
  deadlineMinutes?: number;
}

export default function MerchantOrderCountdown({
  createdAt,
  serviceType,
  status,
  deadlineMinutes: propDeadlineMinutes
}: MerchantOrderCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'pending' || !createdAt) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [status, createdAt]);

  if (status !== 'pending' || !createdAt) return null;

  const placedAtMs = Date.parse(createdAt);
  if (isNaN(placedAtMs)) return null;

  const deadlineMinutes =
    Number.isInteger(propDeadlineMinutes) && (propDeadlineMinutes ?? 0) > 0
      ? (propDeadlineMinutes ?? 10)
      : serviceType === 'grocery'
      ? 15
      : 10;

  const totalDeadlineMs = deadlineMinutes * 60 * 1000;
  const remainingMs = Math.max(0, placedAtMs + totalDeadlineMs - now);
  const remainingSec = Math.floor(remainingMs / 1000);

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (remainingSec === 0) {
    return (
      <div
        role="timer"
        aria-live="assertive"
        data-testid="merchant-countdown-expired"
        className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 font-bold"
      >
        <Clock className="w-3.5 h-3.5 text-rose-400" />
        <span>Acceptance deadline expired (auto-cancelling...)</span>
      </div>
    );
  }

  const isUrgent = remainingSec <= 60;

  return (
    <div
      role="timer"
      aria-live="polite"
      data-testid={isUrgent ? 'merchant-countdown-urgent' : 'merchant-countdown'}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
        isUrgent
          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse'
          : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
      }`}
    >
      <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-400' : 'text-blue-400'}`} />
      <span>Accept within {formatted}</span>
    </div>
  );
}
