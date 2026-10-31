import React, { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { merchantRemoveOrderItem } from '../data/firestoreHelper';

interface MerchantItemRemoverProps {
  bookingId: string;
  itemIndex: number;
  item: {
    name: string;
    price: number;
    quantity?: number;
    removed?: boolean;
    removedReason?: string;
  };
  canRemove: boolean;
  onSuccess?: () => void;
}

export default function MerchantItemRemover({
  bookingId,
  itemIndex,
  item,
  canRemove,
  onSuccess
}: MerchantItemRemoverProps) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('Item out of stock');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (item.removed) {
    return (
      <span className="text-[10px] text-rose-400 font-medium block">
        Removed: {item.removedReason || 'Unavailable'} (Refunded)
      </span>
    );
  }

  if (!canRemove) return null;

  const qty = item.quantity || 1;
  const refundAmount = Math.round((item.price * qty) * 100) / 100;

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await merchantRemoveOrderItem(bookingId, itemIndex, reason.trim() || 'Item out of stock');
      setExpanded(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-block ml-2" data-testid={`item-remover-${itemIndex}`}>
      {!expanded ? (
        <button
          type="button"
          onClick={() => { setExpanded(true); setError(''); }}
          data-testid={`remove-item-${itemIndex}`}
          className="text-slate-400 hover:text-rose-400 text-[10px] underline font-semibold transition"
          aria-label={`Remove ${item.name}`}
        >
          Remove item
        </button>
      ) : (
        <div className="mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 space-y-1.5 text-xs text-slate-200">
          <p className="font-bold text-amber-300 text-[11px]">
            Remove {item.name}?
          </p>
          <p className="text-[10px] text-slate-400">
            Automated partial refund of <strong className="text-emerald-400">₹{refundAmount}</strong> will be refunded to customer.
          </p>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (e.g. out of stock)"
            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500"
            aria-label="Item removal reason"
          />
          {error && <p role="alert" className="text-[10px] text-rose-400">{error}</p>}
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => { setExpanded(false); setError(''); }}
              disabled={busy}
              className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              data-testid={`confirm-remove-item-${itemIndex}`}
              className="px-2.5 py-0.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-[10px] rounded transition"
            >
              {busy ? 'Removing...' : 'Confirm Partial Refund'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
