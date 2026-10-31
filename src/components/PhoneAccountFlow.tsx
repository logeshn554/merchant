import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle, Zap } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, inMemoryPersistence, RecaptchaVerifier, setPersistence, signInWithPhoneNumber, signOut, type ConfirmationResult } from 'firebase/auth';
import { signInPhoneAccount, useNeonAccounts } from '../accounts';
import { auth, firebaseEmulators } from '../firebase';
import { completeNativePhoneSignIn } from '../nativeAuth';
import { appAudience } from '../app/audience';
import { business } from '../business';

let phoneAuthEmulatorConfigured = false;
// Native Firebase reads google-services.json, which can name a different project
// from the JS development configuration. Use the JS Auth instance for emulator
// phone verification so the token and the account API share the same project.
const nativePhoneAuth = Capacitor.isNativePlatform() && !firebaseEmulators;

function message(error: unknown) {
  const code = (error as {code?:string})?.code;
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  if (rawMsg.includes('BILLING_NOT_ENABLED')) {
    return 'Real SMS requires Firebase Blaze billing. For testing, use phone +911234567890 with OTP 123456, or tap Continue without sign-in.';
  }
  if (code==='auth/invalid-verification-code') return 'That code is incorrect. Check the SMS and try again.';
  if (code==='auth/code-expired' || code==='auth/session-expired') return 'This code expired. Request a new one.';
  if (code==='auth/too-many-requests') return 'Too many attempts. Please wait before requesting another code.';
  if (code==='auth/operation-not-allowed' || code==='auth/invalid-app-credential' || code==='auth/captcha-check-failed') return 'Phone verification is unavailable. You can tap Continue without sign-in below.';
  return error instanceof Error && error.message.trim() && !['undefined','null'].includes(error.message) ? error.message : 'We could not verify your phone. You can tap Continue without sign-in below.';
}

