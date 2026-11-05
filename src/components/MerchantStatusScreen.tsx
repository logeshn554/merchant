import { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ArrowRight,
  LogOut,
  RefreshCw,
  Mail,
  FileText,
  Building,
  HelpCircle
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { business } from '../business';
import PartnerEvidencePanel from './PartnerEvidencePanel';

export type MerchantStatusType =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'needs_information'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface MerchantApplicationRecord {
  applicationId: string;
  type: string;
  name: string;
  phone: string;
  city: string;
  status: string;
  revision?: number;
  feedback?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MerchantStatusScreenProps {
  application?: MerchantApplicationRecord | null;
  userSuspended?: boolean;
  suspensionReason?: string;
  onContinueDraft?: () => void;
  onEnterDashboard?: () => void;
  onSignOut?: () => void;
  onRefresh?: () => void;
}

export default function MerchantStatusScreen({
  application,
  userSuspended = false,
  suspensionReason = 'Account review pending.',
  onContinueDraft,
  onEnterDashboard,
  onSignOut,
  onRefresh
}: MerchantStatusScreenProps) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [correctedCity, setCorrectedCity] = useState(application?.city || '');
  const [correctedName, setCorrectedName] = useState(application?.name || '');
  const [correctedPhone, setCorrectedPhone] = useState(application?.phone || '');

  // Determine normalized status
  let currentStatus: MerchantStatusType = 'submitted';
  if (userSuspended) {
    currentStatus = 'suspended';
  } else if (!application) {
    currentStatus = 'draft';
  } else {
    const raw = application.status?.toLowerCase();
    if (raw === 'approved' || raw === 'active') currentStatus = 'approved';
    else if (raw === 'rejected') currentStatus = 'rejected';
    else if (raw === 'needs_information' || raw === 'documents_required') currentStatus = 'needs_information';
    else if (raw === 'under_review') currentStatus = 'under_review';
    else if (raw === 'draft') currentStatus = 'draft';
    else currentStatus = 'submitted';
  }

  const handleResubmit = async () => {
    if (!application) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      const amendCallable = httpsCallable(functions, 'amendPartnerApplication');
      await amendCallable({
        applicationId: application.applicationId,
        expectedRevision: application.revision ?? 0,
        requestId: crypto.randomUUID(),
        type: application.type,
        name: correctedName.trim() || application.name,
        phone: correctedPhone.trim() || application.phone,
        city: correctedCity.trim() || application.city,
        consent: true
      });
      setActionSuccess('Your amended application has been submitted for review.');
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit correction. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full">
        {/* Top Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5932ea] to-[#4320c2] text-white font-black text-xl flex items-center justify-center shadow-md shadow-purple-600/25">
              A
            </div>
            <div>
              <span className="text-base font-black text-[#1e104b] tracking-tight leading-none">AllGo Partner</span>
              <p className="text-xs text-slate-500 font-medium">Merchant Onboarding Status</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh Status"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs"
              >
                <RefreshCw size={15} />
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50 shadow-xs"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Status Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-purple-900/5 border border-purple-100">
          {actionError && (
            <div role="alert" className="mb-5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div role="status" className="mb-5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              {actionSuccess}
            </div>
          )}

          {/* 1. SUBMITTED or UNDER_REVIEW */}
          {(currentStatus === 'submitted' || currentStatus === 'under_review') && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-[#5932ea] flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Clock size={28} />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {currentStatus === 'under_review' ? 'Verification In Progress' : 'Application Under Review'}
                </h1>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Your application is under review. Our team will verify your details within 24-48 hours.
                </p>
              </div>

              {/* Application Details Summary */}
              {application && (
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Business Name:</span>
                    <strong className="text-slate-900">{application.name}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Vertical:</span>
                    <strong className="text-slate-900 capitalize">{application.type.replace('_', ' ')}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">City:</span>
                    <span className="text-slate-800">{application.city}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Reference ID:</span>
                    <span className="font-mono text-purple-700 text-[11px] select-all">{application.applicationId}</span>
                  </div>
                </div>
              )}

              {/* Progress Checklist */}
              <div className="space-y-3 pt-2">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Review Stages</h2>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <div className="grow">
                      <p className="font-bold text-slate-800">Application Received</p>
                      <p className="text-[11px] text-slate-500">Business registration profile received.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs">
                    <div className="w-4 h-4 rounded-full border-2 border-[#5932ea] border-t-transparent animate-spin shrink-0 ml-0.5" />
                    <div className="grow">
                      <p className="font-bold text-[#5932ea]">FSSAI &amp; Document Review</p>
                      <p className="text-[11px] text-slate-600">Operations team verifying compliance certificates.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-100 text-xs opacity-60">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 ml-0.5" />
                    <div className="grow">
                      <p className="font-bold text-slate-700">Bank &amp; Payout Verification</p>
                      <p className="text-[11px] text-slate-400">Penny-drop validation for weekly disbursements.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-100 text-xs opacity-60">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 ml-0.5" />
                    <div className="grow">
                      <p className="font-bold text-slate-700">Store Live &amp; Order Acceptance</p>
                      <p className="text-[11px] text-slate-400">Final outlet onboarding and live status.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence / Documents Panel */}
              {application && (
                <div className="pt-2">
                  <PartnerEvidencePanel
                    applicationId={application.applicationId}
                    staff={false}
                    active={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. DOCUMENTS_REQUIRED / NEEDS_INFORMATION */}
          {currentStatus === 'needs_information' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <AlertTriangle size={28} />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Information Required</h1>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Our operations team reviewed your application and requires additional details or corrected documents.
                </p>
              </div>

              {/* Reviewer Feedback Box */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Reviewer Feedback:</span>
                <p className="text-xs text-amber-900 font-medium">
                  {application?.feedback || 'Please update your details or re-upload clear photos of your FSSAI/PAN documents.'}
                </p>
              </div>

              {/* Evidence Panel for uploading requested documents */}
              {application && (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Upload Missing Documents</h3>
                  <PartnerEvidencePanel
                    applicationId={application.applicationId}
                    staff={false}
                    active={true}
                  />
                </div>
              )}

              {/* Amendment Form */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Update Application Fields</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      value={correctedName}
                      onChange={e => setCorrectedName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={correctedCity}
                      onChange={e => setCorrectedCity(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2.5"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleResubmit}
                  className="w-full min-h-[46px] rounded-xl bg-[#5932ea] text-white font-bold text-xs shadow-md shadow-purple-600/20 hover:bg-[#4a24d6] transition-all disabled:opacity-50"
                >
                  {busy ? 'Submitting Corrections…' : 'Correct and Resubmit Application'}
                </button>
              </div>
            </div>
          )}

          {/* 3. APPROVED */}
          {currentStatus === 'approved' && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Congratulations!
                </h1>
                <p className="text-sm font-semibold text-[#5932ea] mt-1">Your AllGo Partner Store is Approved</p>
                <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                  Your merchant onboarding is complete. You can now access your merchant dashboard to manage orders, catalog items, and store settings.
                </p>
              </div>

              {application && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-left text-xs max-w-sm mx-auto space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Store Name:</span>
                    <strong className="text-slate-900">{application.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-emerald-700 font-bold uppercase">Active &amp; Approved</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onEnterDashboard || (() => window.location.reload())}
                className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-[#6236ff] to-[#5123df] text-white font-bold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 hover:from-[#572be0] hover:to-[#461cc4] transition-all"
              >
                <span>Enter Merchant Dashboard</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* 4. REJECTED */}
          {currentStatus === 'rejected' && (
            <div className="space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <XCircle size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Application Not Approved</h1>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  We could not approve your merchant partner application at this time.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-left space-y-1 text-xs">
                <span className="font-bold text-rose-900 uppercase tracking-wider">Reason:</span>
                <p className="text-rose-800">
                  {application?.feedback || 'The submitted regulatory certificates or location do not meet our partner operating standards.'}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                {onContinueDraft && (
                  <button
                    type="button"
                    onClick={onContinueDraft}
                    className="w-full py-3 rounded-xl bg-[#5932ea] text-white font-bold text-xs shadow-md shadow-purple-600/20"
                  >
                    Start New Application
                  </button>
                )}
                <a
                  href={`mailto:${business.supportEmail}?subject=Application Appeal - ${application?.applicationId || ''}`}
                  className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 block text-center"
                >
                  Contact Merchant Support
                </a>
              </div>
            </div>
          )}

          {/* 5. SUSPENDED */}
          {currentStatus === 'suspended' && (
            <div className="space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Merchant Account Suspended</h1>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Your store operations have been temporarily paused by AllGo operations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1 text-xs">
                <span className="font-bold text-amber-900 uppercase tracking-wider">Notice:</span>
                <p className="text-amber-800">{suspensionReason}</p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Completed order balances remain secure and will be settled according to financial reconciliation policies.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href={`mailto:${business.supportEmail}?subject=Suspension Appeal - Merchant`}
                  className="w-full py-3 rounded-xl bg-[#5932ea] text-white font-bold text-xs shadow-md shadow-purple-600/20 block text-center"
                >
                  Submit Appeal to AllGo Support
                </a>
              </div>
            </div>
          )}

          {/* 6. DRAFT */}
          {currentStatus === 'draft' && (
            <div className="space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-[#5932ea] flex items-center justify-center mx-auto mb-3">
                <Building size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Complete Your Registration</h1>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  You have an unfinished business application draft on this device.
                </p>
              </div>

              {onContinueDraft && (
                <button
                  type="button"
                  onClick={onContinueDraft}
                  className="w-full py-3.5 rounded-2xl bg-[#5932ea] text-white font-bold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 hover:bg-[#4a24d6] transition-all"
                >
                  <span>Continue Onboarding</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Support Help Footer */}
        <div className="text-center py-4 text-xs text-slate-500">
          Questions about your status?{' '}
          <a href={`mailto:${business.supportEmail}`} className="text-[#5932ea] font-semibold hover:underline">
            Email Partner Help Desk
          </a>
        </div>
      </div>
    </main>
  );
}
