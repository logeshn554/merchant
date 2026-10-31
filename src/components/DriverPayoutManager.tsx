import React, { useState } from 'react';
import { Landmark, QrCode, AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';
import type { DriverProfile } from '../types';
import { setDriverPayoutAccount, createPayoutRequest, submitDriverCodDeposit } from '../data/firestoreHelper';
import { useFeedbackDialog } from './useFeedbackDialog';

interface DriverPayoutManagerProps {
  profile: DriverProfile | null;
  userId: string;
  onRefresh?: () => void;
}

export default function DriverPayoutManager({ profile, userId, onRefresh }: DriverPayoutManagerProps) {
  const { alert, dialog } = useFeedbackDialog();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [busy, setBusy] = useState(false);

  // Payout Account Form State
  const [accountType, setAccountType] = useState<'bank' | 'upi'>('upi');
  const [beneficiaryName, setBeneficiaryName] = useState(profile?.payoutAccount?.beneficiaryName || '');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');

  // Withdrawal Form State
  const availableRupees = (profile?.availableEarningsCents || 0) / 100;
  const [withdrawAmount, setWithdrawAmount] = useState<string>(availableRupees >= 200 ? String(Math.min(availableRupees, 10000)) : '200');

  // COD Deposit Form State
  const codRupees = (profile?.codCashInHandCents || 0) / 100;
  const [depositAmount, setDepositAmount] = useState<string>(String(codRupees || ''));
  const [depositMode, setDepositMode] = useState<'bank_transfer' | 'upi'>('upi');
  const [bankReference, setBankReference] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (accountType === 'upi') {
        if (!upiId.trim() || !beneficiaryName.trim()) {
          alert('Please enter your full name and a valid UPI ID (e.g. name@okhdfcbank).');
          return;
        }
        await setDriverPayoutAccount({ accountType: 'upi', beneficiaryName: beneficiaryName.trim(), upiId: upiId.trim() });
      } else {
        if (!accountNumber.trim() || !ifscCode.trim() || !beneficiaryName.trim()) {
          alert('Please enter your bank account number, 11-character IFSC code, and account holder name.');
          return;
        }
        await setDriverPayoutAccount({
          accountType: 'bank',
          beneficiaryName: beneficiaryName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          bankName: bankName.trim(),
        });
      }
      setShowAccountModal(false);
      alert('Payout destination verified successfully.');
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save payout account.');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const num = parseFloat(withdrawAmount);
    if (!Number.isFinite(num) || num < 200) {
      alert('Minimum withdrawal amount is ₹200.00.');
      return;
    }
    if (num > 10000) {
      alert('Maximum withdrawal per request is ₹10,000.00.');
      return;
    }
    if (num > availableRupees) {
      alert('Requested amount exceeds your available balance.');
      return;
    }
    setBusy(true);
    try {
      const cents = Math.round(num * 100);
      await createPayoutRequest({ requestId: crypto.randomUUID(), driverId: userId, amount: num, amountCents: cents });
      setShowWithdrawModal(false);
      alert(`Withdrawal request for ₹${num.toFixed(2)} submitted for operations review. Funds have been reserved.`);
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Withdrawal request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const num = parseFloat(depositAmount);
    if (!Number.isFinite(num) || num <= 0) {
      alert('Enter a valid deposit amount.');
      return;
    }
    if (num > codRupees) {
      alert('Deposit amount cannot exceed your recorded cash-in-hand balance.');
      return;
    }
    if (!bankReference.trim()) {
      alert('Enter the bank UTR or UPI transaction reference ID.');
      return;
    }
    setBusy(true);
    try {
      const cents = Math.round(num * 100);
      await submitDriverCodDeposit({
        amountCents: cents,
        paymentMode: depositMode,
        bankReference: bankReference.trim(),
        notes: depositNotes.trim(),
      });
      setShowDepositModal(false);
      setBankReference('');
      setDepositNotes('');
      alert('Deposit receipt submitted. An administrator will verify the bank reference and reconcile your cash-in-hand balance.');
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit deposit.');
    } finally {
      setBusy(false);
    }
  };

  const hasPayoutAccount = Boolean(profile?.payoutAccount?.maskedAccount);

  return (
    <div className="space-y-4" data-screen="driver-payout-manager">
      {dialog}

      {/* Payout Account Status Card */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-3.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="font-bold text-white">Payout Destination</p>
              <p className="text-[11px] text-slate-400">
                {hasPayoutAccount
                  ? `${profile?.payoutAccount?.accountType?.toUpperCase()}: ${profile?.payoutAccount?.maskedAccount} (${profile?.payoutAccount?.beneficiaryName})`
                  : 'No verified payout account linked'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAccountModal(true)}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors"
          >
            {hasPayoutAccount ? 'Change' : 'Link Account'}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            if (!hasPayoutAccount) {
              alert('Please link your Bank Account or UPI ID before requesting a withdrawal.');
              setShowAccountModal(true);
              return;
            }
            if (availableRupees < 200) {
              alert('Minimum balance of ₹200.00 is required for withdrawal.');
              return;
            }
            setShowWithdrawModal(true);
          }}
          disabled={busy || availableRupees < 200}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-all shadow-md ${
            hasPayoutAccount && availableRupees >= 200
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          Request Payout
        </button>

        <button
          type="button"
          onClick={() => {
            if (codRupees <= 0) {
              alert('You have no outstanding COD cash in hand to deposit.');
              return;
            }
            setShowDepositModal(true);
          }}
          disabled={busy || codRupees <= 0}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-all shadow-md ${
            codRupees > 0
              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4" />
          Deposit COD Cash
        </button>
      </div>

      {/* Account Setup Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Payout Account Setup
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Earnings withdrawals are disbursed directly to your registered destination.
            </p>

            <form onSubmit={handleSaveAccount} className="mt-4 space-y-3 text-xs">
              <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => setAccountType('upi')}
                  className={`flex-1 rounded-md py-1.5 text-center font-bold transition-colors ${
                    accountType === 'upi' ? 'bg-purple-600 text-white' : 'text-slate-400'
                  }`}
                >
                  UPI VPA
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('bank')}
                  className={`flex-1 rounded-md py-1.5 text-center font-bold transition-colors ${
                    accountType === 'bank' ? 'bg-purple-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Bank Account
                </button>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Beneficiary Account Holder Name</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={beneficiaryName}
                  onChange={e => setBeneficiaryName(e.target.value)}
                  placeholder="Full name as in bank record"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs"
                />
              </div>

              {accountType === 'upi' ? (
                <div>
                  <label className="block text-slate-400 mb-1">UPI ID</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    placeholder="e.g. mobile@okhdfcbank or id@upi"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">Bank Account Number</label>
                    <input
                      type="text"
                      required
                      maxLength={18}
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                      placeholder="9 to 18 digit account number"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={ifscCode}
                      onChange={e => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Bank Name (Optional)</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowAccountModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition-colors"
                >
                  {busy ? 'Verifying…' : 'Save & Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white">Request Payout</h3>
            <p className="mt-1 text-xs text-slate-400">
              Available balance: <strong className="text-emerald-400">₹{availableRupees.toFixed(2)}</strong> (Min: ₹200, Max: ₹10,000)
            </p>

            <form onSubmit={handleWithdraw} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  min={200}
                  max={Math.min(availableRupees, 10000)}
                  step="1"
                  required
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-base font-bold text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawAmount('200')}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300"
                >
                  ₹200
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawAmount('500')}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300"
                >
                  ₹500
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(String(Math.min(availableRupees, 10000)))}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300"
                >
                  Max Available
                </button>
              </div>

              <div className="rounded-lg bg-slate-950 p-2 text-[11px] text-slate-400">
                Destination: <strong className="text-white">{profile?.payoutAccount?.accountType?.toUpperCase()}: {profile?.payoutAccount?.maskedAccount}</strong>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition-colors"
                >
                  {busy ? 'Submitting…' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COD Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white">Submit COD Cash Deposit</h3>
            <p className="mt-1 text-xs text-slate-400">
              Outstanding cash in hand: <strong className="text-rose-400">₹{codRupees.toFixed(2)}</strong>
            </p>

            <form onSubmit={handleSubmitDeposit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Deposit Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  max={codRupees}
                  step="1"
                  required
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-base font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Channel</label>
                <select
                  value={depositMode}
                  onChange={e => setDepositMode(e.target.value as 'bank_transfer' | 'upi')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs"
                >
                  <option value="upi">Company UPI / QR Code</option>
                  <option value="bank_transfer">Direct Bank Transfer / NEFT / IMPS</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Bank UTR / UPI Transaction Reference</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={bankReference}
                  onChange={e => setBankReference(e.target.value)}
                  placeholder="e.g. UTR123456789 or UPI transaction ID"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deposit Notes (Optional)</label>
                <textarea
                  maxLength={300}
                  rows={2}
                  value={depositNotes}
                  onChange={e => setDepositNotes(e.target.value)}
                  placeholder="Deposit branch or remarks"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-bold text-white transition-colors"
                >
                  {busy ? 'Submitting…' : 'Submit Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
