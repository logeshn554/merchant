import React, { useState, useEffect } from 'react';

interface OfferCountdownTimerProps {
  expiresAt?: string;
  onExpired?: () => void;
}

export default function OfferCountdownTimer({ expiresAt, onExpired }: OfferCountdownTimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return;

    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresMs) {
        clearInterval(timer);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  if (!expiresAt) {
    return <p className="text-xs text-slate-500">Awaiting lease timeline…</p>;
  }

  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return <p className="text-xs text-slate-500">Invalid lease timeline.</p>;
  }

  const remainingSeconds = Math.max(0, Math.ceil((expiresMs - now) / 1000));
  const isExpired = remainingSeconds <= 0;

  return (
    <div className="space-y-1" data-component="offer-countdown-timer">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className={isExpired ? 'text-rose-600' : remainingSeconds <= 10 ? 'text-amber-600 animate-pulse' : 'text-purple-700'}>
          {isExpired ? 'Offer expired. Refreshing dispatch…' : `Offer expires in ${remainingSeconds}s`}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">30s lease</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 rounded-full ${
            isExpired ? 'bg-rose-500 w-0' : remainingSeconds <= 10 ? 'bg-amber-500' : 'bg-purple-600'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, (remainingSeconds / 30) * 100))}%` }}
        />
      </div>
    </div>
  );
}