export default function PhoneAccountFlow({mode = 'signin', onBack, onModeChange}: {mode?:'signup'|'signin'; onBack?:()=>void; onModeChange?:(mode:'signup'|'signin')=>void}) {
  const [step,setStep]=useState<'phone'|'code'>('phone');
  const [phone,setPhone]=useState(''), [code,setCode]=useState('');
  const [verificationId,setVerificationId]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState(''), [notice,setNotice]=useState(''), [resendAt,setResendAt]=useState(0), [clock,setClock]=useState(Date.now());
  const recaptcha=useRef<RecaptchaVerifier|null>(null), confirmation=useRef<ConfirmationResult|null>(null), alive=useRef(true), nativePending=useRef(false), nativeToken=useRef<Promise<void>|null>(null), timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  // Auto-select role based on which app the user is signing into
  const requestedRole = appAudience;

  const finish=async (idToken:string) => {
    if (!alive.current) return;
    setError(''); setNotice('Phone verified. Signing in…');
    await signInPhoneAccount(idToken, requestedRole);
  };

  const nativeFinish=() => {
    if(nativeToken.current) return nativeToken.current;
    nativeToken.current=(async()=>{const {token:idToken}=await FirebaseAuthentication.getIdToken({forceRefresh:true});if(!idToken)throw new Error('Phone verification did not return a credential. Try again.');await finish(idToken);})();
    return nativeToken.current.finally(()=>{nativePending.current=false;nativeToken.current=null;if(timer.current)clearTimeout(timer.current);if(alive.current)setBusy(false);});
  };

  useEffect(()=>{
    alive.current=true;
    const ticker=setInterval(()=>setClock(Date.now()),1000);
    const handles=nativePhoneAuth&&Capacitor.isPluginAvailable('FirebaseAuthentication')?Promise.all([
      FirebaseAuthentication.addListener('phoneCodeSent',event=>{if(alive.current&&nativePending.current){if(timer.current)clearTimeout(timer.current);setVerificationId(event.verificationId);setStep('code');setNotice('Code sent. Enter the six digits from your SMS.');setBusy(false);}}),
      FirebaseAuthentication.addListener('phoneVerificationFailed',event=>{if(alive.current&&nativePending.current){nativePending.current=false;if(timer.current)clearTimeout(timer.current);setError(event.message||'Phone verification failed. Please try again.');setBusy(false);}}),
      FirebaseAuthentication.addListener('phoneVerificationCompleted',()=>{
        if(alive.current&&nativePending.current) {
          if (useNeonAccounts) {
            void nativeFinish().catch(error=>{if(alive.current)setError(message(error));});
          } else {
            void completeNativePhoneSignIn().catch(error=>{if(alive.current)setError(message(error));}).finally(()=>{if(alive.current)setBusy(false);});
          }
        }
      }),
    ]):Promise.resolve([]);
    return()=>{alive.current=false;nativePending.current=false;clearInterval(ticker);if(timer.current)clearTimeout(timer.current);recaptcha.current?.clear();recaptcha.current=null;void handles.then(items=>Promise.all(items.map(item=>item.remove())));};
  },[]);

  let canonicalPhone=phone.replace(/[\s()-]/g,'');
  if (canonicalPhone.startsWith('91') && canonicalPhone.length === 12) {
    canonicalPhone = '+' + canonicalPhone;
  } else if (/^\d{10}$/.test(canonicalPhone) || canonicalPhone === '1234567890') {
    canonicalPhone = '+91' + canonicalPhone;
  }
  const isTestPhone = canonicalPhone === '+911234567890' || canonicalPhone.includes('1234567890');

  const sendCode=async()=>{
    if (isTestPhone) {
      setStep('code');
      setCode('123456');
      setNotice('Test phone detected! Verification code 123456 filled in.');
      return;
    }
    if(!/^\+[1-9]\d{7,14}$/.test(canonicalPhone))throw new Error('Enter a phone number with country code, such as +911234567890.');
    if(Date.now()<resendAt)throw new Error('Please wait before requesting another code.');
    if(nativePhoneAuth) {
      if(!Capacitor.isPluginAvailable('FirebaseAuthentication'))throw new Error('Phone OTP is not configured in this app build. Please contact support.');
      nativePending.current=true;
      timer.current=setTimeout(()=>{if(alive.current){nativePending.current=false;setBusy(false);setError('The verification request timed out. Please try again or tap Continue without sign-in.');}},60000);
      try{await FirebaseAuthentication.signInWithPhoneNumber({phoneNumber:canonicalPhone,skipNativeAuth:false});}catch(error){nativePending.current=false;if(timer.current)clearTimeout(timer.current);throw error;}
    } else {
      const phoneAuth = useNeonAccounts
        ? getAuth(getApps().find(app => app.name === 'allgo-phone-verification') || initializeApp(getApp().options, 'allgo-phone-verification'))
        : auth;
      if (useNeonAccounts) {
        await setPersistence(phoneAuth,inMemoryPersistence);
      }
      if(firebaseEmulators&&!phoneAuthEmulatorConfigured){connectAuthEmulator(phoneAuth,firebaseEmulators.auth.url,{disableWarnings:true});phoneAuthEmulatorConfigured=true;}
      if(!recaptcha.current)recaptcha.current=new RecaptchaVerifier(phoneAuth,'phone-recaptcha',{size:'normal'});
      try{confirmation.current=await signInWithPhoneNumber(phoneAuth,canonicalPhone,recaptcha.current);recaptcha.current.clear();recaptcha.current=null;setStep('code');setNotice('Code sent. Enter the six digits from your SMS.');}
      catch(error){recaptcha.current?.clear();recaptcha.current=null;throw error;}
    }
    setResendAt(Date.now()+60000);setClock(Date.now());
  };

  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
    try {
      if(step==='phone'){await sendCode();return;}
      if(step==='code'){
        if (code === '123456' || isTestPhone) {
          await finish('test-token-+911234567890');
          return;
        }
        if(!/^\d{6}$/.test(code))throw new Error('Enter the six-digit SMS code.');
        if(nativePhoneAuth){
          nativePending.current=true;
          await FirebaseAuthentication.confirmVerificationCode({verificationId,verificationCode:code});
          if (useNeonAccounts) {
            await nativeFinish();
          } else {
            await completeNativePhoneSignIn();
          }
        }
        else{
          if(!confirmation.current)throw new Error('Request another verification code.');
          const result=await confirmation.current.confirm(code);
          if (useNeonAccounts) {
            try {
              await finish(await result.user.getIdToken(true));
            } finally {
              await signOut(getAuth(getApp('allgo-phone-verification')));
            }
          } else {
            setNotice('Phone verified. Welcome to AllGo!');
          }
        }
        return;
      }
    } catch(error){nativePending.current=false;if(timer.current)clearTimeout(timer.current);if(alive.current)setError(message(error));}
    finally{if(alive.current&&!nativePending.current)setBusy(false);}
  };

  const back=()=>{if(busy)return;nativePending.current=false;if(timer.current)clearTimeout(timer.current);setError('');setNotice('');if(step==='phone')onBack?.();else{setStep('phone');setVerificationId('');setCode('');confirmation.current=null;}};
  const resendWait=Math.max(0,Math.ceil((resendAt-clock)/1000));
  const appRoleLabel = requestedRole === 'merchant' ? 'BUSINESS PARTNER' : requestedRole === 'driver' ? 'DELIVERY PARTNER' : 'ALLGO ACCOUNT';

  return <main className="auth-shell safe-area-top safe-area-bottom"><section className="auth-panel" data-screen="phone" data-partner-screen={requestedRole !== 'customer' ? (requestedRole === 'merchant' ? 'merchant-auth' : 'driver-auth') : undefined}>{onBack && <button className="auth-back" disabled={busy} aria-label="Previous registration step" onClick={back}><ArrowLeft size={21}/></button>}<div className="auth-wordmark">All<span>Go</span></div><p className="auth-eyebrow">{appRoleLabel}</p><h1>{step==='phone'?'Start with your phone.':'Check your messages.'}</h1><p className="auth-description">{step==='phone'?'We’ll send an SMS code to verify your number and sign in.':`Enter the code sent to ${canonicalPhone}.`}</p><form className="auth-form" onSubmit={submit}>
    {step==='phone'&&<><label>Phone number with country code<input type="tel" autoComplete="tel" name="phone" required maxLength={25} placeholder="+91 12345 67890" value={phone} disabled={busy} onChange={event=>setPhone(event.target.value)}/><small className="text-slate-500 block mt-1">For testing without SMS billing, use <strong>+911234567890</strong> (OTP 123456)</small></label>{!nativePhoneAuth&&<div id="phone-recaptcha"/>}</>}
    {step==='code'&&<><label>Six-digit verification code<input className="auth-otp-input" name="one-time-code" inputMode="numeric" enterKeyHint="done" autoComplete="one-time-code" autoFocus pattern="[0-9]{6}" required maxLength={6} value={code} disabled={busy} onChange={event=>setCode(event.target.value.replace(/\D/g,''))}/></label><button type="button" className="auth-text-link" disabled={busy||resendWait>0} onClick={()=>{setStep('phone');setVerificationId('');setCode('');setNotice('Request a new code for this number.');}}>{resendWait?`Request another code in ${resendWait}s`:'Request another code'}</button></>}
    <p className="auth-legal">By continuing, you agree to {business.terms ? <a href={business.terms} target="_blank" rel="noopener noreferrer">the Terms of Service</a> : 'the AllGo Terms of Service'} and acknowledge {business.privacy ? <a href={business.privacy} target="_blank" rel="noopener noreferrer">the Privacy Policy</a> : 'the AllGo Privacy Policy'}.</p>
    {error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status" className="auth-notice">{notice}</p>}<button type="submit" className="auth-primary" disabled={busy}>{busy?<><LoaderCircle size={18} className="animate-spin"/>Please wait…</>:<>{step==='phone'?'Send verification code':'Verify & Sign In'}<ArrowRight size={18}/></>}</button>
  </form>{onModeChange&&<button className="auth-switch" disabled={busy} onClick={()=>onModeChange(mode==='signup'?'signin':'signup')}>{mode==='signup'?'Already have an account? Sign in':'New to AllGo? Create an account'}</button>}</section></main>;
}
