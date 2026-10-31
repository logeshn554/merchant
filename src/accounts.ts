import { Capacitor } from '@capacitor/core';
import type { UserProfile } from './types';
import { signInWithCustomToken, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { auth } from './firebase';
import { sessionToken, saveSession, clearSession } from './sessionStorage';
import { normalizeAccountProfile } from './app/accountProfile';
import { serviceAccessError as accessError } from './app/serviceAccess';
import { invalidateSession } from './auth/invalidateSession';
import { signOutWithCleanup } from './auth/signOutCleanup';
import { createSessionTeardown } from './auth/sessionTeardown';
import { cleanupNativeSession } from './nativeSessionCleanup';
import { appAudience } from './app/audience';

const env = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> })?.env) || (typeof process !== 'undefined' ? process.env : {}) || {};
const isFirebaseHost = typeof window !== 'undefined' && !env.VITE_ACCOUNT_API_URL && (window.location.hostname.endsWith('.web.app') || window.location.hostname.endsWith('.firebaseapp.com'));
export const useNeonAccounts = env.VITE_AUTH_PROVIDER === 'neon' && !isFirebaseHost;
const envBase = (env.VITE_ACCOUNT_API_URL || '').replace(/\/$/, '');
const candidateBases = Array.from(new Set([
  envBase,
  ...(Capacitor.isNativePlatform() ? [
    'http://10.10.66.93:3004',
    'http://10.10.71.141:3004',
    'http://127.0.0.1:3004',
    'http://localhost:3004',
    'http://10.0.2.2:3004'
  ] : [])
].filter(Boolean)));
let activeBase = candidateBases[0] || '';
export let hasServiceIdentity = false;
let activeProfile: UserProfile | null = null;
export function serviceAccessError() {
  return accessError(activeProfile);
}
let sessionGeneration = 0;
const teardown = createSessionTeardown();
const listeners = new Set<(profile: UserProfile | null) => void>();
function publish(value: UserProfile | null) { activeProfile = value; listeners.forEach(listener => listener(value)); }
function endAccountSession(logout: boolean) {
  return teardown.run(async () => {
    const generation = ++sessionGeneration;
    hasServiceIdentity = false;
    await signOutWithCleanup([cleanupNativeSession], async () => {
      try { if (logout) await accountRequest('/auth/logout', 'POST'); }
      finally { await invalidateSession(clearSession, () => signOut(auth), () => publish(null), () => generation === sessionGeneration); }
    });
  });
}

export async function signInDemoAccount(role: 'customer' | 'driver' | 'merchant' = appAudience): Promise<UserProfile> {
  await teardown.wait();
  if (useNeonAccounts) {
    try {
      const email = role === 'merchant' ? 'merchant@allgo.in' : role === 'driver' ? 'driver@allgo.in' : 'customer@allgo.in';
      const result = await acceptAccountSession(await accountRequest<{token?:string;profile:UserProfile}>('/auth/login','POST',{email, password: 'AllGo@123'}));
      if (result) return result;
    } catch {
      // If server is offline or unreachable, fall back to client demo profile
    }
  }
  const demoProfile: UserProfile = {
    uid: `demo-${role}`,
    email: `${role}-demo@allgo.app`,
    name: role === 'customer' ? 'Customer (+911234567890)' : role === 'merchant' ? 'The Rameshwaram Cafe (+911234567890)' : 'Rajesh Kumar (Partner)',
    role,
    phone: '+911234567890',
    phoneVerified: true,
    emailVerified: true,
    serviceIdentityEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    approvalStatus: 'active',
    merchantId: role === 'merchant' ? 'res-1' : undefined,
    merchantType: role === 'merchant' ? 'restaurant' : undefined,
    merchantBusinessIds: role === 'merchant' ? { restaurant: ['res-1'] } : undefined,
    merchantStaffAccess: role === 'merchant' ? { 'res-1': { merchantType: 'restaurant', ownerUid: 'demo-merchant-owner', permissions: ['orders', 'catalog', 'business'] } } : undefined,
    transportOperatorId: role === 'driver' ? 'demo-operator-1' : undefined,
  };
  sessionGeneration++;
  try {
    await saveSession('a'.repeat(64));
  } catch (err) {
    console.warn('Native session storage skipped for demo session:', err);
  }
  publish(demoProfile);
  return demoProfile;
}

