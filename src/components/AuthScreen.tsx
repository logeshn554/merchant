import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  connectAuthEmulator,
  type ConfirmationResult
} from 'firebase/auth';
import {
  ArrowRight,
  ArrowLeft,
  LoaderCircle,
  Store,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { auth, firebaseEmulators } from '../firebase';
import { completeNativePhoneSignIn } from '../nativeAuth';
import { business } from '../business';

let phoneAuthEmulatorConfigured = false;
const nativePhoneAuth = Capacitor.isNativePlatform() && !firebaseEmulators;

export function isValidIndianMobile(phone: string): boolean {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+91')) {
    const afterCode = trimmed.slice(3).replace(/\D/g, '');
    return /^[6-9]\d{9}$/.test(afterCode);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  }
  return /^[6-9]\d{9}$/.test(digits);
}

export function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 2)}*** **${digits.slice(-3)}`;
}

export function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-verification-code': 'The verification code is incorrect. Check your SMS and try again.',
    'auth/code-expired': 'The verification code has expired. Please request a new code.',
    'auth/session-expired': 'The verification session expired. Please request a new code.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes before trying again.',
    'auth/invalid-phone-number': 'Please enter a valid 10-digit Indian mobile number.',
    'auth/missing-phone-number': 'Please enter your mobile phone number.',
    'auth/quota-exceeded': 'SMS daily quota reached for this project. Please contact support or use a verified test number.',
    'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please try again.',
    'auth/operation-not-allowed': 'Phone authentication is not enabled in Firebase Console.',
    'auth/user-disabled': 'This account has been disabled. Please contact AllGo support.',
    'permission-denied': 'We could not access your account profile. Please contact support.',
    'unavailable': 'Account services are temporarily unavailable. Please try again.',
  };
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  if (rawMsg.includes('BILLING_NOT_ENABLED') || rawMsg.includes('billing')) {
    return 'SMS delivery requires a linked billing account on Firebase. Please contact support or use a test phone number.';
  }
  return (code && messages[code]) || (error instanceof Error && error.message.trim() ? error.message : 'We could not verify your phone number. Please try again.');
}

interface AuthScreenProps {
  onRegisterBusiness?: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthScreen({ onRegisterBusiness, initialMode = 'login' }: AuthScreenProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [rawPhone, setRawPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());

  const recaptcha = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const alive = useRef(true);
  const nativePending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phoneResendWait = Math.max(0, Math.ceil((resendAt - clock) / 1000));

  useEffect(() => {
    alive.current = true;
    const ticker = window.setInterval(() => setClock(Date.now()), 1000);
    const handles = nativePhoneAuth && Capacitor.isPluginAvailable('FirebaseAuthentication') ? Promise.all([
      FirebaseAuthentication.addListener('phoneCodeSent', event => {
        if (alive.current && nativePending.current) {
          if (timer.current) clearTimeout(timer.current);
          setVerificationId(event.verificationId);
          setStep('code');
          setNotice('OTP sent! Enter the 6 digits from your SMS.');
          setBusy(false);
        }
      }),
      FirebaseAuthentication.addListener('phoneVerificationFailed', event => {
        if (alive.current && nativePending.current) {
          nativePending.current = false;
          if (timer.current) clearTimeout(timer.current);
          setError(event.message || 'Phone verification failed. Please try again.');
          setBusy(false);
        }
      }),
      FirebaseAuthentication.addListener('phoneVerificationCompleted', () => {
        if (alive.current && nativePending.current) {
          void completeNativePhoneSignIn().catch(err => {
            if (alive.current) setError(authMessage(err));
          }).finally(() => {
            if (alive.current) setBusy(false);
          });
        }
      }),
    ]) : Promise.resolve([]);

    return () => {
      alive.current = false;
      nativePending.current = false;
      clearInterval(ticker);
      if (timer.current) clearTimeout(timer.current);
      recaptcha.current?.clear();
      recaptcha.current = null;
      void handles.then(items => Promise.all(items.map(item => item.remove())));
    };
  }, []);

  const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10);
  const isValidNumber = isValidIndianMobile(cleanDigits);
  const canonicalPhone = `+91${cleanDigits}`;

  const sendCode = async () => {
    if (!isValidNumber) {
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }
    if (Date.now() < resendAt) {
      throw new Error(`Please wait ${phoneResendWait}s before requesting another OTP.`);
    }

    if (nativePhoneAuth) {
      if (!Capacitor.isPluginAvailable('FirebaseAuthentication')) {
        throw new Error('Native phone authentication is not available in this build.');
      }
      nativePending.current = true;
      timer.current = setTimeout(() => {
        if (alive.current) {
          nativePending.current = false;
          setBusy(false);
          setError('Verification request timed out. Please try again.');
        }
      }, 60000);
      try {
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: canonicalPhone, skipNativeAuth: false });
      } catch (err) {
        nativePending.current = false;
        if (timer.current) clearTimeout(timer.current);
        throw err;
      }
    } else {
      if (firebaseEmulators && !phoneAuthEmulatorConfigured) {
        connectAuthEmulator(auth, firebaseEmulators.auth.url, { disableWarnings: true });
        phoneAuthEmulatorConfigured = true;
      }
      if (!recaptcha.current) {
        recaptcha.current = new RecaptchaVerifier(auth, 'phone-recaptcha', {
          size: 'invisible',
        });
      }
      try {
        confirmation.current = await signInWithPhoneNumber(auth, canonicalPhone, recaptcha.current);
        recaptcha.current.clear();
        recaptcha.current = null;
        setStep('code');
        setNotice('OTP sent! Enter the 6 digits received via SMS.');
      } catch (err) {
        recaptcha.current?.clear();
        recaptcha.current = null;
        throw err;
      }
    }

    setResendAt(Date.now() + 60000);
    setClock(Date.now());
  };

  const handlePhoneSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!isValidNumber) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sendCode();
    } catch (err) {
      setError(authMessage(err));
    } finally {
      if (alive.current && !nativePending.current) setBusy(false);
    }
  };

  const handleCodeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (nativePhoneAuth) {
        nativePending.current = true;
        await FirebaseAuthentication.confirmVerificationCode({
          verificationId,
          verificationCode: code
        });
        await completeNativePhoneSignIn();
      } else {
        if (!confirmation.current) throw new Error('Please request another verification code.');
        await confirmation.current.confirm(code);
        setNotice('Mobile verified successfully!');
      }
    } catch (err) {
      nativePending.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (alive.current) setError(authMessage(err));
    } finally {
      if (alive.current && !nativePending.current) setBusy(false);
    }
  };

  const resetToPhone = () => {
    if (busy) return;
    nativePending.current = false;
    if (timer.current) clearTimeout(timer.current);
    setError('');
    setNotice('');
    setStep('phone');
    setVerificationId('');
    setCode('');
    confirmation.current = null;
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f0ff] via-[#faf8ff] to-white text-slate-900 flex flex-col justify-between selection:bg-purple-200">
      <div className="w-full max-w-[460px] mx-auto min-h-screen flex flex-col justify-between px-5 pt-8 pb-8 relative">
        {/* Invisible container for Firebase phone Recaptcha */}
        <div id="phone-recaptcha" className="absolute opacity-0 pointer-events-none" />

        {/* Top Branding Header */}
        <header className="flex flex-col items-center text-center pt-4 pb-2 z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5932ea] to-[#4320c2] text-white font-black text-2xl flex items-center justify-center relative shadow-lg shadow-purple-600/25">
              A
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#ff7a45] rounded-full border-2 border-white" />
            </div>
            <div className="text-left ml-1">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-[#1e104b] tracking-tight leading-none">AllGo</span>
                <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#5932ea]/10 text-[#5932ea]">
                  Partner
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
                Merchant Operations Hub
              </span>
            </div>
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/70 border border-purple-200/80 text-[11px] font-semibold text-[#5932ea] mt-2">
            <Store size={13} className="text-[#5932ea]" />
            <span>Restaurants • Cloud Kitchens • Groceries • Bakeries • Home Kitchens</span>
          </div>
        </header>

        {/* Main Merchant Partner Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-purple-900/5 border border-purple-100/90 flex flex-col gap-5 z-10 my-auto">
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-5">
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-[26px] font-black text-[#1e104b] tracking-tight leading-tight">
                  {mode === 'register' ? 'Register your business' : 'Welcome to AllGo Partner'}
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {mode === 'register' ? 'Start growing your business with AllGo orders.' : 'Grow your business with AllGo.'}
                </p>
              </div>

              {/* Mobile Number Input with Indian country code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50/50 px-3.5 py-3 shadow-xs focus-within:border-[#5932ea] focus-within:bg-white focus-within:ring-4 focus-within:ring-purple-100 transition-all">
                  <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200 select-none">
                    <span className="text-xl leading-none" role="img" aria-label="India flag">🇮🇳</span>
                    <span className="text-sm font-extrabold text-slate-800 ml-1">+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="Enter your mobile number"
                    className="grow pl-3 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                    value={rawPhone}
                    onChange={(e) => setRawPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    disabled={busy}
                    autoFocus
                  />
                  {isValidNumber && (
                    <CheckCircle2 size={18} className="text-emerald-600 ml-2 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  We will send a 6-digit OTP to verify your mobile number.
                </p>
              </div>

              {error && (
                <div role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200/80 rounded-xl p-3 flex items-start gap-2">
                  <span className="font-bold text-rose-800 shrink-0">!</span>
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div role="status" className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Continue button */}
              <button
                type="submit"
                disabled={busy || !isValidNumber}
                className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-[#6236ff] to-[#5123df] hover:from-[#572be0] hover:to-[#461cc4] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {busy ? (
                  <><LoaderCircle className="animate-spin" size={18} /> Sending OTP…</>
                ) : (
                  <>Continue <ArrowRight size={18} /></>
                )}
              </button>

              {/* Register / Sign In Switch */}
              <div className="pt-2 text-center border-t border-slate-100">
                {mode === 'login' ? (
                  <p className="text-xs text-slate-600">
                    New to AllGo?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        if (onRegisterBusiness) {
                          onRegisterBusiness();
                        } else {
                          setMode('register');
                        }
                      }}
                      className="text-[#5932ea] font-bold hover:underline underline-offset-2 ml-1"
                    >
                      Register your business
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">
                    Already an AllGo Partner?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-[#5932ea] font-bold hover:underline underline-offset-2 ml-1"
                    >
                      Sign in to your account
                    </button>
                  </p>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetToPhone}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#5932ea] hover:underline"
                >
                  <ArrowLeft size={16} /> Edit number
                </button>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> SMS Sent
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#1e104b] tracking-tight">
                  Verify your mobile number
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Enter the 6-digit OTP sent to <strong className="text-slate-800">{maskPhoneNumber(rawPhone)}</strong>
                </p>
              </div>

              {/* 6-digit OTP code input */}
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  className="w-full min-h-[62px] rounded-2xl border-2 border-purple-200 bg-purple-50/40 text-center text-3xl font-extrabold tracking-[0.45em] text-[#1e104b] focus:outline-none focus:border-[#5932ea] focus:bg-white focus:ring-4 focus:ring-purple-100 transition-all placeholder:tracking-widest placeholder:text-slate-300"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={busy}
                  autoFocus
                />
              </div>

              {/* Countdown & Resend Option */}
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <button
                  type="button"
                  disabled={busy || phoneResendWait > 0}
                  onClick={() => void sendCode().catch(err => setError(authMessage(err)))}
                  className="text-[#5932ea] hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1"
                >
                  {phoneResendWait > 0 ? (
                    <>
                      <Clock size={13} className="text-slate-400" />
                      <span>Resend OTP in {phoneResendWait}s</span>
                    </>
                  ) : (
                    'Resend OTP via SMS'
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetToPhone}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Change number
                </button>
              </div>

              {error && (
                <div role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200/80 rounded-xl p-3 flex items-start gap-2">
                  <span className="font-bold text-rose-800 shrink-0">!</span>
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div role="status" className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Verify Button */}
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-[#6236ff] to-[#5123df] hover:from-[#572be0] hover:to-[#461cc4] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {busy ? (
                  <><LoaderCircle className="animate-spin" size={18} /> Verifying OTP…</>
                ) : (
                  <>Verify &amp; Continue <ArrowRight size={18} /></>
                )}
              </button>
            </form>
          )}

          {/* Legal and Security footer */}
          <footer className="pt-2 text-center text-[11px] text-slate-400 flex flex-col gap-2">
            <p className="leading-relaxed">
              By continuing, you agree to our{' '}
              <a href={business.terms} target="_blank" rel="noopener noreferrer" className="text-[#5932ea] font-semibold underline underline-offset-2">
                Merchant Partner Terms
              </a>{' '}
              and{' '}
              <a href={business.privacy} target="_blank" rel="noopener noreferrer" className="text-[#5932ea] font-semibold underline underline-offset-2">
                Privacy Policy
              </a>.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck size={12} className="text-purple-600" />
              <span>Official AllGo Merchant Partner Portal • Bank-Grade Security</span>
            </div>
          </footer>
        </div>

        {/* Bottom Support Contact */}
        <div className="text-center py-2 text-xs text-slate-500 z-10">
          Need help registering your store?{' '}
          <a href={`mailto:${business.supportEmail}`} className="text-[#5932ea] font-semibold hover:underline">
            Contact Merchant Support
          </a>
        </div>
      </div>
    </main>
  );
}
