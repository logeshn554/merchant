import { useState } from 'react';
import { auth } from '../firebase';
import { sendEmailVerification } from 'firebase/auth';

export default function VerifyAccount({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sendLink = async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!auth.currentUser) throw new Error('Sign in before requesting verification.');
      await sendEmailVerification(auth.currentUser);
      setMessage('Verification link sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification email could not be sent.');
    } finally {
      setBusy(false);
    }
  };
  const refreshStatus = async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!auth.currentUser) throw new Error('Sign in before refreshing status.');
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setMessage('Email verified! You may continue.');
      } else {
        setError('Email is not verified yet. Please check the link sent to your inbox.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh verification status.');
    } finally {
      setBusy(false);
    }
  };
  return <main className="auth-shell safe-area-top safe-area-bottom"><section className="auth-panel grid content-center gap-4"><h1>Verify your email</h1><p>Confirm {email} to connect your account to AllGo services.</p><button className="auth-primary" disabled={busy} onClick={() => void sendLink()}>Send verification link</button><button className="auth-primary" disabled={busy} onClick={() => void refreshStatus()}>I verified my email — refresh status</button>{message && <p role="status" aria-live="polite">{message}</p>}{error && <p role="alert" className="auth-error">{error}</p>}<button className="auth-switch" disabled={busy} onClick={() => void onSignOut().catch(err => setError(err instanceof Error ? err.message : 'Sign out failed.'))}>Sign out</button></section></main>;
}