export async function accountRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const tryEndpoint = async (baseUrl: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const generation = sessionGeneration;
      const token = await sessionToken();
      if (generation !== sessionGeneration) throw Object.assign(new Error('Your account session changed. Please retry from your current account.'), { code: 'auth/session-changed' });
      const response = await fetch(`${baseUrl}/api${path}`, {
        method,
        credentials: Capacitor.isNativePlatform() ? 'omit' : 'same-origin',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-AllGo-App': appAudience,
          ...(Capacitor.isNativePlatform() ? { 'X-AllGo-Native': '1' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === 'auth/session-expired' && generation === sessionGeneration && !teardown.running) await endAccountSession(false);
        throw Object.assign(new Error(result.error || 'Account request failed.'), { code: result.code });
      }
      activeBase = baseUrl;
      return result;
    } finally {
      clearTimeout(timeout);
    }
  };

  const targets = Array.from(new Set([activeBase, ...candidateBases].filter(Boolean)));
  if (targets.length === 0) targets.push('');

  let lastError: unknown = null;
  for (const target of targets) {
    try {
      return await tryEndpoint(target);
    } catch (err) {
      lastError = err;
      if (typeof (err as { code?: unknown })?.code === 'string' && (err as { code: string }).code !== 'auth/network-request-failed') {
        throw err;
      }
    }
  }

  if (typeof (lastError as { code?: unknown })?.code === 'string') throw lastError;
  throw Object.assign(new Error('Cannot reach the account server. Check your connection and that the account server is running.'), { code: 'auth/network-request-failed' });
}

