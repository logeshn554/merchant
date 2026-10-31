import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  writeBatch,
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Booking, UserProfile, DriverProfile, SavedAddress, SupportTicket, DriverLedgerEntry } from '../types';
import type { ServiceFareBreakdown } from '../design-system/serviceQuote';
import { subscriptionGroup } from './subscriptionGroup';

export function listenToMerchantHours(id: string, type: 'restaurant' | 'grocery', callback: (value: { weeklyHours?: Record<string, { open: string; close: string }[]>; timeZone?: string; acceptingOrders?: boolean; pausedUntil?: string | null; pausedAt?: string | null; pausedReason?: string | null }) => void, onError: (error: unknown) => void) {
  return onSnapshot(doc(db, type === 'restaurant' ? 'restaurants' : 'grocery_stores', id), snapshot => { if (!snapshot.exists()) { onError(new Error('Business unavailable.')); return; } callback(snapshot.data()); }, onError);
}
export async function setMerchantHours(merchantId: string, merchantType: 'restaurant' | 'grocery', weeklyHours: Record<string, { open: string; close: string }[]>, timeZone: string, acceptingOrders?: boolean) {
  return (await httpsCallable(functions, 'setMerchantHours')({ merchantId, merchantType, weeklyHours, timeZone, ...(typeof acceptingOrders === 'boolean' ? { acceptingOrders } : {}) })).data;
}
export async function setMerchantPause(input: {
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
  durationMinutes: number | 'indefinite';
  reason?: string;
}): Promise<{
  success: boolean;
  paused: boolean;
  pausedUntil: string | null;
  pausedAt: string | null;
  pausedReason: string | null;
  acceptingOrders: boolean;
}> {
  return (await httpsCallable(functions, 'setMerchantPause')(input)).data as any;
}
export type MerchantCapacity = { maxPreparationOrders: number; activePreparationOrders: number; revision: number };
export async function getMerchantCapacity(input: { merchantId: string; merchantType: 'restaurant' | 'grocery' }): Promise<MerchantCapacity> {
  return (await httpsCallable<typeof input, MerchantCapacity>(functions, 'getMerchantCapacity')(input)).data;
}
export async function setMerchantCapacity(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; maxPreparationOrders: number; expectedRevision: number }): Promise<MerchantCapacity> {
  return (await httpsCallable<typeof input, MerchantCapacity>(functions, 'setMerchantCapacity')(input)).data;
}
export type MerchantBusinessSummary = { id: string; merchantType: 'restaurant' | 'grocery'; name: string; address: string; timeZone?: string; profileRevision?: number; acceptingOrders: boolean; pausedUntil?: string | null; pausedAt?: string | null; pausedReason?: string | null; applicationId?: string; applicationNeedsInformation?: boolean; permissions?: Array<'orders' | 'catalog' | 'business'>; canManageStaff?: boolean };
export async function listMerchantBusinesses(): Promise<MerchantBusinessSummary[]> {
  const result = (await httpsCallable<void, { businesses: MerchantBusinessSummary[] }>(functions, 'listMerchantBusinesses')()).data;
  return result.businesses;
}
export type MerchantOffer = { code: string; type: 'fixed' | 'percent'; discountCents?: number; percentBps?: number; maxDiscountCents?: number; minAmountCents: number; maxRedemptions: number; redeemedCount: number; enabled: boolean; expiresAt: string | null; version: number };
export async function listMerchantOffers(input: { merchantId: string; merchantType: 'restaurant' | 'grocery' }): Promise<{ offers: MerchantOffer[]; hasMore: boolean }> {
  return (await httpsCallable<typeof input, { offers: MerchantOffer[]; hasMore: boolean }>(functions, 'listMerchantOffers')(input)).data;
}
export async function saveMerchantOffer(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; code: string; requestId: string; expectedVersion: number; enabled: boolean; type: 'fixed' | 'percent'; discountCents?: number; percentBps?: number; maxDiscountCents?: number; minAmountCents: number; maxRedemptions: number; expiresAt: string }): Promise<{ code: string; version: number; enabled: boolean }> {
  return (await httpsCallable<typeof input, { code: string; version: number; enabled: boolean }>(functions, 'saveMerchantOffer')(input)).data;
}
export async function updateMerchantBusinessProfile(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; name: string; address: string; timeZone: string; expectedRevision: number; requestId: string }) {
  return (await httpsCallable<typeof input, { updated: true; revision: number }>(functions, 'updateMerchantBusinessProfile')(input)).data;
}
export async function getTransportOperatorDashboard() {
  return (await httpsCallable<void, import('../types').TransportOperatorDashboardData>(functions, 'getTransportOperatorDashboard')()).data;
}
export async function reviewTransportPickupTime(input: { bookingId: string; decision: 'confirmed' | 'declined'; reason: string; expectedRevision: number; requestId: string }) {
  return (await httpsCallable<typeof input, { status: string; revision: number }>(functions, 'reviewTransportPickupTime')(input)).data;
}
export async function listTransportOperators(needs?: { vehicleWeightKg: number; vehicleDimensions: { lengthCm: number; widthCm: number; heightCm: number } }) {
  return (await httpsCallable<typeof needs, { operators: import('../types').TransportOperatorOption[] }>(functions, 'listTransportOperators')(needs)).data.operators;
}
export async function requestTransportQuote(input: { operatorId: string; requestId: string; booking: Pick<import('../types').Booking, 'serviceType' | 'customerName' | 'pickupAddress' | 'dropAddress' | 'details'> }) {
  return (await httpsCallable<typeof input, { requestId: string; status: string; revision: number }>(functions, 'requestTransportQuote')(input)).data;
}
export async function getTransportQuoteRequest(requestId: string) {
  return (await httpsCallable<{ requestId: string }, import('../types').TransportQuoteRequestStatus>(functions, 'getTransportQuoteRequest')({ requestId })).data;
}
export async function acceptTransportQuote(input: { requestId: string; expectedRevision: number }) {
  return (await httpsCallable<typeof input, { quoteId: string; amount: number; price: number; expiresAt: string; estimatedKm: number; estimatedMinutes: number }>(functions, 'acceptTransportQuote')(input)).data;
}
export async function cancelTransportQuoteRequest(requestId: string) { return (await httpsCallable<{ requestId: string }, { status: string }>(functions, 'cancelTransportQuoteRequest')({ requestId })).data; }
export async function issueTransportQuote(input: { requestId: string; decision: 'confirmed' | 'declined'; amountCents: number; expiresInMinutes: number; reason: string; expectedRevision: number; requestIdempotencyKey: string }) {
  return (await httpsCallable<typeof input, { status: string; revision: number; expiresAt: string | null }>(functions, 'issueTransportQuote')(input)).data;
}
export async function requestTransportOperatorLink(operatorId: string) {
  return (await httpsCallable<{ operatorId: string }, { status: string }>(functions, 'requestTransportOperatorLink')({ operatorId })).data;
}
export async function reviewTransportDriverLink(input: { operatorId: string; driverId: string; decision: 'approved' | 'declined' }) {
  return (await httpsCallable<typeof input, { status: string }>(functions, 'reviewTransportDriverLink')(input)).data;
}
export async function assignTransportFleetBooking(input: { bookingId: string; driverId: string; vehicleId: string }) {
  return (await httpsCallable<typeof input, { status: string }>(functions, 'assignTransportFleetBooking')(input)).data;
}
export async function submitTransportVehicle(input: { vehicleId: string; label: string; registration: string; carrierType: string; maxLoadKg: number; maxLengthCm: number; maxWidthCm: number; maxHeightCm: number; insuranceReference: string; rcReference: string }) {
  return (await httpsCallable<typeof input, { status: string; vehicleId: string }>(functions, 'submitTransportVehicle')(input)).data;
}
export async function listTransportVehicleReviews() {
  return (await httpsCallable<void, { vehicles: Array<{ vehicleId: string; operatorId: string; label: string; registration: string; carrierType: string; maxLoadKg: number; maxLengthCm: number; maxWidthCm: number; maxHeightCm: number; insuranceReference: string; rcReference: string }>; hasMore: boolean }>(functions, 'listTransportVehicleReviews')()).data;
}
export async function reviewTransportVehicle(input: { operatorId: string; vehicleId: string; decision: 'approved' | 'rejected'; reason: string }) {
  return (await httpsCallable<typeof input, { status: string }>(functions, 'reviewTransportVehicle')(input)).data;
}
export type StaffPermission = 'orders' | 'catalog' | 'business' | 'settlements';
export type MerchantStaffMember = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role?: 'manager' | 'staff';
  permissions: Array<StaffPermission>;
};
export type MerchantStaffInvite = {
  inviteCode: string;
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
  role: 'manager' | 'staff';
  permissions: Array<StaffPermission>;
  contactType: 'phone' | 'email' | 'code';
  targetContact?: string | null;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
};
export type MerchantStaffActivity = {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
  details: Record<string, unknown>;
  createdAt: string;
};

