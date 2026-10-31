import React, { useState } from 'react';
import { AlertTriangle, PhoneCall, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { triggerDriverEmergencySos } from '../data/firestoreHelper';

interface DriverEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBookingId?: string | null;
  currentLat?: number;
  currentLng?: number;
}

export default function DriverEmergencyModal({
  isOpen,
  onClose,
  activeBookingId,
  currentLat,
  currentLng,
}: DriverEmergencyModalProps) {
  const [reason, setReason] = useState<'accident' | 'harassment' | 'medical' | 'vehicle_breakdown' | 'robbery' | 'other'>('accident');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [transmittedId, setTransmittedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleTransmit = async () => {
    try {
      setBusy(true);
      setError('');
      const res = await triggerDriverEmergencySos({
        bookingId: activeBookingId || undefined,
        lat: currentLat,
        lng: currentLng,
        reason,
        notes: notes.trim() || undefined,
      });
      setTransmittedId(res.incidentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transmit emergency alert. Please call 112 directly.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fadeIn" data-screen="driver-emergency-modal">
      <div className="w-full max-w-sm rounded-2xl border-2 border-rose-500 bg-slate-900 p-5 text-white shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-500/30 pb-3">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-6 h-6 animate-pulse text-rose-500" />
            <h3 className="text-base font-black uppercase tracking-wide text-rose-100">Emergency SOS</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {transmittedId ? (
          <div className="space-y-4 text-center py-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Emergency Alert Transmitted</h4>
              <p className="mt-1 text-xs text-slate-300">
                Operations Hub has been alerted with your live GPS coordinates. Keep your phone accessible.
              </p>
              <p className="mt-2 text-[10px] font-mono text-slate-400">Incident ID: {transmittedId}</p>
            </div>
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-rose-600 hover:bg-rose-700 py-3 text-sm font-black text-white"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Dial 112 Police / Medical</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Dismiss Notice
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              Transmits an instant high-priority SOS alert with your GPS location to the AllGo operations response team.
            </p>

            {currentLat != null && currentLng != null && (
              <div className="rounded-lg bg-slate-800/80 p-2 text-[11px] text-slate-300 flex items-center justify-between">
                <span>📍 Live Coordinates:</span>
                <span className="font-mono font-semibold text-rose-300">{currentLat.toFixed(5)}, {currentLng.toFixed(5)}</span>
              </div>
            )}

            {activeBookingId && (
              <div className="rounded-lg bg-slate-800/80 p-2 text-[11px] text-slate-300 flex items-center justify-between">
                <span>Active Booking:</span>
                <span className="font-mono text-slate-200">{activeBookingId}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-200 block mb-1">Select Incident Type:</label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value as any)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs font-semibold text-white focus:outline-none focus:border-rose-500"
              >
                <option value="accident">Accident / Collision</option>
                <option value="harassment">Physical Threat / Harassment</option>
                <option value="medical">Medical Emergency</option>
                <option value="robbery">Robbery / Theft</option>
                <option value="vehicle_breakdown">Vehicle Breakdown in Unsafe Area</option>
                <option value="other">Other Life Safety Emergency</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-200 block mb-1">Optional Details:</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={300}
                placeholder="Brief description of situation..."
                rows={2}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-lg border border-rose-800">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTransmit()}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-3 text-xs font-black text-white shadow-lg shadow-rose-900/50 disabled:opacity-50"
              >
                {busy ? 'Transmitting…' : 'Transmit SOS Alert'}
              </button>
              <a
                href="tel:112"
                className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-3 text-xs font-bold text-white"
              >
                <PhoneCall className="w-4 h-4 text-rose-400" />
                <span>Call 112</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
