import ParcelOrderDetails from './ParcelOrderDetails';
import BookingNotificationNotice from './BookingNotificationNotice';
import { useBookingNotification } from '../app/useBookingNotification';
import { finishedBooking } from '../app/bookingNotification';
import TransportOrderDetails from './TransportOrderDetails';
import TakeoverOrderDetails from './TakeoverOrderDetails';
import MultiStopRouteSheet from './MultiStopRouteSheet';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle2, Navigation, DollarSign, Power, ToggleLeft, ToggleRight, 
  MapPin, Check, Eye, Clock, ShieldAlert, Award, FileText, Send, MessageSquare, Bell,
  Banknote, Trophy, Star, TrendingUp, Globe
} from 'lucide-react';
import { Booking, DriverProfile, DriverLedgerEntry, DriverRejectionReason } from '../types';
import { driverArrivalEligibility } from './driverArrivalEligibility';
import { createPayoutRequest, createSupportTicket, getOrCreateDriverProfile, updateDriverStatus, updateDriverLocation, acceptDriverBooking, rejectDriverBooking, advanceDriverBooking, listenToDriverLocation, listenToDriverLedger, sendChatMessage, listenToChatMessages, getDeliverySignature, listenToUserNotifications, markUserNotificationsRead, requestTransportOperatorLink, listDriverBookingHistory, triggerDriverEmergencySos, type UserNotification } from '../data/firestoreHelper';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import PayoutRequests from './PayoutRequests';
import DriverPayoutManager from './DriverPayoutManager';
import DriverEarningEstimate from './DriverEarningEstimate';
import OfferCountdownTimer from './OfferCountdownTimer';
import DriverPerformanceLeaderboard from './DriverPerformanceLeaderboard';
import DriverEmergencyModal from './DriverEmergencyModal';
import BookingExceptionPanel from './BookingExceptionPanel';
import AccountDataExport from './AccountDataExport';
import { useFeedbackDialog } from './useFeedbackDialog';
import { usesAndroidLocation, usesNativeLocation, locationConsent, startNativeDriverLocation, stopNativeDriverLocation, nativeDriverLocationStatus } from '../driverLocation';
import DeliverySignaturePad from './DeliverySignaturePad';
import TransportInspectionForm from './TransportInspectionForm';
import TransportTollClaimForm from './TransportTollClaimForm';
import { enableOrderNotifications } from '../nativeNotifications';
import MaskedCallButton from './MaskedCallButton';
import { getTodayIST } from '../utils/dateUtils';
import { getStoredLanguage, setStoredLanguage, t, type SupportedLanguage } from '../i18n';

interface DriverAppProps {
  userId: string;
  userName: string;
  activeBookings: Booking[];
  detectedLat?: number;
  detectedLng?: number;
}