export async function listMerchantStaff(merchantId: string, merchantType: 'restaurant' | 'grocery'): Promise<MerchantStaffMember[]> {
  const result = (await httpsCallable<{ merchantId: string; merchantType: 'restaurant' | 'grocery' }, { members: MerchantStaffMember[] }>(functions, 'listMerchantStaff')({ merchantId, merchantType })).data;
  return result.members;
}
export async function grantMerchantStaffAccess(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; staffUid: string; permissions: Array<StaffPermission>; role?: 'manager' | 'staff' }) {
  return (await httpsCallable(functions, 'grantMerchantStaffAccess')(input)).data;
}
export async function revokeMerchantStaffAccess(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; staffUid: string }) {
  return (await httpsCallable(functions, 'revokeMerchantStaffAccess')(input)).data;
}
export async function createMerchantStaffInvite(input: {
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
  contactType?: 'phone' | 'email' | 'code';
  targetContact?: string;
  role?: 'manager' | 'staff';
  permissions?: Array<StaffPermission>;
}): Promise<{ success: boolean; inviteCode: string; role: string; permissions: string[]; expiresAt: string }> {
  return (await httpsCallable<typeof input, { success: boolean; inviteCode: string; role: string; permissions: string[]; expiresAt: string }>(functions, 'createMerchantStaffInvite')(input)).data;
}
export async function listMerchantStaffInvites(merchantId: string, merchantType: 'restaurant' | 'grocery'): Promise<MerchantStaffInvite[]> {
  const result = (await httpsCallable<{ merchantId: string; merchantType: 'restaurant' | 'grocery' }, { invites: MerchantStaffInvite[] }>(functions, 'listMerchantStaffInvites')({ merchantId, merchantType })).data;
  return result.invites;
}
export async function cancelMerchantStaffInvite(merchantId: string, merchantType: 'restaurant' | 'grocery', inviteCode: string): Promise<{ cancelled: boolean }> {
  return (await httpsCallable<{ merchantId: string; merchantType: 'restaurant' | 'grocery'; inviteCode: string }, { cancelled: boolean }>(functions, 'cancelMerchantStaffInvite')({ merchantId, merchantType, inviteCode })).data;
}
export async function acceptMerchantStaffInvite(inviteCode: string): Promise<{ success: boolean; merchantId: string; merchantType: 'restaurant' | 'grocery'; permissions: string[]; role: string }> {
  return (await httpsCallable<{ inviteCode: string }, { success: boolean; merchantId: string; merchantType: 'restaurant' | 'grocery'; permissions: string[]; role: string }>(functions, 'acceptMerchantStaffInvite')({ inviteCode })).data;
}
export async function listMerchantStaffActivity(merchantId: string, merchantType: 'restaurant' | 'grocery', limit?: number): Promise<MerchantStaffActivity[]> {
  const result = (await httpsCallable<{ merchantId: string; merchantType: 'restaurant' | 'grocery'; limit?: number }, { activities: MerchantStaffActivity[] }>(functions, 'listMerchantStaffActivity')({ merchantId, merchantType, limit })).data;
  return result.activities;
}
export async function logMerchantStaffActivity(merchantId: string, merchantType: 'restaurant' | 'grocery', action: string, details?: Record<string, unknown>): Promise<{ success: boolean }> {
  return (await httpsCallable<{ merchantId: string; merchantType: 'restaurant' | 'grocery'; action: string; details?: Record<string, unknown> }, { success: boolean }>(functions, 'logMerchantStaffActivity')({ merchantId, merchantType, action, details })).data;
}
export async function saveCatalogItem(merchantId: string, merchantType: 'restaurant' | 'grocery', itemId: string, item: unknown) {
  return (await httpsCallable(functions, 'saveCatalogItem')({ merchantId, merchantType, itemId, item })).data;
}
export async function bulkSaveCatalogItems(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; requestId: string; items: { itemId: string; item: Record<string, unknown>; expectedStock?: number }[] }) {
  return (await httpsCallable<typeof input, { saved: number; created: number; updated: number; requestId: string }>(functions, 'bulkSaveCatalogItems')(input)).data;
}
export type UploadCatalogPhotoResult = {
  success: boolean;
  imageUrl: string;
  sha256: string;
  size: number;
  scanStatus: string;
};
export async function uploadCatalogPhoto(input: {
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
  itemId: string;
  fileBase64: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}): Promise<UploadCatalogPhotoResult> {
  return (await httpsCallable<typeof input, UploadCatalogPhotoResult>(functions, 'uploadCatalogPhoto')(input)).data;
}
export async function submitOrderReview(bookingId: string, rating: number, comment: string) {
  return (await httpsCallable(functions,'submitOrderReview')({bookingId,rating,comment})).data;
}
export type MerchantOrderReview = { reviewId: string; bookingId: string; rating: number; comment: string; createdAt: string };
export async function listMerchantOrderReviews(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; cursor?: string | null }): Promise<{ reviews: MerchantOrderReview[]; nextCursor: string | null }> {
  return (await httpsCallable<typeof input, { reviews: MerchantOrderReview[]; nextCursor: string | null }>(functions, 'listMerchantOrderReviews')(input)).data;
}
export async function exportAccountPage(section: string, cursor: string | null = null, parentId?: string): Promise<{items:unknown[];nextCursor:string|null}> {
  return (await httpsCallable(functions,'exportAccountPage')({section,cursor,...(parentId ? { parentId } : {})})).data as {items:unknown[];nextCursor:string|null};
}
export function listenToOrderReviews(uid: string, callback: (reviews: { id:string; bookingId:string; rating:number; comment:string; createdAt:string }[]) => void, onError: (error:unknown)=>void) {
  return onSnapshot(query(collection(db,'order_reviews'),where('userId','==',uid)),snapshot=>callback(snapshot.docs.map(item=>({id:item.id,...item.data()} as { id:string; bookingId:string; rating:number; comment:string; createdAt:string }))),onError);
}
export type UserNotification = { id: string; eventId: string; bookingId?: string; audience: string[]; type: string; title: string; body: string; createdAt: { toDate: () => Date }; readAt: unknown | null; deliveryStatus: 'sending' | 'sent' | 'partial' | 'failed' | 'in_app'; deliveryError?: string };
export type MerchantSettlementEntry = { bookingId: string; merchantId: string; serviceType: 'food' | 'grocery'; contractVersion: number; commissionBps: number; itemValueCents: number; discountCents: number; commissionCents: number; payableCents: number; createdAt: { toDate: () => Date } };
export type MerchantSettlementBalance = { merchantId: string; serviceType: 'food' | 'grocery'; currency: string; availableCents: number; reservedCents: number; updatedAt: { toDate: () => Date } };
export type MerchantSettlementAgreement = { status: 'not_configured' | 'pending_acceptance' | 'active'; version: number; serviceType?: 'food' | 'grocery'; commissionBps?: number; agreementReference?: string; acceptedAt?: unknown };
export async function getMerchantSettlementAgreement(merchantId: string, merchantType: 'restaurant' | 'grocery') {
  return (await httpsCallable(functions, 'getMerchantSettlementAgreement')({ merchantId, merchantType })).data as MerchantSettlementAgreement;
}
export async function acceptMerchantSettlementAgreement(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; expectedVersion: number; requestId: string; accepted: true }) {
  return (await httpsCallable(functions, 'acceptMerchantSettlementAgreement')(input)).data as { status: string; version: number };
}
export type MerchantPayoutAccount = {
  status: 'not_configured' | 'pending_verification' | 'verified' | 'rejected';
  accountType?: 'bank_account' | 'upi';
  maskedAccount?: string;
  beneficiaryName?: string;
  bankName?: string;
  ifscCode?: string;
  verifiedAt?: string | null;
};
export async function setMerchantPayoutAccount(input: {
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
  accountType: 'bank_account' | 'upi';
  beneficiaryName: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
}): Promise<{ success: boolean; status: string; accountType: string; maskedAccount: string; beneficiaryName: string }> {
  return (await httpsCallable(functions, 'setMerchantPayoutAccount')(input)).data as { success: boolean; status: string; accountType: string; maskedAccount: string; beneficiaryName: string };
}
export async function getMerchantPayoutAccount(merchantId: string, merchantType: 'restaurant' | 'grocery'): Promise<MerchantPayoutAccount> {
  return (await httpsCallable(functions, 'getMerchantPayoutAccount')({ merchantId, merchantType })).data as MerchantPayoutAccount;
}
export type MerchantTaxCompliance = {
  gstin: string | null;
  fssaiNumber: string | null;
  verified: boolean;
};
export async function setMerchantTaxCompliance(input: {
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
  gstin?: string;
  fssaiNumber?: string;
}): Promise<{ success: boolean; gstin: string | null; fssaiNumber: string | null }> {
  return (await httpsCallable(functions, 'setMerchantTaxCompliance')(input)).data as { success: boolean; gstin: string | null; fssaiNumber: string | null };
}
export async function getMerchantTaxCompliance(merchantId: string, merchantType: 'restaurant' | 'grocery'): Promise<MerchantTaxCompliance> {
  return (await httpsCallable(functions, 'getMerchantTaxCompliance')({ merchantId, merchantType })).data as MerchantTaxCompliance;
}
export type WeeklySettlementStatement = {
  statementId: string;
  weekStart: string;
  weekEnd: string;
  orderCount: number;
  grossSalesCents: number;
  discountsCents: number;
  commissionCents: number;
  gstCents: number;
  netPayableCents: number;
  status: string;
  utrNumber: string;
};
export type MerchantWeeklySettlementsResult = {
  statements: WeeklySettlementStatement[];
  csvData: string;
  merchantGstin: string;
  merchantFssai: string;
  platformGstin: string;
};
export async function getMerchantWeeklySettlements(merchantId: string, merchantType: 'restaurant' | 'grocery'): Promise<MerchantWeeklySettlementsResult> {
  return (await httpsCallable(functions, 'getMerchantWeeklySettlements')({ merchantId, merchantType })).data as MerchantWeeklySettlementsResult;
}
export function listenToMerchantSettlementBalance(merchantId: string, merchantType: 'restaurant' | 'grocery', callback: (balance: MerchantSettlementBalance | null) => void, onError: (error: unknown) => void) {
  return onSnapshot(doc(db, 'merchant_balances', merchantId), snapshot => callback(snapshot.exists() ? snapshot.data() as MerchantSettlementBalance : null), onError);
}
export function listenToMerchantSettlementEntries(merchantId: string, merchantType: 'restaurant' | 'grocery', callback: (entries: MerchantSettlementEntry[]) => void, onError: (error: unknown) => void) {
  const serviceType = merchantType === 'restaurant' ? 'food' : 'grocery';
  const records = collection(db, `merchant_ledger/${merchantId}/entries`);
  return onSnapshot(query(records, where('merchantId', '==', merchantId), where('serviceType', '==', serviceType), orderBy('createdAt', 'desc'), limit(50)), snapshot => callback(snapshot.docs.map(item => item.data() as MerchantSettlementEntry)), onError);
}
export function listenToUserNotifications(uid: string, callback: (items: UserNotification[]) => void, onError: (error: unknown) => void) {
  return onSnapshot(query(collection(db, `user_notifications/${uid}/items`), orderBy('createdAt', 'desc'), limit(50)), snapshot => callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as UserNotification)), onError);
}
export async function markUserNotificationsRead(uid: string, ids: string[]) {
  const unique = [...new Set(ids)].filter(id => /^[a-f0-9]{64}$/.test(id)).slice(0, 100);
  if (!unique.length) return;
  const batch = writeBatch(db);
  unique.forEach(id => batch.update(doc(db, `user_notifications/${uid}/items/${id}`), { readAt: new Date() }));
  await batch.commit();
}

