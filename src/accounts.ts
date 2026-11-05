import type { UserProfile } from './types';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { clearSession } from './sessionStorage';
import { invalidateSession } from './auth/invalidateSession';
import { signOutWithCleanup } from './auth/signOutCleanup';
import { createSessionTeardown } from './auth/sessionTeardown';
import { cleanupNativeSession } from './nativeSessionCleanup';

let activeProfile: UserProfile | null = null;
let sessionGeneration = 0;
const teardown = createSessionTeardown();
const listeners = new Set<(profile: UserProfile | null) => void>();

function publish(value: UserProfile | null) {
  activeProfile = value;
  listeners.forEach(listener => listener(value));
}

export function endAccountSession() {
  return teardown.run(async () => {
    const generation = ++sessionGeneration;
    await signOutWithCleanup([cleanupNativeSession], async () => {
      await invalidateSession(
        clearSession,
        () => signOut(auth),
        () => publish(null),
        () => generation === sessionGeneration
      );
    });
  });
}

export async function signOutAccount() {
  await endAccountSession();
}

export function watchAccount(listener: (value: UserProfile | null) => void, onError: (error: unknown) => void) {
  listeners.add(listener);
  const unsubscribeAuth = onAuthStateChanged(auth, user => {
    if (!user) publish(null);
  }, error => {
    onError(error);
  });
  return () => {
    listeners.delete(listener);
    unsubscribeAuth();
  };
}

export const getAccount = async (): Promise<UserProfile | null> => {
  return activeProfile;
};
