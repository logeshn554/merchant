import { useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { Booking } from '../types';
import { canEditMerchantPreparation } from './merchantPreparationPolicy';

export default function MerchantPreparationEditor({ booking }: { booking: Booking }) {
  const [minutes, setMinutes] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const pending = useRef<{ requestId: string; minutes: number; reason: string } | undefined>(undefined);
  if (!canEditMerchantPreparation(booking)) return null;

  const isInitial = !booking.preparation;
  const PREP_CHIPS = [10, 15, 20, 30, 45];

  return <form className="space-y-2 border-t border-slate-600 pt-3 text-xs" data-screen="merchant-prep-editor" onSubmit={event => {
    event.preventDefault(); if (busy) return;
    const effectiveReason = reason.trim() || (isInitial ? 'Initial preparation estimate' : '');
    const data = { minutes: Number(minutes), reason: effectiveReason };
    if (!pending.current || pending.current.minutes !== data.minutes || pending.current.reason !== data.reason) pending.current = { ...data, requestId: crypto.randomUUID() };
    setBusy(true); setMessage('');
    void httpsCallable(functions, 'updateMerchantPreparation')({ bookingId: booking.bookingId, ...pending.current })
      .then(() => { pending.current = undefined; setMessage('Preparation estimate published.'); })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Update failed. Retry with the same details.'))
      .finally(() => setBusy(false));
  }}>
    {booking.preparation && <p>Current ready estimate: {new Date(booking.preparation.expectedReadyAt).toLocaleString()}</p>}
    <div>
      <label className="block mb-1">Ready in minutes</label>
      <div className="flex gap-1.5 mb-1.5" role="group" aria-label="Preset preparation minutes">
        {PREP_CHIPS.map(m => (
          <button
            key={m}
            type="button"
            data-testid={`prep-chip-${m}`}
            disabled={busy}
            onClick={() => setMinutes(String(m))}
            className={`px-2 py-1 rounded text-xs font-semibold ${
              Number(minutes) === m ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {m}m
          </button>
        ))}
      </div>
      <input required type="number" min="1" max="240" step="1" disabled={busy} value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="Enter or select minutes" className="block w-full rounded border bg-white p-2 text-slate-900" />
    </div>
    <label className="block">
      Customer-visible reason {isInitial ? '(optional for initial estimate)' : '(required)'}
      <input required={!isInitial} maxLength={300} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} placeholder={isInitial ? 'e.g. Busy dinner rush (optional)' : 'Required for timing changes'} className="block w-full rounded border bg-white p-2 text-slate-900" />
    </label>
    <button disabled={busy} className="rounded bg-indigo-600 p-3 text-white font-bold">{busy ? 'Publishing…' : 'Publish preparation estimate'}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
