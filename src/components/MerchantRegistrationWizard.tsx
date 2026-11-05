import { useState, useEffect, useRef, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  Store,
  MapPin,
  FileCheck,
  Building2,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  LoaderCircle,
  AlertCircle,
  Save,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { functions } from '../firebase';
import { business } from '../business';

export type BusinessCategory =
  | 'restaurant'
  | 'cloud_kitchen'
  | 'grocery'
  | 'supermarket'
  | 'bakery'
  | 'home_kitchen'
  | 'handmade';

export type BusinessConstitution =
  | 'sole_proprietorship'
  | 'partnership'
  | 'private_limited'
  | 'individual';

export interface MerchantOnboardingDraft {
  step: number;
  // Step 1: Business Information
  legalName: string;
  displayName: string;
  category: BusinessCategory;
  ownerName: string;
  email: string;
  phone: string;
  businessConstitution: BusinessConstitution;

  // Step 2: Location & Address
  addressLine: string;
  landmark: string;
  city: string;
  state: string;
  pinCode: string;
  latitude: number | null;
  longitude: number | null;
  deliveryRadiusKm: number;

  // Step 3: Verification & Compliance
  fssaiNumber: string;
  fssaiExpiryDate: string;
  gstin: string;
  panNumber: string;
  tradeLicenseNumber: string;

  // Step 4: Bank & Payout Information
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  payoutSchedule: 'daily' | 'weekly';

  // Step 5: Store Setup
  openingTime: string;
  closingTime: string;
  weeklyOffDays: string[];
  estimatedPrepTimeMins: number;
  minOrderValueInr: number;
  managerPhone: string;

  // Step 6: Review & Agreement
  agreementAccepted: boolean;
}

export const DRAFT_STORAGE_KEY = 'allgo_merchant_onboarding_draft';

const defaultDraft: MerchantOnboardingDraft = {
  step: 1,
  legalName: '',
  displayName: '',
  category: 'restaurant',
  ownerName: '',
  email: '',
  phone: '',
  businessConstitution: 'sole_proprietorship',
  addressLine: '',
  landmark: '',
  city: '',
  state: '',
  pinCode: '',
  latitude: null,
  longitude: null,
  deliveryRadiusKm: 5,
  fssaiNumber: '',
  fssaiExpiryDate: '',
  gstin: '',
  panNumber: '',
  tradeLicenseNumber: '',
  accountHolderName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  bankName: '',
  branchName: '',
  payoutSchedule: 'weekly',
  openingTime: '09:00',
  closingTime: '22:00',
  weeklyOffDays: [],
  estimatedPrepTimeMins: 20,
  minOrderValueInr: 99,
  managerPhone: '',
  agreementAccepted: false,
};

export const FOOD_CATEGORIES: BusinessCategory[] = ['restaurant', 'cloud_kitchen', 'bakery', 'home_kitchen'];

export function mapCategoryToBackendType(category: BusinessCategory): 'restaurant' | 'grocery' | 'home_kitchen' | 'handmade' {
  switch (category) {
    case 'restaurant':
    case 'cloud_kitchen':
    case 'bakery':
      return 'restaurant';
    case 'grocery':
    case 'supermarket':
      return 'grocery';
    case 'home_kitchen':
      return 'home_kitchen';
    case 'handmade':
      return 'handmade';
    default:
      return 'restaurant';
  }
}

export function validateStep(step: number, draft: MerchantOnboardingDraft): string | null {
  switch (step) {
    case 1:
      if (!draft.legalName.trim() || draft.legalName.trim().length < 2) return 'Enter the registered legal business name.';
      if (!draft.displayName.trim() || draft.displayName.trim().length < 2) return 'Enter the store display name shown to customers.';
      if (!draft.ownerName.trim() || draft.ownerName.trim().length < 2) return 'Enter the authorized owner or partner name.';
      if (!draft.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return 'Enter a valid business email address.';
      if (!draft.phone.trim() || draft.phone.replace(/\D/g, '').length < 10) return 'Enter a valid 10-digit mobile number.';
      return null;

    case 2:
      if (!draft.addressLine.trim() || draft.addressLine.trim().length < 5) return 'Enter the complete shop or building address.';
      if (!draft.city.trim()) return 'Enter the operating city.';
      if (!draft.state.trim()) return 'Enter the state.';
      if (!/^\d{6}$/.test(draft.pinCode.trim())) return 'Enter a valid 6-digit Indian PIN code.';
      if (draft.deliveryRadiusKm < 1 || draft.deliveryRadiusKm > 25) return 'Delivery radius must be between 1 and 25 km.';
      return null;

    case 3:
      if (!draft.panNumber.trim() || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(draft.panNumber.trim())) {
        return 'Enter a valid 10-character PAN number (e.g. ABCDE1234F).';
      }
      if (FOOD_CATEGORIES.includes(draft.category)) {
        if (!draft.fssaiNumber.trim() || draft.fssaiNumber.replace(/\D/g, '').length < 14) {
          return 'FSSAI License / Registration number (14 digits) is mandatory for food and kitchen businesses.';
        }
        if (!draft.fssaiExpiryDate.trim()) {
          return 'Enter your FSSAI certificate expiry date.';
        }
      }
      if (draft.gstin.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(draft.gstin.trim())) {
        return 'Enter a valid 15-character GSTIN or leave blank if exempt.';
      }
      return null;

    case 4:
      if (!draft.accountHolderName.trim() || draft.accountHolderName.trim().length < 2) return 'Enter the bank account beneficiary name as on passbook.';
      if (!draft.accountNumber.trim() || draft.accountNumber.trim().length < 8) return 'Enter a valid bank account number.';
      if (draft.accountNumber.trim() !== draft.confirmAccountNumber.trim()) return 'Bank account numbers do not match.';
      if (!draft.ifscCode.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(draft.ifscCode.trim())) return 'Enter a valid 11-character IFSC code (e.g. SBIN0001234).';
      return null;

    case 5:
      if (!draft.openingTime || !draft.closingTime) return 'Select standard opening and closing times.';
      if (draft.estimatedPrepTimeMins < 5 || draft.estimatedPrepTimeMins > 180) return 'Preparation time must be between 5 and 180 minutes.';
      if (draft.minOrderValueInr < 0) return 'Minimum order value cannot be negative.';
      return null;

    case 6:
      if (!draft.agreementAccepted) return 'Please accept the Merchant Partner Agreement to submit your application.';
      return null;

    default:
      return null;
  }
}

interface MerchantRegistrationWizardProps {
  userId: string;
  initialPhone?: string;
  initialName?: string;
  onApplicationSubmitted?: (applicationId: string) => void;
  onCancel?: () => void;
}

export default function MerchantRegistrationWizard({
  userId,
  initialPhone = '',
  initialName = '',
  onApplicationSubmitted,
  onCancel
}: MerchantRegistrationWizardProps) {
  const [draft, setDraft] = useState<MerchantOnboardingDraft>(() => {
    try {
      const saved = localStorage.getItem(`${DRAFT_STORAGE_KEY}_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultDraft, ...parsed, phone: parsed.phone || initialPhone, ownerName: parsed.ownerName || initialName };
      }
    } catch {
      // Fallback to default
    }
    return { ...defaultDraft, phone: initialPhone, ownerName: initialName };
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showAccountNum, setShowAccountNum] = useState(false);

  // Auto-save draft on changes
  useEffect(() => {
    try {
      localStorage.setItem(`${DRAFT_STORAGE_KEY}_${userId}`, JSON.stringify(draft));
    } catch {
      // Ignore quota errors
    }
  }, [draft, userId]);

  const updateField = <K extends keyof MerchantOnboardingDraft>(key: K, value: MerchantOnboardingDraft[K]) => {
    setError('');
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleManualSave = () => {
    try {
      localStorage.setItem(`${DRAFT_STORAGE_KEY}_${userId}`, JSON.stringify(draft));
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch {
      setError('Could not save draft locally.');
    }
  };

  const handleNextStep = () => {
    const validationError = validateStep(draft.step, draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    updateField('step', Math.min(6, draft.step + 1));
  };

  const handlePrevStep = () => {
    setError('');
    updateField('step', Math.max(1, draft.step - 1));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsDetecting(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsDetecting(false);
        setDraft(prev => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6))
        }));
      },
      (err) => {
        setGpsDetecting(false);
        setError(`Unable to retrieve GPS coordinates: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const validationError = validateStep(6, draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError('');

    const applicationId = crypto.randomUUID();
    const backendType = mapCategoryToBackendType(draft.category);
    const formattedPhone = draft.phone.startsWith('+91')
      ? draft.phone
      : `+91${draft.phone.replace(/\D/g, '').slice(-10)}`;

    try {
      const submitCallable = httpsCallable(functions, 'submitPartnerApplication');
      await submitCallable({
        applicationId,
        type: backendType,
        name: draft.displayName.trim() || draft.legalName.trim(),
        phone: formattedPhone,
        city: draft.city.trim(),
        consent: true
      });

      // Clear local draft upon successful submission
      try {
        localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${userId}`);
        // Store submitted application summary
        localStorage.setItem(`allgo_merchant_submitted_app_${applicationId}`, JSON.stringify({
          ...draft,
          applicationId,
          submittedAt: new Date().toISOString()
        }));
      } catch {
        // Safe to ignore
      }

      setSubmittedAppId(applicationId);
      if (onApplicationSubmitted) {
        onApplicationSubmitted(applicationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application. Please check your network and try again.');
    } finally {
      setBusy(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Business Info', icon: Store },
    { num: 2, label: 'Location', icon: MapPin },
    { num: 3, label: 'Verification', icon: FileCheck },
    { num: 4, label: 'Bank & Payout', icon: Building2 },
    { num: 5, label: 'Store Setup', icon: Clock },
    { num: 6, label: 'Review', icon: CheckCircle2 },
  ];

  if (submittedAppId) {
    return (
      <main className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-purple-100 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Application Submitted!
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            Thank you for registering <strong>{draft.displayName}</strong> on AllGo Partner. Your application has been received and queued for review.
          </p>

          <div className="mt-6 p-4 rounded-2xl bg-purple-50/70 border border-purple-100 text-left max-w-md mx-auto space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Application Reference ID:</span>
              <strong className="text-[#5932ea] font-mono select-all text-xs">{submittedAppId}</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Business Name:</span>
              <span className="text-slate-800 font-semibold">{draft.displayName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Category:</span>
              <span className="text-slate-800 font-semibold capitalize">{draft.category.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">City:</span>
              <span className="text-slate-800 font-semibold">{draft.city}</span>
            </div>
          </div>

          <div className="mt-8 text-left max-w-md mx-auto space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">What happens next?</h2>
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-[#5932ea] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</div>
              <p className="text-xs text-slate-600"><strong>Document & Compliance Review:</strong> Our operations team verifies your FSSAI/PAN/GST documents within 24-48 hours.</p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-[#5932ea] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</div>
              <p className="text-xs text-slate-600"><strong>Store Setup & Menu:</strong> Add your products, set pricing, upload photos, and connect printer.</p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-[#5932ea] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</div>
              <p className="text-xs text-slate-600"><strong>Go Live:</strong> Turn on online orders and start accepting orders with AllGo delivery fleet!</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => onApplicationSubmitted ? onApplicationSubmitted(submittedAppId) : window.location.reload()}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#6236ff] to-[#5123df] text-white font-bold text-sm shadow-md shadow-purple-600/20 hover:from-[#572be0] hover:to-[#461cc4] transition-all"
            >
              Track Application Status
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5932ea] to-[#4320c2] text-white font-black text-xl flex items-center justify-center shadow-md shadow-purple-600/25">
              A
            </div>
            <div>
              <span className="text-lg font-black text-[#1e104b] tracking-tight leading-none">AllGo Partner</span>
              <p className="text-xs text-slate-500 font-medium">Merchant Onboarding Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <Save size={14} className="text-[#5932ea]" />
              <span>Save Draft</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {saveToast && (
          <div role="status" className="mb-4 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Your onboarding progress has been saved to this device.</span>
          </div>
        )}

        {/* Step Progress Tracker */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-purple-100 mb-6">
          <div className="grid grid-cols-6 gap-2">
            {stepsList.map(item => {
              const Icon = item.icon;
              const isActive = draft.step === item.num;
              const isDone = draft.step > item.num;
              return (
                <div key={item.num} className="flex flex-col items-center text-center">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm transition-all mb-1 ${
                      isActive
                        ? 'bg-[#5932ea] text-white shadow-md shadow-purple-600/30 ring-4 ring-purple-100'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                  </div>
                  <span className={`text-[10px] sm:text-[11px] font-bold line-clamp-1 ${
                    isActive ? 'text-[#5932ea]' : isDone ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-purple-900/5 border border-purple-100">
          {error && (
            <div role="alert" className="mb-6 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: BUSINESS INFO */}
          {draft.step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 1: Business Information</h2>
                <p className="text-xs text-slate-500 mt-1">Provide your legal entity and public store profile details.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Legal Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annapoorna Foods Private Limited"
                    value={draft.legalName}
                    onChange={e => updateField('legalName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Name registered on legal PAN / GSTIN.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sree Annapoorna Pure Veg"
                    value={draft.displayName}
                    onChange={e => updateField('displayName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">The name customers will see in the AllGo app.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Business Category *
                  </label>
                  <select
                    value={draft.category}
                    onChange={e => updateField('category', e.target.value as BusinessCategory)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  >
                    <option value="restaurant">Restaurant (Dine-in &amp; Takeaway)</option>
                    <option value="cloud_kitchen">Cloud Kitchen / Delivery Only</option>
                    <option value="bakery">Bakery &amp; Cake Shop</option>
                    <option value="home_kitchen">Home Kitchen / Home Chef</option>
                    <option value="grocery">Grocery &amp; Kirana Store</option>
                    <option value="supermarket">Supermarket / Departmental Store</option>
                    <option value="handmade">Handmade Products &amp; Packaged Foods</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Constitution of Business *
                  </label>
                  <select
                    value={draft.businessConstitution}
                    onChange={e => updateField('businessConstitution', e.target.value as BusinessConstitution)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  >
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                    <option value="partnership">Partnership / LLP</option>
                    <option value="private_limited">Private Limited Company</option>
                    <option value="individual">Individual / Home Chef</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Owner / Signatory Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={draft.ownerName}
                    onChange={e => updateField('ownerName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contact@example.com"
                    value={draft.email}
                    onChange={e => updateField('email', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Registered Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={draft.phone}
                    onChange={e => updateField('phone', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LOCATION & ADDRESS */}
          {draft.step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 2: Store Location &amp; Address</h2>
                <p className="text-xs text-slate-500 mt-1">Provide your physical outlet address for customer pickups and rider dispatch.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Store / Outlet Full Address *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Shop No. 12, Ground Floor, Royal Complex, Main Road"
                  value={draft.addressLine}
                  onChange={e => updateField('addressLine', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Landmark / Area
                  </label>
                  <input
                    type="text"
                    placeholder="Near Old Bus Stand"
                    value={draft.landmark}
                    onChange={e => updateField('landmark', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coimbatore"
                    value={draft.city}
                    onChange={e => updateField('city', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tamil Nadu"
                    value={draft.state}
                    onChange={e => updateField('state', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    PIN Code (6 Digits) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="641001"
                    value={draft.pinCode}
                    onChange={e => updateField('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Delivery Radius (km) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={draft.deliveryRadiusKm}
                    onChange={e => updateField('deliveryRadiusKm', Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>
              </div>

              {/* GPS Coordinates & Auto-Detect */}
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-[#5932ea]" />
                    <span className="text-xs font-bold text-slate-800">Map Coordinates (Lat / Lng)</span>
                  </div>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={gpsDetecting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5932ea] text-white text-xs font-bold hover:bg-[#4a24d6] disabled:opacity-50"
                  >
                    {gpsDetecting ? <LoaderCircle size={14} className="animate-spin" /> : <MapPin size={14} />}
                    <span>{gpsDetecting ? 'Detecting GPS…' : 'Use Current GPS'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="11.0168"
                      value={draft.latitude ?? ''}
                      onChange={e => updateField('latitude', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="76.9558"
                      value={draft.longitude ?? ''}
                      onChange={e => updateField('longitude', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: VERIFICATION & COMPLIANCE */}
          {draft.step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 3: Business Verification &amp; Documents</h2>
                <p className="text-xs text-slate-500 mt-1">Regulatory certifications and identification for verified merchant status.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  PAN Number (10 Alphanumeric Characters) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={draft.panNumber}
                  onChange={e => updateField('panNumber', e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-mono uppercase focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">Permanent Account Number of proprietor, firm or entity.</p>
              </div>

              {/* FSSAI Section for Food / Kitchen Businesses */}
              {FOOD_CATEGORIES.includes(draft.category) && (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileCheck size={16} className="text-amber-700" />
                    <span className="text-xs font-bold text-amber-900">
                      FSSAI Food License / Registration (Mandatory for Food Businesses)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                        14-Digit FSSAI License Number *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={14}
                        placeholder="12423001000123"
                        value={draft.fssaiNumber}
                        onChange={e => updateField('fssaiNumber', e.target.value.replace(/\D/g, '').slice(0, 14))}
                        className="w-full rounded-xl border border-amber-300 bg-white p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                        FSSAI Expiry Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={draft.fssaiExpiryDate}
                        onChange={e => updateField('fssaiExpiryDate', e.target.value)}
                        className="w-full rounded-xl border border-amber-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    GSTIN (Optional for small &amp; home kitchens)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="33ABCDE1234F1Z5"
                    value={draft.gstin}
                    onChange={e => updateField('gstin', e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-mono uppercase focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">15-digit GST identification number if registered.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Trade License / Municipal Reg. (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="TL-2026-98124"
                    value={draft.tradeLicenseNumber}
                    onChange={e => updateField('tradeLicenseNumber', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: BANK & PAYOUT DETAILS */}
          {draft.step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 4: Bank &amp; Payout Account</h2>
                <p className="text-xs text-slate-500 mt-1">Your weekly order sales will be disbursed directly to this account.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Account Beneficiary Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annapoorna Foods"
                  value={draft.accountHolderName}
                  onChange={e => updateField('accountHolderName', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must match the registered business or proprietor name.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Bank Account Number *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAccountNum(!showAccountNum)}
                      className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      {showAccountNum ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showAccountNum ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showAccountNum ? 'text' : 'password'}
                    required
                    placeholder="Enter account number"
                    value={draft.accountNumber}
                    onChange={e => updateField('accountNumber', e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-mono focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Re-enter Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Confirm account number"
                    value={draft.confirmAccountNumber}
                    onChange={e => updateField('confirmAccountNumber', e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-mono focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    IFSC Code (11 Chars) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    placeholder="SBIN0001234"
                    value={draft.ifscCode}
                    onChange={e => updateField('ifscCode', e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-mono uppercase focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="State Bank of India"
                    value={draft.bankName}
                    onChange={e => updateField('bankName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payout Frequency *
                  </label>
                  <select
                    value={draft.payoutSchedule}
                    onChange={e => updateField('payoutSchedule', e.target.value as 'daily' | 'weekly')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  >
                    <option value="weekly">Weekly Settlement (T+3)</option>
                    <option value="daily">Daily Settlement</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: STORE SETUP */}
          {draft.step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 5: Store Setup &amp; Timing</h2>
                <p className="text-xs text-slate-500 mt-1">Configure operating hours, order preparation times, and store thresholds.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Daily Opening Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={draft.openingTime}
                    onChange={e => updateField('openingTime', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Daily Closing Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={draft.closingTime}
                    onChange={e => updateField('closingTime', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Avg Prep Time (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={draft.estimatedPrepTimeMins}
                    onChange={e => updateField('estimatedPrepTimeMins', Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Min Order Value (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={draft.minOrderValueInr}
                    onChange={e => updateField('minOrderValueInr', Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Manager Contact
                  </label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={draft.managerPhone}
                    onChange={e => updateField('managerPhone', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-medium focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW & SUBMISSION */}
          {draft.step === 6 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 6: Review &amp; Confirmation</h2>
                <p className="text-xs text-slate-500 mt-1">Review all entered details before submitting for operations approval.</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Business Info Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                    <span className="font-bold text-[#5932ea] uppercase tracking-wider">Business Details</span>
                    <button type="button" onClick={() => updateField('step', 1)} className="text-[#5932ea] font-semibold hover:underline">Edit</button>
                  </div>
                  <p><span className="text-slate-500">Legal Name:</span> <strong>{draft.legalName}</strong></p>
                  <p><span className="text-slate-500">Display Name:</span> <strong>{draft.displayName}</strong></p>
                  <p><span className="text-slate-500">Category:</span> <strong className="capitalize">{draft.category.replace('_', ' ')}</strong></p>
                  <p><span className="text-slate-500">Owner:</span> {draft.ownerName}</p>
                  <p><span className="text-slate-500">Phone:</span> {draft.phone}</p>
                  <p><span className="text-slate-500">Email:</span> {draft.email}</p>
                </div>

                {/* Location Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                    <span className="font-bold text-[#5932ea] uppercase tracking-wider">Location &amp; Radius</span>
                    <button type="button" onClick={() => updateField('step', 2)} className="text-[#5932ea] font-semibold hover:underline">Edit</button>
                  </div>
                  <p><span className="text-slate-500">Address:</span> {draft.addressLine}</p>
                  <p><span className="text-slate-500">City / State:</span> {draft.city}, {draft.state} - {draft.pinCode}</p>
                  <p><span className="text-slate-500">Delivery Radius:</span> <strong>{draft.deliveryRadiusKm} km</strong></p>
                  {draft.latitude && draft.longitude && (
                    <p><span className="text-slate-500">GPS:</span> {draft.latitude}, {draft.longitude}</p>
                  )}
                </div>

                {/* Verification Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                    <span className="font-bold text-[#5932ea] uppercase tracking-wider">Certifications</span>
                    <button type="button" onClick={() => updateField('step', 3)} className="text-[#5932ea] font-semibold hover:underline">Edit</button>
                  </div>
                  <p><span className="text-slate-500">PAN:</span> <strong className="font-mono">{draft.panNumber}</strong></p>
                  {draft.fssaiNumber && (
                    <p><span className="text-slate-500">FSSAI:</span> <strong className="font-mono">{draft.fssaiNumber}</strong> (Exp: {draft.fssaiExpiryDate})</p>
                  )}
                  {draft.gstin && (
                    <p><span className="text-slate-500">GSTIN:</span> <strong className="font-mono">{draft.gstin}</strong></p>
                  )}
                </div>

                {/* Bank Details Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                    <span className="font-bold text-[#5932ea] uppercase tracking-wider">Bank &amp; Settlement</span>
                    <button type="button" onClick={() => updateField('step', 4)} className="text-[#5932ea] font-semibold hover:underline">Edit</button>
                  </div>
                  <p><span className="text-slate-500">Beneficiary:</span> {draft.accountHolderName}</p>
                  <p><span className="text-slate-500">Account:</span> <strong className="font-mono">•••• •••• {draft.accountNumber.slice(-4)}</strong></p>
                  <p><span className="text-slate-500">IFSC:</span> <strong className="font-mono">{draft.ifscCode}</strong></p>
                  <p><span className="text-slate-500">Schedule:</span> <strong className="capitalize">{draft.payoutSchedule}</strong></p>
                </div>
              </div>

              {/* Agreement Checkbox */}
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={draft.agreementAccepted}
                    onChange={e => updateField('agreementAccepted', e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#5932ea] focus:ring-[#5932ea]"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed font-medium">
                    I confirm that I am the authorized owner / signatory of <strong>{draft.displayName || 'this business'}</strong>. I accept the{' '}
                    <a href={business.terms} target="_blank" rel="noopener noreferrer" className="text-[#5932ea] font-bold underline">
                      AllGo Merchant Terms &amp; Conditions
                    </a>{' '}
                    and certify that all food safety, legal tax documents and bank information provided are genuine.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy || !draft.agreementAccepted}
                  className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-[#6236ff] to-[#5123df] hover:from-[#572be0] hover:to-[#461cc4] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {busy ? (
                    <><LoaderCircle className="animate-spin" size={18} /> Submitting Application…</>
                  ) : (
                    <>Submit Partner Application <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Navigation Controls (Steps 1 to 5) */}
          {draft.step < 6 && (
            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                disabled={draft.step === 1}
                onClick={handlePrevStep}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#5932ea] text-white text-xs font-bold shadow-md shadow-purple-600/20 hover:bg-[#4a24d6] transition-all"
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