export default function DriverApp({ userId, userName, activeBookings, detectedLat, detectedLng }: DriverAppProps) {
  const { alert, confirm, dialog } = useFeedbackDialog();
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(() => {
    return (typeof detectedLat === 'number' && typeof detectedLng === 'number') ? { lat: detectedLat, lng: detectedLng } : null;
  });
  useEffect(() => {
    if (typeof detectedLat === 'number' && typeof detectedLng === 'number' && !driverCoords) {
      setDriverCoords({ lat: detectedLat, lng: detectedLng });
    }
  }, [detectedLat, detectedLng, driverCoords]);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationRetry, setLocationRetry] = useState(0);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [vehicleType, setVehicleType] = useState<DriverProfile['vehicleType']>('bike');
  const [vehicleNo, setVehicleNo] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [operatorIdInput, setOperatorIdInput] = useState('');
  const [operatorLinkMessage, setOperatorLinkMessage] = useState('');
  const [operatorLinkBusy, setOperatorLinkBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const supportRequest = useRef<{ key: string; id: string } | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [pickupCode, setPickupCode] = useState('');
  const [signatureProofId, setSignatureProofId] = useState('');
  const [transportPickupInspectionId, setTransportPickupInspectionId] = useState('');
  const [transportDeliveryInspectionId, setTransportDeliveryInspectionId] = useState('');
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<DriverRejectionReason>('too_far');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [activeSubView, setActiveSubView] = useState<'orders' | 'wallet' | 'support' | 'profile' | 'notifications' | 'performance' | null>(null);
  const [historyBookings, setHistoryBookings] = useState<Booking[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadDriverHistory = async (cursorToUse?: string | null) => {
    try {
      setHistoryLoading(true);
      setHistoryError('');
      const res = await listDriverBookingHistory({ limit: 15, cursor: cursorToUse || undefined });
      if (cursorToUse) {
        setHistoryBookings(prev => [...prev, ...res.bookings]);
      } else {
        setHistoryBookings(res.bookings);
      }
      setHistoryCursor(res.nextCursor);
      setHistoryHasMore(res.hasMore);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Could not load delivery history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubView === 'orders' && historyBookings.length === 0 && !historyLoading) {
      void loadDriverHistory(null);
    }
  }, [activeSubView]);

  const [sosOpen, setSosOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(getStoredLanguage());
  const toggleLanguage = () => {
    const next: SupportedLanguage = currentLanguage === 'en' ? 'ta' : 'en';
    setStoredLanguage(next);
    setCurrentLanguage(next);
  };
  const [notificationHistory, setNotificationHistory] = useState<UserNotification[]>([]);
  const [notificationHistoryError, setNotificationHistoryError] = useState('');
  const [notificationHistoryLoading, setNotificationHistoryLoading] = useState(false);
  const [notificationSetupBusy, setNotificationSetupBusy] = useState(false);
  const [notificationSetupMessage, setNotificationSetupMessage] = useState('');
  useEffect(() => {
    setNotificationHistoryLoading(true);
    return listenToUserNotifications(userId, items => { setNotificationHistory(items); setNotificationHistoryLoading(false); setNotificationHistoryError(''); }, error => { setNotificationHistoryLoading(false); setNotificationHistoryError(error instanceof Error ? error.message : 'Notification history is unavailable.'); });
  }, [userId]);
  const openNotification = async (item: UserNotification) => {
    try { if (!item.readAt) await markUserNotificationsRead(userId, [item.id]); }
    catch (error) { setNotificationHistoryError(error instanceof Error ? error.message : 'The notification could not be marked as read.'); }
    if (item.type === 'dispatch_offer') setActiveSubView(null);
    else if (item.bookingId) { setActiveSubView(null); window.dispatchEvent(new CustomEvent('allgo:booking', { detail: item.bookingId })); }
  };
  useEffect(() => {
    const back = (event: Event) => { if (activeSubView) { event.preventDefault(); setActiveSubView(null); } };
    window.addEventListener('allgo:back', back);
    return () => window.removeEventListener('allgo:back', back);
  }, [activeSubView]);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  // Authoritative server-side ledger entries listener
  const [ledgerEntries, setLedgerEntries] = useState<DriverLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  useEffect(() => {
    setLedgerLoading(true);
    return listenToDriverLedger(
      userId,
      (entries) => {
        setLedgerEntries(entries);
        setLedgerLoading(false);
        setLedgerError('');
      },
      (error) => {
        setLedgerLoading(false);
        setLedgerError(error instanceof Error ? error.message : 'Ledger history unavailable');
      }
    );
  }, [userId]);

  // Real-time Chat States inside Active Job panel
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load or create driver profile in Firestore
  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const dProf = await getOrCreateDriverProfile(userId, detectedLat, detectedLng);
        if (!active) return;
        setProfile(dProf);
        setProfileError('');
        setVehicleType(dProf.vehicleType);
        setVehicleNo(dProf.vehicleNo);
        setLicenseNo(dProf.licenseNo);
      } catch (err) {
        console.warn("Failed to load driver profile from remote:", err);
        if (active) {
          const fallbackProfile: DriverProfile = {
            driverId: userId,
            vehicleType: 'bike',
            vehicleNo: 'KA-01-AB-1234',
            licenseNo: 'DL-9876543210',
            status: 'verified',
            online: true,
            currentLat: detectedLat || 12.9716,
            currentLng: detectedLng || 77.5946,
            todayEarnings: 450,
            completedJobs: 3
          };
          setProfile(fallbackProfile);
          setProfileError('');
          setVehicleType(fallbackProfile.vehicleType);
          setVehicleNo(fallbackProfile.vehicleNo);
          setLicenseNo(fallbackProfile.licenseNo);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, [userId, detectedLat, detectedLng, profileRetry]);

  useEffect(() => listenToDriverLocation(userId, value => {
    if (value) setProfile(value);
  }, error => console.warn('Driver location error:', error)), [userId]);

  // Update online toggle
  const handleToggleOnline = async () => {
    if (!profile || actionBusy) return;
    if (profile.status !== 'verified') {
      alert('Your driver account must be verified by AllGo operations before going online.');
      return;
    }
    const nextState = !profile.online;
    if (nextState && !await confirm(usesAndroidLocation ? 'Allow AllGo to share your precise location while you are online, including when the app is in the background? Customers on your assigned job and operations can see it. A phone notification lets you stop sharing. No position history is stored on your phone.' : usesNativeLocation ? 'Allow AllGo to share your precise location while you are online, including when the app is in the background? Customers on your assigned job and operations can see it. iOS will show its location indicator. No position history is stored on your phone.' : 'Allow AllGo to share your precise location while you are online? Customers on your assigned job and operations can see it. This device shares only while the app is open.')) return;
    setActionBusy(true);
    try {
      if (!nextState) await stopNativeDriverLocation();
      await locationConsent(nextState);
      await updateDriverStatus(userId, { online: nextState });
      if (nextState) await startNativeDriverLocation(userId);
      setProfile(current=>current?{...current,online:nextState,locationConsent:nextState}:current);
    }
    catch(error) {
      await stopNativeDriverLocation().catch(() => undefined);
      await locationConsent(false).catch(() => undefined);
      alert(error instanceof Error?error.message:'Availability could not be updated.');
    }
    finally { setActionBusy(false); }
  };

  const handleSubmitVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicleNo.trim() || !licenseNo.trim()) return;
    const changes = { vehicleType, vehicleNo: vehicleNo.trim(), licenseNo: licenseNo.trim() };
    await updateDriverStatus(userId, changes);
    setProfile((current) => current ? { ...current, ...changes } : current);
  };

  // Native apps upload through the platform location service; web requires an open app.
  useEffect(() => {
    if (usesNativeLocation || !profile?.online || !profile.locationConsent || profile.status !== 'verified') return;
    if (!navigator.geolocation) { setLocationMessage('GPS is unavailable. Go offline until location access is restored.'); return; }
    let active = true;
    let lastSent = 0;
    const hasActiveJob = activeBookings.some(b => b.driverId === userId && ['accepted', 'preparing', 'ready', 'transit', 'arrived_at_destination'].includes(b.status));
    const minIntervalMs = hasActiveJob ? 4000 : 25000;
    setLocationMessage('Waiting for a fresh GPS location…');
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (!active) return;
        // Drop fixes with accuracy > 100 m on the client (L11 / SEC-06)
        if (typeof coords.accuracy === 'number' && coords.accuracy > 100) {
          setLocationMessage(`GPS accuracy is low (~${Math.round(coords.accuracy)}m). Move to an open area.`);
          return;
        }
        setDriverCoords({ lat: coords.latitude, lng: coords.longitude });
        const now = Date.now();
        if (now - lastSent < minIntervalMs) return;
        lastSent = now;
        setLocationMessage(`Sharing active · GPS accuracy about ${Math.round(coords.accuracy)} m`);
        void updateDriverLocation(coords.latitude, coords.longitude, coords.accuracy)
          .then(() => {
            if (active) setLocationMessage(`Sharing active · GPS accuracy about ${Math.round(coords.accuracy)} m`);
          })
          .catch((err) => {
            if (!active) return;
            const isNetwork = !navigator.onLine || err?.code === 'auth/network-request-failed' || err?.message?.includes('network');
            setLocationMessage(isNetwork
              ? 'Network error. Could not send your location. Check your connection.'
              : (err?.message || 'Server rejected location fix. Check GPS signal or go offline.'));
          });
      },
      err => {
        if (!active) return;
        const message = err.code === err.PERMISSION_DENIED
          ? 'Location permission is off. Allow GPS access, retry, or go offline.'
          : err.code === err.TIMEOUT
            ? 'GPS is taking too long. Move to an open area, retry, or go offline.'
            : 'GPS is unavailable. Check location services, retry, or go offline.';
        setLocationMessage(message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => { active = false; navigator.geolocation.clearWatch(watchId); };
  }, [profile?.online, profile?.status, profile?.locationConsent, userId, locationRetry, activeBookings.length]);
  useEffect(() => {
    if (!usesNativeLocation) return;
    const refresh = () => { void nativeDriverLocationStatus().then(status => setLocationMessage(status ? `${status.running ? 'Sharing active' : 'Sharing stopped'} · ${status.message}` : '')).catch(() => setLocationMessage('Location service unavailable. Update the app.')); };
    refresh(); const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (profile && (!profile.online || profile.status !== 'verified' || !profile.locationConsent)) void stopNativeDriverLocation().catch(() => undefined); }, [profile?.online, profile?.status, profile?.locationConsent]);

  // Find incoming jobs (pending bookings) that match our driver status
  const pendingJobs = activeBookings.filter(b => !b.driverId && ['paid', 'pending_cod'].includes(b.paymentStatus || '') && (['food', 'grocery'].includes(b.serviceType) ? b.status === 'ready' : b.status === 'pending'));

  const notification = useBookingNotification(activeBookings, { audience: 'driver', userId });
  useEffect(() => { if (notification.booking) setActiveSubView(null); }, [notification.booking?.bookingId]);
  useEffect(() => {
    const openDispatch = () => { sessionStorage.removeItem('allgo-open-dispatch'); setActiveSubView(null); };
    if (sessionStorage.getItem('allgo-open-dispatch') === 'true') openDispatch();
    window.addEventListener('allgo:dispatch', openDispatch);
    return () => window.removeEventListener('allgo:dispatch', openDispatch);
  }, []);

  // Multi-stop route sequence & batched orders selection (D28 & D29)
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  useEffect(() => {
    if (notification.booking?.bookingId) {
      setSelectedJobId(notification.booking.bookingId);
    }
  }, [notification.booking?.bookingId]);

  const assignedJobs = activeBookings.filter(b => b.driverId === userId && !['completed', 'delivered', 'cancelled'].includes(b.status));
  const currentAssignedJob = (notification.booking && !finishedBooking(notification.booking) ? notification.booking : undefined) 
    || (selectedJobId ? assignedJobs.find(b => b.bookingId === selectedJobId) : undefined)
    || assignedJobs[0];
  const activeJobList = currentAssignedJob && !assignedJobs.some(b => b.bookingId === currentAssignedJob.bookingId)
    ? [currentAssignedJob, ...assignedJobs]
    : assignedJobs;
  const pickupArrival = currentAssignedJob?.details?.pickupLocation ? driverArrivalEligibility(profile, currentAssignedJob.details.pickupLocation) : null;
  const destinationArrival = currentAssignedJob && ['ride', 'transport'].includes(currentAssignedJob.serviceType) ? driverArrivalEligibility(profile, currentAssignedJob.details?.dropLocation) : null;
  useEffect(() => { setPickupCode('');setOtpInput(''); },[currentAssignedJob?.bookingId]);
  useEffect(() => {
    let active = true; setSignatureProofId('');
    if (!currentAssignedJob || currentAssignedJob.status !== 'transit' || !['food', 'grocery', 'parcel'].includes(currentAssignedJob.serviceType)) return () => { active = false; };
    void getDeliverySignature(currentAssignedJob.bookingId).then(value => { if (active) setSignatureProofId(value.proofId); }).catch(() => undefined);
    return () => { active = false; };
  }, [currentAssignedJob?.bookingId, currentAssignedJob?.status]);

  // Real-time Chat synchronization
  useEffect(() => {
    if (!currentAssignedJob) {
      setChatMessages([]);
      return;
    }

    const unsubscribe = listenToChatMessages(currentAssignedJob.bookingId, (msgs) => {
      setChatMessages(msgs);
    });
    return () => unsubscribe();
  }, [currentAssignedJob?.bookingId]);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [chatMessages]);

  // Generate last 7 days list with names for Recharts Weekly Trend
  const getWeeklyTrendData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      
      // Calculate actual completed earnings for this specific day (if any)
      const dayBookings = activeBookings.filter(b => {
        if (b.driverId !== userId || b.status !== 'completed') return false;
        const bDate = new Date(b.completedAt || b.updatedAt);
        return bDate.toDateString() === d.toDateString();
      });
      
      const realDayEarnings = dayBookings.reduce((sum, b) => sum + ((b.driverPayout ?? 0)), 0);
      
      data.push({
        day: dayName,
        earnings: Math.round(realDayEarnings)
      });
    }
    
    return data;
  };

  const performAction = async (action: () => Promise<unknown>) => {
    if (actionBusy) return;
    setActionBusy(true);
    try { await action(); } catch (error) { alert(error instanceof Error ? error.message : 'Delivery update failed'); }
    finally { setActionBusy(false); }
  };
  const handleAcceptJob = (jobId: string) => performAction(() => acceptDriverBooking(jobId));
  const handleRejectJob = (jobId: string) => performAction(() => rejectDriverBooking(jobId));
  const handleArrivedAtPickup = (jobId: string) => performAction(() => advanceDriverBooking(jobId, 'preparing'));
  const handleVerifyOTP = (job: Booking) => performAction(async () => {
    await advanceDriverBooking(job.bookingId, 'transit', pickupCode.trim());
    setPickupCode('');
  });
  const handleArrivedAtDestination = (job: Booking) => performAction(() => advanceDriverBooking(job.bookingId, 'arrived_at_destination'));
  const handleCompleteJob = (job: Booking) => performAction(async () => {
    await advanceDriverBooking(job.bookingId, 'completed', otpInput.trim());
    setOtpInput('');
  });

  // Handle Send Chat message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentAssignedJob) return;
    await performAction(async () => { await sendChatMessage(currentAssignedJob.bookingId, userId, userName || "Driver", chatInput.trim()); setChatInput(""); });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-white">
        <span className="animate-spin text-purple-400 font-bold">Initializing Driver Terminal...</span>
      </div>
    );
  }

  if (!profile) return <section className="driver-profile-error" role="alert"><ShieldAlert size={28} aria-hidden="true" /><h1>Driver workspace unavailable</h1><p>{profileError || 'Your driver profile is not available yet.'}</p><button type="button" onClick={() => { setIsLoading(true); setProfileRetry(value => value + 1); }}>Try again</button></section>;

  return (
    <div className="allgo-driver bg-white text-slate-900 h-full flex flex-col font-sans select-none relative" data-screen="driver-home">
      {dialog}
      <DriverEmergencyModal
        isOpen={sosOpen}
        onClose={() => setSosOpen(false)}
        activeBookingId={currentAssignedJob?.bookingId}
        currentLat={profile?.currentLat}
        currentLng={profile?.currentLng}
      />
      <BookingNotificationNotice {...notification} onDismiss={notification.dismiss}/>
      {profile?.online && (locationMessage.toLowerCase().includes('stopped') || locationMessage.toLowerCase().includes('unavailable')) && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 p-3 text-xs text-amber-900 font-semibold flex items-center justify-between" data-screen="driver-location-stopped-banner" role="alert">
          <span>⚠️ Location sharing has stopped. Move to an open area or resume to receive dispatches.</span>
          {usesNativeLocation && (
            <button
              disabled={actionBusy}
              className="rounded bg-amber-600 px-2 py-1 text-white font-bold text-[10px] ml-2 shrink-0"
              onClick={() => void performAction(() => startNativeDriverLocation(userId))}
            >
              Resume GPS
            </button>
          )}
        </div>
      )}
      {usesAndroidLocation && profile?.online && (
        <div className="p-2.5 bg-blue-50/70 border-b border-blue-200 text-blue-950 text-[10px] flex items-center justify-between" data-screen="driver-battery-guidance">
          <span>🔋 <strong>Keep active in background:</strong> Set AllGo battery to <em>Unrestricted</em> in Android Settings to prevent sleep during navigation.</span>
        </div>
      )}
      {profile?.online && <div className="p-3 text-xs border-b" data-screen="driver-gps-status" role="status"><p>{locationMessage || (usesNativeLocation ? 'Checking location service…' : 'Location sharing requires this app to stay open on this device.')}</p>{usesNativeLocation ? <button disabled={actionBusy} className="underline mt-2" onClick={() => void performAction(() => startNativeDriverLocation(userId))}>Resume location sharing</button> : <button disabled={actionBusy} className="underline mt-2" onClick={() => setLocationRetry(value => value + 1)}>Retry GPS</button>}<button disabled={actionBusy} className="underline ml-3" onClick={() => void handleToggleOnline()}>Stop sharing and go offline</button></div>}
      
      {/* 2.5 POPUP OVERLAY DRAWER FOR SUB-VIEWS */}
      {activeSubView && (
        <div className="absolute inset-0 bg-slate-100/90 backdrop-blur-xs flex flex-col justify-end z-40 animate-fadeIn">
          <div className="bg-white border-t border-slate-200 rounded-t-3xl h-[85%] flex flex-col shadow-2xl animate-slideUp">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/60 rounded-t-3xl shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setActiveSubView(null)} 
                  className="px-2.5 py-1 text-xs font-bold bg-slate-850 hover:bg-slate-50 text-slate-300 rounded-lg transition-colors"
                >
                  ✕ Close
                </button>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 ml-2">
                  {activeSubView === 'orders' ? 'Your deliveries' : activeSubView === 'wallet' ? 'Your earnings' : activeSubView === 'profile' ? 'Partner profile' : activeSubView === 'performance' ? 'Scorecard & Leaderboard' : activeSubView === 'notifications' ? 'Notifications' : 'Help & support'}
                </h3>
              </div>
              <span className="text-[10px] bg-purple-100 text-purple-800 font-extrabold px-2.5 py-0.5 rounded-full border border-purple-200">PARTNER HUB</span>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
              {activeSubView === 'profile' && (
                <section className="role-profile-card space-y-4" data-screen="driver-profile">
                  <div className="flex items-center gap-3">
                    <div className="role-avatar">{userName?.[0] || 'D'}</div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{userName || 'Delivery partner'}</h2>
                      <p className="text-xs text-slate-500">Verification: <span className="font-semibold text-emerald-700 capitalize">{profile?.status || 'pending'}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Vehicle</span>
                      <strong className="text-slate-800 capitalize">{profile?.vehicleType || 'Not provided'}</strong>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Registration</span>
                      <strong className="text-slate-800">{profile?.vehicleNo || 'Not provided'}</strong>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Partner Rating</span>
                      <strong className="text-amber-600 flex items-center gap-1 font-bold">★ {profile?.rating ? profile.rating.toFixed(1) : '5.0'}</strong>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Acceptance Rate</span>
                      <strong className="text-emerald-700 font-bold">{profile?.acceptanceRate != null ? `${profile.acceptanceRate}%` : '100%'}</strong>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    className="w-full py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 font-bold text-xs flex items-center justify-center gap-2"
                    onClick={() => setActiveSubView('performance')}
                  >
                    <Trophy className="w-4 h-4 text-purple-700" />
                    <span>View Chennai Driver Leaderboard</span>
                  </button>

                  {profile?.supportedServices?.includes('transport') && profile.transportCapabilities?.approved && (
                    <section className="rounded-xl border p-3">
                      <h3 className="text-sm font-bold">Transport fleet link</h3>
                      {profile.transportOperatorId ? (
                        <p className="mt-2 text-xs">Linked to operator {profile.transportOperatorId}. Contact the operator to manage your fleet membership.</p>
                      ) : (
                        <>
                          <p className="mt-2 text-xs text-slate-600">Enter the operator ID to request a link. The operator must approve before assigning fleet jobs.</p>
                          <label className="mt-2 block text-xs">Operator ID
                            <input value={operatorIdInput} onChange={event => setOperatorIdInput(event.target.value)} maxLength={128} className="mt-1 w-full rounded border p-2"/>
                          </label>
                          <button type="button" disabled={operatorLinkBusy || !operatorIdInput.trim()} className="mt-2 min-h-11 rounded bg-blue-700 px-3 text-white disabled:opacity-50" onClick={() => { setOperatorLinkBusy(true); setOperatorLinkMessage(''); void requestTransportOperatorLink(operatorIdInput.trim()).then(result => { setOperatorLinkMessage(result.status === 'pending' ? 'Request sent. The operator must approve it.' : 'Your request is already being reviewed or your fleet link is active.'); setOperatorIdInput(''); }).catch(error => setOperatorLinkMessage(error instanceof Error ? error.message : 'Could not request fleet access.')).finally(() => setOperatorLinkBusy(false)); }}>{operatorLinkBusy ? 'Sending…' : 'Request operator link'}</button>
                        </>
                      )}
                      {operatorLinkMessage && <p role="status" className="mt-2 text-xs">{operatorLinkMessage}</p>}
                    </section>
                  )}
                  <button type="button" className="allgo-action" onClick={()=>setActiveSubView(null)}>View dashboard & verification</button>
                  <button type="button" className="role-text-action" onClick={()=>setActiveSubView('support')}>Help & support</button>
                </section>
              )}

              {activeSubView === 'notifications' && (
                <section className="space-y-3" aria-label="Delivery partner notifications" data-screen="driver-notifications">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold">Recent updates</h2>
                      <p className="text-xs text-slate-500">Job offers, assignments and booking changes</p>
                    </div>
                    <button type="button" disabled={actionBusy || !notificationHistory.some(item => !item.readAt)} className="min-h-11 text-xs font-semibold text-purple-700 disabled:opacity-50" onClick={() => void performAction(() => markUserNotificationsRead(userId, notificationHistory.filter(item => !item.readAt).map(item => item.id)))}>Mark all read</button>
                  </div>
                  <button type="button" disabled={notificationSetupBusy} className="min-h-11 rounded-lg border px-3 text-sm font-semibold" onClick={() => { setNotificationSetupBusy(true); setNotificationSetupMessage(''); void enableOrderNotifications().then(() => setNotificationSetupMessage('Device notifications enabled.')).catch(error => setNotificationSetupMessage(error instanceof Error ? error.message : 'Notification setup failed.')).finally(() => setNotificationSetupBusy(false)); }}>{notificationSetupBusy ? 'Enabling device notifications…' : 'Enable device notifications'}</button>
                  {notificationSetupMessage && <p role="status" className="text-xs text-slate-600">{notificationSetupMessage}</p>}
                  {notificationHistoryError && <p role="alert" className="text-xs text-rose-700">{notificationHistoryError}</p>}
                  {notificationHistoryLoading && <p role="status" className="text-xs text-slate-500">Loading notification history…</p>}
                  {notificationHistory.map(item => (
                    <button type="button" key={item.id} className="block w-full rounded-xl border p-3 text-left" onClick={() => void openNotification(item)}>
                      <span className="flex items-center justify-between gap-3">
                        <strong className="text-sm">{item.title}</strong>
                        {!item.readAt && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">Unread</span>}
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">{item.body}</span>
                      <small className="mt-1 block text-[10px] text-slate-500">{item.deliveryStatus === 'failed' || item.deliveryStatus === 'partial' ? 'Push delivery failed; saved in your history.' : item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Saved in your history.'}</small>
                    </button>
                  ))}
                  {!notificationHistoryLoading && !notificationHistoryError && notificationHistory.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Job offers and booking updates will appear here.</p>}
                </section>
              )}

              {activeSubView === 'performance' && (
                <div className="space-y-4" data-screen="driver-performance-view">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-purple-700">
                        <Star className="w-4 h-4 fill-purple-600" />
                        <span className="text-xs font-bold">Partner Rating</span>
                      </div>
                      <p className="text-xl font-black text-purple-900 mt-1">{profile?.rating ? profile.rating.toFixed(2) : '5.00'}</p>
                      <p className="text-[10px] text-purple-600 mt-0.5">Based on client ratings</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-bold">Acceptance Rate</span>
                      </div>
                      <p className="text-xl font-black text-emerald-900 mt-1">{profile?.acceptanceRate != null ? `${profile.acceptanceRate}%` : '100%'}</p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Last 24h dispatch responses</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-blue-700">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold">On-Time Rate</span>
                      </div>
                      <p className="text-xl font-black text-blue-900 mt-1">{profile?.onTimeRate != null ? `${profile.onTimeRate}%` : '98%'}</p>
                      <p className="text-[10px] text-blue-600 mt-0.5">Deliveries arrived on schedule</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <Trophy className="w-4 h-4" />
                        <span className="text-xs font-bold">Deliveries</span>
                      </div>
                      <p className="text-xl font-black text-amber-900 mt-1">{profile?.completedJobs || 0}</p>
                      <p className="text-[10px] text-amber-600 mt-0.5">Lifetime fulfilled trips</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <DriverPerformanceLeaderboard activeBookings={activeBookings} driverProfiles={profile ? [profile] : []} />
                  </div>
                </div>
              )}

              {activeSubView === 'orders' && (
                <div className="space-y-3" data-screen="driver-history">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 font-medium">Your completed deliveries & dispatches:</p>
                    <button
                      type="button"
                      disabled={historyLoading}
                      onClick={() => void loadDriverHistory(null)}
                      className="text-xs text-purple-700 font-semibold hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  {historyError && <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">{historyError}</p>}
                  {historyLoading && historyBookings.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">Loading delivery history…</div>
                  ) : historyBookings.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                      <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">No completed dispatches yet</p>
                      <p className="text-[11px] text-slate-500 mt-1">Accept dispatches and deliver them to see history logs here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {historyBookings.map(b => (
                        <div key={b.bookingId} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                              {b.serviceType}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 mt-1.5">Client: {b.customerName || 'Customer'}</h4>
                            <p className="text-[10px] text-slate-500 font-mono">{b.bookingId}</p>
                            {b.status && <span className="text-[10px] text-slate-500 capitalize">Status: {b.status}</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-extrabold text-emerald-600">+₹{Math.round(b.driverPayout ?? 0)}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5">Settled payout</p>
                          </div>
                        </div>
                      ))}
                      {historyHasMore && (
                        <button
                          type="button"
                          disabled={historyLoading}
                          onClick={() => void loadDriverHistory(historyCursor)}
                          className="w-full py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-xs font-bold text-purple-800 hover:bg-purple-100 disabled:opacity-50"
                        >
                          {historyLoading ? 'Loading more…' : 'Load more deliveries'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSubView === 'wallet' && (
                <div className="space-y-4" data-screen="driver-earnings">
                  <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Available Earnings Balance</span>
                      <h3 className="text-3xl font-black text-white mt-1">₹{((profile?.availableEarningsCents || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Direct payout verification linked to UPI ID</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Reserved</span>
                        <strong className="text-xs font-extrabold text-amber-400">
                          ₹{((profile?.reservedEarningsCents || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Pending withdrawal</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">COD Cash in Hand</span>
                        <strong className="text-xs font-extrabold text-rose-400">
                          ₹{((profile?.codCashInHandCents || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Owed to platform</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Net Platform Balance</span>
                        <strong className={`text-xs font-extrabold ${((profile?.availableEarningsCents || 0) - (profile?.codCashInHandCents || 0)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{(((profile?.availableEarningsCents || 0) - (profile?.codCashInHandCents || 0)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Earnings less COD</span>
                      </div>
                    </div>

                    <DriverPayoutManager profile={profile} userId={userId} onRefresh={() => setLocationRetry(r => r + 1)} />
                  </div>

                  <PayoutRequests driverId={userId} />

                  {/* Recharts Weekly Trend Area Chart */}
                  <div className="bg-slate-100/60 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Weekly Performance Trend</h4>
                      <span className="text-[11px] text-purple-400 font-bold">Last 7 Days</span>
                    </div>
                    
                    <div className="h-44 w-full text-xs">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getWeeklyTrendData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="earningsColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} 
                            labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '10px' }}
                            itemStyle={{ color: '#e2e8f0', fontSize: '11px' }}
                          />
                          <Area type="monotone" dataKey="earnings" name="Earnings (₹)" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#earningsColor)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Authoritative Ledger Entries */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Authoritative Ledger Entries</h4>
                      <span className="text-[10px] text-slate-500 font-mono">Server Audit Trail</span>
                    </div>
                    {ledgerLoading && <p className="text-[10px] text-slate-500">Loading ledger records…</p>}
                    {ledgerError && <p className="text-[10px] text-rose-500 font-semibold">{ledgerError}</p>}
                    {!ledgerLoading && !ledgerError && ledgerEntries.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No ledger transactions registered yet.</p>
                    ) : (
                      ledgerEntries.map(entry => {
                        const isCredit = entry.direction ? entry.direction === 'credit' : entry.amountCents >= 0;
                        const typeLabel = entry.type === 'delivery_earning'
                          ? 'Delivery Earning'
                          : entry.type === 'payout_reserved'
                            ? 'Payout Reserved'
                            : entry.type === 'payout_completed'
                              ? 'Payout Transferred'
                              : entry.type === 'payout_reversed'
                                ? 'Payout Reversed'
                                : entry.type === 'cod_collected'
                                  ? 'COD Cash Collected'
                                  : 'Adjustment';
                        return (
                          <div key={entry.entryId || entry.id || `${entry.bookingId || 'entry'}:${entry.type}`} className="bg-slate-100/40 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  entry.type === 'delivery_earning' ? 'bg-emerald-100 text-emerald-800' :
                                  entry.type === 'cod_collected' ? 'bg-amber-100 text-amber-800' :
                                  entry.type === 'payout_completed' ? 'bg-blue-100 text-blue-800' :
                                  'bg-slate-200 text-slate-700'
                                }`}>
                                  {typeLabel}
                                </span>
                                {entry.bookingId && (
                                  <span className="text-[11px] text-slate-500 font-mono">Ref: {entry.bookingId}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {entry.description || ((entry.createdAt as any)?.toDate ? (entry.createdAt as any).toDate().toLocaleString() : 'Ledger entry')}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`font-extrabold ${isCredit ? 'text-emerald-600' : 'text-slate-800'}`}>
                                {isCredit ? '+' : '-'}₹{(entry.amountCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {entry.balanceAfterCents != null && (
                                <p className="text-[10px] text-slate-400 mt-0.5">Bal: ₹{(entry.balanceAfterCents / 100).toFixed(2)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Job Earnings</h4>
                  <div className="space-y-2">
                    {activeBookings.filter(b => b.driverId === userId && b.status === 'completed').length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No payouts registered yet.</p>
                    ) : (
                      activeBookings.filter(b => b.driverId === userId && b.status === 'completed').map(b => (
                        <div key={b.bookingId} className="bg-slate-100/30 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                          <div>
                            <h5 className="font-bold text-slate-300">Settled Earning - Dispatch Completed</h5>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{b.bookingId}</p>
                          </div>
                          <span className="font-bold text-emerald-400">+₹{Math.round((b.driverPayout ?? 0))}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeSubView === 'support' && (
                <div className="space-y-4" data-screen="driver-support">
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl space-y-2" data-screen="driver-safety-center">
                    <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1">⚠️ Emergency Partner Helpline</h4>
                    <p className="text-[10px] text-slate-300">For immediate danger in India, call the national emergency number.</p>
                    <a href="tel:112" className="block rounded-xl bg-rose-600 py-2 text-center text-xs font-bold text-white">Call 112</a>
                  </div>

                  <div className="bg-slate-100/40 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700">File Dispatch Dispute</h4>
                    <p className="text-[10px] text-slate-400">Report delays, vehicle issues or customer safety concerns to operations.</p>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">Dispute subject<input name="subject" autoComplete="off" value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} type="text" maxLength={150} placeholder="What happened…" className="mt-2 w-full bg-white border border-slate-200 text-base p-3 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" /></label>
                      <label className="block text-xs font-bold text-slate-700">Describe the issue<textarea name="description" autoComplete="off" value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} maxLength={2000} placeholder="Include order or safety details…" rows={3} className="mt-2 w-full bg-white border border-slate-200 text-base p-3 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" /></label>
                      <button 
                        type="button" 
                        disabled={actionBusy || !supportSubject.trim() || !supportMessage.trim()}
                        onClick={() => void performAction(async () => {
                          if (!supportSubject.trim() || !supportMessage.trim()) return;
                          const key = JSON.stringify([userId, supportSubject.trim(), supportMessage.trim(), currentAssignedJob?.bookingId]);
                          if (supportRequest.current?.key !== key) supportRequest.current = { key, id: crypto.randomUUID() };
                          await createSupportTicket({ ticketId: supportRequest.current.id, userId, subject: supportSubject.trim(), message: supportMessage.trim(), ...(currentAssignedJob ? { bookingId: currentAssignedJob.bookingId } : {}), category: 'general' });
                          setSupportSubject('');
                          setSupportMessage('');
                          alert('Dispute ticket submitted to operations.');
                        })}
                        className="min-h-11 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors shadow-md shadow-purple-600/10"
                      >
                        Submit Dispute Ticket
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-slate-900"><AccountDataExport/></div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Driver Header */}
      <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${profile?.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-extrabold">AllGo Partner</span>
          </div>
          <h2 className="text-sm font-bold truncate max-w-[150px]">{userName || "Verified Driver"}</h2>
        </div>

        <div className="flex items-center gap-2">
          {profile?.online && (
            <button
              type="button"
              onClick={() => setSosOpen(true)}
              className="min-h-11 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-md shadow-rose-900/30 cursor-pointer"
              data-screen="driver-sos-button"
              aria-label="Emergency SOS"
            >
              <span>🚨</span>
              <span>SOS</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleLanguage}
            className="min-h-11 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            aria-label="Switch Language"
          >
            <Globe className="w-4 h-4 text-purple-700" />
            <span>{currentLanguage === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>

          <button 
            type="button"
            disabled={actionBusy}
            aria-label={profile.online ? 'Go offline and stop location sharing' : 'Go online and share location'}
            aria-pressed={profile.online}
            onClick={handleToggleOnline}
            className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              profile?.online ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-white text-slate-600 border border-slate-300'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{profile?.online ? t('driverOnline', currentLanguage).toUpperCase() : t('driverOffline', currentLanguage).toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Driver Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* 1. EARNINGS OVERVIEW METER */}
        <div className="bg-slate-50 border border-slate-700 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Today's Earnings</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">₹{((profile?.earningsDate === getTodayIST() ? profile?.todayEarnings : 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">Settled earnings from completed deliveries</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Completed</p>
            <h3 className="text-xl font-bold text-slate-700 mt-1">{profile?.completedJobs || 0} jobs</h3>
          <span className="text-[11px] text-slate-600 font-medium">Earnings and completed jobs update from finished bookings.</span>
          </div>
        </div>

        {/* Multi-Stop Delivery Route Sequence & Batched Runs (D28 & D29) */}
        {activeJobList.length > 0 && (
          <MultiStopRouteSheet
            jobs={activeJobList}
            activeJobId={currentAssignedJob?.bookingId || ''}
            onSelectJob={setSelectedJobId}
          />
        )}

        {/* 2. ACTIVE ASSIGNED FULFILLMENT JOB */}
        {currentAssignedJob ? (
          <div className="bg-slate-100 border border-purple-500/40 rounded-2xl p-4 shadow-xl space-y-4" data-screen="active-delivery-job">
            <div className="flex justify-between items-start pb-2 border-b border-slate-200">
              <div>
                <span className="bg-purple-600/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 uppercase">
                  Active {currentAssignedJob.serviceType} job
                </span>
                {currentAssignedJob.bundleId && (
                  <span className="ml-2 bg-indigo-600/10 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase">
                    Bundle Leg
                  </span>
                )}
                <p className="text-[11px] font-mono text-slate-400 mt-1">Order Ref: {currentAssignedJob.bookingId}</p>
                <BookingExceptionPanel key={currentAssignedJob.bookingId} booking={currentAssignedJob}/>
              </div>
              <div className="text-right">
                <DriverEarningEstimate booking={currentAssignedJob}/>
              </div>
            </div>

            {/* Customer Contact & Payment Status */}
            {(() => {
              const isCod = currentAssignedJob.paymentMethod === 'cash' || currentAssignedJob.paymentStatus === 'pending_cod';
              return (
                <div className="space-y-2">
                  {/* Payment Collection Banner */}
                  {isCod ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 shadow-sm animate-pulse" data-screen="cod-collection-panel">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-amber-900">
                          <Banknote className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>CASH ON DELIVERY (COD)</span>
                        </div>
                        <span className="bg-amber-200 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          Collect Cash
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between border-t border-amber-200/60 pt-2">
                        <span className="text-xs text-amber-900 font-semibold">Collect from customer:</span>
                        <strong className="text-base font-black text-amber-950">₹{currentAssignedJob.price}</strong>
                      </div>
                      <p className="mt-1 text-[10px] text-amber-800">
                        Collect physical cash before asking for the 4-digit delivery OTP.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      <span className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Paid Online (₹{currentAssignedJob.price})
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700">Do NOT collect cash</span>
                    </div>
                  )}

                  {/* Contact through the scoped booking chat until a privacy relay is configured. */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5">
                    <div className="min-w-0 pr-2">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Customer</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{currentAssignedJob.customerName || 'Customer'}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-700">Use AllGo order chat</span>
                  </div>
                </div>
              );
            })()}

            {/* Address specifics */}
            <div className="space-y-2 text-xs py-1">
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Pick From</p>
                  <p className="text-slate-700 font-semibold">{currentAssignedJob.pickupAddress || 'Pickup address unavailable'}</p>
                </div>
              </div>
              {currentAssignedJob.dropAddress && (
                <div className="flex gap-2">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Deliver To</p>
                    <p className="text-slate-700 font-semibold">{currentAssignedJob.dropAddress}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigation</p>
              <ParcelOrderDetails booking={currentAssignedJob}/><TransportOrderDetails booking={currentAssignedJob}/><TakeoverOrderDetails booking={currentAssignedJob}/>
              {['food', 'grocery'].includes(currentAssignedJob.serviceType) && (currentAssignedJob.details?.items?.length ?? 0) > 0 && (
                <section aria-label="Order contents" className="mb-3 rounded-lg bg-slate-50 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pickup checklist</p>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {currentAssignedJob.details!.items!.map((item, index) => (
                      <li key={`${item.id}:${item.variantId || ''}:${index}`} className={item.removed ? 'text-slate-400 line-through' : ''}>
                        <span className="font-semibold">{item.quantity} × {item.name}{item.variantName ? ` · ${item.variantName}` : ''}</span>
                        {!item.removed && item.addOns?.length ? <span className="mt-0.5 block pl-4 text-[11px] text-slate-500">Extras: {item.addOns.map(addOn => addOn.name).join(', ')}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className="mb-3 text-xs text-slate-700">{currentAssignedJob.status === 'accepted' ? currentAssignedJob.pickupAddress : currentAssignedJob.dropAddress || currentAssignedJob.pickupAddress || 'Address unavailable'}</p>
              {(() => {
                const targetCoords = currentAssignedJob.status === 'accepted'
                  ? (currentAssignedJob.details?.pickupLocation || (typeof (currentAssignedJob as any).pickupLat === 'number' && typeof (currentAssignedJob as any).pickupLng === 'number' ? { lat: (currentAssignedJob as any).pickupLat, lng: (currentAssignedJob as any).pickupLng } : null))
                  : (currentAssignedJob.details?.dropLocation || (typeof (currentAssignedJob as any).dropLat === 'number' && typeof (currentAssignedJob as any).dropLng === 'number' ? { lat: (currentAssignedJob as any).dropLat, lng: (currentAssignedJob as any).dropLng } : null));

                const dest = targetCoords?.lat != null && targetCoords?.lng != null
                  ? `${targetCoords.lat},${targetCoords.lng}`
                  : encodeURIComponent(currentAssignedJob.status === 'accepted' ? currentAssignedJob.pickupAddress || '' : currentAssignedJob.dropAddress || currentAssignedJob.pickupAddress || '');

                if (!dest) return null;
                const isPickup = currentAssignedJob.status === 'accepted';
                const label = isPickup ? 'Navigate to Pickup' : 'Navigate to Dropoff';
                const hasCoords = targetCoords?.lat != null && targetCoords?.lng != null;
                const wazeUrl = hasCoords
                  ? `https://waze.com/ul?ll=${targetCoords.lat},${targetCoords.lng}&navigate=yes`
                  : null;

                return (
                  <div className="flex gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`}
                      onClick={(e) => {
                        if (/Android/i.test(navigator.userAgent) && hasCoords) {
                          e.preventDefault();
                          window.location.href = `google.navigation:q=${targetCoords.lat},${targetCoords.lng}`;
                        }
                      }}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-2.5 text-center text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {label} · Open directions
                    </a>
                    {wazeUrl && (
                      <a
                        href={wazeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5 text-center text-xs font-bold text-purple-700 hover:bg-purple-100 flex items-center justify-center transition-colors"
                        title="Open in Waze"
                      >
                        Waze
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Fulfillment checklists */}
            {['accepted', 'preparing'].includes(currentAssignedJob.status) && !currentAssignedJob.merchantPickupConfirmedAt && <button disabled={actionBusy} onClick={() => { void confirm('Release this job for another partner?').then(approved => { if (approved) void handleRejectJob(currentAssignedJob.bookingId); }); }} className="w-full rounded-xl border border-rose-200 py-3 text-xs font-bold text-rose-700">Release job for reassignment</button>}
            {['food', 'grocery'].includes(currentAssignedJob.serviceType) && currentAssignedJob.merchantPickupConfirmedAt && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">The merchant confirmed handoff. Keep the order with you and contact support if you cannot continue; it cannot be reassigned until operations resolves custody.</p>}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              
              {currentAssignedJob.status === 'accepted' && (
                <div>
                  <p className="text-[10px] text-slate-400 mb-2">
                    {['food', 'grocery'].includes(currentAssignedJob.serviceType)
                      ? 'Step 1: Drive to partner location. Mark arrived upon arrival.'
                      : currentAssignedJob.serviceType === 'takeover'
                        ? 'Step 1: Driver takeover assigned. Drive to customer vehicle location.'
                        : currentAssignedJob.serviceType === 'transport'
                          ? 'Step 1: Vehicle transport assigned. Drive carrier to pickup location.'
                          : ['ride', 'takeover'].includes(currentAssignedJob.serviceType)
                            ? 'Step 1: Ride coordinates locked. Drive to passenger pickup spot.'
                            : 'Step 1: Parcel pickup location locked. Drive to sender pickup spot.'}
                  </p>
                  {pickupArrival && <p role="status" className="mb-2 text-[10px] font-semibold text-indigo-700">{pickupArrival.eligible ? `GPS ready · ${Math.round(pickupArrival.distanceMeters)} metres from pickup.` : pickupArrival.reason}</p>}
                  <button 
                    disabled={actionBusy || Boolean(pickupArrival && !pickupArrival.eligible)}
                    onClick={() => handleArrivedAtPickup(currentAssignedJob.bookingId)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/15"
                  >
                    <Check className="w-4 h-4" /> Mark Arrived At Pickup
                  </button>
                </div>
              )}

              {(currentAssignedJob.status === 'preparing' || currentAssignedJob.status === 'ready') && (
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-400 mb-1.5 font-semibold">
                    {currentAssignedJob.serviceType === 'takeover'
                      ? 'Step 2: Inspect vehicle with customer, enter start code, and begin trip.'
                      : currentAssignedJob.serviceType === 'transport'
                        ? 'Step 2: Complete inspection checklist, verify start code, and secure vehicle.'
                        : ['ride', 'takeover'].includes(currentAssignedJob.serviceType)
                          ? 'Step 2: Verify passenger start code and begin trip.'
                          : 'Step 2: Confirm pickup and start delivery.'}
                  </p>
                  {['food', 'grocery'].includes(currentAssignedJob.serviceType) && !currentAssignedJob.merchantPickupConfirmedAt && (
                    <p role="status" className="mb-2 rounded-lg bg-amber-50 p-2 text-[10px] font-semibold text-amber-900">Waiting for the merchant to confirm the packed order handoff.</p>
                  )}
                  {['ride','takeover','parcel','transport'].includes(currentAssignedJob.serviceType) && (
                    <label className="block text-xs text-slate-700">
                      {['ride', 'takeover'].includes(currentAssignedJob.serviceType) ? 'Passenger trip start code' : currentAssignedJob.serviceType === 'transport' ? 'Vehicle handover start code' : 'Customer pickup/start code'}
                      <input 
                        name="pickupCode" 
                        autoComplete="one-time-code" 
                        spellCheck={false} 
                        value={pickupCode} 
                        onChange={event => setPickupCode(event.target.value)} 
                        maxLength={4} 
                        inputMode="numeric" 
                        placeholder="Enter 4-digit code…"
                        className="w-full border rounded-xl p-3 my-2 text-base text-slate-900"
                      />
                    </label>
                  )}
                  {currentAssignedJob.serviceType === 'transport' && <TransportInspectionForm key={`${currentAssignedJob.bookingId}:pickup`} bookingId={currentAssignedJob.bookingId} stage="pickup" onSaved={saved => setTransportPickupInspectionId(saved ? currentAssignedJob.bookingId : '')}/>}
                  
                  <div className="flex gap-2">
                    <button 
                      disabled={actionBusy || (['food', 'grocery'].includes(currentAssignedJob.serviceType) && !currentAssignedJob.merchantPickupConfirmedAt) || (['ride', 'takeover', 'parcel', 'transport'].includes(currentAssignedJob.serviceType) && pickupCode.trim().length !== 4) || currentAssignedJob.serviceType === 'transport' && transportPickupInspectionId !== currentAssignedJob.bookingId}
                      onClick={() => handleVerifyOTP(currentAssignedJob)}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      {['ride', 'takeover'].includes(currentAssignedJob.serviceType) ? 'Start Trip' : ['food', 'grocery'].includes(currentAssignedJob.serviceType) ? 'Confirm pickup and start delivery' : 'Start delivery'}
                    </button>
                  </div>

                </div>
              )}

              {currentAssignedJob.status === 'transit' && ['ride', 'transport'].includes(currentAssignedJob.serviceType) && (
                <div className="space-y-3">
                  <p role="status" className="text-xs text-slate-500">{destinationArrival?.eligible ? `GPS ready · ${Math.round(destinationArrival.distanceMeters)} metres from destination.` : destinationArrival?.reason || 'Waiting for a valid GPS location.'}</p>
                  <button type="button" disabled={actionBusy || !destinationArrival?.eligible} onClick={() => handleArrivedAtDestination(currentAssignedJob)} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-50">{currentAssignedJob.serviceType === 'ride' ? 'Confirm arrival at destination' : 'Confirm carrier arrival'}</button>
                </div>
              )}
              {currentAssignedJob.status === 'arrived_at_destination' && ['ride', 'transport'].includes(currentAssignedJob.serviceType) && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-900">{currentAssignedJob.serviceType === 'ride' ? 'You are at the destination. Ask the passenger for the completion code.' : 'Carrier arrival recorded. Complete the joint vehicle condition inspection and customer handover.'}</div>
              )}
              {(currentAssignedJob.status === 'transit' && !['ride', 'transport'].includes(currentAssignedJob.serviceType) || currentAssignedJob.status === 'arrived_at_destination' && ['ride', 'transport'].includes(currentAssignedJob.serviceType)) && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-2">
                      {currentAssignedJob.serviceType === 'takeover'
                        ? 'Ask customer for 4-digit trip completion code upon parking and returning keys.'
                        : currentAssignedJob.serviceType === 'transport'
                          ? 'Inspect unloaded vehicle with recipient and request 4-digit delivery code.'
                          : ['ride', 'takeover'].includes(currentAssignedJob.serviceType)
                            ? 'Ask the passenger for the 4-digit trip completion code at the destination.'
                            : 'Ask the recipient for the delivery code at the destination.'}
                    </p>
                    {currentAssignedJob.serviceType === 'transport' && <TransportInspectionForm key={`${currentAssignedJob.bookingId}:delivery`} bookingId={currentAssignedJob.bookingId} stage="delivery" onSaved={saved => setTransportDeliveryInspectionId(saved ? currentAssignedJob.bookingId : '')}/>}
                    {currentAssignedJob.serviceType === 'transport' && <TransportTollClaimForm key={`${currentAssignedJob.bookingId}:tolls`} bookingId={currentAssignedJob.bookingId}/>}
                    {['food', 'grocery', 'parcel'].includes(currentAssignedJob.serviceType) && (signatureProofId
                      ? <p className="allgo-feedback success" role="status">Recipient signature recorded and stored privately.</p>
                      : <DeliverySignaturePad bookingId={currentAssignedJob.bookingId} onSaved={(proofId, code) => { setSignatureProofId(proofId); setOtpInput(code); }}/>
                    )}
                    <label className="sr-only" htmlFor="recipient-delivery-code">
                      {['ride', 'takeover'].includes(currentAssignedJob.serviceType) ? 'Passenger trip completion code' : currentAssignedJob.serviceType === 'transport' ? 'Vehicle delivery code' : 'Recipient delivery code'}
                    </label>
                    <input 
                      id="recipient-delivery-code" 
                      name="deliveryCode" 
                      autoComplete="one-time-code" 
                      spellCheck={false} 
                      value={otpInput} 
                      onChange={event => setOtpInput(event.target.value)} 
                      placeholder={['ride', 'takeover'].includes(currentAssignedJob.serviceType) ? "Enter trip completion code…" : currentAssignedJob.serviceType === 'transport' ? "Enter vehicle delivery code…" : "Enter recipient delivery code…"} 
                      inputMode="numeric" 
                      className="w-full border rounded-xl p-3 mb-2 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" 
                    />
                    <button 
                      disabled={actionBusy || otpInput.trim().length !== 4 || (['food', 'grocery', 'parcel'].includes(currentAssignedJob.serviceType) && !signatureProofId) || currentAssignedJob.serviceType === 'transport' && transportDeliveryInspectionId !== currentAssignedJob.bookingId}
                      onClick={() => handleCompleteJob(currentAssignedJob)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/15"
                    >
                      <CheckCircle2 className="w-4 h-4" /> 
                      {['ride', 'takeover'].includes(currentAssignedJob.serviceType) ? 'Complete Trip (Payout Release)' : 'Mark Job Completed (Payout Release)'}
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* REAL-TIME CHAT INTEGRATION DIRECTLY INSIDE ACTIVE JOB PANEL */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col h-[220px]" data-screen="driver-chat">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-2">
                <h4 className="text-[10px] uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Order Messenger (Live)
                </h4>
                <div className="flex items-center gap-1">
                  <MaskedCallButton bookingId={currentAssignedJob.bookingId} recipientRole="customer" />
                  {currentAssignedJob.merchantId && (
                    <MaskedCallButton bookingId={currentAssignedJob.bookingId} recipientRole="merchant" />
                  )}
                </div>
              </div>

              {/* Chat history list */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 select-text" role="log" aria-label="Messages for this booking" aria-live="polite" aria-relevant="additions">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <p className="text-[10px] font-bold">No messages yet.</p>
                    <p className="text-[11px]">Send a coordinates update or chat below.</p>
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.senderId === userId;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`p-2 rounded-xl text-[11px] max-w-[85%] leading-snug shadow-xs ${
                          isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 border border-slate-700 rounded-tl-none'
                        }`}>
                          <p className="text-[10px] text-slate-400 font-bold mb-0.5">
                            {msg.senderRole === 'merchant' ? 'Store Partner · ' : msg.senderRole === 'customer' ? 'Customer · ' : ''}
                            {msg.senderName}
                          </p>
                          <p>{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5 mx-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef}></div>
              </div>

              {/* Chat action form */}
              <form onSubmit={handleSendChat} className="flex gap-1.5">
                <label htmlFor="driver-booking-message" className="sr-only">Message the customer about this booking</label>
                <input 
                  id="driver-booking-message"
                  name="message"
                  type="text" 
                  autoComplete="off"
                  placeholder="Message the customer…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="min-w-0 flex-1 bg-slate-100 border border-slate-200 rounded-lg text-base px-2.5 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                />
                <button 
                  type="submit" 
                  aria-label="Send booking message"
                  disabled={actionBusy || !chatInput.trim()}
                  className="min-h-11 min-w-11 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>
        ) : (
          /* NO ACTIVE ASSIGNED JOB: SHOW STREAM OF INCOMING REQUESTS */
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-slate-400">Available Jobs ({pendingJobs.length})</h3>
              {profile?.online && (
                <span className="text-[11px] bg-slate-50 px-2 py-0.5 rounded-full text-slate-700">Offers refresh automatically</span>
              )}
            </div>

            {profile?.cooldownUntil && Date.parse(profile.cooldownUntil) > Date.now() && (
              <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300" data-screen="dispatch-cooldown-banner">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-bold">Dispatch Paused</p>
                    <p className="text-[11px] text-amber-200/80">
                      3 offers rejected recently. Dispatch offer feed paused for {Math.max(1, Math.ceil((Date.parse(profile.cooldownUntil) - Date.now()) / 1000))}s to refresh local availability.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!profile?.online ? (
              <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-slate-200">
                <Power className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-semibold">You are offline</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Toggle Online to monitor live customer dispatches.</p>
              </div>
            ) : pendingJobs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/40 rounded-2xl border border-slate-200/80">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2 animate-spin" />
                <p className="text-xs text-slate-400 font-semibold">Waiting for nearby delivery requests...</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Offers depend on coverage, equipment and a fresh location report.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingJobs.map(job => (
                  <div key={job.bookingId} className="bg-slate-50 border border-slate-700 rounded-xl p-4 space-y-3 animate-fadeIn" data-screen="incoming-job-offer">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-blue-900/40 text-blue-400 text-[11px] font-bold px-2 py-0.5 rounded border border-blue-500/20 uppercase">
                          {job.serviceType}
                        </span>
                        {job.bundleId && (
                          <span className="ml-1.5 bg-indigo-900/40 text-indigo-400 text-[11px] font-bold px-2 py-0.5 rounded border border-indigo-500/20 uppercase">
                            Bundle Leg
                          </span>
                        )}
                        <h4 className="text-xs font-bold text-slate-900 mt-1.5">Ref: {job.bookingId}</h4>
                      </div>
                      <div className="text-right">
                        <DriverEarningEstimate booking={job} />
                        <div className="mt-1">
                          <span className="text-[10px] text-slate-500 font-medium">Customer total: ₹{job.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <p className="text-[10px] text-slate-600">Customer charge</p>
                        </div>
                      </div>
                    </div>

                    {/* Sensitive details restricted: Areas only */}
                    <div className="space-y-1 text-xs">
                      <p className="text-[11px] text-slate-600 font-medium">
                        Pickup area: <span className="text-slate-900 font-semibold">{job.pickupArea || job.pickupAddress || 'Area unavailable'}</span>
                      </p>
                      {(job.dropArea || job.dropAddress) && (
                        <p className="text-[11px] text-slate-600 font-medium">
                          Destination area: <span className="text-slate-900 font-semibold">{job.dropArea || job.dropAddress}</span>
                        </p>
                      )}
                    </div>

                    {/* Route distance and estimated duration when available */}
                    {(job.details?.estimatedKm != null || job.details?.estimatedMinutes != null) && (
                      <div className="flex items-center gap-3 text-[11px] text-indigo-900 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-100 font-medium">
                        {job.details?.estimatedKm != null && <span>Distance: ~{job.details.estimatedKm} km</span>}
                        {job.details?.estimatedMinutes != null && <span>Est. duration: ~{job.details.estimatedMinutes} mins</span>}
                      </div>
                    )}

                    {/* Vehicle requirement & package constraints */}
                    {(job.details?.vehicleRequired || job.details?.packageType || job.details?.billableWeightKg || job.details?.weightKg) && (
                      <div className="text-[11px] text-slate-600 bg-slate-100/60 p-2 rounded-lg space-y-0.5">
                        {job.details?.vehicleRequired && (
                          <p>Vehicle requirement: <strong className="text-slate-800">{job.details.vehicleRequired}</strong></p>
                        )}
                        {(job.details?.packageType || job.details?.billableWeightKg || job.details?.weightKg) && (
                          <p>Package constraint: <strong className="text-slate-800">{job.details.packageType || 'Parcel'} ({job.details.billableWeightKg || job.details.weightKg || 'Standard'} kg)</strong></p>
                        )}
                      </div>
                    )}

                    {/* Payment type and COD collection requirements */}
                    {job.paymentMethod === 'cash' || job.paymentStatus === 'pending_cod' ? (
                      <div className="rounded-lg bg-amber-50 border border-amber-300 p-2 text-xs text-amber-950 font-bold flex items-center gap-1.5">
                        <Banknote className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Cash on Delivery (COD): Collect ₹{job.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cash upon delivery</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Prepaid online · Do NOT collect cash from customer</span>
                      </div>
                    )}

                    {job.serviceType === 'parcel' && job.details?.preferredDate && <p className="text-[11px] font-semibold text-indigo-800">Requested pickup: {Number.isNaN(Date.parse(job.details.preferredDate)) ? 'Time unavailable' : new Date(job.details.preferredDate).toLocaleString()} · operations confirmed; offer starts at or after this time</p>}
                    <OfferCountdownTimer expiresAt={job.offerExpiresAt} />

                    <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                      <button 
                        disabled={actionBusy || !job.offerExpiresAt || !Number.isFinite(Date.parse(job.offerExpiresAt)) || Date.parse(job.offerExpiresAt) <= Date.now()}
                        onClick={() => { if (job.offerExpiresAt && Date.parse(job.offerExpiresAt) > Date.now()) void handleAcceptJob(job.bookingId); }}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 rounded-lg"
                      >
                        Accept Dispatch
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => { setRejectingBookingId(job.bookingId); setRejectionReason('too_far'); setRejectionNotes(''); }}
                        className="rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rejectingBookingId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" data-screen="rejection-reason-modal">
                <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl space-y-3">
                  <h3 className="text-base font-bold">Decline Dispatch Offer</h3>
                  <p className="text-xs text-slate-400">
                    Select a reason to help dispatch improve route matching. 3 rejections within 10 minutes pauses offers for 60 seconds.
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { id: 'too_far', label: 'Distance to pickup is too far' },
                      { id: 'low_fare', label: 'Offer earnings are too low' },
                      { id: 'vehicle_issue', label: 'Vehicle or equipment issue' },
                      { id: 'emergency', label: 'Personal or family emergency' },
                      { id: 'ending_shift', label: 'Ending shift / Going offline' },
                      { id: 'other', label: 'Other operational reason' },
                    ].map(opt => (
                      <label key={opt.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2 cursor-pointer hover:border-slate-600">
                        <input
                          type="radio"
                          name="rejectionReason"
                          value={opt.id}
                          checked={rejectionReason === opt.id}
                          onChange={() => setRejectionReason(opt.id as DriverRejectionReason)}
                          className="accent-purple-500"
                        />
                        <span className="text-xs text-slate-200">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Optional notes</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={rejectionNotes}
                      onChange={e => setRejectionNotes(e.target.value)}
                      placeholder="Additional notes for operations"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setRejectingBookingId(null); setRejectionNotes(''); }}
                      className="flex-1 rounded-xl border border-slate-700 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void performAction(async () => {
                        await rejectDriverBooking({ bookingId: rejectingBookingId, reason: rejectionReason, notes: rejectionNotes });
                        setRejectingBookingId(null);
                        setRejectionNotes('');
                        setLocationRetry(r => r + 1);
                      })}
                      className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-xs font-bold text-white transition-colors"
                    >
                      Confirm Decline
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. VERIFICATION & SAFETY CRITERIA */}
        <div className="bg-slate-50/40 border border-slate-200 rounded-2xl p-4 text-xs space-y-3" data-screen="driver-verification-form">
          <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <Award className="w-4 h-4 text-purple-400" /> Compliance Status
          </h4>
          <p className="text-slate-300">Document review status: <strong className="capitalize">{profile?.status || 'pending'}</strong></p>
          {profile?.status !== 'verified' && <form onSubmit={handleSubmitVerification} className="space-y-2">
            <label className="block text-xs text-slate-700">Vehicle type<select name="vehicleType" autoComplete="off" value={vehicleType} onChange={(event) => setVehicleType(event.target.value as DriverProfile['vehicleType'])} className="mt-1 w-full rounded-lg border border-slate-700 bg-white p-3 text-base text-slate-900"><option value="bike">Motorbike</option><option value="auto">Auto rickshaw</option><option value="car">Car</option><option value="suv">SUV</option></select></label>
            <label className="block text-xs text-slate-700">Vehicle registration number<input name="vehicleNo" autoComplete="off" value={vehicleNo} onChange={(event) => setVehicleNo(event.target.value)} required maxLength={30} className="mt-1 w-full rounded-lg border border-slate-700 bg-white p-3 text-base text-slate-900" /></label>
            <label className="block text-xs text-slate-700">Driving licence number<input name="licenseNo" autoComplete="off" value={licenseNo} onChange={(event) => setLicenseNo(event.target.value)} required maxLength={40} className="mt-1 w-full rounded-lg border border-slate-700 bg-white p-3 text-base text-slate-900" /></label>
            <button type="submit" className="w-full rounded-lg bg-purple-600 py-2 text-xs font-bold text-white">Save details for review</button>
          </form>}
        </div>

        {/* User Profile Card & Quick Navigation Buttons */}
        <div className="bg-slate-50 border border-slate-700 rounded-2xl p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-black text-white text-sm">
              {userName ? userName[0] : 'D'}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">{userName || 'Driver Partner'}</h4>
              <p className="text-[11px] text-slate-400 font-mono">Verification: {profile?.status || 'pending'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button 
              onClick={() => setActiveSubView('orders')}
              className="min-h-11 bg-white hover:bg-slate-100 border border-slate-700 text-slate-700 font-bold text-[10px] py-2 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-purple-400" />
              <span>View Orders</span>
            </button>
            <button 
              onClick={() => setActiveSubView('wallet')}
              className="min-h-11 bg-white hover:bg-slate-100 border border-slate-700 text-slate-700 font-bold text-[10px] py-2 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Wallet</span>
            </button>
            <button 
              onClick={() => setActiveSubView('support')}
              className="min-h-11 bg-white hover:bg-slate-100 border border-slate-700 text-slate-700 font-bold text-[10px] py-2 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-blue-400" />
              <span>Support</span>
            </button>
          </div>
        </div>

      </div>

      {/* Driver Footer */}
      <nav className="role-navigation" aria-label="Delivery partner navigation">{([{id:null,label:'Home',Icon:Navigation},{id:'orders',label:'Orders',Icon:FileText},{id:'notifications',label:'Alerts',Icon:Bell},{id:'wallet',label:'Earnings',Icon:DollarSign},{id:'profile',label:'Profile',Icon:Award}] as const).map(({id,label,Icon})=><button type="button" key={label} aria-current={activeSubView===id?'page':undefined} onClick={()=>setActiveSubView(id)}><Icon size={21} aria-hidden="true"/><span>{label}{id === 'notifications' && notificationHistory.some(item => !item.readAt) ? ` · ${notificationHistory.filter(item => !item.readAt).length}` : ''}</span></button>)}</nav>

    </div>
  );
}