/**
 * Fetches user profile or creates it if missing.
 */
export async function getOrCreateUserProfile(uid: string, fallbackEmail: string, fallbackName: string, selectedRole: 'customer' | 'driver' | 'merchant' | 'admin' = 'customer'): Promise<UserProfile> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const newUser: UserProfile = {
      uid,
      name: fallbackName || fallbackEmail.split('@')[0],
      email: fallbackEmail,
      role: 'customer',
      createdAt: new Date().toISOString(),
      walletBalance: 0
    };

    return await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(userRef);
      if (snapshot.exists()) return { ...snapshot.data(), uid } as UserProfile;
      transaction.set(userRef, newUser);
      return newUser;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export async function updateUserAddress(uid: string, defaultAddress: string, defaultAddressId = '') {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), { defaultAddress: defaultAddress.trim(), defaultAddressId });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function saveAccountName(uid: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) throw new Error('Enter a name between 2 and 100 characters.');
  await updateDoc(doc(db, 'users', uid), { name: trimmed });
}

export function listenToSavedAddresses(uid: string, callback: (addresses: SavedAddress[]) => void) {
  const path = `users/${uid}/addresses`;
  return onSnapshot(collection(db, 'users', uid, 'addresses'), (snapshot) => {
    const addresses = snapshot.docs.map((addressDoc) => ({ id: addressDoc.id, ...addressDoc.data() } as SavedAddress));
    addresses.sort((a, b) => a.label.localeCompare(b.label) || a.createdAt.localeCompare(b.createdAt));
    callback(addresses);
  }, (err) => handleFirestoreError(err, OperationType.GET, path));
}

