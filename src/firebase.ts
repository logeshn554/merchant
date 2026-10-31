import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  connectFirestoreEmulator, 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  memoryLocalCache 
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { initializeAppCheck, CustomProvider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { Capacitor } from '@capacitor/core';
import { FirebaseAppCheck } from '@capacitor-firebase/app-check';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import firebaseConfig from '../firebase-applet-config.json';
import { firebaseEmulatorEndpoints } from './app/firebaseEmulators.js';

const env: Record<string, string | undefined> = 
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env) ||
  (typeof process !== 'undefined' && process.env) ||
  {};

export const firebaseEmulators = firebaseEmulatorEndpoints({
  auth: env.VITE_FIREBASE_AUTH_EMULATOR_URL,
  firestore: env.VITE_FIREBASE_FIRESTORE_EMULATOR_URL,
  functions: env.VITE_FIREBASE_FUNCTIONS_EMULATOR_URL,
}, env.MODE || '');

// Initialize Firebase
const releaseEnvironment = ['staging', 'production'].includes(env.MODE || '');
if (releaseEnvironment) {
  for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_DATABASE_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID']) {
    if (!env[key]?.trim()) throw new Error(`Release Firebase configuration is missing ${key}.`);
  }
}
const clientConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
};
for (const field of ['apiKey', 'appId', 'projectId', 'authDomain'] as const) {
  if (!clientConfig[field]?.trim()) throw new Error(`Firebase configuration is missing ${field}.`);
}
const app = getApps().length ? getApp() : initializeApp(clientConfig);
if (env.VITE_APP_CHECK_ENABLED === 'true') {
  if (Capacitor.isNativePlatform()) {
    const ready = FirebaseAppCheck.initialize({ debugToken: env.DEV === 'true' && env.VITE_APP_CHECK_DEBUG === 'true', isTokenAutoRefreshEnabled: true });
    initializeAppCheck(app, { isTokenAutoRefreshEnabled: true, provider: new CustomProvider({ getToken: async () => {
      await ready;
      const result = await FirebaseAppCheck.getToken({ forceRefresh: false });
      if (!result.token || !Number.isFinite(result.expireTimeMillis)) throw new Error('Device attestation did not return a valid token.');
      return { token: result.token, expireTimeMillis: result.expireTimeMillis! };
    } }) });
  } else {
    const siteKey = env.VITE_APP_CHECK_SITE_KEY;
    if (!siteKey) throw new Error('Web App Check site key is missing.');
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  }
}

const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

function initFirestoreInstance() {
  const isBrowserWithIndexedDb = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
  try {
    return initializeFirestore(app, {
      localCache: isBrowserWithIndexedDb
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache()
    }, firestoreDatabaseId);
  } catch {
    return getFirestore(app, firestoreDatabaseId);
  }
}

export const db = initFirestoreInstance();
export const auth = getAuth(app);
export const functions = getFunctions(app, 'asia-south1');
if (firebaseEmulators) {
  connectAuthEmulator(auth, firebaseEmulators.auth.url, { disableWarnings: true });
  connectFirestoreEmulator(db, firebaseEmulators.firestore.host, firebaseEmulators.firestore.port);
  connectFunctionsEmulator(functions, firebaseEmulators.functions.host, firebaseEmulators.functions.port);
}
let nativeAuthEmulatorReady: Promise<void> | undefined;
export function ensureFirebaseAuthEmulator() {
  if (!firebaseEmulators || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('FirebaseAuthentication')) return Promise.resolve();
  nativeAuthEmulatorReady ??= FirebaseAuthentication.useEmulator({ host: firebaseEmulators.auth.host, port: firebaseEmulators.auth.port });
  return nativeAuthEmulatorReady;
}
export const googleProvider = new GoogleAuthProvider();

// Error diagnostic helper as specified in firebase-integration-rpc skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Firestore request failed', { operationType, path, code: (error as { code?: string })?.code || 'unknown' });
  throw error instanceof Error ? error : new Error('The request could not be completed.');
}

