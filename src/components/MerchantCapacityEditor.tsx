import type { SellerVertical } from '../domain/merchant';
import { useEffect, useState, type FormEvent } from 'react';
import { getMerchantCapacity, setMerchantCapacity, type MerchantCapacity } from '../data/firestoreHelper';
import { Gauge, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function MerchantCapacityEditor({ id, type }: { id: string; type: SellerVertical }) {
  const [capacity, setCapacity] = useState<MerchantCapacity | null>(null);
  const [maxOrders, setMaxOrders] = useState<number>(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadCapacity = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMerchantCapacity({ merchantId: id, merchantType: type });
      setCapacity(data);
      setMaxOrders(data.maxPreparationOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load capacity settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCapacity();
  }, [id, type]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!capacity || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await setMerchantCapacity({
        merchantId: id,
        merchantType: type,
        maxPreparationOrders: maxOrders,
        expectedRevision: capacity.revision
      });
      setCapacity(updated);
      setMaxOrders(updated.maxPreparationOrders);
      setMessage(`Capacity limit updated to ${updated.maxPreparationOrders} active preparation orders.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capacity controls could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="rounded-xl border border-slate-700 bg-slate-900/60 p-4" data-section="capacity-controls" data-screen="merchant-capacity-editor">
      <summary className="font-bold cursor-pointer text-slate-100 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          <span>Preparation capacity & order scheduling</span>
        </span>
        {capacity && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {capacity.activePreparationOrders} / {capacity.maxPreparationOrders} in prep
          </span>
        )}
      </summary>

      {loading ? (
        <p className="mt-3 text-xs text-slate-400">Loading capacity settings…</p>
      ) : error && !capacity ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : capacity ? (
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active preparing</span>
              <p className="text-xl font-black text-amber-400 mt-1">{capacity.activePreparationOrders}</p>
              <span className="text-[10px] text-slate-400">Orders currently in kitchen/packing</span>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Maximum limit</span>
              <p className="text-xl font-black text-indigo-400 mt-1">{capacity.maxPreparationOrders}</p>
              <span className="text-[10px] text-slate-400">Max concurrent preparation target</span>
            </div>
          </div>

          <label className="block space-y-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-200">
              <span>Concurrent preparation limit (1 to 50 orders)</span>
              <span className="text-indigo-400 font-bold text-sm">{maxOrders}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={maxOrders}
              onChange={e => setMaxOrders(Number(e.target.value))}
              disabled={saving}
              className="w-full accent-indigo-500 cursor-pointer"
              aria-label="Concurrent preparation limit"
            />
            <p className="text-[11px] text-slate-400">
              When the number of active preparation orders reaches this limit, acceptance of new orders pauses automatically until ongoing orders are marked ready.
            </p>
          </label>

          {error && (
            <div role="alert" className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div role="status" className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || maxOrders === capacity.maxPreparationOrders}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 transition-all shadow-md"
            >
              {saving ? 'Updating…' : 'Save capacity limit'}
            </button>
          </div>
        </form>
      ) : null}
    </details>
  );
}
