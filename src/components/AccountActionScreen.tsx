import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { confirmPasswordReset, applyActionCode } from 'firebase/auth';

export default function AccountActionScreen() {
  const [params] = useState(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const mode = search.get('mode') || hash.get('action') || hash.get('mode') || '';
    const code = search.get('oobCode') || hash.get('token') || hash.get('oobCode') || '';
    return { mode, code };
  });
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);

  const isReset = params.mode === 'resetPassword' || params.mode === 'reset';
  const isVerify = params.mode === 'verifyEmail' || params.mode === 'verify';
  const valid = Boolean(params.code && (isReset || isVerify));

  return <main className="auth-shell"><section className="auth-panel grid content-center gap-4"><h1>{isReset ? 'Reset your password' : 'Verify your email'}</h1>
    {valid && !message && <form className="grid gap-4" onSubmit={event => {
      event.preventDefault(); if (busy) return;
      if (isReset && password !== repeat) { setError('Passwords do not match.'); return; }
      setBusy(true); setError('');
      void (isReset ? confirmPasswordReset(auth, params.code, password) : applyActionCode(auth, params.code))
        .then(() => { setMessage(isReset ? 'Your password has been successfully reset. You can now sign in.' : 'Your email has been verified. You can now return to AllGo.'); setPassword(''); setRepeat(''); })
        .catch(error => setError(error instanceof Error ? error.message : 'The link could not be confirmed.'))
        .finally(() => setBusy(false));
    }}>
      <p>{isVerify ? 'Confirm your email address to complete verification.' : 'Choose a new password for your AllGo account.'}</p>
      {isReset && <><label>New password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded border p-3"/></label><label>Confirm password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" disabled={busy} value={repeat} onChange={event => setRepeat(event.target.value)} className="mt-1 w-full rounded border p-3"/></label></>}
      <button className="auth-primary" disabled={busy}>{busy ? 'Confirming…' : isReset ? 'Update password' : 'Confirm verification'}</button>
    </form>}
    {!valid && !message && <p role="alert">This account link is invalid or has expired. Please request a new link.</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}<a className="auth-switch" href="/">Return to AllGo</a>
  </section></main>;
}
