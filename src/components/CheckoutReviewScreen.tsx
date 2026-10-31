import { useState } from 'react';
import {
  ArrowLeft, MapPin, ShieldCheck, ShoppingBag, CreditCard, Wallet, Banknote,
  CheckCircle2, AlertCircle, HeartHandshake, Tag, Check, Sparkles
} from 'lucide-react';
import type { PriceBreakdown } from '../types';
import CancellationPolicyNotice from './CancellationPolicyNotice';

export type PaymentMethodOption = 'online' | 'wallet' | 'cod';

export default function CheckoutReviewScreen({
  service,
  partner,
  address,
  notes,
  lines,
  wallet,
  busy,
  ready,
  error,
  breakdown,
  quoteBusy,
  quoteError,
  paymentMethod = wallet ? 'wallet' : 'online',
  walletBalance = 0,
  contactlessDelivery = false,
  onBack,
  onAddress,
  onConfirm,
  onSelectPaymentMethod,
  onContactlessChange,
  onTipSelected,
  onInstructionsSelected,
}: {
  service: 'food' | 'grocery';
  partner: string;
  address: string;
  notes: string;
  lines: { id: string; name: string; quantity: number; price: number; option?: string; addOns?: string[] }[];
  subtotal?: number;
  discount?: number;
  wallet: boolean;
  busy: boolean;
  ready: boolean;
  error?: string;
  breakdown?: PriceBreakdown;
  quoteBusy: boolean;
  quoteError?: string;
  paymentMethod?: PaymentMethodOption;
  walletBalance?: number;
  contactlessDelivery?: boolean;
  onBack: () => void;
  onAddress: () => void;
  onConfirm: () => void;
  onSelectPaymentMethod?: (method: PaymentMethodOption) => void;
  onContactlessChange?: (requested: boolean) => void;
  onTipSelected?: (tipRupees: number) => void;
  onInstructionsSelected?: (instructions: string) => void;
}) {
  // Real-world Tipping State (₹20, ₹30, ₹50, Custom)
  const [tipRupees, setTipRupees] = useState<number>(0);
  const [customTipActive, setCustomTipActive] = useState<boolean>(false);
  const [customTipValue, setCustomTipValue] = useState<string>('');

  // Real-world Delivery Instruction Quick Pills
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const instructionPills = [
    'Leave at door',
    'Do not ring bell',
    'Avoid calling',
    'Leave with guard',
    'Pet in house 🐕',
  ];

  // Real-world Promo Code Engine
  const [promoInput, setPromoInput] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoDiscountRupees, setPromoDiscountRupees] = useState<number>(0);
  const [promoFeedback, setPromoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleTogglePill = (pill: string) => {
    const updated = selectedPills.includes(pill)
      ? selectedPills.filter(p => p !== pill)
      : [...selectedPills, pill];
    setSelectedPills(updated);
    onInstructionsSelected?.(updated.join(', '));
  };

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    const baseCents = breakdown?.itemCents ?? 0;
    const baseRupees = baseCents / 100;

    if (code === 'ALLGO50') {
      if (baseRupees < 199) {
        setPromoFeedback({ type: 'error', message: 'ALLGO50 requires a minimum order of ₹199.' });
        return;
      }
      const disc = Math.min(Math.round(baseRupees * 0.5), 100);
      setAppliedPromo(code);
      setPromoDiscountRupees(disc);
      setPromoFeedback({ type: 'success', message: `ALLGO50 applied! Saved ₹${disc.toFixed(2)}` });
    } else if (code === 'WELCOME100') {
      if (baseRupees < 299) {
        setPromoFeedback({ type: 'error', message: 'WELCOME100 requires a minimum order of ₹299.' });
        return;
      }
      const disc = Math.min(100, baseRupees);
      setAppliedPromo(code);
      setPromoDiscountRupees(disc);
      setPromoFeedback({ type: 'success', message: `WELCOME100 applied! Saved ₹${disc.toFixed(2)}` });
    } else if (code === 'FREEDEL') {
      const disc = 40;
      setAppliedPromo(code);
      setPromoDiscountRupees(disc);
      setPromoFeedback({ type: 'success', message: 'FREEDEL applied! Free Delivery (₹40 saved).' });
    } else {
      setPromoFeedback({ type: 'error', message: `Coupon "${code}" is not valid.` });
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscountRupees(0);
    setPromoFeedback(null);
    setPromoInput('');
  };

  const handleSelectTip = (amount: number) => {
    setCustomTipActive(false);
    setTipRupees(amount);
    onTipSelected?.(amount);
  };

  const handleCustomTipChange = (value: string) => {
    setCustomTipValue(value);
    const num = Math.max(0, parseInt(value || '0', 10));
    setTipRupees(num);
    onTipSelected?.(num);
  };

  const currency = (cents: number) =>
    `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const baseTotalCents = breakdown?.totalCents ?? 0;
  const tipCents = tipRupees * 100;
  const promoDiscountCents = promoDiscountRupees * 100;
  const totalCents = Math.max(0, baseTotalCents + tipCents - promoDiscountCents);
  const totalRupees = totalCents / 100;

  const isCodAllowed = totalCents <= 200000; // COD limit: ₹2,000 (200,000 cents)
  const isWalletSufficient = walletBalance >= totalRupees;

  const handleMethodSelect = (method: PaymentMethodOption) => {
    if (busy) return;
    if (method === 'cod' && !isCodAllowed) return;
    if (onSelectPaymentMethod) {
      onSelectPaymentMethod(method);
    }
  };

  const isActionDisabled =
    busy ||
    !ready ||
    quoteBusy ||
    !!quoteError ||
    !breakdown ||
    !address.trim() ||
    !lines.length ||
    (paymentMethod === 'cod' && !isCodAllowed) ||
    (paymentMethod === 'wallet' && !isWalletSufficient);

  const getActionLabel = () => {
    if (busy) {
      if (paymentMethod === 'cod') return 'Placing order…';
      if (paymentMethod === 'wallet') return 'Deducting wallet…';
      return 'Opening checkout…';
    }
    if (/busy|capacity/i.test(quoteError || '')) return 'Busy, not accepting right now';
    if (!breakdown) return 'Checking pricing…';
    if (paymentMethod === 'cod') {
      return `Place COD Order · ${currency(totalCents)}`;
    }
    if (paymentMethod === 'wallet') {
      return `Pay ${currency(totalCents)} with Wallet`;
    }
    return `Pay ${currency(totalCents)} securely`;
  };

  return (
    <section
      className="checkout-review safe-area-top safe-area-bottom"
      role="dialog"
      aria-modal="true"
      aria-label="Review delivery before payment"
      data-screen="universal-checkout"
    >
      <header className="allgo-page-heading">
        <button onClick={onBack} disabled={busy} aria-label="Back to cart">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p>{service === 'food' ? 'FOOD DELIVERY' : 'GROCERY DELIVERY'}</p>
          <h1>One last look.</h1>
        </div>
      </header>

      <p className="allgo-muted">Check your items, delivery address and payment choice.</p>

      {/* Partner & Items */}
      <article className="allgo-card">
        <div className="allgo-row">
          <ShoppingBag size={19} />
          <h2>{partner || 'Partner details unavailable'}</h2>
        </div>
        {!partner && (
          <p className="allgo-muted">
            These saved items need catalog verification. Return to the catalog if this partner is no longer listed.
          </p>
        )}
        {lines.map((line) => (
          <div className="service-bill-line" key={line.id}>
            <span>
              {line.quantity} × {line.name}
              {line.option && <small>{line.option}</small>}
              {line.addOns?.map(addOn => <small key={addOn}>+ {addOn}</small>)}
            </span>
            <strong>{currency(Math.round(line.price * line.quantity * 100))}</strong>
          </div>
        ))}
      </article>

      {/* Delivery Address & Quick Instructions Pills */}
      <article className="allgo-card">
        <div className="allgo-row">
          <MapPin size={19} />
          <h2>Deliver to</h2>
          <button className="allgo-text" disabled={busy} onClick={onAddress}>
            Edit
          </button>
        </div>
        <p className="font-semibold text-slate-800">{address || 'Choose a delivery address'}</p>

        {/* Quick Delivery Instructions Pills */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-600 mb-2">Delivery Instructions</p>
          <div className="flex flex-wrap gap-1.5">
            {instructionPills.map(pill => {
              const active = selectedPills.includes(pill);
              return (
                <button
                  type="button"
                  key={pill}
                  disabled={busy}
                  onClick={() => handleTogglePill(pill)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    active
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pill} {active && '✓'}
                </button>
              );
            })}
          </div>
        </div>

        {notes && (
          <>
            <h2 className="mt-3">{service === 'grocery' ? 'Grocery delivery instructions' : 'Your instructions'}</h2>
            <p className="whitespace-pre-wrap text-xs text-slate-600">{notes}</p>
          </>
        )}
        {service === 'grocery' && <div className="checkout-grocery-delivery-options">
            <label>
              <input
                type="checkbox"
                checked={contactlessDelivery}
                disabled={busy}
                onChange={event => onContactlessChange?.(event.target.checked)}
              />
              <span>
                <strong>Request contactless handoff</strong>
                <small>This is a delivery preference, not a guarantee. The partner may need to contact you.</small>
              </span>
            </label>
            <p>Scheduled delivery slots are not provided by this store in checkout.</p>
          </div>
        }
      </article>

      {/* Promo / Coupon Box */}
      <article className="allgo-card">
        <div className="allgo-row mb-2">
          <Tag size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold">Offers & Coupons</h2>
        </div>
        {!appliedPromo ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              disabled={busy}
              onChange={e => setPromoInput(e.target.value)}
              placeholder="Enter coupon (e.g. ALLGO50, WELCOME100)"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs uppercase font-bold tracking-wider"
            />
            <button
              type="button"
              disabled={busy || !promoInput.trim()}
              onClick={handleApplyPromo}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600" />
              <div>
                <strong className="text-xs text-emerald-900 font-black">{appliedPromo} applied</strong>
                <p className="text-[10px] text-emerald-700">₹{promoDiscountRupees.toFixed(2)} discount applied</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleRemovePromo}
              className="text-xs font-bold text-rose-600 underline"
            >
              Remove
            </button>
          </div>
        )}
        {promoFeedback && (
          <p className={`mt-2 text-[11px] font-medium ${promoFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
            {promoFeedback.message}
          </p>
        )}
      </article>

      {/* Driver Tipping Selector */}
      <article className="allgo-card">
        <div className="allgo-row mb-1">
          <HeartHandshake size={18} className="text-rose-500" />
          <h2 className="text-sm font-bold">Say thanks with a tip</h2>
        </div>
        <p className="text-[10px] text-slate-500 mb-2.5">
          100% of your tip goes directly to your delivery partner.
        </p>
        <div className="flex items-center gap-2">
          {[0, 20, 30, 50].map(amt => (
            <button
              type="button"
              key={amt}
              disabled={busy}
              onClick={() => handleSelectTip(amt)}
              className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                tipRupees === amt && !customTipActive
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {amt === 0 ? 'None' : `₹${amt}`}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => setCustomTipActive(true)}
            className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              customTipActive
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Custom
          </button>
        </div>
        {customTipActive && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">₹</span>
            <input
              type="number"
              min={1}
              value={customTipValue}
              onChange={e => handleCustomTipChange(e.target.value)}
              placeholder="Enter amount"
              className="w-32 rounded-lg border border-slate-200 p-1.5 text-xs font-bold"
            />
          </div>
        )}
      </article>

      {/* Price Breakdown */}
      {breakdown && (
        <article className="allgo-card">
          <details className="checkout-bill-details" open>
            <summary>
              <span>
                <CreditCard size={19} aria-hidden="true" />Bill breakdown
              </span>
              <strong>Total · {currency(totalCents)}</strong>
            </summary>
            {([
              ['Items', breakdown.itemCents],
              ['Delivery', breakdown.deliveryCents],
              ['Packaging', breakdown.packagingCents],
              ['Platform fee', breakdown.platformCents],
              ['Tax', breakdown.taxCents],
            ] as [string, number][]).map(([label, cents]) => (
              <div className="service-bill-line" key={label}>
                <span>{label}</span>
                <strong>{currency(cents)}</strong>
              </div>
            ))}
            {tipRupees > 0 && (
              <div className="service-bill-line">
                <span>Driver tip (100% to partner)</span>
                <strong className="text-indigo-700">+{currency(tipCents)}</strong>
              </div>
            )}
            {(breakdown.discountCents > 0 || promoDiscountCents > 0) && (
              <div className="service-bill-line">
                <span>Offer discount</span>
                <strong className="text-emerald-600">
                  −{currency(breakdown.discountCents + promoDiscountCents)}
                </strong>
              </div>
            )}
            <div className="service-bill-line border-t pt-2 font-black text-slate-900">
              <strong>Total payable</strong>
              <strong className="text-base text-indigo-700">{currency(totalCents)}</strong>
            </div>
          </details>
        </article>
      )}

      <CancellationPolicyNotice />

      {/* Payment Method Selector */}
      <article className="allgo-card">
        <div className="allgo-row mb-3">
          <CreditCard size={19} />
          <h2>Payment method</h2>
        </div>

        <div className="space-y-2">
          {/* 1. Online Payment */}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleMethodSelect('online')}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
              paymentMethod === 'online'
                ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  paymentMethod === 'online' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CreditCard size={18} />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">Online Payment</p>
                <p className="text-[10px] text-slate-500">Instant UPI, Cards & NetBanking via Razorpay</p>
              </div>
            </div>
            {paymentMethod === 'online' && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
          </button>

          {/* 2. AllGo Wallet */}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleMethodSelect('wallet')}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
              paymentMethod === 'wallet'
                ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  paymentMethod === 'wallet' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Wallet size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-xs text-slate-900">AllGo Wallet</p>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                    Balance: ₹{walletBalance.toFixed(2)}
                  </span>
                </div>
                {!isWalletSufficient && breakdown && (
                  <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                    Insufficient balance (Need ₹{(totalRupees - walletBalance).toFixed(2)} more)
                  </p>
                )}
                {isWalletSufficient && <p className="text-[10px] text-slate-500">Fast 1-tap checkout</p>}
              </div>
            </div>
            {paymentMethod === 'wallet' && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
          </button>

          {/* 3. Cash on Delivery (COD) */}
          <button
            type="button"
            disabled={busy || !isCodAllowed}
            onClick={() => handleMethodSelect('cod')}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
              !isCodAllowed
                ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                : paymentMethod === 'cod'
                ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  paymentMethod === 'cod' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Banknote size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-xs text-slate-900">Cash on Delivery (COD)</p>
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    Doorstep Cash
                  </span>
                </div>
                {!isCodAllowed && (
                  <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                    Available only for orders up to ₹2,000
                  </p>
                )}
                {isCodAllowed && (
                  <p className="text-[10px] text-slate-500">Pay cash upon delivery. Exact change appreciated.</p>
                )}
              </div>
            </div>
            {paymentMethod === 'cod' && isCodAllowed && (
              <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />
            )}
          </button>
        </div>

        {paymentMethod === 'cod' && isCodAllowed && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200/70">
            <AlertCircle size={15} className="text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Please keep <strong>₹{totalRupees.toFixed(2)}</strong> ready in cash. You will need to share the delivery
              OTP upon receiving your items.
            </p>
          </div>
        )}
      </article>

      <div className="service-assurance">
        <ShieldCheck size={22} />
        <p>Coverage, current prices and availability are verified by AllGo before dispatch.</p>
      </div>

      {/busy|capacity/i.test(quoteError || '') && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          Busy, not accepting right now
        </p>
      )}
      {(error || (quoteError && !/busy|capacity/i.test(quoteError))) && (
        <p role="alert" className="allgo-feedback error">
          {error || quoteError}
        </p>
      )}

      {(quoteBusy || !ready) && !error && !quoteError && (
        <p role="status" className="allgo-muted">
          Checking delivery coverage and charges…
        </p>
      )}

      <div className="checkout-action-dock">
        <button
          className="allgo-action"
          disabled={isActionDisabled}
          onClick={onConfirm}
        >
          {getActionLabel()}
        </button>
      </div>
    </section>
  );
}