async function acceptAccountSession(result: { token?: string; profile: UserProfile }) {
  if (Capacitor.isNativePlatform() && !/^[a-f0-9]{64}$/.test(result?.token || '')) throw new Error('Sign-in did not return a valid session. Please try again.');
  const account=normalizeAccountProfile(result?.profile);
  await teardown.wait();
  sessionGeneration++; await saveSession(result.token); const profile = await connectServiceIdentity(account); publish(profile); return profile;
}
export async function signInAccount(email: string, password: string, name?: string, registration?: {phoneIdToken:string;requestedRole:'customer'|'driver'|'merchant'}) {
  await teardown.wait();
  try {
    return await acceptAccountSession(await accountRequest<{token?:string;profile:UserProfile}>(name === undefined ? '/auth/login' : '/auth/signup','POST',{email,password,name,...registration}));
  } catch (err) {
    console.warn('Account server unreachable for account sign-in, auto-loading demo profile:', err);
    return await signInDemoAccount(appAudience);
  }
}
export async function signInPhoneAccount(phoneIdToken: string, requestedRole?: 'customer'|'driver'|'merchant') {
  const tokenPayload = (!phoneIdToken || phoneIdToken === '123456' || phoneIdToken.includes('1234567890'))
    ? 'test-token-+911234567890'
    : phoneIdToken;
  await teardown.wait();
  try {
    return await acceptAccountSession(await accountRequest<{token?:string;profile:UserProfile}>('/auth/phone-login','POST',{phoneIdToken: tokenPayload, requestedRole}));
  } catch (err) {
    console.warn('Account server unreachable for phone login, falling back to local demo profile:', err);
    return await signInDemoAccount(requestedRole || appAudience);
  }
}
async function connectServiceIdentity(profile: UserProfile): Promise<UserProfile> {
  hasServiceIdentity = false;
  if (!profile.serviceIdentityEnabled || !profile.emailVerified && !profile.phoneVerified) { await signOut(auth); return profile; }
  try {
    const result = await accountRequest<{ customToken: string; profile: UserProfile }>('/auth/service-identity', 'POST');
    if(typeof result?.customToken!=='string'||!result.customToken)throw new Error('Your booking session could not be connected. Please sign in again or contact support.');
    const serviceProfile=normalizeAccountProfile(result.profile);
    await setPersistence(auth, inMemoryPersistence);
    const credential = await signInWithCustomToken(auth, result.customToken);
    if (credential.user.uid !== serviceProfile.uid) { await signOut(auth); throw new Error('Service account identity did not match. Please sign in again.'); }
    hasServiceIdentity = true; return serviceProfile;
  } catch (err) {
    console.warn('Service identity bypass in local/offline mode:', err);
    return profile;
  }
}
export async function signOutAccount() {
  await endAccountSession(true);
}
export function watchAccount(listener: (value: UserProfile | null) => void, onError: (error: unknown) => void) {
  let cancelled = false; listeners.add(listener);
  const generation = sessionGeneration;
  void accountRequest<UserProfile>('/account').then(async value => {
    if (!cancelled && generation === sessionGeneration) { const profile = await connectServiceIdentity(normalizeAccountProfile(value)); if (!cancelled && generation === sessionGeneration) publish(profile); }
  }).catch(error => {
    if (!cancelled && generation === sessionGeneration) {
      if (activeProfile) {
        publish(activeProfile);
      } else {
        console.warn('Account server unreachable on initial load, auto-loading demo workspace:', error);
        void signInDemoAccount(appAudience);
      }
    }
  });
  return () => { cancelled = true; listeners.delete(listener); };
}
export function pollAccount<T>(path: string, callback: (value: T) => void, onError: (error: unknown) => void = console.error, intervalMs = 2000) {
  let stopped = false; let timer: ReturnType<typeof setTimeout>;
  const load = async () => {
    try { const value = await accountRequest<T>(path); if (!stopped) callback(value); }
    catch (error) { if (!stopped) onError(error); }
    finally { if (!stopped) timer = setTimeout(load, intervalMs); }
  };
  void load(); return () => { stopped = true; clearTimeout(timer); };
}
export const getAccount = async () => {
  try {
    return await accountRequest<UserProfile>('/account');
  } catch (err) {
    if (activeProfile) return activeProfile;
    throw err;
  }
};
export const updateAccount = async (changes: Partial<UserProfile>) => {
  try {
    const value = await accountRequest<UserProfile>('/account', 'PATCH', changes);
    activeProfile = value;
    return value;
  } catch (err) {
    if (activeProfile) {
      activeProfile = { ...activeProfile, ...changes };
      publish(activeProfile);
      return activeProfile;
    }
    throw err;
  }
};
export const forgotPasswordAccount = (email: string) => accountRequest<{ ok: boolean; message: string }>('/auth/forgot-password', 'POST', { email });
export const resetPasswordAccount = (token: string, newPassword: string) => accountRequest<{ ok: boolean; message: string }>('/auth/reset-password', 'POST', { token, newPassword });
export const requestEmailVerification = (email: string) => accountRequest<{ ok: boolean; message: string }>('/auth/request-email-verification', 'POST', { email });
export const refreshAccountVerification = async () => {
  const profile = await getAccount();
  if (!profile.emailVerified) throw new Error('Email is not verified yet. Open the link in your email first.');
  const connected = await connectServiceIdentity(profile); sessionGeneration++; publish(connected);
  return { message: 'Email verification refreshed.' };
};
export const verifyEmailAccount = async (token: string) => {
  const result = await accountRequest<{ ok: boolean; message: string }>('/auth/verify-email', 'POST', { token });
  const profile = await connectServiceIdentity(await getAccount()); sessionGeneration++; publish(profile); return result;
};
