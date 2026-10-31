import React, { useState } from 'react';
import { Phone, Shield, X, Loader2 } from 'lucide-react';
import { initiateMaskedCall, type MaskedCallSession } from '../data/firestoreHelper';

interface MaskedCallButtonProps {
  bookingId: string;
  recipientRole: 'customer' | 'driver' | 'merchant';
  recipientName?: string;
  className?: string;
  variant?: 'sm' | 'md';
}

export default function MaskedCallButton({
  bookingId,
  recipientRole,
  recipientName,
  className = '',
  variant = 'sm'
}: MaskedCallButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<MaskedCallSession | null>(null);
  const [showModal, setShowModal] = useState(false);

  const roleLabel = recipientRole === 'driver'
    ? 'Delivery Partner'
    : recipientRole === 'merchant'
    ? 'Store Partner'
    : 'Customer';

  const displayName = recipientName ? `${recipientName} (${roleLabel})` : roleLabel;

  const handleInitiate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await initiateMaskedCall({ bookingId, recipientRole });
      setSession(res);
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initiate masked call.');
      setShowModal(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInitiate}
        disabled={busy}
        data-testid={`masked-call-btn-${recipientRole}`}
        aria-label={`Privacy-protected call to ${displayName}`}
        className={`inline-flex items-center gap-1.5 font-bold rounded-lg transition-colors ${
          variant === 'sm'
            ? 'px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            : 'px-3.5 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white'
        } ${className}`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5 text-emerald-400" />}
        <span>Call {roleLabel}</span>
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Privacy-protected calling modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Privacy-Protected Call</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowModal(false); setSession(null); setError(''); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error ? (
              <div className="space-y-3">
                <p role="alert" className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 rounded-lg p-3">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(''); }}
                  className="w-full py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200"
                >
                  Close
                </button>
              </div>
            ) : session ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-300">
                  Connecting to <strong className="text-white">{displayName}</strong> via AllGo Virtual Number Proxy.
                </p>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    AllGo Virtual Proxy Number
                  </span>
                  <span className="font-mono text-base font-black text-emerald-400">
                    {session.virtualNumber}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Valid for active order · Your real number remains private
                  </span>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <a
                    href={`tel:${session.virtualNumber}`}
                    data-testid="start-masked-call-link"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-center text-white rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Dial Virtual Number</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setSession(null); }}
                    className="w-full py-2 text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
