import type { Booking, PriceBreakdown } from '../types';

function isValidBreakdown(value: PriceBreakdown | undefined): value is PriceBreakdown {
  if (!value) return false;
  const fields = [value.itemCents, value.deliveryCents, value.packagingCents, value.platformCents, value.taxCents, value.discountCents, value.totalCents];
  if (fields.some(amount => !Number.isSafeInteger(amount) || amount < 0)) return false;
  const total = value.itemCents + value.deliveryCents + value.packagingCents + value.platformCents + value.taxCents - value.discountCents;
  return Number.isSafeInteger(total) && total >= 0 && total === value.totalCents;
}

export default function MerchantOrderPriceBreakdown({ breakdown }: { breakdown: Booking['priceBreakdown'] }) {
  const money = (cents: number) => (cents / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  if (!isValidBreakdown(breakdown)) return <p className="text-[10px] text-slate-400">Detailed charge breakdown is unavailable for this order.</p>;
  const lines: [string, number][] = [
    ['Items', breakdown.itemCents],
    ['Delivery', breakdown.deliveryCents],
    ['Packaging', breakdown.packagingCents],
    ['Platform fee', breakdown.platformCents],
    ['Tax', breakdown.taxCents],
  ];
  return <section className="space-y-1 rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-[11px]" aria-label="Customer charge breakdown">
    <h5 className="font-bold text-slate-200">Customer bill</h5>
    {lines.map(([label, cents]) => <div key={label} className="flex justify-between gap-3 text-slate-300"><span>{label}</span><span>{money(cents)}</span></div>)}
    {breakdown.discountCents > 0 && <div className="flex justify-between gap-3 text-emerald-300"><span>Offer discount</span><span>−{money(breakdown.discountCents)}</span></div>}
    <div className="flex justify-between gap-3 border-t border-slate-700 pt-1 font-bold text-white"><span>Total charged</span><span>{money(breakdown.totalCents)}</span></div>
    <p className="pt-1 text-[10px] text-slate-400">Delivery, platform fees and tax are customer charges; seller earnings are shown in Settlements.</p>
  </section>;
}