export async function saveUserAddress(uid: string, label: string, address: string, deliveryDetails?: SavedAddress['deliveryDetails'], location?: SavedAddress['location'], addressId?: string) {
  const path = `users/${uid}/addresses`;
  try {
    const addressRef = addressId ? doc(db, 'users', uid, 'addresses', addressId) : doc(collection(db, 'users', uid, 'addresses'));
    const batch = writeBatch(db);
    const fields = { label: label.trim(), address: address.trim(), ...(deliveryDetails ? { deliveryDetails } : {}), ...(location ? { location } : {}), ...(!addressId ? { createdAt: new Date().toISOString() } : {}) };
    if (addressId) batch.update(addressRef, fields); else batch.set(addressRef, fields);
    batch.update(doc(db, 'users', uid), { defaultAddressId: addressRef.id, defaultAddress: address.trim() });
    await batch.commit();
    return addressRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export async function deleteSavedAddress(uid: string, addressId: string, wasDefault: boolean) {
  const path = `users/${uid}/addresses/${addressId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, 'addresses', addressId));
    if (wasDefault) batch.update(doc(db, 'users', uid), { defaultAddressId: '', defaultAddress: '' });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
}

export async function updateUserPreferences(uid: string, preferences: NonNullable<UserProfile['preferences']>) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), { preferences });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}
export async function updateUserFavorites(uid: string, favorites: string[]) {
  if (favorites.length > 200 || favorites.some(id => typeof id !== 'string' || !/^(restaurant|store|dish|product):[^/\u0000-\u001f]{1,128}$/.test(id))) throw new Error('Saved items contain an invalid catalog reference.');
  await updateDoc(doc(db, 'users', uid), { favorites: [...new Set(favorites)] });
}

/**
 * Updates an existing user role
 */
export async function updateUserRole(uid: string, role: 'customer' | 'driver' | 'merchant' | 'admin') {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), { role });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Fetches or initializes a Driver Profile for tracking GPS and verification.
 */
export async function getOrCreateDriverProfile(driverId: string, lat?: number, lng?: number): Promise<DriverProfile> {
  const path = `driver_profiles/${driverId}`;
  try {
    const ref = doc(db, 'driver_profiles', driverId);
    const isDemo = driverId.startsWith('demo-');
    const defaultProfile: DriverProfile = {
      driverId,
      vehicleType: 'bike',
      vehicleNo: isDemo ? 'KA-01-AB-1234' : '',
      licenseNo: isDemo ? 'DL-9876543210' : '',
      status: isDemo ? 'verified' : 'pending',
      online: isDemo ? true : false,
      ...(lat !== undefined && lng !== undefined ? { currentLat: lat, currentLng: lng } : isDemo ? { currentLat: 12.9716, currentLng: 77.5946 } : {}),
      ...(isDemo ? { locationConsent: true, supportedServices: ['food', 'grocery', 'ride', 'parcel', 'takeover', 'transport'] } : {}),
      todayEarnings: isDemo ? 450 : 0,
      completedJobs: isDemo ? 3 : 0
    };

    if (isDemo) {
      try {
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) return snapshot.data() as DriverProfile;
      } catch {
        // demo fallback
      }
      return defaultProfile;
    }

    return await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) return snapshot.data() as DriverProfile;
      transaction.set(ref, defaultProfile);
      return defaultProfile;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * updates active driver coordinates and online toggle
 */
export async function updateDriverStatus(driverId: string, updates: Partial<DriverProfile>) {
  const path = `driver_profiles/${driverId}`;
  try {
    const ref = doc(db, 'driver_profiles', driverId);
    await updateDoc(ref, updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function updateDriverVerification(driverId: string, status: DriverProfile['status'], supportedServices: Booking['serviceType'][] = []) {
  throw new Error('Use the audited driver eligibility review with the actual application and document references.');
}

/**
 * Creates a synchronized booking order
 */
export async function startOnlinePayment(booking: Pick<Booking, 'serviceType' | 'customerName' | 'pickupAddress' | 'dropAddress' | 'details'> & { couponCode?: string }, expectedAmountCents: number, requestId: string) {
  const request = { ...booking, expectedAmountCents, requestId };
  const createOrder = httpsCallable<typeof request, { orderId: string; keyId: string; amount: number; currency: string }>(functions, 'createPaymentOrder');
  const result = await createOrder(request);
  return result.data;
}

export async function createCodBooking(data: { booking: Pick<Booking, 'serviceType' | 'customerName' | 'pickupAddress' | 'dropAddress' | 'details'> & { couponCode?: string }; expectedAmountCents: number; requestId: string }) {
  const createCod = httpsCallable<typeof data, { bookingId: string; status: string }>(functions, 'createCodBooking');
  const result = await createCod(data);
  return result.data;
}

export async function getServiceQuote(booking: Pick<Booking, 'serviceType' | 'customerName' | 'pickupAddress' | 'dropAddress' | 'details'> & { couponCode?: string }) {
  const quote = httpsCallable<typeof booking, { quoteId: string; amount: number; currency: string; price: number; expiresAt: string; estimatedKm: number; estimatedMinutes: number; fareBreakdown?: ServiceFareBreakdown }>(functions, 'getServiceQuote');
  return (await quote(booking)).data;
}

export type ServiceLocation = { placeId: string; address: string; location: { lat: number; lng: number }; partialMatch: boolean };
export type AutocompleteSuggestion = { placeId: string; description: string; mainText: string; secondaryText: string };

export async function searchServiceLocations(address: string): Promise<ServiceLocation[]> {
  return (await httpsCallable<{ address: string }, { locations: ServiceLocation[] }>(functions, 'searchServiceLocations')({ address })).data.locations;
}

export async function autocompleteServiceLocations(input: string, sessionToken?: string): Promise<{ suggestions: AutocompleteSuggestion[] }> {
  return (await httpsCallable<{ input: string; sessionToken?: string }, { suggestions: AutocompleteSuggestion[] }>(functions, 'autocompleteServiceLocations')({ input, sessionToken })).data;
}

export function listenToAccountProfile(userId: string, callback: (profile: UserProfile) => void, onError: (error: unknown) => void) {
  if (userId.startsWith('demo-')) {
    return () => {};
  }
  return onSnapshot(doc(db, 'users', userId), snapshot => {
    if (snapshot.exists()) callback(snapshot.data() as UserProfile);
    else onError(new Error('Your account profile is unavailable.'));
  }, onError);
}

export function listenToBookingContacts(bookingId: string, callback: (contacts: NonNullable<Booking['details']>['parcelContacts'] | null) => void, onError: (error: unknown) => void) {
  return onSnapshot(doc(db, 'booking_contacts', bookingId), snapshot => callback(snapshot.exists() ? snapshot.data() as NonNullable<NonNullable<Booking['details']>['parcelContacts']> : null), onError);
}

export function listenToDriverLocation(driverId: string, callback: (profile: DriverProfile | null) => void, onError: (error: unknown) => void) {
  return onSnapshot(doc(db, 'driver_profiles', driverId), snapshot => callback(snapshot.exists() ? snapshot.data() as DriverProfile : null), onError);
}

export interface BookingTracking { driverId: string; currentLat: number; currentLng: number; locationUpdatedAt: string; locationAccuracyMeters?: number }
export function listenToBookingTracking(bookingId: string, callback: (value: BookingTracking | null) => void, onError: (error: unknown) => void) {
  return onSnapshot(doc(db, 'booking_tracking', bookingId), snapshot => callback(snapshot.exists() ? snapshot.data() as BookingTracking : null), onError);
}
export async function updateDriverLocation(lat: number, lng: number, accuracy: number) {
  return (await httpsCallable(functions, 'updateDriverLocation')({ location: { lat, lng }, accuracy })).data;
}
export async function getTrackingRoute(bookingId: string) {
  return (await httpsCallable<{ bookingId: string }, { distanceMeters: number; estimatedMinutes: number; calculatedAt: string; destination: string }>(functions, 'getTrackingRoute')({ bookingId })).data;
}

export async function acceptDriverBooking(bookingId: string) {
  return (await httpsCallable<{ bookingId: string }, { status: string }>(functions, 'acceptDriverBooking')({ bookingId })).data;
}
export async function rejectDriverBooking(input: string | { bookingId: string; reason?: string; notes?: string }, reason?: string, notes?: string) {
  const payload = typeof input === 'string'
    ? { bookingId: input, ...(reason ? { reason } : {}), ...(notes ? { notes } : {}) }
    : input;
  return (await httpsCallable<typeof payload, { status: string; reason?: string; acceptanceRate?: number; cooldownUntil?: string }>(functions, 'rejectDriverBooking')(payload)).data;
}

export async function advanceDriverBooking(bookingId: string, status: 'preparing' | 'transit' | 'arrived_at_destination' | 'completed', otp?: string) {
  return (await httpsCallable<{ bookingId: string; status: string; otp?: string }, { status: string }>(functions, 'advanceDriverBooking')({ bookingId, status, ...(otp ? { otp } : {}) })).data;
}

export type TransportInspectionStage = 'pickup' | 'delivery';
export type TransportInspectionPhoto = { contentType: string; base64: string };
export type TransportInspectionRecord = { bookingId: string; stage: TransportInspectionStage; status: 'recorded'; driverId: string; checklist: Record<string, true>; conditionNotes: string; photos: TransportInspectionPhoto[]; recordedAt: string };
export async function recordTransportInspection(bookingId: string, stage: TransportInspectionStage, checklist: Record<string, boolean>, conditionNotes: string, photos: TransportInspectionPhoto[]) {
  return (await httpsCallable<{ bookingId: string; stage: TransportInspectionStage; checklist: Record<string, boolean>; conditionNotes: string; photos: TransportInspectionPhoto[] }, { status: 'recorded'; stage: TransportInspectionStage }>(functions, 'recordTransportInspection')({ bookingId, stage, checklist, conditionNotes, photos })).data;
}
export async function getTransportInspection(bookingId: string, stage: TransportInspectionStage) {
  return (await httpsCallable<{ bookingId: string; stage: TransportInspectionStage }, { inspection: TransportInspectionRecord | null }>(functions, 'getTransportInspection')({ bookingId, stage })).data.inspection;
}
export type TransportTollClaim = { claimId: string; amountCents: number; description: string; status: string; reviewReason: string | null; createdAt: string | null; receiptCount: number };
export async function submitTransportTollClaim(input: { bookingId: string; requestId: string; amountCents: number; description: string; receipts: TransportInspectionPhoto[] }) { return (await httpsCallable<typeof input, { claimId: string; status: string }>(functions, 'submitTransportTollClaim')(input)).data; }
export async function getTransportTollClaims(bookingId: string) { return (await httpsCallable<{ bookingId: string }, { claims: TransportTollClaim[] }>(functions, 'getTransportTollClaims')({ bookingId })).data.claims; }
export async function getTransportTollReceipt(operatorId: string, claimId: string) { return (await httpsCallable<{ operatorId: string; claimId: string }, { receipts: TransportInspectionPhoto[] }>(functions, 'getTransportTollReceipt')({ operatorId, claimId })).data.receipts; }
export async function listTransportTollClaimsForReview() { return (await httpsCallable<void, { claims: Array<{ claimId: string; bookingId: string; operatorId: string; driverId: string; amountCents: number; description: string; receiptCount: number; createdAt: string | null }>; hasMore: boolean }>(functions, 'listTransportTollClaimsForReview')()).data; }
export async function reviewTransportTollClaim(input: { operatorId: string; claimId: string; bookingId: string; decision: 'approved' | 'rejected'; reason: string; requestId: string }) { return (await httpsCallable<typeof input, { status: string }>(functions, 'reviewTransportTollClaim')(input)).data; }

export type DeliveryProofPolicy = { enabled: boolean; version: number; retentionDays: number; privacyPolicyUrl: string };
export async function getDeliveryProofPolicy() {
  return (await httpsCallable<void, DeliveryProofPolicy>(functions, 'getDeliveryProofPolicy')()).data;
}
export async function saveDeliverySignature(data: { bookingId: string; requestId: string; strokes: { x: number; y: number }[][]; consent: true; otp: string; policyVersion: number; privacyPolicyUrl: string }) {
  return (await httpsCallable<typeof data, { proofId: string; status: string; retentionUntil: string }>(functions, 'saveDeliverySignature')(data)).data;
}
export async function getDeliverySignature(bookingId: string) {
  return (await httpsCallable<{ bookingId: string }, { proofId: string; bookingId: string; method: string; signatureSvg: string; capturedAt: string; retentionUntil: string }>(functions, 'getDeliverySignature')({ bookingId })).data;
}

export async function confirmOnlinePayment(payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  const verifyPayment = httpsCallable<typeof payment, { bookingId: string; status: 'paid' | 'processing' }>(functions, 'verifyPayment');
  const result = await verifyPayment(payment);
  return result.data;
}

export async function requestBookingCancellation(bookingId: string, reason?: string) {
  const cancelBooking = httpsCallable<{ bookingId: string; reason?: string }, { status: 'cancelled' | 'refund_processing' }>(functions, 'cancelPaidBooking');
  const result = await cancelBooking({ bookingId, ...(reason ? { reason } : {}) });
  return result.data;
}
export async function rejectMerchantBooking(bookingId: string, reason: string) {
  return (await httpsCallable(functions, 'rejectMerchantBooking')({ bookingId, reason })).data;
}

export type PaymentActivity = { orderId: string; amount: number; currency: string; serviceType: string; status: string; createdAt: string | null; paidAt: string | null; updatedAt: string | null; bookingId: string | null; paymentId: string | null; paymentMethod: string | null; refundStatus: string | null; refundedAmountCents: number; refundRequestedAmountCents: number; refundId: string | null };
export async function listPaymentActivity(): Promise<PaymentActivity[]> {
  return (await httpsCallable<void, { attempts: PaymentActivity[] }>(functions, 'listPaymentActivity')()).data.attempts;
}
export async function recoverPayment(orderId: string) {
  return (await httpsCallable<{ orderId: string }, { status: string; bookingId?: string }>(functions, 'recoverPayment')({ orderId })).data;
}
export async function recoverCodBooking(orderId: string) {
  return (await httpsCallable<{ orderId: string }, { status: string; bookingId?: string }>(functions, 'recoverCodBooking')({ orderId })).data;
}

export async function reportBookingException(data: { bookingId: string; requestId: string; kind: string; reason: string }) {
  return (await httpsCallable(functions, 'reportBookingException')(data)).data;
}
export async function resolveBookingException(data: { bookingId: string; requestId: string; expectedRevision: number; reason: string }) {
  return (await httpsCallable(functions, 'resolveBookingException')(data)).data;
}

/**
 * Updates booking status or fields
 */
export async function updateBookingStatus(bookingId: string, updates: Partial<Booking>) {
  const path = `bookings/${bookingId}`;
  try {
    const ref = doc(db, 'bookings', bookingId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Listens to active bookings real-time
 */
export function listenToBookings(callback: (bookings: Booking[]) => void, onError: (error: unknown) => void = console.error) {
  const path = 'bookings';
  const q = query(collection(db, path), limit(25));
  return onSnapshot(q, (snapshot) => {
    const bookingsList: Booking[] = [];
    snapshot.forEach((doc) => {
      bookingsList.push(doc.data() as Booking);
    });
    // Sort by createdAt descending
    bookingsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(bookingsList);
  }, (err) => {
    // FIX-02: Clear stale rows before propagating the error so the workspace never
    // displays stale booking data after a permission change or network error.
    callback([]);
    onError(err);
  });
}

export function listenToCustomerBookings(userId: string, callback: (bookings: Booking[]) => void, onError: (error: unknown) => void = console.error) {
  const path = 'bookings';
  const q = query(collection(db, path), where('customerId', '==', userId));
  let bookings: Booking[] = [], codes = new Map<string, { code?: string; pickupCode?: string }>();
  const group = subscriptionGroup<Booking[]>(callback, () => [], onError);
  const publish = () => group.publish(bookings.map(booking => ({ ...booking, otp: codes.get(booking.bookingId)?.code, pickupOtp: codes.get(booking.bookingId)?.pickupCode })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  group.add(onSnapshot(q, snapshot => { bookings = snapshot.docs.map(booking => booking.data() as Booking); publish(); }, group.fail));
  group.add(onSnapshot(query(collection(db, 'booking_codes'), where('customerId', '==', userId)), snapshot => { codes = new Map(snapshot.docs.map(record => [record.id, record.data() as { code?: string; pickupCode?: string }])); publish(); }, group.fail));
  return group.stop;
}

export type MerchantBookingOutlet = { merchantId: string; merchantType: 'restaurant' | 'grocery' };
export const ACTIVE_MERCHANT_STATUSES = [
  'pending',
  'driver_offer_pending',
  'accepted',
  'preparing',
  'ready',
  'driver_assigned',
  'driver_at_store',
  'pickup_verified',
  'transit',
  'arrived_at_destination',
  'delivery_otp_verified'
];

export function listenToMerchantBookings(outlets: MerchantBookingOutlet[], callback: (bookings: Booking[]) => void, onError: (error: unknown) => void = console.error) {
  const unique = [...new Map(outlets.map(outlet => [`${outlet.merchantType}:${outlet.merchantId}`, outlet])).values()].slice(0, 50);
  const snapshots = new Map<string, Booking[]>(); let failed = false;
  const publish = () => callback([...new Map([...snapshots.values()].flat().map(booking => [booking.bookingId, booking])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  if (!unique.length) { callback([]); return () => undefined; }
  const stops = unique.map(outlet => onSnapshot(
    query(
      collection(db, 'bookings'),
      where('merchantId', '==', outlet.merchantId),
      where('serviceType', '==', outlet.merchantType === 'restaurant' ? 'food' : 'grocery'),
      where('status', 'in', ACTIVE_MERCHANT_STATUSES),
      limit(50)
    ),
    snapshot => { if (failed) return; snapshots.set(`${outlet.merchantType}:${outlet.merchantId}`, snapshot.docs.map(record => record.data() as Booking)); publish(); },
    error => { if (failed) return; failed = true; callback([]); for (const stop of stops) stop(); onError(error); }
  ));
  return () => { failed = true; for (const stop of stops) stop(); };
}

export async function getMerchantDailySummary(merchantId: string, date?: string, startAt?: string, endAt?: string) {
  return (await httpsCallable(functions, 'getMerchantDailySummary')({ merchantId, date, startAt, endAt })).data as {
    merchantId: string;
    date: string;
    completedToday: number;
    grossRevenueToday: number;
  };
}

export interface MerchantBookingHistoryOptions {
  merchantId: string;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  bookingId?: string;
  cursor?: string;
}

export async function listMerchantBookingHistory(options: MerchantBookingHistoryOptions) {
  return (await httpsCallable(functions, 'listMerchantBookingHistory')(options)).data as {
    bookings: Booking[];
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

export function listenToMerchantTodaySummary(merchantId: string, callback: (summary: { completedToday: number; grossRevenueToday: number }) => void, onError: (error: unknown) => void = console.error) {
  const kolkataDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todayStartMs = new Date(`${kolkataDateStr}T00:00:00.000+05:30`).getTime();
  const todayEndMs = new Date(`${kolkataDateStr}T23:59:59.999+05:30`).getTime();
  return onSnapshot(
    query(
      collection(db, 'bookings'),
      where('merchantId', '==', merchantId),
      where('status', 'in', ['delivered', 'completed']),
      limit(50)
    ),
    snapshot => {
      let completedToday = 0;
      let grossRevenueToday = 0;
      for (const doc of snapshot.docs) {
        const b = doc.data() as Booking;
        if (b.status === 'cancelled') continue;
        const t = new Date(b.completedAt || b.deliveredAt || b.createdAt).getTime();
        if (t >= todayStartMs && t <= todayEndMs) {
          completedToday++;
          grossRevenueToday += (Number.isFinite(b.price) ? b.price : 0);
        }
      }
      callback({ completedToday, grossRevenueToday: Math.round(grossRevenueToday * 100) / 100 });
    },
    onError
  );
}
export function listenToBookingEvents(id: string, callback: (events: { id: string; stage: string; createdAt: string; proofMethod?: string }[]) => void, onError: (error: unknown) => void) {
  return onSnapshot(collection(db, 'bookings', id, 'events'), snapshot => callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as { id: string; stage: string; createdAt: string; proofMethod?: string })).sort((a,b) => a.createdAt.localeCompare(b.createdAt))), onError);
}
export async function advanceMerchantBooking(bookingId: string, status: 'preparing' | 'ready', prepMinutes?: number, reason?: string) {
  return (await httpsCallable(functions, 'advanceMerchantBooking')({ bookingId, status, prepMinutes, reason })).data;
}
export async function confirmMerchantPickup(bookingId: string) {
  return (await httpsCallable(functions, 'confirmMerchantPickup')({ bookingId })).data;
}
export async function merchantCancelAfterAccept(bookingId: string, reason: string) {
  return (await httpsCallable(functions, 'merchantCancelAfterAccept')({ bookingId, reason })).data;
}
export async function merchantRemoveOrderItem(bookingId: string, itemIndex: number, reason: string) {
  return (await httpsCallable(functions, 'merchantRemoveOrderItem')({ bookingId, itemIndex, reason })).data;
}
export function listenToMerchantScorecard(merchantId: string, callback: (scorecard: { missedOrders?: number; cancelledAfterAccept?: number; itemRemovals?: number }) => void, onError: (error: unknown) => void = console.error) {
  return onSnapshot(doc(db, 'merchant_scorecards', merchantId), snapshot => {
    callback(snapshot.exists() ? (snapshot.data() as { missedOrders?: number; cancelledAfterAccept?: number; itemRemovals?: number }) : { missedOrders: 0, cancelledAfterAccept: 0, itemRemovals: 0 });
  }, onError);
}
export async function updateMerchantCatalog(catalogId: string, merchantType: 'restaurant' | 'grocery', itemId: string, changes: { available?: boolean; stock?: number; expectedStock?: number }) {
  return (await httpsCallable(functions, 'updateMerchantCatalog')({ catalogId, merchantType, itemId, ...changes })).data;
}

export const ACTIVE_DRIVER_STATUSES = ['accepted', 'preparing', 'ready', 'transit', 'arrived_at_destination'];

export function listenToDriverBookings(driverId: string, callback: (bookings: Booking[]) => void, onError: (error: unknown) => void = console.error) {
  const group = subscriptionGroup<Booking[]>(callback, () => [], onError);
  const path = 'bookings';
  let assigned: Booking[] = [];
  let available: Booking[] = [];
  let rejected = new Set<string>();
  let supportedServices = new Set<string>();
  let vehicleType = '';
  let stopAvailable: (() => void) | undefined;
  let dispatchKey = '';

  const publish = () => {
    const byId = new Map([...available.filter(booking => !rejected.has(booking.bookingId) && supportedServices.has(booking.serviceType) && (booking.serviceType !== 'ride' || booking.details?.vehicleType === vehicleType) && (!['food', 'grocery'].includes(booking.serviceType) || booking.status === 'ready')), ...assigned].map((booking) => [booking.bookingId, booking]));
    group.publish([...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  group.add(onSnapshot(query(collection(db, path), where('driverId', '==', driverId), where('status', 'in', ACTIVE_DRIVER_STATUSES), limit(20)), (snapshot) => {
    assigned = snapshot.docs.map((booking) => booking.data() as Booking);
    publish();
  }, group.fail));

  group.add(() => stopAvailable?.());
  group.add(onSnapshot(doc(db, 'driver_profiles', driverId), (snapshot) => {
    if (!group.active) return;
    const isDemo = driverId.startsWith('demo-');
    const profile = (snapshot.data() as DriverProfile | undefined) || (isDemo ? {
      driverId,
      status: 'verified' as const,
      online: true,
      vehicleType: 'bike' as const,
      vehicleNo: 'KA-01-AB-1234',
      licenseNo: 'DL-9876543210',
      rejectedBookingIds: [],
      supportedServices: ['food', 'grocery', 'ride', 'parcel', 'takeover', 'transport'],
      locationConsent: true
    } as DriverProfile : undefined);
    rejected = new Set(profile?.rejectedBookingIds || []);
    supportedServices = new Set(profile?.supportedServices || []);
    vehicleType = profile?.vehicleType || '';
    publish();
    const canReceiveJobs = profile?.status === 'verified' && profile.online;
    const nextKey = canReceiveJobs ? `${vehicleType}:${[...supportedServices].sort().join(',')}` : '';
    if (nextKey !== dispatchKey) {
      stopAvailable?.(); stopAvailable = undefined; dispatchKey = nextKey; available = []; publish();
      if (canReceiveJobs) {
        const offersRef = collection(db, 'driver_offers', driverId, 'offers');
        const unsubscribeOffers = onSnapshot(offersRef, (offersSnapshot) => {
          const now = Date.now();
          const unexpiredOffers: Booking[] = [];
          offersSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const expiresAtMs = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : Date.parse(data.expiresAt || '');
            if (!Number.isFinite(expiresAtMs) || expiresAtMs > now) {
              if (data.offerPayload) {
                unexpiredOffers.push({ ...data.offerPayload, offerExpiresAt: data.expiresAt?.toDate?.()?.toISOString?.() || data.expiresAt } as Booking);
              }
            }
          });
          available = unexpiredOffers;
          publish();
        }, (err) => {
          console.warn('Real-time driver offers stream encountered an issue:', err);
        });
        stopAvailable = unsubscribeOffers;
      }
    }
  }, group.fail));

  return group.stop;
}

/**
 * Listens to active driver profiles real-time (useful for live tracking maps)
 */
export function listenToDriverProfiles(callback: (drivers: DriverProfile[]) => void, onError: (error: unknown) => void = console.error) {
  const path = 'driver_profiles';
  const q = query(collection(db, path), limit(25));
  return onSnapshot(q, (snapshot) => {
    const list: DriverProfile[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as DriverProfile);
    });
    callback(list);
  }, (err) => {
    // FIX-02: Clear stale driver profile rows before propagating the error
    callback([]);
    onError(err);
  });
}

/**
 * Pushes a chat message into a subcollection of a booking in real-time
 */
export async function sendChatMessage(bookingId: string, senderId: string, senderName: string, text: string) {
  try {
    return (await httpsCallable(functions, 'sendBookingMessage')({ bookingId, text })).data;
  } catch (err) {
    if (senderId.startsWith('demo-')) {
      const colRef = collection(db, 'bookings', bookingId, 'chats');
      await addDoc(colRef, {
        senderId,
        senderName,
        senderRole: senderId.includes('merchant') ? 'merchant' : senderId.includes('driver') ? 'driver' : 'customer',
        text,
        timestamp: new Date().toISOString()
      }).catch(() => {});
      return { sent: true };
    }
    throw err;
  }
}

export interface MaskedCallSession {
  success: boolean;
  sessionId: string;
  virtualNumber: string;
  callerRole: 'customer' | 'driver' | 'merchant' | 'admin';
  recipientRole: 'customer' | 'driver' | 'merchant';
  expiresInMinutes: number;
}

export async function initiateMaskedCall(input: {
  bookingId: string;
  recipientRole: 'customer' | 'driver' | 'merchant';
}): Promise<MaskedCallSession> {
  return (await httpsCallable(functions, 'initiateMaskedCall')(input)).data as MaskedCallSession;
}

/**
 * Listens to chat messages under a booking in real-time
 */
export function listenToChatMessages(bookingId: string, callback: (messages: any[]) => void) {
  const path = `bookings/${bookingId}/chats`;
  const q = collection(db, 'bookings', bookingId, 'chats');
  return onSnapshot(q, (snapshot) => {
    const list: any[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    // Sort by timestamp ascending
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    callback(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

/**
 * Listens to all Restaurants in real-time
 */
export function listenToRestaurants(callback: (rests: any[]) => void, onError: (error: unknown) => void = console.error) {
  const path = 'restaurants';
  return onSnapshot(collection(db, 'restaurants'), (snapshot) => {
    const list: any[] = [];
    snapshot.forEach((doc) => {
      list.push({ ...doc.data(), id: doc.id });
    });
    callback(list.filter(item => !item.onboardingStatus || item.onboardingStatus === 'approved'));
  }, (err) => {
    onError(err);
  });
}

/**
 * Listens to Menu Items for a specific Restaurant in real-time
 */
export function listenToMenuItems(restaurantId: string, callback: (items: any[]) => void, onError: (error: unknown) => void = console.error) {
  const path = `restaurants/${restaurantId}/menu_items`;
  return onSnapshot(collection(db, 'restaurants', restaurantId, 'menu_items'), (snapshot) => {
    const list: any[] = [];
    snapshot.forEach((doc) => {
      list.push({ ...doc.data(), id: doc.id, restaurantId });
    });
    callback(list);
  }, (err) => {
    onError(err);
  });
}

/**
 * Listens to all Grocery Stores in real-time
 */
export function listenToGroceryStores(callback: (stores: any[]) => void, onError: (error: unknown) => void = console.error) {
  const path = 'grocery_stores';
  return onSnapshot(collection(db, 'grocery_stores'), (snapshot) => {
    const list: any[] = [];
    snapshot.forEach((doc) => {
      list.push({ ...doc.data(), id: doc.id });
    });
    callback(list.filter(item => !item.onboardingStatus || item.onboardingStatus === 'approved'));
  }, (err) => {
    onError(err);
  });
}

/**
 * Listens to Products for a specific Grocery Store in real-time
 */
export function listenToGroceryProducts(storeId: string, callback: (prods: any[]) => void, onError: (error: unknown) => void = console.error) {
  const path = `grocery_stores/${storeId}/products`;
  return onSnapshot(collection(db, 'grocery_stores', storeId, 'products'), (snapshot) => {
    const list: any[] = [];
    snapshot.forEach((doc) => {
      list.push({ ...doc.data(), id: doc.id, storeId });
    });
    callback(list);
  }, (err) => {
    onError(err);
  });
}

/**
 * Updates menu item availability without mutating dietary metadata.
 */
export async function updateMenuItemAvailability(restaurantId: string, itemId: string, available: boolean) {
  return (await httpsCallable(functions, 'updateMerchantCatalog')({ merchantType: 'restaurant', catalogId: restaurantId, itemId, available })).data;
}

/**
 * Updates grocery product stock level in Firestore
 */
export async function updateGroceryProductStock(storeId: string, productId: string, stock: number, expectedStock: number) {
  return (await httpsCallable(functions, 'updateMerchantCatalog')({ merchantType: 'grocery', catalogId: storeId, itemId: productId, stock, expectedStock })).data;
}

export async function createSupportTicket(ticket: { ticketId: string; userId: string; subject: string; message: string; bookingId?: string; category?: string }) {
  return (await httpsCallable(functions, 'createSupportCase')(ticket)).data;
}

export function listenToSupportTickets(userId: string, callback: (tickets: SupportTicket[]) => void, onError?: (error: unknown) => void) {
  const path = 'support_tickets';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map((ticket) => ticket.data() as SupportTicket);
    tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(tickets);
  }, (error) => { if (onError) onError(error); else handleFirestoreError(error, OperationType.GET, path); });
}

export async function createPayoutRequest(request: { requestId: string; driverId: string; amount: number; amountCents?: number }) {
  return (await httpsCallable(functions, 'requestDriverPayout')({
    requestId: request.requestId,
    amount: request.amount,
    ...(request.amountCents ? { amountCents: request.amountCents } : {})
  })).data;
}
export async function setDriverPayoutAccount(data: { accountType: 'bank' | 'upi'; beneficiaryName: string; accountNumber?: string; ifscCode?: string; bankName?: string; upiId?: string }) {
  return (await httpsCallable(functions, 'setDriverPayoutAccount')(data)).data;
}
export async function submitDriverCodDeposit(data: { amountCents: number; paymentMode: 'bank_transfer' | 'upi'; bankReference: string; notes?: string }) {
  return (await httpsCallable(functions, 'submitDriverCodDeposit')(data)).data;
}
export type PayoutRecord = { requestId: string; driverId?: string; operatorId?: string; merchantId?: string; merchantType?: string; beneficiaryType?: string; amount: number; amountCents?: number; status: string; createdAt: string; transferReference?: string; destination?: string };

export function listenToPayoutRequests(driverId: string | undefined, callback: (records: PayoutRecord[]) => void, onError: (error: unknown) => void) {
  const records = collection(db, 'payout_requests');
  return onSnapshot(driverId ? query(records, where('driverId', '==', driverId)) : records, snapshot => callback(snapshot.docs.map(record => ({ ...record.data(), requestId: record.id } as PayoutRecord)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))), onError);
}
export async function recordDriverPayout(requestId: string, status: 'paid' | 'failed', reference: string) {
  return (await httpsCallable(functions, 'recordDriverPayout')({ requestId, status, reference })).data;
}
export async function requestTransportOperatorPayout(requestId: string) { return (await httpsCallable<{ requestId: string }, { requestId: string; amountCents: number; status: string }>(functions, 'requestTransportOperatorPayout')({ requestId })).data; }
export async function recordTransportOperatorPayout(input: { requestId: string; status: 'paid' | 'failed'; reference: string }) { return (await httpsCallable<typeof input, { status: string }>(functions, 'recordTransportOperatorPayout')(input)).data; }
export async function listTransportOperatorSettlements() { return (await httpsCallable<void, { entries: Array<{ operatorId: string; bookingId: string; grossCents: number; driverPayoutCents: number; amountCents: number; createdAt: string | null }>; hasMore: boolean }>(functions, 'listTransportOperatorSettlements')()).data; }
export async function reviewTransportOperatorSettlement(input: { operatorId: string; bookingId: string; decision: 'approved' | 'rejected'; reason: string; requestId: string }) { return (await httpsCallable<typeof input, { status: string }>(functions, 'reviewTransportOperatorSettlement')(input)).data; }
export async function recordTransportOperatorPayoutResult(input: { requestId: string; status: 'paid' | 'failed'; reference: string }) { return (await httpsCallable<typeof input, { status: string }>(functions, 'recordTransportOperatorPayout')(input)).data; }
export async function requestMerchantPayout(input: { merchantId: string; merchantType: 'restaurant' | 'grocery'; requestId: string }) { return (await httpsCallable<typeof input, { requestId: string; amountCents: number; status: string }>(functions, 'requestMerchantPayout')(input)).data; }
export async function recordMerchantPayout(input: { requestId: string; status: 'paid' | 'failed'; reference: string }) { return (await httpsCallable<typeof input, { status: string }>(functions, 'recordMerchantPayout')(input)).data; }
export async function recordMerchantPayoutResult(input: { requestId: string; status: 'paid' | 'failed'; reference: string }) { return (await httpsCallable<typeof input, { status: string }>(functions, 'recordMerchantPayout')(input)).data; }
export async function getMerchantPayableBalance(merchantId: string, merchantType: 'restaurant' | 'grocery') { return (await httpsCallable<{ merchantId: string; merchantType: string }, { availableCents: number; reservedCents: number; currency: string }>(functions, 'getMerchantPayableBalance')({ merchantId, merchantType })).data; }
export function listenToMerchantPayoutRequests(merchantId: string, callback: (records: PayoutRecord[]) => void, onError: (error: unknown) => void) {
  const records = collection(db, 'payout_requests');
  return onSnapshot(query(records, where('merchantId', '==', merchantId), where('beneficiaryType', '==', 'merchant')), snapshot => callback(snapshot.docs.map(record => ({ ...record.data(), requestId: record.id } as PayoutRecord)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))), onError);
}

/**
 * Updates the user's wallet balance in Firestore
 */
export async function updateUserWalletBalance(uid: string, balance: number) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), { walletBalance: balance });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}


export async function reverseServiceLocation(lat: number, lng: number): Promise<ServiceLocation[]> {
  return (await httpsCallable<{ location: { lat: number; lng: number } }, { locations: ServiceLocation[] }>(functions, 'reverseServiceLocation')({ location: { lat, lng } })).data.locations;
}

export async function getMapPickerPreview(lat: number, lng: number, zoom = 16): Promise<string> {
  return (await httpsCallable<{ location: { lat: number; lng: number }; zoom: number }, { image: string }>(functions, 'getMapPickerPreview')({ location: { lat, lng }, zoom })).data.image;
}

export async function createWalletTopup(amountCents: number, requestId: string) {
  return (await httpsCallable<{ amountCents: number; requestId: string }, { orderId: string; keyId: string; amount: number; currency: string; paid: boolean }>(functions, 'createWalletTopup')({ amountCents, requestId })).data;
}
export async function payWithWallet(booking: unknown, expectedAmountCents: number, requestId: string) {
  return (await httpsCallable<{ booking: unknown; expectedAmountCents: number; requestId: string }, { status: string; bookingId: string }>(functions, 'payWithWallet')({ booking, expectedAmountCents, requestId })).data;
}
export async function requestAccountDeletion() {
  return (await httpsCallable(functions, 'requestAccountDeletion')({})).data;
}
export function listenToWalletLedger(uid: string, callback: (entries: { id: string; kind: string; amountCents: number; balanceCents: number; createdAt: string }[]) => void, onError: (error: unknown) => void) {
  return onSnapshot(collection(db, 'wallet_ledger', uid, 'entries'), snapshot => callback(snapshot.docs.map(entry => ({ ...entry.data(), id: entry.id } as { id: string; kind: string; amountCents: number; balanceCents: number; createdAt: string })).sort((a,b) => b.createdAt.localeCompare(a.createdAt))), onError);
}

export async function previewCartCoupon(booking: unknown, code: string) {
  return (await httpsCallable<{ booking: unknown; code: string }, { amount: number; discountCents: number; code: string }>(functions, 'previewCartCoupon')({ booking, code })).data;
}
export async function getCartQuote(booking: unknown, code?: string) {
  return (await httpsCallable<{ booking: unknown; code?: string }, { amount: number; priceBreakdown: import('../types').PriceBreakdown }>(functions, 'getCartQuote')({ booking, code })).data;
}

export function listenToDriverLedger(driverId: string, callback: (entries: DriverLedgerEntry[]) => void, onError: (error: unknown) => void = console.error) {
  return onSnapshot(
    query(
      collection(db, 'driver_ledger', driverId, 'entries'),
      limit(50)
    ),
    snapshot => {
      const list: DriverLedgerEntry[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...(doc.data() as DriverLedgerEntry) });
      });
      list.sort((a, b) => {
        const at = a.createdAt ? (typeof (a.createdAt as any).toDate === 'function' ? (a.createdAt as any).toDate().getTime() : Date.parse(String(a.createdAt))) : 0;
        const bt = b.createdAt ? (typeof (b.createdAt as any).toDate === 'function' ? (b.createdAt as any).toDate().getTime() : Date.parse(String(b.createdAt))) : 0;
        return bt - at;
      });
      callback(list);
    },
    onError
  );
}

export async function listDriverBookingHistory(options?: { limit?: number; status?: string; cursor?: string }) {
  return (await httpsCallable<{ limit?: number; status?: string; cursor?: string }, { bookings: Booking[]; nextCursor: string | null; hasMore: boolean }>(functions, 'listDriverBookingHistory')(options || {})).data;
}

export async function triggerDriverEmergencySos(payload: {
  bookingId?: string;
  lat?: number;
  lng?: number;
  reason?: string;
  notes?: string;
}) {
  return (await httpsCallable<typeof payload, { success: boolean; incidentId: string; status: string }>(functions, 'triggerDriverEmergencySos')(payload)).data;
}

export async function listAdminBookings(options?: { limit?: number; serviceType?: string; status?: string; cursor?: string }) {
  return (await httpsCallable<{ limit?: number; serviceType?: string; status?: string; cursor?: string }, { bookings: Booking[]; nextCursor: string | null; hasMore: boolean }>(functions, 'listAdminBookings')(options || {})).data;
}

export async function listAdminDriverProfiles(options?: { limit?: number; status?: string; cursor?: string }) {
  return (await httpsCallable<{ limit?: number; status?: string; cursor?: string }, { drivers: DriverProfile[]; nextCursor: string | null; hasMore: boolean }>(functions, 'listAdminDriverProfiles')(options || {})).data;
}


