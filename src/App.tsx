import { appTitle } from './app/audience';
import { subscribeWorkspaceBookings } from './app/bookingSubscription';
import { subscriptionGroup } from './data/subscriptionGroup';
import { workspaceFor, type AppAudience } from './app/workspace';
import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { initializeNativeNotifications, nativeSignOut } from './nativeNotifications';
import AuthScreen, { authMessage } from './components/AuthScreen';
import {
  getOrCreateUserProfile,
  listenToAccountProfile,
  listenToBookings,
  listenToCustomerBookings,
  listenToDriverBookings,
  listenToDriverProfiles,
  listenToMerchantBookings,
  reverseServiceLocation,
  listenToUserPartnerApplications,
  type UserPartnerApplication
} from './data/firestoreHelper';
import { useCurrentLocation } from './location/useCurrentLocation';
import { Booking, DriverProfile, UserProfile } from './types';
import { isLegacyMerchantType } from './domain/merchant';

declare const __ALLGO_AUDIENCE__: AppAudience;
const appAudience: AppAudience = typeof __ALLGO_AUDIENCE__ !== 'undefined' ? __ALLGO_AUDIENCE__ : 'customer';

const PartnerNotifications = appAudience === 'customer' ? null : lazy(() => import('./components/PartnerNotifications'));
const CustomerApp = appAudience === 'customer' ? lazy(() => import('./components/CustomerApp')) : null;
const AdminDashboard: React.ComponentType<{ activeBookings: Booking[]; driverProfiles: DriverProfile[] }> | null = null;
const MerchantPortal = appAudience === 'merchant' ? lazy(() => import('./components/MerchantPortal')) : null;
const DriverApp = appAudience === 'driver' ? lazy(() => import('./components/DriverApp')) : null;
const TransportOperatorDashboard = appAudience === 'merchant' ? lazy(() => import('./components/TransportOperatorDashboard')) : null;
const PartnerApplicationPanel = appAudience !== 'customer' ? lazy(() => import('./components/PartnerApplicationPanel')) : null;
const MerchantRegistrationWizard = appAudience === 'merchant' ? lazy(() => import('./components/MerchantRegistrationWizard')) : null;
const MerchantStatusScreen = appAudience === 'merchant' ? lazy(() => import('./components/MerchantStatusScreen')) : null;

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | UserProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [retry, setRetry] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingError, setBookingError] = useState('');
  const [bookingRetry, setBookingRetry] = useState(0);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const accountUid = useRef<string | null>(null);
  const locationHook = useCurrentLocation();
  const [detectedAddress, setDetectedAddress] = useState<string>('');
  const [merchantApplications, setMerchantApplications] = useState<UserPartnerApplication[]>([]);
  const [forceRegistrationView, setForceRegistrationView] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || appAudience !== 'customer') return;
    let active = true;
    void locationHook.request().then(async pos => {
      if (!active || !pos) return;
      try {
        const list = await reverseServiceLocation(pos.latitude, pos.longitude);
        const best = list.find((loc: any) => !loc.partialMatch) || list[0];
        if (active && best?.address) {
          setDetectedAddress(best.address);
        }
      } catch (err) {
        console.warn('Reverse geocoding detected location skipped:', err);
      }
    });
    return () => { active = false; };
  }, [currentUser?.uid]);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void initializeNativeNotifications().then(cleanup => {
      if (disposed) cleanup();
      else stop = cleanup;
    }).catch(error => console.error('Native notification initialization failed', error));
    return () => { disposed = true; stop?.(); };
  }, [currentUser?.uid]);

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const request = ++generation;
      setCurrentUser(user);
      setBookings([]);
      setDrivers([]);
      setUserProfile(null);
      setProfileError('');
      setAuthChecking(true);
      if (!user) {
        setUserProfile(null);
        setAuthChecking(false);
        return;
      }
      void (async () => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          const email = user.email || '';
          const profile = await Promise.race([
            getOrCreateUserProfile(user.uid, email, user.displayName || 'AllGo customer', 'customer'),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => reject(Object.assign(new Error('Profile request timed out'), { code: 'unavailable' })), 15000);
            }),
          ]);
          if (profile.role === 'admin' && (await user.getIdTokenResult()).claims.admin !== true) {
            throw Object.assign(new Error('Operations claim required'), { code: 'permission-denied' });
          }
          if (active && request === generation) setUserProfile(profile);
        } catch (error) {
          if (active && request === generation) setProfileError(authMessage(error));
        } finally {
          clearTimeout(timeout);
          if (active && request === generation) setAuthChecking(false);
        }
      })();
    }, (error) => {
      setProfileError(authMessage(error));
      setAuthChecking(false);
    });
    return () => { active = false; unsubscribe(); };
  }, [retry]);

  useEffect(() => {
    if (!currentUser || !userProfile) return;
    return listenToAccountProfile(
      currentUser.uid,
      profile => { setUserProfile(profile); setProfileError(''); },
      error => setProfileError(authMessage(error))
    );
  }, [currentUser?.uid, Boolean(userProfile)]);

  useEffect(() => {
    if (!currentUser?.uid || appAudience !== 'merchant') return;
    return listenToUserPartnerApplications(
      currentUser.uid,
      apps => setMerchantApplications(apps),
      err => console.warn('Partner applications listener:', err)
    );
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || !userProfile) return;
    setBookings([]);
    setDrivers([]);
    setBookingError('');
    const group = subscriptionGroup<Booking[]>(setBookings, () => [], error => {
      setBookings([]);
      setDrivers([]);
      setBookingError(authMessage(error));
    });
    group.add(subscribeWorkspaceBookings(appAudience, currentUser.uid, userProfile, {
      listenToBookings, listenToCustomerBookings, listenToDriverBookings, listenToMerchantBookings,
    }, group.publish, group.fail));
    let active = true;
    if (workspaceFor(appAudience, userProfile) === 'admin') {
      group.add(listenToDriverProfiles(rows => { if (active) setDrivers(rows); }, group.fail));
    }
    group.add(() => { active = false; });
    return group.stop;
  }, [currentUser?.uid, userProfile?.role, userProfile?.merchantId, userProfile?.merchantType, userProfile?.merchantBusinessIds, userProfile?.merchantStaffAccess, userProfile?.transportOperatorId, bookingRetry]);

  if (authChecking) {
    return (
      <div className="auth-shell safe-area-top safe-area-bottom" data-screen="splash" data-partner-screen={appAudience === 'merchant' ? 'merchant-splash' : appAudience === 'driver' ? 'driver-splash' : undefined}>
        <section className="auth-panel grid place-content-center text-center py-12">
          <div className="brand-mark mx-auto mb-4" aria-hidden="true">A<span /></div>
          <div className="auth-wordmark">All<span>Go</span></div>
          <p role="status" className="mt-3 text-xs font-semibold text-slate-500 animate-pulse">Opening your account…</p>
        </section>
      </div>
    );
  }

  if (profileError && (!currentUser || !userProfile)) {
    return (
      <div className="auth-shell">
        <section className="auth-panel grid content-center gap-4">
          <h1>Let’s reconnect.</h1>
          <p role="alert">{profileError}</p>
          <button className="auth-primary" onClick={() => setRetry(value => value + 1)}>Try again</button>
          {currentUser ? (
            <button className="auth-switch" onClick={() => void nativeSignOut()}>Sign out</button>
          ) : (
            <button className="auth-switch" onClick={() => setProfileError('')}>Open sign-in options</button>
          )}
        </section>
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return <AuthScreen />;
  }

  if (bookingError) {
    return (
      <div className="auth-shell">
        <section className="auth-panel grid content-center gap-4">
          <h1>Order updates are unavailable</h1>
          <p role="alert">{bookingError}</p>
          <p>Reconnect to load your current orders. Previously loaded order details have been cleared.</p>
          <button type="button" className="auth-primary" onClick={() => setBookingRetry(value => value + 1)}>Retry order updates</button>
          <button type="button" className="auth-switch" onClick={() => void nativeSignOut()}>Sign out</button>
        </section>
      </div>
    );
  }

  const workspace = workspaceFor(appAudience, userProfile);
  const merchantType = isLegacyMerchantType(userProfile.merchantType)
    ? userProfile.merchantType
    : userProfile.merchantBusinessIds?.restaurant?.length
      ? 'restaurant'
      : userProfile.merchantBusinessIds?.grocery?.length
        ? 'grocery'
        : undefined;

  // 1. Admin workspace
  if (workspace === 'admin') {
    return (
      <div className="allgo-workspace">
        <header className="allgo-workspace-header">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-600 px-2.5 py-1 font-black text-white">AllGo</div>
            <span className="text-xs capitalize text-slate-500">Operations Hub</span>
          </div>
          <button type="button" aria-label="Sign out" title="Sign out" onClick={() => nativeSignOut()} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
            <LogOut size={18} />
          </button>
        </header>
        <main className="allgo-workspace-main max-w-7xl overflow-auto">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-slate-500">Opening AllGo…</div>}>
            {AdminDashboard ? <AdminDashboard activeBookings={bookings} driverProfiles={drivers} /> : <p role="alert">Operations is not included in this app build.</p>}
          </Suspense>
        </main>
      </div>
    );
  }

  // 2. Partner Onboarding / Unassigned / Denied
  if (workspace === 'application' || workspace === 'denied' || workspace === 'unassigned') {
    // Dedicated Merchant Flow: Wizard & Status Tracker
    if (appAudience === 'merchant') {
      if (userProfile.suspended || userProfile.disabled) {
        return (
          <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">Checking account status…</div>}>
            {MerchantStatusScreen && (
              <MerchantStatusScreen
                userSuspended={true}
                onSignOut={() => void nativeSignOut()}
                onRefresh={() => setRetry(v => v + 1)}
              />
            )}
          </Suspense>
        );
      }

      if (merchantApplications.length > 0 && !forceRegistrationView) {
        return (
          <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">Opening application status…</div>}>
            {MerchantStatusScreen && (
              <MerchantStatusScreen
                application={merchantApplications[0]}
                onContinueDraft={() => setForceRegistrationView(true)}
                onSignOut={() => void nativeSignOut()}
                onRefresh={() => setRetry(v => v + 1)}
                onEnterDashboard={() => setRetry(v => v + 1)}
              />
            )}
          </Suspense>
        );
      }

      return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">Opening onboarding wizard…</div>}>
          {MerchantRegistrationWizard ? (
            <MerchantRegistrationWizard
              userId={currentUser.uid}
              initialPhone={userProfile.phone || (currentUser as User).phoneNumber || ''}
              initialName={userProfile.name}
              onApplicationSubmitted={() => {
                setForceRegistrationView(false);
              }}
              onCancel={merchantApplications.length > 0 ? () => setForceRegistrationView(false) : undefined}
            />
          ) : (
            <p role="alert">Merchant onboarding is not included in this app build.</p>
          )}
        </Suspense>
      );
    }

    // Driver & Other Partner fallback
    return (
      <main className="partner-onboarding">
        <header>
          <div className="auth-wordmark">All<span>Go</span></div>
          <p className="auth-eyebrow">{appTitle}</p>
          <h1>{workspace === 'application' ? 'Apply to become an AllGo partner' : 'Partner workspace unavailable'}</h1>
        </header>
        {workspace === 'application' ? (
          <>
            <p>Submit your application for review. Approval and an assigned partner role are required before accepting work.</p>
            {PartnerApplicationPanel ? (
              <Suspense fallback={<p role="status">Opening application…</p>}>
                <PartnerApplicationPanel
                  userId={currentUser.uid}
                  initialType={appAudience === 'driver' ? 'driver' : 'restaurant'}
                  initialName={userProfile.name}
                  initialPhone={userProfile.phone}
                />
              </Suspense>
            ) : <p role="alert">Partner registration is not included in this app build.</p>}
          </>
        ) : (
          <p role="alert">
            {workspace === 'unassigned'
              ? 'Your merchant account has no assigned business. Contact AllGo operations to complete your setup.'
              : `Sign in with your approved ${appAudience} account to open this app.`}
          </p>
        )}
        <button type="button" className="auth-switch" onClick={() => void nativeSignOut()}>Sign out</button>
      </main>
    );
  }

  // 3. Merchant or Driver workspace
  if (workspace === 'merchant' || workspace === 'driver') {
    return (
      <div className="allgo-workspace">
        {profileError && (
          <aside role="alert" className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Account updates are temporarily unavailable. {profileError}
          </aside>
        )}
        <header className="allgo-workspace-header">
          <strong>{appTitle}</strong>
          <button type="button" aria-label="Sign out" onClick={() => void nativeSignOut()} className="rounded-xl p-3 text-rose-600">
            <LogOut size={19}/>
          </button>
        </header>
        {PartnerNotifications && (
          <Suspense fallback={null}>
            <PartnerNotifications/>
          </Suspense>
        )}
        <main className="allgo-workspace-main max-w-md overflow-hidden">
          <Suspense fallback={<p role="status">Opening your workspace…</p>}>
            {workspace === 'merchant' ? (
              userProfile.transportOperatorId ? (
                TransportOperatorDashboard ? <TransportOperatorDashboard key={currentUser.uid} userId={currentUser.uid}/> : <p role="alert">Transport operations are not included in this app build.</p>
              ) : (
                MerchantPortal && merchantType ? <MerchantPortal key={currentUser.uid} userId={currentUser.uid} activeBookings={bookings} merchantId={userProfile.merchantId || userProfile.merchantBusinessIds?.restaurant?.[0] || userProfile.merchantBusinessIds?.grocery?.[0]} merchantType={merchantType}/> : <p role="alert">This seller vertical is not enabled in the current merchant workspace.</p>
              )
            ) : (
              DriverApp ? <DriverApp key={currentUser.uid} userId={currentUser.uid} userName={userProfile.name} activeBookings={bookings} detectedLat={locationHook.coords?.latitude} detectedLng={locationHook.coords?.longitude}/> : <p role="alert">Driver operations are not included in this app build.</p>
            )}
          </Suspense>
        </main>
      </div>
    );
  }

  // 4. Customer is the default remaining workspace
  return (
    <div className="allgo-workspace">
      {profileError && (
        <aside role="alert" className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Account updates are temporarily unavailable. Your current screen is preserved. {profileError}
        </aside>
      )}
      <main className="mx-auto h-full w-full max-w-md">
        {CustomerApp ? (
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-slate-500">Opening AllGo…</div>}>
            <CustomerApp
              key={currentUser.uid}
              userId={currentUser.uid}
              userName={userProfile.name}
              activeBookings={bookings.filter(booking => booking.customerId === currentUser.uid)}
              userProfile={userProfile}
              detectedAddress={detectedAddress}
              onSignOut={() => nativeSignOut()}
            />
          </Suspense>
        ) : <p role="alert">Customer ordering is not included in this app build.</p>}
      </main>
    </div>
  );
}
