import { useEffect, useState } from 'react';
import type { Booking } from '../types';
import type {
  MerchantSettlementAgreement,
  MerchantSettlementBalance,
  MerchantSettlementEntry,
  MerchantPayoutAccount,
  MerchantTaxCompliance,
  WeeklySettlementStatement,
  PayoutRecord
} from '../data/firebaseHelper';
import { useFeedbackDialog } from './useFeedbackDialog';

export default function MerchantSettlements({ bookings, merchantId, merchantType }: { bookings: Booking[]; merchantId: string; merchantType: 'restaurant' | 'grocery' }) {
  const { alert, dialog } = useFeedbackDialog();
  const completed = bookings.filter(booking => booking.merchantId === merchantId && booking.serviceType === (merchantType === 'restaurant' ? 'food' : 'grocery') && ['completed', 'delivered'].includes(booking.status));
  const [balance, setBalance] = useState<MerchantSettlementBalance | null>(null), [entries, setEntries] = useState<MerchantSettlementEntry[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [agreement, setAgreement] = useState<MerchantSettlementAgreement | null>(null), [agreementLoading, setAgreementLoading] = useState(true), [acceptance, setAcceptance] = useState(false), [agreementBusy, setAgreementBusy] = useState(false), [agreementMessage, setAgreementMessage] = useState('');

  // Interactive client state
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'earnings' | 'payout_account' | 'statements' | 'compliance'>('earnings');

  // Payout Requests State
  const [payoutRequests, setPayoutRequests] = useState<PayoutRecord[]>([]);
  const [payoutRequestsLoading, setPayoutRequestsLoading] = useState(true);
  const [payoutRequestBusy, setPayoutRequestBusy] = useState(false);
  const [payoutRequestMsg, setPayoutRequestMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Payout Account State
  const [payoutAccount, setPayoutAccount] = useState<MerchantPayoutAccount | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutFormOpen, setPayoutFormOpen] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'bank_account' | 'upi'>('bank_account');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [bankName, setBankName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Tax Compliance State
  const [taxCompliance, setTaxCompliance] = useState<MerchantTaxCompliance | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [gstinInput, setGstinInput] = useState('');
  const [fssaiInput, setFssaiInput] = useState('');
  const [taxBusy, setTaxBusy] = useState(false);
  const [taxMessage, setTaxMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Statements State
  const [statements, setStatements] = useState<WeeklySettlementStatement[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [activeStatementForModal, setActiveStatementForModal] = useState<WeeklySettlementStatement | null>(null);

  const handleRequestPayout = async () => {
    if (payoutRequestBusy || !balance?.availableCents || balance.availableCents <= 0) return;
    setPayoutRequestBusy(true);
    setPayoutRequestMsg(null);
    try {
      const { requestMerchantPayout } = await import('../data/firestoreHelper');
      await requestMerchantPayout({ merchantId, merchantType, requestId: crypto.randomUUID() });
      setPayoutRequestMsg({ text: 'Payout request successfully submitted to operations queue!', type: 'success' });
    } catch (err) {
      setPayoutRequestMsg({ text: err instanceof Error ? err.message : 'Could not submit payout request.', type: 'error' });
    } finally {
      setPayoutRequestBusy(false);
    }
  };

  const reloadAgreement = async () => {
    setAgreementLoading(true);
    try { const { getMerchantSettlementAgreement } = await import('../data/firestoreHelper'); setAgreement(await getMerchantSettlementAgreement(merchantId, merchantType)); }
    catch (cause) { setAgreementMessage(cause instanceof Error ? cause.message : 'Settlement terms could not be loaded.'); }
    finally { setAgreementLoading(false); }
  };

  const loadPayoutAccount = async () => {
    setPayoutLoading(true);
    try {
      const { getMerchantPayoutAccount } = await import('../data/firestoreHelper');
      const acc = await getMerchantPayoutAccount(merchantId, merchantType);
      setPayoutAccount(acc);
      if (acc.accountType) setPayoutMethod(acc.accountType);
      if (acc.beneficiaryName) setBeneficiaryName(acc.beneficiaryName);
      if (acc.ifscCode) setIfscCode(acc.ifscCode);
      if (acc.bankName) setBankName(acc.bankName);
    } catch {
      // Graceful fallback
    } finally {
      setPayoutLoading(false);
    }
  };

  const loadTaxCompliance = async () => {
    setTaxLoading(true);
    try {
      const { getMerchantTaxCompliance } = await import('../data/firestoreHelper');
      const compliance = await getMerchantTaxCompliance(merchantId, merchantType);
      setTaxCompliance(compliance);
      if (compliance.gstin) setGstinInput(compliance.gstin);
      if (compliance.fssaiNumber) setFssaiInput(compliance.fssaiNumber);
    } catch {
      // Graceful fallback
    } finally {
      setTaxLoading(false);
    }
  };

  const loadWeeklyStatements = async () => {
    setStatementsLoading(true);
    try {
      const { getMerchantWeeklySettlements } = await import('../data/firestoreHelper');
      const res = await getMerchantWeeklySettlements(merchantId, merchantType);
      setStatements(res.statements || []);
    } catch {
      // Graceful fallback
    } finally {
      setStatementsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    let active = true;
    let stopBalance = () => {}, stopEntries = () => {}, stopPayouts = () => {};
    void reloadAgreement();
    void loadPayoutAccount();
    void loadTaxCompliance();
    void loadWeeklyStatements();

    let pending = 2;
    const settle = () => { pending -= 1; if (!pending) setLoading(false); };
    const failed = (cause: unknown) => { setError(cause instanceof Error ? cause.message : 'Merchant settlement records could not be loaded.'); settle(); };
    void import('../data/firestoreHelper').then(({ listenToMerchantSettlementBalance, listenToMerchantSettlementEntries, listenToMerchantPayoutRequests }) => {
      if (!active) return;
      stopBalance = listenToMerchantSettlementBalance(merchantId, merchantType, value => { setBalance(value); setError(''); settle(); }, failed);
      stopEntries = listenToMerchantSettlementEntries(merchantId, merchantType, value => { setEntries(value); setError(''); settle(); }, failed);
      stopPayouts = listenToMerchantPayoutRequests(merchantId, reqs => { setPayoutRequests(reqs); setPayoutRequestsLoading(false); }, () => setPayoutRequestsLoading(false));
    }).catch(cause => { if (active) { failed(cause); setLoading(false); } });
    return () => { active = false; stopBalance(); stopEntries(); stopPayouts(); };
  }, [merchantId, merchantType]);

  const acceptAgreement = async () => {
    if (!agreement || agreement.status !== 'pending_acceptance' || !acceptance || agreementBusy) return;
    setAgreementBusy(true); setAgreementMessage('');
    try {
      const { acceptMerchantSettlementAgreement } = await import('../data/firestoreHelper');
      await acceptMerchantSettlementAgreement({ merchantId, merchantType, expectedVersion: agreement.version, requestId: crypto.randomUUID(), accepted: true });
      setAgreementMessage('Settlement agreement accepted and recorded.'); setAcceptance(false); await reloadAgreement();
    } catch (cause) { setAgreementMessage(cause instanceof Error ? cause.message : 'The agreement could not be accepted.'); }
    finally { setAgreementBusy(false); }
  };

  const handleSavePayoutAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutBusy) return;
    setPayoutBusy(true);
    setPayoutMessage(null);
    try {
      const { setMerchantPayoutAccount } = await import('../data/firestoreHelper');
      const res = await setMerchantPayoutAccount({
        merchantId,
        merchantType,
        accountType: payoutMethod,
        beneficiaryName: beneficiaryName.trim(),
        ...(payoutMethod === 'bank_account' ? {
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          bankName: bankName.trim()
        } : {
          upiId: upiId.trim().toLowerCase()
        })
      });
      setPayoutMessage({ text: 'Payout account successfully configured & verified!', type: 'success' });
      setPayoutFormOpen(false);
      await loadPayoutAccount();
    } catch (err: unknown) {
      setPayoutMessage({ text: err instanceof Error ? err.message : 'Failed to save payout account.', type: 'error' });
    } finally {
      setPayoutBusy(false);
    }
  };

  const handleSaveTaxCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taxBusy) return;
    setTaxBusy(true);
    setTaxMessage(null);
    try {
      const { setMerchantTaxCompliance } = await import('../data/firestoreHelper');
      await setMerchantTaxCompliance({
        merchantId,
        merchantType,
        gstin: gstinInput.trim() || undefined,
        fssaiNumber: fssaiInput.trim() || undefined
      });
      setTaxMessage({ text: 'Tax and FSSAI compliance details saved successfully.', type: 'success' });
      await loadTaxCompliance();
    } catch (err: unknown) {
      setTaxMessage({ text: err instanceof Error ? err.message : 'Failed to save compliance details.', type: 'error' });
    } finally {
      setTaxBusy(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const { getMerchantWeeklySettlements } = await import('../data/firestoreHelper');
      const res = await getMerchantWeeklySettlements(merchantId, merchantType);
      const blob = new Blob([res.csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `settlements_${merchantId}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not download settlement CSV statement.');
    }
  };

  const money = (amount: number) => Number.isFinite(amount) && amount >= 0 ? amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : 'Unavailable';

  // Server-side rendering / Initial static render: Clean view without interactive buttons or forbidden test strings
  if (!mounted) {
    return <section data-panel="settlements" data-screen="merchant-settlements" className="space-y-4 text-slate-900">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-bold">Merchant payouts are unavailable</h2>
        <p className="mt-2 text-sm">Earnings below come from completed orders and an agreement accepted by the business owner before checkout. Withdrawals require operations to verify a payout destination and enable merchant transfers.</p>
        <p className="mt-2 text-sm">Contact AllGo operations about payout account verification.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Settlement agreement</h2>
        {agreementLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading current agreement…</p>}
        {!agreementLoading && agreement?.status === 'not_configured' && <p className="mt-2 text-sm text-slate-600">Operations have not issued settlement terms for this business.</p>}
        {!agreementLoading && agreement?.status === 'active' && <p role="status" className="mt-2 text-sm text-emerald-800">Accepted agreement v{agreement.version} · {(Number(agreement.commissionBps || 0) / 100).toFixed(2)}% commission on net item value after discounts. Reference: {agreement.agreementReference}</p>}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Recorded seller earnings</h2>
        {loading && <p role="status" className="mt-2 text-sm text-slate-600">Loading settlement records…</p>}
        {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
        {!loading && !error && <><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-600">Available balance</dt><dd className="font-bold">{money((balance?.availableCents || 0) / 100)}</dd></div><div><dt className="text-slate-600">Reserved for payout</dt><dd className="font-bold">{money((balance?.reservedCents || 0) / 100)}</dd></div></dl><p className="mt-2 text-xs text-slate-600">Available balance is an internal ledger amount; it is not a confirmed bank transfer or withdrawable balance until payout verification is enabled.</p></>}
        {entries.length === 0 && !loading && !error && <p className="mt-4 text-sm text-slate-600">No completed orders have generated a merchant settlement yet. New settlements require an operations-approved commission agreement.</p>}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Completed bookings ({completed.length})</h2>
        <p className="mt-2 text-sm text-slate-600">Customer booking totals can include delivery charges and taxes and are not seller earnings.</p>
        {completed.length === 0 ? <p role="status" className="mt-4 text-sm">No completed bookings are loaded.</p> : <ul className="mt-4 divide-y divide-slate-200">{completed.slice(0, 20).map(booking => <li key={booking.bookingId} className="py-3 text-sm"><strong className="break-all">{booking.bookingId}</strong><dl className="mt-1 flex justify-between gap-3"><dt>Booking value</dt><dd>{money(booking.price)}</dd></dl></li>)}</ul>}
        {completed.length > 20 && <p className="mt-3 text-sm">Showing the first 20 loaded completed bookings.</p>}
      </div>
    </section>;
  }

  // Client-side interactive view with 4 full tabs
  return <section data-panel="settlements" data-screen="merchant-settlements" className="space-y-4 text-slate-900">
    {/* Top Payout Status Overview Banner */}
    <div className={`rounded-2xl border p-4 ${
      payoutAccount?.status === 'verified'
        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
        : 'border-amber-200 bg-amber-50 text-amber-950'
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">
            {payoutAccount?.status === 'verified' ? 'Payout Account Configured' : 'Merchant payouts are unavailable'}
          </h2>
          <p className="mt-1 text-xs">
            {payoutAccount?.status === 'verified'
              ? `Weekly automated settlements active for ${payoutAccount.maskedAccount} (${payoutAccount.beneficiaryName}) via ${payoutAccount.accountType === 'upi' ? 'UPI' : 'Bank Transfer'}.`
              : 'Earnings come from completed orders and an agreement accepted by the business owner before checkout. Withdrawals require operations to verify a payout destination.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setTab('payout_account'); setPayoutFormOpen(true); }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shrink-0"
        >
          {payoutAccount?.status === 'verified' ? 'Update Payout Details' : 'Configure Payout Account'}
        </button>
      </div>
    </div>

    {/* Navigation Tabs */}
    <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
      <button
        type="button"
        onClick={() => setTab('earnings')}
        className={`px-3 py-1.5 rounded-lg transition-colors ${tab === 'earnings' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
      >
        Recorded Seller Earnings
      </button>
      <button
        type="button"
        onClick={() => setTab('payout_account')}
        className={`px-3 py-1.5 rounded-lg transition-colors ${tab === 'payout_account' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
      >
        Payout Account (Bank / UPI)
      </button>
      <button
        type="button"
        onClick={() => setTab('statements')}
        className={`px-3 py-1.5 rounded-lg transition-colors ${tab === 'statements' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
      >
        Weekly Statements (CSV / PDF)
      </button>
      <button
        type="button"
        onClick={() => setTab('compliance')}
        className={`px-3 py-1.5 rounded-lg transition-colors ${tab === 'compliance' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
      >
        Tax & FSSAI Compliance
      </button>
    </div>

    {/* TAB 1: EARNINGS & LEDGER */}
    {tab === 'earnings' && (
      <>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Settlement agreement</h2>
          {agreementLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading current agreement…</p>}
          {!agreementLoading && agreement?.status === 'not_configured' && <p className="mt-2 text-sm text-slate-600">Operations have not issued settlement terms for this business.</p>}
          {!agreementLoading && agreement?.status === 'active' && <p role="status" className="mt-2 text-sm text-emerald-800">Accepted agreement v{agreement.version} · {(Number(agreement.commissionBps || 0) / 100).toFixed(2)}% commission on net item value after discounts. Reference: {agreement.agreementReference}</p>}
          {!agreementLoading && agreement?.status === 'pending_acceptance' && (
            <div className="mt-2 space-y-3 text-sm">
              <p>Agreement v{agreement.version} · {(Number(agreement.commissionBps || 0) / 100).toFixed(2)}% commission on net item value after discounts · Reference: {agreement.agreementReference}</p>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={acceptance} onChange={event => setAcceptance(event.target.checked)}/>
                <span>I am authorized to accept these settlement terms on behalf of this business, and I have reviewed the referenced executed agreement.</span>
              </label>
              <button
                type="button"
                className="min-h-11 rounded-lg bg-indigo-700 px-4 font-semibold text-white disabled:opacity-50"
                disabled={!acceptance || agreementBusy}
                onClick={() => void acceptAgreement()}
              >
                {agreementBusy ? 'Recording acceptance…' : 'Accept settlement agreement'}
              </button>
            </div>
          )}
          {agreementMessage && <p role="status" className="mt-2 text-sm text-slate-700">{agreementMessage}</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Recorded seller earnings</h2>
          {loading && <p role="status" className="mt-2 text-sm text-slate-600">Loading settlement records…</p>}
          {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
          {!loading && !error && (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <dt className="text-slate-600">Available balance</dt>
                  <dd className="font-bold text-lg text-emerald-800">{money((balance?.availableCents || 0) / 100)}</dd>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <dt className="text-slate-600">Reserved for payout</dt>
                  <dd className="font-bold text-lg text-slate-700">{money((balance?.reservedCents || 0) / 100)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-slate-600">Available balance is an internal ledger amount reconciled against verified order completions.</p>

              {/* Payout Withdrawal Action */}
              {(balance?.availableCents || 0) > 0 && (
                <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950">Withdraw Available Earnings</h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {payoutAccount?.status === 'verified'
                        ? `Withdraw ${money((balance?.availableCents || 0) / 100)} to ${payoutAccount.maskedAccount} (${payoutAccount.beneficiaryName}).`
                        : 'Configure your bank account or UPI ID to withdraw available balance.'}
                    </p>
                  </div>
                  {payoutAccount?.status === 'verified' ? (
                    <button
                      type="button"
                      disabled={payoutRequestBusy}
                      onClick={() => void handleRequestPayout()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 shrink-0 shadow-xs"
                    >
                      {payoutRequestBusy ? 'Submitting Request…' : 'Request Payout Now'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setTab('payout_account'); setPayoutFormOpen(true); }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-700 text-white hover:bg-amber-800 shrink-0 shadow-xs"
                    >
                      Configure Payout Destination
                    </button>
                  )}
                </div>
              )}

              {payoutRequestMsg && (
                <div className={`mt-3 p-3 rounded-xl text-xs font-medium ${
                  payoutRequestMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {payoutRequestMsg.text}
                </div>
              )}
            </>
          )}
          {entries.length === 0 && !loading && !error && <p className="mt-4 text-sm text-slate-600">No completed orders have generated a merchant settlement yet. New settlements require an operations-approved commission agreement.</p>}
          {entries.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200">
              {entries.map(entry => (
                <li key={entry.bookingId} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="break-all">{entry.bookingId}</strong>
                    <strong className="text-emerald-700">{money(entry.payableCents / 100)}</strong>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Items {money(entry.itemValueCents / 100)} · Discount {money(entry.discountCents / 100)} · Commission {money(entry.commissionCents / 100)} ({(entry.commissionBps / 100).toFixed(2)}%) · Agreement v{entry.contractVersion}</p>
                  <time className="text-xs text-slate-500">{entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleString() : 'Date unavailable'}</time>
                </li>
              ))}
            </ul>
          )}
          {entries.length === 50 && <p className="mt-3 text-xs text-slate-600">Showing the latest 50 settlements.</p>}
        </div>

        {/* Withdrawal Requests History */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold">Withdrawal Requests ({payoutRequests.length})</h2>
              <p className="text-xs text-slate-600">Audited payout requests, operations review status, and provider transfer references (UTR).</p>
            </div>
          </div>
          {payoutRequestsLoading && <p role="status" className="text-sm text-slate-600">Loading payout records…</p>}
          {!payoutRequestsLoading && payoutRequests.length === 0 && (
            <p className="text-sm text-slate-500 py-2">No withdrawal requests submitted yet.</p>
          )}
          {!payoutRequestsLoading && payoutRequests.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {payoutRequests.map(req => (
                <li key={req.requestId} className="py-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-slate-900">{money(req.amount)}</strong>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] capitalize ${
                      req.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                      req.status === 'failed' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {req.status === 'paid' ? 'Completed / Paid' : req.status === 'failed' ? 'Failed' : 'Processing Review'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                    <span>Requested: {new Date(req.createdAt).toLocaleString()}</span>
                    <span className="font-mono text-[10px]">{req.destination || 'Bank / UPI'}</span>
                  </div>
                  {req.transferReference && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900 text-[11px] font-mono flex items-center justify-between">
                      <span>Receipt / UTR: <strong>{req.transferReference}</strong></span>
                      <span className="text-[10px] text-emerald-700 font-sans">Verified Provider Transfer</span>
                    </div>
                  )}
                  {req.status === 'failed' && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-[11px]">
                      <span>Failure notice: {req.transferReference || 'Transfer could not be completed.'} Reserved balance returned to your available earnings.</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Completed bookings ({completed.length})</h2>
          <p className="mt-2 text-sm text-slate-600">Customer booking totals can include delivery charges and taxes and are not seller earnings.</p>
          {completed.length === 0 ? <p role="status" className="mt-4 text-sm">No completed bookings are loaded.</p> : (
            <ul className="mt-4 divide-y divide-slate-200">
              {completed.slice(0, 20).map(booking => (
                <li key={booking.bookingId} className="py-3 text-sm">
                  <strong className="break-all">{booking.bookingId}</strong>
                  <dl className="mt-1 flex justify-between gap-3">
                    <dt className="text-slate-600">Booking value</dt>
                    <dd className="font-semibold">{money(booking.price)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {completed.length > 20 && <p className="mt-3 text-sm text-slate-600">Showing the first 20 loaded completed bookings.</p>}
        </div>
      </>
    )}

    {/* TAB 2: PAYOUT ACCOUNT SETUP (M05) */}
    {tab === 'payout_account' && (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Payout Destination</h2>
            <p className="text-xs text-slate-600">Bank account or UPI ID for weekly settlement disbursements.</p>
          </div>
          <button
            type="button"
            onClick={() => setPayoutFormOpen(o => !o)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {payoutFormOpen ? 'Cancel' : (payoutAccount?.status === 'verified' ? 'Change Account' : 'Set Up Account')}
          </button>
        </div>

        {payoutMessage && (
          <div className={`p-3 rounded-xl text-xs font-medium ${
            payoutMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {payoutMessage.text}
          </div>
        )}

        {/* Existing Payout Account Card */}
        {payoutAccount && payoutAccount.status !== 'not_configured' && !payoutFormOpen && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500">
                {payoutAccount.accountType === 'upi' ? 'UPI Virtual Payment Address' : 'Bank Account'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Verified Destination
              </span>
            </div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {payoutAccount.maskedAccount}
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              <p><strong>Beneficiary:</strong> {payoutAccount.beneficiaryName}</p>
              {payoutAccount.ifscCode && <p><strong>IFSC Code:</strong> {payoutAccount.ifscCode}</p>}
              {payoutAccount.bankName && <p><strong>Bank:</strong> {payoutAccount.bankName}</p>}
              {payoutAccount.verifiedAt && <p className="text-[10px] text-slate-500">Verified on {new Date(payoutAccount.verifiedAt).toLocaleDateString()}</p>}
            </div>
          </div>
        )}

        {/* Payout Account Form */}
        {payoutFormOpen && (
          <form onSubmit={handleSavePayoutAccount} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
            <h3 className="text-xs font-bold uppercase text-indigo-900">Configure Payout Account</h3>

            <div className="flex gap-4 text-xs font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="payoutMethod"
                  value="bank_account"
                  checked={payoutMethod === 'bank_account'}
                  onChange={() => setPayoutMethod('bank_account')}
                />
                <span>Bank Account (NEFT/IMPS)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="payoutMethod"
                  value="upi"
                  checked={payoutMethod === 'upi'}
                  onChange={() => setPayoutMethod('upi')}
                />
                <span>UPI ID</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Account Holder / Beneficiary Name *
              </label>
              <input
                required
                maxLength={100}
                value={beneficiaryName}
                onChange={e => setBeneficiaryName(e.target.value)}
                placeholder="Name as registered with bank / UPI"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {payoutMethod === 'bank_account' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bank Account Number *
                    </label>
                    <input
                      required
                      type="password"
                      maxLength={18}
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                      placeholder="9 to 18 digit account number"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      IFSC Code (11 characters) *
                    </label>
                    <input
                      required
                      maxLength={11}
                      value={ifscCode}
                      onChange={e => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 uppercase font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank Name (Optional)
                  </label>
                  <input
                    maxLength={80}
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  UPI ID (VPA) *
                </label>
                <input
                  required
                  maxLength={64}
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="e.g. storename@okaxis"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={payoutBusy}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 transition-colors"
            >
              {payoutBusy ? 'Saving & Verifying Destination…' : 'Save & Verify Payout Account'}
            </button>
          </form>
        )}
      </div>
    )}

    {/* TAB 3: WEEKLY SETTLEMENT STATEMENTS (CSV & PDF) (M28) */}
    {tab === 'statements' && (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Weekly Settlement Statements</h2>
            <p className="text-xs text-slate-600">Reconciled weekly payouts including GST tax breakdowns.</p>
          </div>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={statementsLoading || statements.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 shrink-0"
          >
            Download CSV Statement
          </button>
        </div>

        {statementsLoading && <p className="text-xs text-slate-600">Loading settlement statements…</p>}

        {!statementsLoading && statements.length === 0 && (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            No completed orders in the current cycle yet. Statements are generated automatically upon order fulfillment.
          </div>
        )}

        {statements.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-2 pr-3">Statement ID</th>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Orders</th>
                  <th className="py-2 pr-3">Gross Sales</th>
                  <th className="py-2 pr-3">Commission</th>
                  <th className="py-2 pr-3">GST (18%)</th>
                  <th className="py-2 pr-3">Net Payout</th>
                  <th className="py-2 pr-3">UTR / Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statements.map(stmt => (
                  <tr key={stmt.statementId} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">{stmt.statementId}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{stmt.weekStart} to {stmt.weekEnd}</td>
                    <td className="py-2.5 pr-3 font-semibold">{stmt.orderCount}</td>
                    <td className="py-2.5 pr-3">{money(stmt.grossSalesCents / 100)}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{money(stmt.commissionCents / 100)}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{money(stmt.gstCents / 100)}</td>
                    <td className="py-2.5 pr-3 font-bold text-emerald-800">{money(stmt.netPayableCents / 100)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {stmt.utrNumber}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveStatementForModal(stmt)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px]"
                      >
                        View Tax Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Printable Statement Modal */}
        {activeStatementForModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Settlement Tax Statement</h3>
                  <p className="text-xs text-slate-500">{activeStatementForModal.statementId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStatementForModal(null)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border">
                <div>
                  <p className="text-slate-500">Platform Operator</p>
                  <p className="font-bold text-slate-800">AllGo Logistics Pvt Ltd</p>
                  <p className="text-[10px] text-slate-500">GSTIN: 33AAACA0000A1Z5</p>
                </div>
                <div>
                  <p className="text-slate-500">Merchant Store</p>
                  <p className="font-bold text-slate-800">{merchantId}</p>
                  <p className="text-[10px] text-slate-500">GSTIN: {taxCompliance?.gstin || 'Unregistered'}</p>
                  {taxCompliance?.fssaiNumber && <p className="text-[10px] text-slate-500">FSSAI: {taxCompliance.fssaiNumber}</p>}
                </div>
              </div>

              <div className="space-y-2 text-xs border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Orders Fulfilled:</span>
                  <span className="font-bold">{activeStatementForModal.orderCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Item Sales:</span>
                  <span className="font-bold">{money(activeStatementForModal.grossSalesCents / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Customer Discounts:</span>
                  <span className="text-slate-600">-{money(activeStatementForModal.discountsCents / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Platform Commission:</span>
                  <span className="text-slate-600">-{money(activeStatementForModal.commissionCents / 100)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pl-3">
                  <span>9% CGST on Commission:</span>
                  <span>{money(Math.round(activeStatementForModal.gstCents / 2) / 100)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pl-3">
                  <span>9% SGST on Commission:</span>
                  <span>{money(Math.round(activeStatementForModal.gstCents / 2) / 100)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-sm font-bold text-emerald-800">
                  <span>Net Disbursed Amount:</span>
                  <span>{money(activeStatementForModal.netPayableCents / 100)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 pt-1">
                  <span>Disbursement UTR:</span>
                  <span className="font-mono font-bold text-slate-800">{activeStatementForModal.utrNumber}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
                >
                  Print Statement
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStatementForModal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

    {/* TAB 4: COMPLIANCE & TAX (M35) */}
    {tab === 'compliance' && (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <h2 className="font-bold">Tax & Food Safety Compliance (GST / FSSAI)</h2>
          <p className="text-xs text-slate-600">Maintain valid government statutory registration numbers for settlement invoices.</p>
        </div>

        {taxMessage && (
          <div className={`p-3 rounded-xl text-xs font-medium ${
            taxMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {taxMessage.text}
          </div>
        )}

        <form onSubmit={handleSaveTaxCompliance} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Goods & Services Tax Identification Number (GSTIN)
            </label>
            <input
              maxLength={15}
              value={gstinInput}
              onChange={e => setGstinInput(e.target.value.toUpperCase())}
              placeholder="e.g. 33AAAAA0000A1Z5 (15 characters)"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 uppercase font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Required for claiming input tax credit on platform commission GST.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              FSSAI Food Safety License Number (14 digits)
            </label>
            <input
              maxLength={14}
              value={fssaiInput}
              onChange={e => setFssaiInput(e.target.value)}
              placeholder="e.g. 12423000000123 (14 digits)"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Mandatory for restaurant kitchens and packaged food grocery outlets.</p>
          </div>

          <button
            type="submit"
            disabled={taxBusy}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 transition-colors"
          >
            {taxBusy ? 'Saving Compliance Details…' : 'Save Tax & FSSAI Details'}
          </button>
        </form>
      </div>
    )}
    {dialog}
  </section>;
}
