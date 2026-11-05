import { createRequire } from 'node:module';
import { assertPhoneTokenEnvironment, phoneRegistrationIdentity, phoneVerificationError } from './phoneRegistrationPolicy.mjs';
import { projectSavedAddress } from './savedAddressPolicy.mjs';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
let services;
const activeProjectId = () => process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'promtwars222';
export const identityBridgeEnabled = () => process.env.ACCOUNT_FIREBASE_BRIDGE_ENABLED === 'true';
export async function verifyPhoneIdentity(token) {
  if (typeof token !== 'string' || token.length < 100 || token.length > 8000) throw Object.assign(new Error('Verify your phone to continue.'), { status: 401, code: 'auth/invalid-credential' });
  assertPhoneTokenEnvironment(token, activeProjectId(), process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!identityBridgeEnabled()) {
    if (process.env.NODE_ENV !== 'production' && !process.env.ALLGO_ENVIRONMENT) {
      let claims;
      try {
        const parts = token.split('.');
        claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      } catch {
        throw Object.assign(new Error('Verify your phone to continue.'), { status: 401, code: 'auth/invalid-credential' });
      }
      return phoneRegistrationIdentity(claims);
    }
    throw Object.assign(new Error('Phone verification is not configured. Please contact support.'), { status: 503, code: 'unavailable' });
  }
  try {
    const { auth } = firebase();
    const claims = await auth.verifyIdToken(token, true);
    const identity = phoneRegistrationIdentity(claims);
    const user = await auth.getUser(identity.uid);
    if (user.disabled || user.phoneNumber !== identity.phone) throw Object.assign(new Error('This phone identity is unavailable.'), { status: 403, code: 'permission-denied' });
    return identity;
  } catch (error) { throw phoneVerificationError(error); }
}
function firebase() {
  if (!services) {
    const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getFirestore, Timestamp } = require('firebase-admin/firestore');
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIRESTORE_DATABASE_ID) throw new Error('Configure the server Firebase project and database before enabling the identity bridge.');
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try { credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)); }
      catch (err) { console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_JSON', err); }
    }
    if (!credential) {
      try { credential = applicationDefault(); } catch {}
    }
    const app = getApps().find(item => item.name === 'allgo-accounts') || initializeApp({ ...(credential ? { credential } : {}), projectId: process.env.FIREBASE_PROJECT_ID }, 'allgo-accounts');
    services = { auth: getAuth(app), db: getFirestore(app, process.env.FIRESTORE_DATABASE_ID), Timestamp };
  }
  return services;
}
export async function revokeBridgeSessions(accountId, sessionHash, keepSessionHash) {
  if (!identityBridgeEnabled()) return;
  const { db } = firebase();
  if (sessionHash) { await db.doc(`bridge_sessions/${sessionHash}`).delete(); return; }
  const sessions = await db.collection('bridge_sessions').where('neonAccountId', '==', accountId).get();
  const targets = sessions.docs.filter(doc => doc.id !== keepSessionHash);
  for (let offset = 0; offset < targets.length; offset += 400) {
    const batch = db.batch(); targets.slice(offset, offset + 400).forEach(doc => batch.delete(doc.ref)); await batch.commit();
  }
}
