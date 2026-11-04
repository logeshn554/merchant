import type { SellerVertical } from '../domain/merchant';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { listMerchantOffers, saveMerchantOffer, type MerchantOffer } from '../data/firestoreHelper';

function amountToCents(value: string) {
  const amount = Number(value);
  return value.trim() && Number.isFinite(amount) && amount > 0 && amount <= 100000 && Math.round(amount * 100) === amount * 100 ? Math.round(amount * 100) : null;
}

export default function MerchantOffersPanel({ merchantId, merchantType }: { merchantId: string; merchantType: SellerVertical }) {
  const [offers, setOffers] = useState<MerchantOffer[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [code, setCode] = useState(''), [kind, setKind] = useState<'fixed' | 'percent'>('fixed'), [discount, setDiscount] = useState(''), [maxDiscount, setMaxDiscount] = useState(''), [minimum, setMinimum] = useState(''), [redemptionLimit, setRedemptionLimit] = useState(''), [expiresAt, setExpiresAt] = useState('');
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setOffers((await listMerchantOffers({ merchantId, merchantType })).offers); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Merchant offers could not be loaded.'); }
    finally { setLoading(false); }
  }, [merchantId, merchantType]);
  useEffect(() => { void reload(); }, [reload]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    const minCents = amountToCents(minimum), discountCents = kind === 'fixed' ? amountToCents(discount) : null, maxCents = kind === 'percent' ? amountToCents(maxDiscount) : null;
    const expiry = new Date(expiresAt);
    const limit = Number(redemptionLimit);
    if (!code.trim() || !minCents || (kind === 'fixed' ? !discountCents : !maxCents || !Number.isInteger(Number(discount) * 100) || Number(discount) < 0.01 || Number(discount) > 100) || !Number.isInteger(limit) || limit < 1 || limit > 100000 || !Number.isFinite(expiry.getTime())) { setError('Check the offer code, discount, minimum basket, redemption cap and expiry.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await saveMerchantOffer({ merchantId, merchantType, code: code.trim().toUpperCase(), requestId: crypto.randomUUID(), expectedVersion: 0, enabled: true, type: kind, ...(discountCents !== null ? { discountCents } : { percentBps: Math.round(Number(discount) * 100), maxDiscountCents: maxCents! }), minAmountCents: minCents, maxRedemptions: limit, expiresAt: expiry.toISOString() });
      setMessage(`Offer ${result.code} is live for ${merchantType === 'restaurant' ? 'food' : 'grocery'} orders.`); setCode(''); setDiscount(''); setMaxDiscount(''); setMinimum(''); setRedemptionLimit(''); setExpiresAt(''); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The offer could not be saved.'); }
    finally { setBusy(false); }
  };
  const disable = async (offer: MerchantOffer) => {
    if (busy || !offer.enabled || !offer.expiresAt) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await saveMerchantOffer({ merchantId, merchantType, code: offer.code, requestId: crypto.randomUUID(), expectedVersion: offer.version, enabled: false, type: offer.type, ...(offer.type === 'fixed' ? { discountCents: offer.discountCents } : { percentBps: offer.percentBps, maxDiscountCents: offer.maxDiscountCents }), minAmountCents: offer.minAmountCents, maxRedemptions: offer.maxRedemptions, expiresAt: offer.expiresAt });
      setMessage(`Offer ${offer.code} disabled.`); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The offer could not be disabled.'); }
    finally { setBusy(false); }
  };
  const money = (cents: number) => `₹${(cents / 100).toFixed(2)}`;
  return <section data-panel="offers" data-screen="merchant-offers" className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-100" aria-label="Merchant offers and discounts">
    <div><h2 className="text-base font-bold">Offers and discounts</h2><p className="mt-1 text-xs text-slate-300">Create a code for this store. Discounts apply to item value and reduce seller earnings under your accepted settlement terms. Delivery fees are not discounted. Each customer can redeem a code once.</p></div>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => void submit(event)}>
      <label className="text-xs font-semibold">Offer code<input required maxLength={40} pattern="[A-Za-z0-9_-]{3,40}" value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="WEEKEND10" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"/></label>
      <label className="text-xs font-semibold">Discount type<select value={kind} onChange={event => setKind(event.target.value as 'fixed' | 'percent')} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"><option value="fixed">Fixed amount</option><option value="percent">Percentage</option></select></label>
      <label className="text-xs font-semibold">{kind === 'fixed' ? 'Discount amount (₹)' : 'Discount percent'}<input required type="number" min="0.01" max={kind === 'fixed' ? '100000' : '100'} step="0.01" value={discount} onChange={event => setDiscount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"/></label>
      {kind === 'percent' && <label className="text-xs font-semibold">Maximum discount (₹)<input required type="number" min="0.01" max="100000" step="0.01" value={maxDiscount} onChange={event => setMaxDiscount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"/></label>}
      <label className="text-xs font-semibold">Minimum item subtotal (₹)<input required type="number" min="1" max="100000" step="0.01" value={minimum} onChange={event => setMinimum(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"/></label>
      <label className="text-xs font-semibold">Maximum total redemptions<input required type="number" min="1" max="100000" step="1" value={redemptionLimit} onChange={event => setRedemptionLimit(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"/></label>
      <label className="text-xs font-semibold">Expiry date and time<input required type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3"/></label>
      <button disabled={busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold disabled:opacity-50">{busy ? 'Saving offer…' : 'Create offer'}</button>
    </form>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
    <div className="space-y-2"><h3 className="text-sm font-bold">Offers for this store</h3>{loading ? <p role="status" className="text-xs text-slate-300">Loading offers…</p> : !offers.length ? <p className="text-xs text-slate-300">No merchant offers yet.</p> : offers.map(offer => <article key={offer.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 p-3 text-xs"><div><strong>{offer.code}</strong><p className="mt-1 text-slate-300">{offer.type === 'fixed' ? `${money(offer.discountCents || 0)} off` : `${((offer.percentBps || 0) / 100).toFixed(2)}% off · up to ${money(offer.maxDiscountCents || 0)}`} · minimum {money(offer.minAmountCents)} · {offer.redeemedCount}/{offer.maxRedemptions} used</p><p className="text-slate-400">{offer.enabled ? `Expires ${offer.expiresAt ? new Date(offer.expiresAt).toLocaleString() : 'unknown'}` : 'Disabled'}</p></div>{offer.enabled && <button type="button" disabled={busy} onClick={() => void disable(offer)} className="min-h-11 rounded-lg border border-slate-600 px-3 font-bold disabled:opacity-50">Disable</button>}</article>)}</div>
  </section>;
}
