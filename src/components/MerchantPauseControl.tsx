import React, { useState, useEffect } from 'react';
import { PauseCircle, PlayCircle, Clock, AlertTriangle, X, Check } from 'lucide-react';

export interface MerchantPauseOutlet {
  id: string;
  merchantType: 'restaurant' | 'grocery';
  name?: string;
  acceptingOrders?: boolean;
  pausedUntil?: string | null;
  pausedAt?: string | null;
  pausedReason?: string | null;
}

export interface MerchantPauseControlProps {
  outlet: MerchantPauseOutlet;
  canManageOrders?: boolean;
  onSetPause?: (input: {
    merchantId: string;
    merchantType: 'restaurant' | 'grocery';
    durationMinutes: number | 'indefinite';
    reason?: string;
  }) => Promise<{
    success: boolean;
    paused: boolean;
    pausedUntil: string | null;
    pausedAt: string | null;
    pausedReason: string | null;
    acceptingOrders: boolean;
  }>;
  onPauseChanged?: (updated: { pausedUntil: string | null; acceptingOrders: boolean; pausedReason?: string | null }) => void;
}

export const PAUSE_DURATIONS = [
  { value: 15, label: '15 mins', description: 'Quick breather' },
  { value: 30, label: '30 mins', description: 'Kitchen rush' },
  { value: 60, label: '60 mins', description: 'Peak demand' },
  { value: 'indefinite' as const, label: 'Until resumed', description: 'Manual resume' }
];

export function isOutletPaused(outlet: MerchantPauseOutlet, nowMs: number = Date.now()): {
  isPaused: boolean;
  isIndefinite: boolean;
  remainingMinutes: number;
  resumeAtTimeFormatted: string;
} {
  const pausedUntil = outlet.pausedUntil;
  if (pausedUntil === 'indefinite' || pausedUntil === 'manual') {
    return { isPaused: true, isIndefinite: true, remainingMinutes: 0, resumeAtTimeFormatted: '' };
  }
  if (typeof pausedUntil === 'string' && pausedUntil.trim()) {
    const untilMs = Date.parse(pausedUntil);
    if (Number.isFinite(untilMs)) {
      if (nowMs < untilMs) {
        const diffMs = untilMs - nowMs;
        const remainingMinutes = Math.max(1, Math.ceil(diffMs / 60000));
        const resumeDate = new Date(untilMs);
        const hours = resumeDate.getHours().toString().padStart(2, '0');
        const mins = resumeDate.getMinutes().toString().padStart(2, '0');
        return {
          isPaused: true,
          isIndefinite: false,
          remainingMinutes,
          resumeAtTimeFormatted: `${hours}:${mins}`
        };
      }
      // Timed pause expired -> server-evaluated auto-resume!
      return { isPaused: false, isIndefinite: false, remainingMinutes: 0, resumeAtTimeFormatted: '' };
    }
  }
  if (outlet.acceptingOrders === false) {
    return { isPaused: true, isIndefinite: true, remainingMinutes: 0, resumeAtTimeFormatted: '' };
  }
  return { isPaused: false, isIndefinite: false, remainingMinutes: 0, resumeAtTimeFormatted: '' };
}

