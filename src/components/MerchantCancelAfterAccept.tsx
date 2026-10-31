import React, { useState } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import { merchantCancelAfterAccept } from '../data/firestoreHelper';

interface MerchantCancelAfterAcceptProps {
  bookingId: string;
  cashOnDelivery?: boolean;
  onSuccess?: () => void;
}

export default function MerchantCancelAfterAccept({ bookingId, cashOnDelivery = false, onSuccess }: MerchantCancelAfterAcceptProps) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleCancel = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for cancelling this order.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await merchantCancelAfterAccept(bookingId, reason.trim());
      setMessage(cashOnDelivery
        ? 'Order cancelled. Cash payment obligation was cancelled.'
        : 'Order cancelled. Full customer refund has been initiated.');
      setExpanded(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel order. Please retry or contact support.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-2 text-xs" data-testid={`merchant-cancel-after-accept-${bookingId}`}>
      {!expanded ? (
        <button
          type="button"
          onClick={() => { setExpanded(true); setError(''); }}
          disabled={busy}
          data-testid="merchant-cancel-after-accept-btn"
          className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] flex items-center gap-1 transition"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Cancel order (cannot fulfill)</span>
        </button>
      ) : (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-3 space-y-2 mt-1">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-200">Cancel Accepted Order</p>
              <p className="text-[11px] text-slate-300">
                Cancelling an accepted order initiates a full customer refund and will impact your store reliability scorecard.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1">
              Mandatory cancellation reason
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Kitchen equipment failure, major power outage..."
              maxLength={500}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              rows={2}
              aria-label="Cancellation reason"
            />
          </div>

          {error && <p role="alert" className="text-[11px] text-rose-400 font-semibold">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => { setExpanded(false); setError(''); }}
              disabled={busy}
              className="px-2.5 py-1 text-slate-400 hover:text-white text-xs font-semibold rounded-lg"
            >
              Keep Order
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy || !reason.trim()}
              data-testid="confirm-cancel-after-accept-btn"
              className="px-3 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
            >
              {busy ? 'Processing...' : 'Confirm Cancellation & Refund'}
            </button>
          </div>
        </div>
      )}
      {message && <p role="status" className="text-[11px] text-emerald-400 mt-1 font-semibold">{message}</p>}
    </div>
  );
}