export default function MerchantPauseControl({
  outlet,
  canManageOrders = true,
  onSetPause,
  onPauseChanged
}: MerchantPauseControlProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | 'indefinite'>(30);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  // Tick every 10 seconds to update remaining time and trigger automatic resume
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const pauseStatus = isOutletPaused(outlet, nowMs);

  const getPauseExecutor = () => {
    return onSetPause || (async (args: Parameters<NonNullable<MerchantPauseControlProps['onSetPause']>>[0]) => {
      const helper = await import('../data/firestoreHelper');
      return helper.setMerchantPause(args);
    });
  };

  const handleResumeNow = async () => {
    if (busy || !canManageOrders) return;
    setBusy(true);
    setError('');
    try {
      const executeSetPause = getPauseExecutor();
      await executeSetPause({
        merchantId: outlet.id,
        merchantType: outlet.merchantType,
        durationMinutes: 0
      });
      onPauseChanged?.({
        pausedUntil: null,
        acceptingOrders: true,
        pausedReason: null
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume orders.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPause = async () => {
    if (busy || !canManageOrders) return;
    setBusy(true);
    setError('');
    try {
      const executeSetPause = getPauseExecutor();
      const res = await executeSetPause({
        merchantId: outlet.id,
        merchantType: outlet.merchantType,
        durationMinutes: selectedDuration,
        reason: reason.trim() || undefined
      });
      onPauseChanged?.({
        pausedUntil: res.pausedUntil,
        acceptingOrders: res.acceptingOrders,
        pausedReason: res.pausedReason
      });
      setDialogOpen(false);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pause orders.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="merchant-pause-control"
      className="merchant-pause-banner rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 shadow-sm text-slate-100 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        {pauseStatus.isPaused ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <PauseCircle className="h-6 w-6" />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <PlayCircle className="h-6 w-6" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            {pauseStatus.isPaused ? (
              <span
                data-testid="merchant-paused-badge"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Orders Paused
              </span>
            ) : (
              <span
                data-testid="merchant-status-open"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/30"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Accepting Orders
              </span>
            )}

            {pauseStatus.isPaused && !pauseStatus.isIndefinite && (
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Until {pauseStatus.resumeAtTimeFormatted} ({pauseStatus.remainingMinutes}m left)
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-400">
            {pauseStatus.isPaused
              ? pauseStatus.isIndefinite
                ? 'Orders are paused until you manually resume. New checkout orders are blocked.'
                : 'Auto-resumes at scheduled time. New checkout orders are blocked during pause.'
              : 'Customers can place orders during published business hours.'}
            {outlet.pausedReason && (
              <span className="ml-1 text-slate-400 italic">
                (Note: {outlet.pausedReason})
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {pauseStatus.isPaused ? (
          <>
            <button
              type="button"
              data-testid="merchant-resume-btn"
              disabled={busy || !canManageOrders}
              onClick={handleResumeNow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <PlayCircle className="w-4 h-4" />
              {busy ? 'Resuming…' : 'Resume orders now'}
            </button>
            <button
              type="button"
              data-testid="merchant-change-pause-btn"
              disabled={busy || !canManageOrders}
              onClick={() => { setError(''); setDialogOpen(true); }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Adjust
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="merchant-pause-btn"
            disabled={busy || !canManageOrders}
            onClick={() => { setError(''); setDialogOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/90 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <PauseCircle className="w-4 h-4" />
            Pause orders
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="w-full mt-1 text-xs text-rose-400 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Pause Duration Modal */}
      {dialogOpen && (
        <div
          data-testid="merchant-pause-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-400" />
                <h3 id="pause-dialog-title" className="text-sm font-bold text-white">
                  Pause incoming orders
                </h3>
              </div>
              <button
                type="button"
                data-testid="cancel-pause-btn"
                onClick={() => setDialogOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Temporarily block new orders while you clear a backlog. Timed pauses automatically resume when the countdown ends.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pause Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAUSE_DURATIONS.map(option => (
                  <button
                    key={String(option.value)}
                    type="button"
                    data-testid={`pause-duration-${option.value}`}
                    onClick={() => setSelectedDuration(option.value)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      selectedDuration === option.value
                        ? 'border-amber-500 bg-amber-500/10 text-amber-200 ring-1 ring-amber-500'
                        : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xs font-bold">{option.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pause-reason-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Reason (Optional)
              </label>
              <input
                id="pause-reason-input"
                data-testid="pause-reason-input"
                type="text"
                maxLength={120}
                placeholder="e.g. Kitchen rush, restocking ingredients"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-rose-400">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-pause-btn"
                disabled={busy}
                onClick={handleConfirmPause}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {busy ? 'Pausing…' : 'Confirm pause'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
