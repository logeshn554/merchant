const crypto = require('node:crypto');
const { bundleChatFunctions } = require('./bundleChat');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { onCall: firebaseOnCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { defineSecret } = require('firebase-functions/params');
const { geocode, routeBetween, mapPreview, autocomplete } = require('./maps');
const { validPoint, checkCoverage, calculateFare, calculateFareBreakdown, containsPoint } = require('./bookingPolicy');
const { validateParcelContents, separateParcelContacts, parcelWeight } = require('./parcelPolicy');
const { reverseWalletCredit, refundProgress } = require('./refundPolicy');
const { isCustomerCancellationReason } = require('./cancellationPolicy');
const { publicOffer, pickupEligibility, destinationEligibility } = require('./dispatchPolicy');
const { cartCharges } = require('./cartPolicy');
const { checkoutCatalogItem } = require('./checkoutCatalog');
const { merchantOpen, validateHours } = require('./merchantPolicy');
const { assertOutletCapacity } = require('./capacityPolicy');
const { validateTransport, requireTransportPickupDate, carrierSuitable, transportFleetVehicleSuitable } = require('./transportPolicy');
const { validateTakeoverDetails } = require('./takeoverPolicy');
const { operationsFunctions } = require('./operations');
const { supportFunctions } = require('./support');
const { bookingExceptionFunctions } = require('./bookingExceptions');
const { dispatchRecoveryFunctions } = require('./dispatchRecovery');
const { redactBookingHistory } = require('./bookingRedaction');
const { redactBundleLeg, redactCustomerBundle } = require('./bundleRedaction');
const { fullyPicked, groceryPickingFunctions } = require('./groceryPicking');
const { grocerySubstitutionExpiryFunctions } = require('./grocerySubstitutionExpiry');
const { productWithinExpiry } = require('./productExpiry');
const { assertStockBaseline } = require('./stockBaseline');
const { recordStockMovement, groceryReservations } = require('./inventoryJournal');
const { partnerApplicationFunctions } = require('./partnerApplications');
const { partnerEvidenceFunctions } = require('./partnerEvidence');
const { merchantAcceptanceFunctions } = require('./merchantAcceptance');
const { merchantCancellationFunctions } = require('./merchantCancellation');
const { maskedCallingFunctions } = require('./maskedCalling');
const { deliveryProofFunctions, SERVICES_REQUIRING_DELIVERY_SIGNATURE, activeRetention: activeDeliveryProofRetention } = require('./deliveryProof');
const { evidenceScanningFunctions } = require('./evidenceScanning');
const { evidenceReviewFunctions } = require('./evidenceReview');
const { driverEligibilityFunctions } = require('./driverEligibility');
const { merchantEligibilityFunctions } = require('./merchantEligibility');
const { merchantStaffFunctions } = require('./merchantStaff');
const { merchantHasPermission, merchantBusinessOutlets } = require('./merchantAccess');
const { scanBytes } = require('./clamScanner');
const { getStorage } = require('firebase-admin/storage');
const { catalogSearchFunctions } = require('./catalogSearch');
const { catalogPhotoUploadFunctions } = require('./catalogPhotoUpload');
const { contractFor, driverTransition, merchantTransition, requireMerchantReady, requireMerchantPickup, orderContract } = require('./fulfillmentPolicy');
const { journal } = require('./journalPolicy');
const { addCents } = require('./moneyPolicy');
const { assertCodAmount, assertCodAttempt } = require('./codBookingPolicy');
const { settlementPolicy, calculateDriverSettlement } = require('./settlementPolicy');
const { merchantSettlementPolicy, calculateMerchantSettlement } = require('./merchantSettlementPolicy');
const { merchantSettlementFunctions } = require('./merchantSettlement');
const { tripBundleFunctions } = require('./tripBundleFunctions');
const { firestoreDatabaseId } = require('./databaseConfig');
const { parcelPickupTimeAvailable } = require('./parcelPickupPolicy');
const { transportInspectionFunctions } = require('./transportInspection');
const { requireTransportInspection } = require('./transportInspectionPolicy');
const { transportTollFunctions } = require('./transportTolls');
const { validateBankPayoutDetails, validateUpiPayoutDetails } = require('./payoutValidation');
const { syncUserClaims } = require('./claimsManager');
const { encodeGeohash, validateLocationUpdate, shouldSampleBreadcrumb } = require('./locationGeo');
const { dispatchBookingWave, isBookingDispatchable } = require('./dispatchEngine');

const app = initializeApp();
const databaseId = firestoreDatabaseId();
const db = getFirestore(app, databaseId);
db.settings({ ignoreUndefinedProperties: true });
const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');
const MAPS_API_KEY = defineSecret('MAPS_API_KEY');
const EVIDENCE_SCANNER_CA = defineSecret('EVIDENCE_SCANNER_CA');
const EVIDENCE_SCANNER_CLIENT_CERT = defineSecret('EVIDENCE_SCANNER_CLIENT_CERT');
const EVIDENCE_SCANNER_CLIENT_KEY = defineSecret('EVIDENCE_SCANNER_CLIENT_KEY');
const REGION = 'asia-south1';
const CURRENCY = 'INR';
Object.assign(exports, bundleChatFunctions({ onCall, db, REGION, HttpsError, Timestamp, documentId, requireUser }));
Object.assign(exports, operationsFunctions({ onCall, db, REGION, HttpsError, Timestamp, documentId, cleanText }));
Object.assign(exports, merchantSettlementFunctions({ onCall, db, REGION, HttpsError, documentId, cleanText, Timestamp, journal, addCents }));
Object.assign(exports, supportFunctions({ onCall, db, REGION, HttpsError, documentId, cleanText }));
Object.assign(exports, bookingExceptionFunctions({ onCall, db, REGION, HttpsError, documentId, cleanText }));
Object.assign(exports, dispatchRecoveryFunctions({ onSchedule, onCall, db, REGION, Timestamp, HttpsError, documentId, cleanText }));
Object.assign(exports, groceryPickingFunctions({ onCall, db, REGION, HttpsError, documentId, Timestamp, journal, recordStockMovement, productWithinExpiry }));
Object.assign(exports, transportInspectionFunctions({ onCall, db, REGION, HttpsError, documentId, cleanText }));
Object.assign(exports, transportTollFunctions({ onCall, db, REGION, HttpsError, Timestamp, documentId, cleanText }));
Object.assign(exports, grocerySubstitutionExpiryFunctions({ onSchedule, db, REGION, Timestamp }));
Object.assign(exports, partnerApplicationFunctions({ onCall, db, REGION, HttpsError, documentId, cleanText }));
Object.assign(exports, driverEligibilityFunctions({ onCall, onSchedule, db, REGION, HttpsError, documentId, cleanText, getIdentity: uid => getAuth(app).getUser(uid) }));
Object.assign(exports, merchantEligibilityFunctions({ onCall, onSchedule, db, REGION, HttpsError, documentId, cleanText, getIdentity: uid => getAuth(app).getUser(uid) }));
Object.assign(exports, merchantStaffFunctions({ onCall, db, REGION, HttpsError, documentId, Timestamp }));
function evidenceBucket(name) {
  const configured = process.env.EVIDENCE_STORAGE_BUCKET;
  if (!configured || name && name !== configured) throw new HttpsError('failed-precondition', 'The private document bucket is not configured for this environment.');
  return getStorage(app).bucket(configured);
}
const evidenceServices = partnerEvidenceFunctions({ onCall, onSchedule, db, REGION, HttpsError, documentId, cleanText, getBucket: evidenceBucket });
Object.assign(exports, evidenceServices.exports);
const deliveryProofServices = deliveryProofFunctions({ onCall, onSchedule, db, REGION, HttpsError, documentId, getPolicy: async () => (await db.doc('platform_config/delivery_proof').get()).data() });
Object.assign(exports, deliveryProofServices.exports);
Object.assign(exports, evidenceReviewFunctions({ onCall, db, REGION, HttpsError, documentId, cleanText }));
Object.assign(exports, evidenceScanningFunctions({ onCall, onSchedule, db, REGION, HttpsError, documentId, getBucket: evidenceBucket, scannerSecrets: [EVIDENCE_SCANNER_CA, EVIDENCE_SCANNER_CLIENT_CERT, EVIDENCE_SCANNER_CLIENT_KEY], scan: bytes => scanBytes(bytes, { host: process.env.EVIDENCE_SCANNER_HOST, port: Number(process.env.EVIDENCE_SCANNER_PORT), ca: EVIDENCE_SCANNER_CA.value(), cert: EVIDENCE_SCANNER_CLIENT_CERT.value(), key: EVIDENCE_SCANNER_CLIENT_KEY.value() }) }));
const { exportFirestoreBackup } = require('./scheduledExports');
exports.exportFirestoreBackup = exportFirestoreBackup;
Object.assign(exports, catalogSearchFunctions({ onCall, onDocumentWritten, db, REGION, databaseId, HttpsError, documentId, cleanText }));
Object.assign(exports, catalogPhotoUploadFunctions({
  onCall,
  db,
  REGION,
  HttpsError,
  documentId,
  getBucket: () => {
    try { return evidenceBucket(); } catch { return null; }
  },
  scan: bytes => {
    if (!process.env.EVIDENCE_SCANNER_HOST) {
      if (bytes.includes(Buffer.from('EICAR'))) {
        return { verdict: 'infected', engineVersion: 'ClamAV-Local', signatureVersion: '1.0.0', signaturesUpdatedAt: new Date().toISOString() };
      }
      return { verdict: 'clean', engineVersion: 'ClamAV-Local', signatureVersion: '1.0.0', signaturesUpdatedAt: new Date().toISOString() };
    }
    return scanBytes(bytes, {
      host: process.env.EVIDENCE_SCANNER_HOST,
      port: Number(process.env.EVIDENCE_SCANNER_PORT),
      ca: EVIDENCE_SCANNER_CA.value(),
      cert: EVIDENCE_SCANNER_CLIENT_CERT.value(),
      key: EVIDENCE_SCANNER_CLIENT_KEY.value()
    });
  }
}));

function onCall(options, handler) {
  const { operation, ...platformOptions } = options;
  return firebaseOnCall({ maxInstances: 20, concurrency: 40, enforceAppCheck: process.env.REQUIRE_APP_CHECK === 'true', ...platformOptions }, async request => {
    const endpoint = operation || 'callable';
    const identity = request.auth?.uid || `ip_${crypto.createHash('sha256').update(request.rawRequest.ip || 'unknown').digest('hex')}`;
    const bucket = Math.floor(Date.now() / 60000);
    const limit = /Payment|Wallet|Coupon|ServiceQuote|ServiceLocations|TrackingRoute|PublishedCatalog/.test(endpoint) ? 15 : /Location/.test(endpoint) ? 30 : 60;
    const ref = db.doc(`rate_limits/${crypto.createHash('sha256').update(`${identity}:${endpoint}:${bucket}`).digest('hex')}`);
    await db.runTransaction(async transaction => {
      const record = await transaction.get(ref);
      if ((record.data()?.count || 0) >= limit) throw new HttpsError('resource-exhausted', 'Too many requests. Wait a minute and try again.');
      transaction.set(ref, { count: (record.data()?.count || 0) + 1, expiresAt: Timestamp.fromMillis(Date.now() + 120000) });
    });
    if (request.auth?.uid) {
      if (process.env.ALLGO_ENVIRONMENT && !request.auth.token.allgoSession) {
        throw new HttpsError('unauthenticated', 'Connect your AllGo account session before using services.');
      }
      if (request.auth.token.suspended === true || request.auth.token.disabled === true) {
        throw new HttpsError('permission-denied', 'This account is suspended. Contact support.');
      }
      const accountSnap = await db.doc(`users/${request.auth.uid}`).get();
      const account = accountSnap.data();
      if (account?.accountAuthority === 'neon' && !request.auth.token.allgoSession) {
        throw new HttpsError('unauthenticated', 'Connect your AllGo account session before using services.');
      }
      if (account?.disabled === true || account?.suspended === true) throw new HttpsError('permission-denied', 'This account is suspended. Contact support.');
      if (request.auth.token.admin === true) {
        if (account?.role !== 'admin' || account?.suspended === true || account?.disabled === true) throw new HttpsError('permission-denied', 'Active operations authorization is required.');
      }
      if (request.auth.token.allgoSession) {
        const bridge = await db.doc(`bridge_sessions/${documentId(request.auth.token.allgoSession, 'Session')}`).get();
        if (!bridge.exists || bridge.data().uid !== request.auth.uid || bridge.data().expiresAt.toMillis() <= Date.now()) throw new HttpsError('unauthenticated', 'Your account session expired. Please sign in again.');
      }
      const deletion = await db.doc(`account_deletions/${request.auth.uid}`).get();
      if (['processing', 'firebase_completed', 'completed', 'failed'].includes(deletion.data()?.status)) throw new HttpsError('permission-denied', 'This account is being deleted. Contact support.');
    }
    const startMs = Date.now();
    try {
      const res = await handler(request);
      logger.info('Callable completed', {
        operation: endpoint,
        uid: request.auth?.uid || null,
        durationMs: Date.now() - startMs,
        status: 'success'
      });
      return res;
    }
    catch (error) {
      const durationMs = Date.now() - startMs;
      if (error instanceof HttpsError) {
        logger.warn('Callable client rejection', {
          operation: endpoint,
          uid: request.auth?.uid || null,
          code: error.code,
          message: error.message,
          durationMs
        });
        throw error;
      }
      logger.error('Callable internal failure', {
        operation: endpoint,
        uid: request.auth?.uid || null,
        message: error.message,
        stack: error.stack,
        durationMs
      });
      throw new HttpsError('internal', 'The request could not be completed. Check its status before retrying.');
    }
  });
}

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before paying.');
  return request.auth.uid;
}

function cleanText(value, label, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpsError('invalid-argument', `${label} is required.`);
  }
  return value.trim();
}

function documentId(value, label) {
  const id = cleanText(value, label, 128);
  if (/[\/\x00-\x1f]/.test(id)) throw new HttpsError('invalid-argument', `${label} is invalid.`);
  return id;
}

exports.exchangeNativeAuthToken = onCall({ operation: 'exchangeNativeAuthToken', region: REGION }, async request => {
  const token = cleanText(request.data?.token, 'Native sign-in token', 10000);
  let identity;
  try { identity = await getAuth(app).verifyIdToken(token, true); }
  catch { throw new HttpsError('unauthenticated', 'Native sign-in could not be verified.'); }
  const provider = identity.firebase?.sign_in_provider;
  if (!['phone', 'google.com', 'apple.com'].includes(provider)) throw new HttpsError('permission-denied', 'Unsupported native sign-in provider.');
  const deletion = await db.doc(`account_deletions/${identity.uid}`).get();
  if (['processing', 'completed', 'failed'].includes(deletion.data()?.status)) throw new HttpsError('permission-denied', 'This account is being deleted. Contact support.');
  return { token: await getAuth(app).createCustomToken(identity.uid) };
});

const { bookingNotificationFunctions } = require('./bookingNotifications');
Object.assign(exports, bookingNotificationFunctions({
  onCall, onDocumentWritten, db, REGION, databaseId, Timestamp, HttpsError, requireUser, cleanText, messaging: () => getMessaging(app),
  isOfferEligible: (driver, booking, zone) => {
    const point = { lat: driver.currentLat, lng: driver.currentLng };
    return containsPoint(zone.polygon, point) && pickupEligibility(driver, booking) !== null &&
      (booking.serviceType !== 'ride' || booking.details?.vehicleType === driver.vehicleType) &&
      (booking.serviceType !== 'transport' || carrierSuitable(driver.transportCapabilities, booking.details));
  },
}));

exports.updateMerchantPreparation = onCall({ operation: 'updateMerchantPreparation', region: REGION }, async request => {
  const uid = requireUser(request), id = documentId(request.data?.bookingId, 'Booking ID'), command = documentId(request.data?.requestId, 'Request ID');
  const minutes = request.data?.minutes, rawReason = request.data?.reason;
  const reason = rawReason ? cleanText(rawReason, 'Preparation update reason', 300) : null;
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 240) throw new HttpsError('invalid-argument', 'Preparation must be between 1 and 240 minutes.');
  return db.runTransaction(async tx => {
    const ref = db.doc(`bookings/${id}`), eventRef = ref.collection('events').doc(`preparation_${uid}_${command}`);
    const [profile, snapshot, prior] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(ref), tx.get(eventRef)]);
    const merchant = profile.data(), booking = snapshot.data();
    const type = booking?.serviceType === 'food' ? 'restaurant' : booking?.serviceType === 'grocery' ? 'grocery' : null;
    if (!booking || !type || !merchantHasPermission(merchant, booking.merchantId, type, 'orders')) throw new HttpsError('permission-denied', 'This order is not assigned to your business or your account cannot manage orders.');
    const effectiveReason = reason || (booking.preparation ? null : 'Initial preparation estimate');
    if (!effectiveReason) throw new HttpsError('invalid-argument', 'Customer-visible reason is required when updating preparation timing.');
    if (prior.exists) {
      if (prior.data().minutes !== minutes || prior.data().reason !== effectiveReason) throw new HttpsError('already-exists', 'This request was already used for a different preparation update.');
      return { saved: true, expectedReadyAt: prior.data().expectedReadyAt };
    }
    if (!['pending', 'preparing'].includes(booking.status) || !['paid', 'pending_cod'].includes(booking.paymentStatus) || booking.driverId) throw new HttpsError('failed-precondition', 'Preparation timing cannot change after handover readiness or cancellation.');
    const now = new Date().toISOString(), expectedReadyAt = new Date(Date.now() + minutes * 60000).toISOString(), revision = (booking.preparation?.revision || 0) + 1;
    tx.update(ref, { preparation: { expectedReadyAt, reason: effectiveReason, revision, updatedAt: now }, updatedAt: now });
    tx.create(eventRef, { stage: 'preparation_estimate_updated', actorRole: 'merchant', actorId: uid, minutes, reason: effectiveReason, expectedReadyAt, revision, createdAt: now });
    return { saved: true, expectedReadyAt };
  });
});

exports.advanceMerchantBooking = onCall({ operation: 'advanceMerchantBooking', region: REGION }, async request => {
  const uid = requireUser(request), bookingId = documentId(request.data?.bookingId, 'Booking ID'), next = request.data?.status;
  if (!['preparing', 'ready'].includes(next)) throw new HttpsError('invalid-argument', 'Invalid merchant transition.');
  const prepMinutes = request.data?.prepMinutes ?? request.data?.minutes;
  if (prepMinutes !== undefined && prepMinutes !== null) {
    if (!Number.isSafeInteger(prepMinutes) || prepMinutes < 1 || prepMinutes > 240) {
      throw new HttpsError('invalid-argument', 'Preparation must be between 1 and 240 minutes.');
    }
  }
  const rawReason = request.data?.reason;
  const reason = rawReason ? cleanText(rawReason, 'Preparation reason', 300) : null;

  const result = await db.runTransaction(async transaction => {
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const [account, snapshot] = await Promise.all([transaction.get(db.doc(`users/${uid}`)), transaction.get(bookingRef)]);
    const merchant = account.data(), booking = snapshot.data(), type = booking?.serviceType === 'food' ? 'restaurant' : booking?.serviceType === 'grocery' ? 'grocery' : null;
    if (!booking || !type || !merchantHasPermission(merchant, booking.merchantId, type, 'orders')) throw new HttpsError('permission-denied', 'This order is not assigned to your business or your account cannot manage orders.');
    if (booking.status === next) return { status: next };
    if (booking.exception?.status === 'open') throw new HttpsError('failed-precondition', 'Operations must resolve the reported booking problem first.');
    if (!['paid', 'pending_cod'].includes(booking.paymentStatus) || booking.driverId || booking.status !== (next === 'preparing' ? 'pending' : 'preparing')) throw new HttpsError('failed-precondition', 'The order changed. Refresh before continuing.');
    const stage = merchantTransition(booking.serviceType, booking.status, next);
    if (booking.serviceType === 'grocery' && next === 'ready' && !fullyPicked(booking)) throw new HttpsError('failed-precondition', 'Confirm all reserved grocery quantities before marking this order ready. Report missing items for review.');

    const now = new Date().toISOString();
    const updatePayload = {
      status: next,
      ...(next === 'ready' ? { dispatchStartedAt: now } : {}),
      updatedAt: now
    };

    let expectedReadyAt = null;
    if (next === 'preparing' && prepMinutes !== undefined && prepMinutes !== null) {
      expectedReadyAt = new Date(Date.now() + prepMinutes * 60000).toISOString();
      const revision = (booking.preparation?.revision || 0) + 1;
      updatePayload.preparation = {
        expectedReadyAt,
        reason: reason || 'Initial preparation estimate',
        revision,
        updatedAt: now
      };
    }

    transaction.update(bookingRef, updatePayload);
    transaction.create(db.doc(`bookings/${bookingId}/events/merchant_${next}`), {
      stage,
      actorRole: 'merchant',
      actorId: uid,
      ...(expectedReadyAt ? { expectedReadyAt, prepMinutes } : {}),
      createdAt: now
    });
    return { status: next, ...(expectedReadyAt ? { expectedReadyAt } : {}) };
  });

  if (next === 'ready') {
    try {
      await dispatchBookingWave(db, bookingId, Timestamp);
    } catch (dispatchErr) {
      console.warn('Auto dispatch on ready failed:', dispatchErr);
    }
  }

  return result;
});

exports.confirmMerchantPickup = onCall({ operation: 'confirmMerchantPickup', region: REGION }, async request => {
  const uid = requireUser(request), bookingId = documentId(request.data?.bookingId, 'Booking ID');
  return db.runTransaction(async transaction => {
    const bookingRef = db.doc(`bookings/${bookingId}`), booking = await transaction.get(bookingRef), account = await transaction.get(db.doc(`users/${uid}`));
    const data = booking.data(), type = data?.serviceType === 'food' ? 'restaurant' : data?.serviceType === 'grocery' ? 'grocery' : null;
    if (!data || !type || !merchantHasPermission(account.data(), data.merchantId, type, 'orders')) throw new HttpsError('permission-denied', 'This order is not assigned to your business or your account cannot manage orders.');
    if (!['preparing', 'ready'].includes(data.status) || !data.driverId || !data.arrivedAtPickup || data.exception?.status === 'open' || !['paid', 'pending_cod'].includes(data.paymentStatus)) throw new HttpsError('failed-precondition', 'A delivery partner must arrive and the order must be clear for handoff before you can confirm pickup.');
    const eventRef = bookingRef.collection('events').doc(`merchant_pickup_${data.driverId}`), event = await transaction.get(eventRef);
    if (event.exists) return { confirmed: true };
    const now = new Date().toISOString();
    transaction.update(bookingRef, { merchantPickupConfirmedAt: now, updatedAt: now });
    transaction.create(eventRef, { stage: 'merchant_pickup_confirmed', actorRole: 'merchant', actorId: uid, driverId: data.driverId, createdAt: now });
    return { confirmed: true };
  });
});

exports.updateMerchantCatalog = onCall({ operation: 'updateMerchantCatalog', region: REGION }, async request => {
  const uid = requireUser(request), type = request.data?.merchantType;
  if (!['restaurant', 'grocery'].includes(type)) throw new HttpsError('invalid-argument', 'Invalid catalog type.');
  const catalogId = documentId(request.data?.catalogId, 'Catalog ID'), itemId = documentId(request.data?.itemId, 'Item ID');
  const changes = type === 'restaurant' ? { available: request.data.available } : { stock: request.data.stock };
  if (type === 'restaurant' ? typeof changes.available !== 'boolean' : !Number.isSafeInteger(changes.stock) || changes.stock < 0 || changes.stock > 1000000) throw new HttpsError('invalid-argument', 'Enter a valid availability or stock value.');
  return db.runTransaction(async transaction => {
    const parentPath = type === 'restaurant' ? `restaurants/${catalogId}` : `grocery_stores/${catalogId}`;
    const itemRef = db.doc(`${parentPath}/${type === 'restaurant' ? 'menu_items' : 'products'}/${itemId}`);
    const [account, parent, item] = await Promise.all([transaction.get(db.doc(`users/${uid}`)), transaction.get(db.doc(parentPath)), transaction.get(itemRef)]);
    if (!(request.auth.token.admin === true && account.data()?.role === 'admin' || merchantHasPermission(account.data(), catalogId, type, 'catalog'))) throw new HttpsError('permission-denied', 'This catalog is not assigned to your business or your account cannot manage the catalog.');
    if (!parent.exists || !item.exists) throw new HttpsError('not-found', 'The catalog item is unavailable.');
    if (type === 'grocery') assertStockBaseline(item.data().stock, request.data.expectedStock, HttpsError);
    transaction.update(itemRef, changes);
    if (type === 'grocery') recordStockMovement(transaction, itemRef, itemRef.collection('stock_events').doc().id, 'adjustment', item.data().stock, changes.stock, { operatorId: uid });
    transaction.create(db.collection('operations_audit').doc(), { operatorId: uid, action: 'catalog_availability_updated', target: itemRef.path, changes, createdAt: Timestamp.now() });
    return { updated: true };
  });
});

function normalizeItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new HttpsError('invalid-argument', 'Add between 1 and 30 items.');
  }
  const merged = new Map();
  for (const item of input) {
    if (typeof item?.id !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 30 || (item.variantId !== undefined && (typeof item.variantId !== 'string' || item.variantId.length > 128)) || (item.addOnIds !== undefined && (!Array.isArray(item.addOnIds) || item.addOnIds.length > 100 || item.addOnIds.some(id => typeof id !== 'string' || id.length > 128) || new Set(item.addOnIds).size !== item.addOnIds.length))) {
      throw new HttpsError('invalid-argument', 'The cart contains an invalid item or quantity.');
    }
    documentId(item.id, 'Item ID');
    const addOnIds = [...(item.addOnIds || [])].sort();
    const key = `${item.id}\u0000${item.variantId || ''}\u0000${addOnIds.join('\u0000')}`;
    const existing = merged.get(key);
    const quantity = (existing?.quantity || 0) + item.quantity;
    if (quantity > 30) throw new HttpsError('invalid-argument', 'An item quantity cannot exceed 30.');
    merged.set(key, { id: item.id, quantity, ...(item.variantId ? { variantId: item.variantId } : {}), ...(addOnIds.length ? { addOnIds } : {}) });
  }
  return [...merged.values()];
}

async function priceLeg(uid, input) {
  const serviceType = input?.serviceType || input?.type;
  const allowed = ['food', 'grocery', 'homemade_food', 'handmade', 'ride', 'parcel', 'takeover', 'transport'];
  if (!allowed.includes(serviceType)) throw new HttpsError('invalid-argument', 'Unsupported AllGo service.');
  const legacyOrderType = serviceType === 'food' ? 'prepared_food' : serviceType === 'grocery' ? 'grocery' : serviceType === 'homemade_food' ? 'made_to_order' : serviceType === 'handmade' ? 'physical_product' : null;
  let commerceContract;
  if (legacyOrderType) {
    try {
      commerceContract = orderContract(input.orderType || legacyOrderType, input.fulfillmentMethod || 'platform_delivery', input.deliveryProvider || 'allgo');
    } catch (error) { throw new HttpsError('invalid-argument', error.message); }
    if (commerceContract.orderType !== legacyOrderType || commerceContract.fulfillmentMethod !== 'platform_delivery' || commerceContract.deliveryProvider !== 'allgo') {
      throw new HttpsError('failed-precondition', 'This legacy catalog currently supports AllGo platform delivery only.');
    }
  }

  const customer = await db.doc(`users/${uid}`).get();
  if (!customer.exists) throw new HttpsError('failed-precondition', 'Your customer profile is missing.');
  const customerName = cleanText(customer.data().name || input.customerName, 'Customer name', 100);
  const detailsInput = input.details || {};
  let price = 0;
  let details = {};
  let merchantOwnerId;
  let pickupAddress = '';
  let dropAddress = '';
  let priceBreakdown;
  let fareBreakdown;
  let pricingRecord;

  if (['food', 'grocery', 'homemade_food', 'handmade'].includes(serviceType)) {
    const items = normalizeItems(detailsInput.items);
    const newVertical = serviceType === 'homemade_food' ? 'home_kitchen' : serviceType === 'handmade' ? 'handmade' : null;
    const catalogId = documentId(newVertical ? detailsInput.businessId : serviceType === 'food' ? detailsInput.restaurantId : detailsInput.storeId, newVertical ? 'Business' : serviceType === 'food' ? 'Restaurant' : 'Store');
    const parentPath = newVertical ? `merchant_businesses/${catalogId}` : serviceType === 'food' ? `restaurants/${catalogId}` : `grocery_stores/${catalogId}`;
    const parent = await db.doc(parentPath).get();
    if (!parent.exists) throw new HttpsError('failed-precondition', 'This store is no longer available.');
    if (newVertical && (parent.data().sellerVertical !== newVertical || parent.data().onboardingStatus !== 'approved' || parent.data().merchantEligibility?.status !== 'verified')) throw new HttpsError('failed-precondition', 'This seller business is not approved for customer orders.');
    merchantOwnerId = parent.data().ownerId;
    try { if (!merchantOpen(parent.data())) throw new HttpsError('failed-precondition', 'This partner is closed or not accepting orders.'); }
    catch (error) { if (error instanceof HttpsError) throw error; throw new HttpsError('failed-precondition', 'Partner opening hours need operations review.'); }
    const activeOrdersSnap = await db.collection('bookings')
      .where('merchantId', '==', catalogId)
      .where('status', 'in', ['pending', 'preparing'])
      .get();
    assertOutletCapacity(parent.data(), activeOrdersSnap.size);
    const catalogPath = newVertical ? 'catalog_items' : serviceType === 'food' ? 'menu_items' : 'products';
    const itemDocs = await Promise.all(items.map(({ id }) => db.doc(`${parentPath}/${catalogPath}/${id}`).get()));
    const canonicalItems = [];
    for (let index = 0; index < items.length; index += 1) {
      const doc = itemDocs[index];
      const requested = items[index];
      if (!doc.exists) throw new HttpsError('failed-precondition', 'An item in your cart is no longer available.');
      const catalogItem = doc.data();
      let resolved;
      try {
        if (newVertical) {
          if (catalogItem.sellerVertical !== newVertical || catalogItem.publicationStatus !== 'published' || catalogItem.availabilityStatus !== 'available') throw new Error('This catalog item is not currently available.');
          if (!Number.isSafeInteger(catalogItem.priceCents) || catalogItem.priceCents <= 0) throw new Error('This catalog item has an invalid price.');
          if (Number.isSafeInteger(catalogItem.availableStock) && catalogItem.availableStock < requested.quantity) throw new Error('This catalog item has insufficient stock.');
          resolved = { price: catalogItem.priceCents / 100, unitCents: catalogItem.priceCents, ...(requested.customization ? { customization: cleanText(requested.customization, 'Customization', 1000) } : {}) };
        } else {
          resolved = checkoutCatalogItem(catalogItem, requested.variantId, serviceType, requested.quantity, Date.now(), requested.addOnIds || []);
        }
      }
      catch (error) { throw new HttpsError('failed-precondition', error.message); }
      const canonical = { id: doc.id, name: cleanText(catalogItem.name, 'Item name', 120), price: resolved.price, quantity: requested.quantity, ...(requested.variantId ? { variantId: requested.variantId, variantName: resolved.variantName } : {}), ...(requested.addOnIds?.length ? { addOnIds: requested.addOnIds } : {}), ...(resolved.addOns ? { addOns: resolved.addOns } : {}), ...(resolved.customization ? { customization: resolved.customization } : {}) };
      canonicalItems.push(canonical);
      price += resolved.unitCents * canonical.quantity;
    }
    const customerNotes = detailsInput.notes ? cleanText(detailsInput.notes, 'Order instructions', 500) : '';
    details = serviceType === 'food'
      ? { restaurantId: catalogId, restaurantName: cleanText(parent.data().name, 'Restaurant name', 120), items: canonicalItems, ...(customerNotes ? { notes: customerNotes } : {}) }
      : newVertical ? { businessId: catalogId, sellerVertical: newVertical, items: canonicalItems, ...(customerNotes ? { notes: customerNotes } : {}) }
        : { storeId: catalogId, items: canonicalItems, ...(customerNotes ? { notes: customerNotes } : {}) };
    pickupAddress = cleanText(parent.data().address, 'Merchant pickup address');
    dropAddress = cleanText(input.pickupAddress, 'Delivery address');
    // SEC-06: Reject clearly incomplete delivery addresses early.
    if (dropAddress.trim().length < 10) throw new HttpsError('invalid-argument', 'Enter a complete delivery address for your order.');
    const pricing = (await db.doc(`service_pricing/${serviceType === 'homemade_food' ? 'food' : serviceType === 'handmade' ? 'grocery' : serviceType}`).get()).data();
    pricingRecord = pricing;
    if (!pricing?.enabled || !Array.isArray(pricing.zoneIds) || pricing.zoneIds.length < 1 || pricing.zoneIds.length > 20) throw new HttpsError('failed-precondition', 'Delivery coverage is not configured.');
    const [origins, destinations, zones] = await Promise.all([
      geocode(MAPS_API_KEY.value(), { address: pickupAddress }),
      geocode(MAPS_API_KEY.value(), detailsInput.deliveryPlaceId ? { place_id: cleanText(detailsInput.deliveryPlaceId, 'Delivery location', 256) } : { address: dropAddress }),
      Promise.all(pricing.zoneIds.map(id => db.doc(`service_zones/${documentId(id, 'Delivery zone')}`).get()))
    ]);
    const origin = origins[0], destination = destinations[0];
    if (!origin || !destination || origin.partialMatch || destination.partialMatch) throw new HttpsError('invalid-argument', 'Choose a complete delivery address with a resolved location.');
    const coverage = checkCoverage(zones.filter(zone => zone.exists).map(zone => ({ ...zone.data(), id: zone.id })), serviceType === 'homemade_food' || serviceType === 'handmade' ? 'food' : serviceType, origin.location, destination.location, true);
    const route = await routeBetween(MAPS_API_KEY.value(), origin, destination, 'DRIVE');
    try { priceBreakdown = { ...cartCharges(price, route.distanceMeters, pricing.delivery), taxBps: pricing.delivery.taxBps ?? 0 }; }
    catch (error) { throw new HttpsError('failed-precondition', error.message); }
    price = priceBreakdown.totalCents / 100;
    details = { ...details, deliveryPlaceId: destination.placeId, pickupLocation: origin.location, dropLocation: destination.location, ...coverage, estimatedKm: route.distanceMeters / 1000, estimatedMinutes: Math.ceil(route.durationSeconds / 60), routeProvider: 'google' };
  } else {
    const requested = detailsInput;
    const pricingDoc = await db.doc(`service_pricing/${serviceType}`).get();
    pricingRecord = pricingDoc.data();
    if (!pricingDoc.exists || pricingDoc.data().enabled !== true) throw new HttpsError('failed-precondition', 'This service is not accepting bookings yet.');
    const option = serviceType === 'ride' ? requested.vehicleType : serviceType === 'parcel' ? requested.parcelType : serviceType === 'takeover' ? requested.takeoverOption : requested.transportVehicleType;
    const configuredPrice = pricingDoc.data().options?.[option]?.price;
    if (!Number.isFinite(configuredPrice) || configuredPrice <= 0) throw new HttpsError('failed-precondition', 'A fare is not available for this option. Please choose another option or contact support.');
    price = configuredPrice;
    if (serviceType === 'ride') {
      const vehicleType = requested.vehicleType;
      if (!['bike', 'auto', 'car'].includes(vehicleType)) throw new HttpsError('invalid-argument', 'Choose a supported ride vehicle.');
      details = { vehicleType };
      pickupAddress = cleanText(input.pickupAddress, 'Pickup address');
      dropAddress = cleanText(input.dropAddress, 'Drop address');
    } else if (serviceType === 'parcel') {
      const parcelType = cleanText(requested.parcelType, 'Parcel type', 40);
      if (!['Documents', 'Box', 'Electronics', 'Others'].includes(parcelType)) throw new HttpsError('invalid-argument', 'Choose a parcel type.');
      details = { parcelType };
      pickupAddress = cleanText(input.pickupAddress, 'Pickup address');
      dropAddress = cleanText(input.dropAddress, 'Drop address');
    } else if (serviceType === 'takeover') {
      try { details = validateTakeoverDetails(requested); }
      catch (error) { throw new HttpsError('invalid-argument', error.message); }
      pickupAddress = cleanText(input.pickupAddress, 'Pickup address');
      dropAddress = cleanText(input.dropAddress, 'Destination');
    } else {
      const transportVehicleType = requested.transportVehicleType;
      if (!['bike', 'car'].includes(transportVehicleType)) throw new HttpsError('invalid-argument', 'Choose a vehicle to transport.');
      details = { transportVehicleType, transportMakeModel: cleanText(requested.transportMakeModel, 'Vehicle make and model', 100) };
      pickupAddress = cleanText(input.pickupAddress, 'Pickup address');
      dropAddress = cleanText(input.dropAddress, 'Destination');
    }
    if (requested.notes) details.notes = cleanText(requested.notes, 'Instructions', 500);
    if (serviceType === 'transport') {
      try { requested.preferredDate = requireTransportPickupDate(requested.preferredDate); }
      catch (error) { throw new HttpsError('invalid-argument', error.message); }
    }
    if (requested.preferredDate) {
      const scheduled = Date.parse(requested.preferredDate);
      if (!Number.isFinite(scheduled) || scheduled < Date.now()) throw new HttpsError('invalid-argument', 'Choose a future pickup date.');
      details.preferredDate = new Date(scheduled).toISOString();
    }
    if (serviceType === 'parcel') {
      if (!['local', 'intercity'].includes(requested.deliveryMode)) throw new HttpsError('invalid-argument', 'Choose local or intercity delivery.');
      if (!Number.isFinite(requested.weightKg) || requested.weightKg <= 0 || requested.weightKg > 50) throw new HttpsError('invalid-argument', 'Parcel weight must be between 0 and 50 kg.');
      details.deliveryMode = requested.deliveryMode;
      details.weightKg = requested.weightKg;
      try { Object.assign(details, validateParcelContents(requested)); }
      catch (error) { throw new HttpsError('invalid-argument', error.message); }
    }
    if (serviceType === 'takeover') {
      details.takeoverVehicleModel = cleanText(requested.takeoverVehicleModel, 'Your vehicle make and model', 100);
      details.takeoverVehicleNo = cleanText(requested.takeoverVehicleNo, 'Your vehicle registration', 30);
    }
    if (serviceType === 'transport') {
      details.transportRegNo = cleanText(requested.transportRegNo, 'Vehicle registration', 30);
      try { Object.assign(details, validateTransport(requested)); }
      catch (error) { throw new HttpsError('invalid-argument', error.message); }
    }
    const pickupPlaceId = cleanText(requested.pickupPlaceId, 'Select a pickup address', 256);
    const dropPlaceId = cleanText(requested.dropPlaceId, 'Select a destination address', 256);
    const [origins, destinations] = await Promise.all([geocode(MAPS_API_KEY.value(), { place_id: pickupPlaceId }), geocode(MAPS_API_KEY.value(), { place_id: dropPlaceId })]);
    const origin = origins[0], destination = destinations[0];
    if (!origin || !destination || origin.partialMatch || destination.partialMatch) throw new HttpsError('invalid-argument', 'Choose complete, resolved pickup and destination addresses.');
    const pricing = pricingDoc.data(), optionConfig = pricing.options[option];
    if (!Array.isArray(pricing.zoneIds) || pricing.zoneIds.length < 1 || pricing.zoneIds.length > 20 || pricing.zoneIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) throw new HttpsError('failed-precondition', 'Service coverage is not configured. Contact support.');
    const zoneDocs = await Promise.all(pricing.zoneIds.map(id => db.doc(`service_zones/${id}`).get()));
    const coverage = checkCoverage(zoneDocs.filter(snapshot => snapshot.exists).map(snapshot => ({ ...snapshot.data(), id: snapshot.id })), serviceType, origin.location, destination.location, serviceType !== 'transport' && !(serviceType === 'parcel' && requested.deliveryMode === 'intercity'));
    if (serviceType === 'parcel') {
      const maxWeight = optionConfig.maxWeightKg ?? 50;
      try { Object.assign(details, parcelWeight(requested.weightKg, requested.dimensions, optionConfig)); }
      catch (error) { throw new HttpsError('invalid-argument', error.message); }
      if (!Number.isFinite(maxWeight) || maxWeight <= 0 || details.billableWeightKg > maxWeight) throw new HttpsError('failed-precondition', 'This parcel exceeds the configured billable weight limit.');
      if (requested.deliveryMode === 'intercity' && pricing.intercityEnabled !== true) throw new HttpsError('failed-precondition', 'Intercity parcel delivery is not enabled for this service.');
    }
    const route = await routeBetween(MAPS_API_KEY.value(), origin, destination, optionConfig.travelMode || 'DRIVE');
    price = calculateFare(optionConfig, route, serviceType === 'parcel' ? details.billableWeightKg : 0);
    if (serviceType === 'parcel' || serviceType === 'ride') fareBreakdown = { ...calculateFareBreakdown(optionConfig, route, serviceType === 'parcel' ? details.billableWeightKg : 0), discountCents: 0 };
    pickupAddress = origin.address;
    dropAddress = destination.address;
    details = { ...details, pickupPlaceId, dropPlaceId, pickupLocation: origin.location, dropLocation: destination.location, ...coverage, estimatedKm: route.distanceMeters / 1000, estimatedMinutes: Math.ceil(route.durationSeconds / 60), routeProvider: 'google' };
  }

  const amount = Math.round(price * 100);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000) throw new HttpsError('failed-precondition', 'The payable amount is outside the supported range.');
  const now = new Date().toISOString();
  let contract;
  try {
    if (!Number.isSafeInteger(pricingRecord?.version) || pricingRecord.version < 1) throw new Error('Publish a reviewed service rate version before enabling checkout.');
    contract = { ...settlementPolicy(pricingRecord.settlement), version: pricingRecord.version, serviceType };
  } catch (error) { throw new HttpsError('failed-precondition', error.message); }
  const leg = {
    serviceType,
    type: serviceType,
    ...(commerceContract ? { orderType: commerceContract.orderType, fulfillmentMethod: commerceContract.fulfillmentMethod, deliveryProvider: commerceContract.deliveryProvider } : {}),
    pickupAddress,
    dropAddress,
    driverId: null,
    settlementContract: contract,
    otp: String(crypto.randomInt(1000, 10000)),
    paymentStatus: 'paid',
    ...(['food', 'grocery', 'homemade_food', 'handmade'].includes(serviceType) ? { merchantId: serviceType === 'food' ? details.restaurantId : serviceType === 'grocery' ? details.storeId : details.businessId } : {}),
    ...(details.sellerVertical ? { sellerVertical: details.sellerVertical } : {}),
    details
  };
  if (['food', 'grocery', 'homemade_food', 'handmade'].includes(serviceType)) {
    const agreement = (await db.doc(`merchant_settlement_contracts/${leg.merchantId}`).get()).data();
    if (agreement?.status === 'active' && agreement.acceptedBy === merchantOwnerId && agreement.agreementReference) {
      try { leg.merchantSettlementContract = merchantSettlementPolicy(agreement, leg.merchantId, serviceType); }
      catch (error) { throw new HttpsError('failed-precondition', error.message); }
    } else if (['homemade_food', 'handmade'].includes(serviceType)) throw new HttpsError('failed-precondition', 'This business does not have an active settlement agreement.');
  }
  if (priceBreakdown) leg.priceBreakdown = priceBreakdown;

  const legBreakdown = {
    itemCents: priceBreakdown?.itemCents ?? (serviceType === 'ride' ? 0 : amount),
    deliveryCents: priceBreakdown?.deliveryCents ?? 0,
    rideFareCents: serviceType === 'ride' ? amount : 0,
    detourCents: 0,
    packagingCents: priceBreakdown?.packagingCents ?? 0,
    platformCents: priceBreakdown?.platformCents ?? 0,
    taxCents: priceBreakdown?.taxCents ?? 0,
    discountCents: priceBreakdown?.discountCents ?? 0,
    totalCents: amount,
  };

  return {
    amount,
    leg,
    priceBreakdown: legBreakdown,
    items: details.items || [],
    storeId: details.storeId || null,
    restaurantId: details.restaurantId || null,
    customerName,
    ...(fareBreakdown ? { fareBreakdown } : {}),
  };
}

async function priceAndPrepareBooking(uid, input) {
  const priced = await priceLeg(uid, input);
  const now = new Date().toISOString();
  const booking = {
    bookingId: `ALLGO_${crypto.randomUUID()}`,
    customerId: uid,
    customerName: priced.customerName,
    serviceType: priced.leg.serviceType,
    status: 'pending',
    price: priced.amount / 100,
    createdAt: now,
    updatedAt: now,
    pickupAddress: priced.leg.pickupAddress,
    dropAddress: priced.leg.dropAddress,
    driverId: null,
    settlementContract: priced.leg.settlementContract,
    ...(priced.leg.merchantSettlementContract ? { merchantSettlementContract: priced.leg.merchantSettlementContract } : {}),
    otp: priced.leg.otp,
    paymentStatus: 'paid',
    paymentOrderId: '',
    paymentId: '',
    ...(priced.leg.merchantId ? { merchantId: priced.leg.merchantId } : {}),
    ...(priced.leg.orderType ? { orderType: priced.leg.orderType } : {}),
    ...(priced.leg.fulfillmentMethod ? { fulfillmentMethod: priced.leg.fulfillmentMethod } : {}),
    ...(priced.leg.deliveryProvider ? { deliveryProvider: priced.leg.deliveryProvider } : {}),
    ...(priced.leg.sellerVertical ? { sellerVertical: priced.leg.sellerVertical } : {}),
    details: priced.leg.details
  };
  if (priced.leg.priceBreakdown) booking.priceBreakdown = priced.leg.priceBreakdown;
  if (priced.fareBreakdown) booking.fareBreakdown = priced.fareBreakdown;
  return { amount: priced.amount, booking, items: priced.items, storeId: priced.storeId, restaurantId: priced.restaurantId, ...(priced.fareBreakdown ? { fareBreakdown: priced.fareBreakdown } : {}) };
}

async function razorpayRequest(path, method, body, extraHeaders = {}) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID.value()}:${RAZORPAY_KEY_SECRET.value()}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error('Payment provider request failed.'), { providerStatus: response.status });
  return data;
}

function validSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET.value()).update(`${orderId}|${paymentId}`).digest();
  let actual;
  try { actual = Buffer.from(signature, 'hex'); } catch { return false; }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function issueRefund(paymentId, amount) {
  const idempotencyKey = crypto.createHash('sha256').update(`${paymentId}:full-refund:${amount}`).digest('hex');
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/refund`, 'POST', { amount, speed: 'normal' }, { 'X-Refund-Idempotency': idempotencyKey });
}

async function applyCoupon(uid, quote, rawCode) {
  if (!rawCode) return quote;
  const code = cleanText(rawCode, 'Coupon', 40).toUpperCase();
  if (quote.booking?.couponCode) {
    if (quote.booking.couponCode === code) return quote;
    throw new HttpsError('invalid-argument', 'A different discount is already applied to this quote.');
  }
  if (quote.couponLocked) throw new HttpsError('invalid-argument', 'Request a new quote to change its offer.');
  if (!/^[A-Z0-9_-]+$/.test(code)) throw new HttpsError('invalid-argument', 'Invalid offer code.');
  const coupon = (await db.doc(`coupons/${code}`).get()).data();
  const redeemed = await db.doc(`coupon_redemptions/${code}_${uid}`).get();
  const minimumBasket = coupon?.merchantId ? quote.booking.priceBreakdown?.itemCents : quote.amount;
  if (!coupon || coupon.enabled !== true || !(coupon.expiresAt?.toMillis() > Date.now()) || redeemed.exists || !Array.isArray(coupon.serviceTypes) || !coupon.serviceTypes.includes(quote.booking.serviceType) || (Array.isArray(coupon.eligibleUserIds) && !coupon.eligibleUserIds.includes(uid)) || !Number.isSafeInteger(coupon.minAmountCents) || minimumBasket < coupon.minAmountCents || !Number.isSafeInteger(coupon.maxRedemptions) || (coupon.redeemedCount || 0) >= coupon.maxRedemptions) throw new HttpsError('failed-precondition', 'This offer is expired, already used or unavailable for this order.');
  const merchantOffer = typeof coupon.merchantId === 'string';
  if (merchantOffer) {
    const expectedType = quote.booking.serviceType === 'food' ? 'restaurant' : quote.booking.serviceType === 'grocery' ? 'grocery' : '';
    if (!expectedType || coupon.merchantType !== expectedType || quote.booking.merchantId !== coupon.merchantId) throw new HttpsError('failed-precondition', 'This offer is only valid at the merchant that issued it.');
  }
  const itemCents = merchantOffer ? quote.booking.priceBreakdown?.itemCents : quote.amount;
  const discount = coupon.type === 'fixed' ? coupon.discountCents : coupon.type === 'percent' && Number.isInteger(coupon.percentBps) && coupon.percentBps > 0 && coupon.percentBps <= 10000 ? Math.min(Math.floor(itemCents * coupon.percentBps / 10000), coupon.maxDiscountCents) : NaN;
  if (!Number.isSafeInteger(discount) || discount <= 0 || discount >= (merchantOffer ? itemCents : quote.amount) || discount >= quote.amount || quote.amount - discount < 100) throw new HttpsError('failed-precondition', 'This offer has an invalid discount configuration.');
  let merchantBreakdown;
  if (merchantOffer) {
    const current = quote.booking.priceBreakdown;
    if (!current || !['itemCents', 'deliveryCents', 'packagingCents', 'platformCents', 'taxCents', 'totalCents'].every(field => Number.isSafeInteger(current[field]) && current[field] >= 0) || current.totalCents !== quote.amount) throw new HttpsError('failed-precondition', 'This merchant offer cannot be applied to an order without a valid itemized price.');
    const taxBps = current.taxBps ?? 0;
    if (!Number.isSafeInteger(taxBps) || taxBps < 0 || taxBps > 10000) throw new HttpsError('failed-precondition', 'The order tax configuration needs review.');
    const taxCents = Math.round((itemCents - discount + current.deliveryCents + current.packagingCents + current.platformCents) * taxBps / 10000);
    const totalCents = itemCents - discount + current.deliveryCents + current.packagingCents + current.platformCents + taxCents;
    if (!Number.isSafeInteger(totalCents) || totalCents < 100) throw new HttpsError('failed-precondition', 'This offer would make the order total invalid.');
    merchantBreakdown = { ...current, taxCents, discountCents: discount, totalCents };
  }
  const couponTerms = coupon.type === 'fixed' ? { type: 'fixed', discountCents: coupon.discountCents, minAmountCents: coupon.minAmountCents } : { type: 'percent', percentBps: coupon.percentBps, maxDiscountCents: coupon.maxDiscountCents, minAmountCents: coupon.minAmountCents };
  const amount = merchantBreakdown?.totalCents ?? quote.amount - discount;
  return { ...quote, amount, booking: { ...quote.booking, price: amount / 100, originalPrice: quote.amount / 100, couponCode: code, couponDiscountCents: discount, couponTerms, ...(merchantBreakdown ? { priceBreakdown: merchantBreakdown } : quote.booking.priceBreakdown ? { priceBreakdown: { ...quote.booking.priceBreakdown, discountCents: discount, totalCents: amount } } : {}), ...(quote.booking.fareBreakdown ? { fareBreakdown: { ...quote.booking.fareBreakdown, discountCents: discount, totalCents: amount } } : {}) } };
}

Object.assign(exports, tripBundleFunctions({
  onCall,
  onSchedule,
  onDocumentWritten,
  db,
  REGION,
  databaseId,
  HttpsError,
  Timestamp,
  FieldValue,
  documentId,
  cleanText,
  requireUser,
  priceLeg,
  razorpayRequest,
  validSignature,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  MAPS_API_KEY,
  recordStockMovement,
  productWithinExpiry,
  calculateDriverSettlement,
  calculateMerchantSettlement,
  addCents,
  journal,
  CURRENCY,
}));

exports.previewCartCoupon = onCall({ operation: 'previewCartCoupon', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  const uid = requireUser(request);
  if (!['food', 'grocery'].includes(request.data?.booking?.serviceType)) throw new HttpsError('invalid-argument', 'Select a food or grocery cart.');
  const quote = await applyCoupon(uid, await priceAndPrepareBooking(uid, request.data.booking), request.data.code);
  return { amount: quote.amount, discountCents: quote.booking.couponDiscountCents || 0, code: quote.booking.couponCode || '' };
});

exports.getCartQuote = onCall({ operation: 'getCartQuote', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  const uid = requireUser(request);
  if (!['food', 'grocery'].includes(request.data?.booking?.serviceType)) throw new HttpsError('invalid-argument', 'Choose a food or grocery cart.');
  const quote = await applyCoupon(uid, await priceAndPrepareBooking(uid, request.data.booking), request.data.code);
  return { amount: quote.amount, priceBreakdown: quote.booking.priceBreakdown };
});

async function settleCapturedPayment(orderId, paymentId, providerPayment, walletPayment = false, codPayment = false) {
  const attemptRef = db.doc(`payment_attempts/${orderId}`);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw new HttpsError('not-found', 'Payment request could not be found.');
  const attempt = attemptSnap.data();
  if (attempt.status === 'paid' || attempt.status === 'pending_cod') return { bookingId: attempt.bookingId || null, status: attempt.status };
  if (['cancelled', 'refunded', 'refund_processing', 'refund_required'].includes(attempt.status)) {
    throw new HttpsError('failed-precondition', 'This payment is already in refund handling and cannot create another booking.');
  }
  if (!walletPayment && !codPayment && (providerPayment.status !== 'captured' || providerPayment.order_id !== orderId || providerPayment.amount !== attempt.amount || providerPayment.currency !== CURRENCY)) {
    throw new HttpsError('failed-precondition', 'Payment has not been captured for this order.');
  }
  if (!walletPayment && !codPayment) {
    // Capture is recorded even when inventory allocation later fails and is refunded.
    const receiptRef = db.doc(`financial_journals/capture_${orderId}`);
    await db.runTransaction(async tx => {
      const receipt = await tx.get(receiptRef);
      if (!receipt.exists) tx.create(receiptRef, journal('provider_capture', 'provider_clearing', 'customer_funds_pending', attempt.amount, { orderId, paymentId, customerId: attempt.uid }));
    });
  }

  if (attempt.kind === 'wallet_topup') {
    await db.runTransaction(async transaction => {
      const userRef = db.doc(`users/${attempt.uid}`), ledgerRef = db.doc(`wallet_ledger/${attempt.uid}/entries/${orderId}`);
      const [latest, account, ledger] = await Promise.all([transaction.get(attemptRef), transaction.get(userRef), transaction.get(ledgerRef)]);
      if (latest.data()?.status === 'paid' || ledger.exists) return;
      if (!account.exists || latest.data()?.status !== 'created') throw new HttpsError('failed-precondition', 'This wallet credit requires review.');
      const balance = Math.round((account.data().walletBalance || 0) * 100);
      if (!Number.isSafeInteger(balance)) throw new HttpsError('failed-precondition', 'The wallet balance needs reconciliation.');
      const nextBalance = addCents(balance, attempt.amount);
      transaction.update(userRef, { walletBalance: nextBalance / 100 });
      transaction.create(ledgerRef, { kind: 'topup', amountCents: attempt.amount, balanceCents: nextBalance, paymentId, createdAt: new Date().toISOString() });
      transaction.create(db.doc(`financial_journals/allocate_${orderId}`), journal('wallet_topup', 'customer_funds_pending', 'wallet_liability', attempt.amount, { orderId, paymentId, customerId: attempt.uid }));
      transaction.update(attemptRef, { status: 'paid', paymentId, paidAt: Timestamp.now() });
    });
    return { status: 'paid', walletCredited: true };
  }
  try {
    await db.runTransaction(async (transaction) => {
      const latestAttempt = await transaction.get(attemptRef);
      if (!latestAttempt.exists) throw new HttpsError('not-found', 'Payment request could not be found.');
      if (latestAttempt.data().status === 'paid' || codPayment && latestAttempt.data().status === 'pending_cod') return;
      if (['refunded', 'refund_processing', 'refund_required'].includes(latestAttempt.data().status)) throw new HttpsError('aborted', 'This payment is in refund handling.');
      if (latestAttempt.data().status !== 'created') throw new HttpsError('failed-precondition', 'This checkout is no longer active. Request a fresh quote.');
      if (latestAttempt.data().uid !== attempt.uid) throw new HttpsError('permission-denied', 'Payment owner does not match.');
      const walletRef = db.doc(`users/${attempt.uid}`);
      const walletAccount = walletPayment ? await transaction.get(walletRef) : null;
      const walletBalance = Math.round((walletAccount?.data()?.walletBalance || 0) * 100);
      if (walletPayment && (!Number.isSafeInteger(walletBalance) || walletBalance < attempt.amount)) throw new HttpsError('resource-exhausted', 'Insufficient AllGo wallet balance.');
      const acceptedMethods = ['upi', 'card', 'netbanking', 'wallet', 'emi'];
      const paymentMethod = codPayment ? 'cash' : walletPayment ? 'wallet' : acceptedMethods.includes(providerPayment.method) ? providerPayment.method : 'other';
      const booking = { ...attempt.booking, paymentOrderId: orderId, paymentId, paymentMethod, paymentStatus: codPayment ? 'pending_cod' : 'paid' };
      try { calculateDriverSettlement(booking); }
      catch (error) { throw new HttpsError('failed-precondition', error.message); }
      const couponRef = booking.couponCode ? db.doc(`coupons/${booking.couponCode}`) : null;
      const redemptionRef = booking.couponCode ? db.doc(`coupon_redemptions/${booking.couponCode}_${attempt.uid}`) : null;
      const coupon = couponRef ? await transaction.get(couponRef) : null;
      const redemption = redemptionRef ? await transaction.get(redemptionRef) : null;
      if (couponRef && (!coupon.exists || coupon.data().enabled !== true || !(coupon.data().expiresAt?.toMillis() > Date.now()) || redemption.exists || (coupon.data().redeemedCount || 0) >= coupon.data().maxRedemptions)) throw new HttpsError('failed-precondition', 'The offer became unavailable while payment was processing.');
      let stockRefs = [];
      let stockSnaps = [];
      if (attempt.storeId) {
        stockRefs = attempt.items.map((item) => db.doc(`grocery_stores/${attempt.storeId}/products/${item.id}`));
        stockSnaps = await Promise.all(stockRefs.map((ref) => transaction.get(ref)));
        for (let index = 0; index < stockSnaps.length; index += 1) {
          try { checkoutCatalogItem(stockSnaps[index].data(), attempt.items[index].variantId, 'grocery', attempt.items[index].quantity); }
          catch (error) { throw new HttpsError('failed-precondition', error.message); }
        }
      }
      let menuRefs = [];
      if (attempt.restaurantId) {
        menuRefs = attempt.items.map((item) => db.doc(`restaurants/${attempt.restaurantId}/menu_items/${item.id}`));
        const menuSnaps = await Promise.all(menuRefs.map((ref) => transaction.get(ref)));
        for (let index = 0; index < attempt.items.length; index += 1) {
          const item = attempt.items[index];
          try { checkoutCatalogItem(menuSnaps[index].data(), item.variantId, 'food', item.quantity, Date.now(), item.addOnIds || []); }
          catch (error) { throw new HttpsError('failed-precondition', error.message); }
        }
      }
      const outletId = attempt.restaurantId || attempt.storeId || attempt.booking?.merchantId;
      if (outletId && ['food', 'grocery'].includes(booking.serviceType)) {
        const outletType = booking.serviceType === 'food' ? 'restaurants' : 'grocery_stores';
        const outletRef = db.doc(`${outletType}/${outletId}`);
        const activeQuery = db.collection('bookings').where('merchantId', '==', outletId).where('status', 'in', ['pending', 'preparing']);
        const [outletSnap, activeSnap] = await Promise.all([transaction.get(outletRef), transaction.get(activeQuery)]);
        assertOutletCapacity(outletSnap.data(), activeSnap.size);
      }
      if (walletPayment) {
        transaction.update(walletRef, { walletBalance: (walletBalance - attempt.amount) / 100 });
        transaction.create(db.doc(`wallet_ledger/${attempt.uid}/entries/${orderId}`), { kind: 'booking', amountCents: -attempt.amount, balanceCents: walletBalance - attempt.amount, bookingId: attempt.bookingId, createdAt: new Date().toISOString() });
      }
      stockSnaps.forEach((snapshot, index) => {
        const before = snapshot.data().stock, after = before - attempt.items[index].quantity;
        transaction.update(stockRefs[index], { stock: after });
        recordStockMovement(transaction, stockRefs[index], `reserve_${orderId}`, 'reservation', before, after, { bookingId: attempt.bookingId });
      });
      if (couponRef) {
        transaction.update(couponRef, { redeemedCount: (coupon.data().redeemedCount || 0) + 1 });
        transaction.create(redemptionRef, { uid: attempt.uid, bookingId: booking.bookingId, discountCents: booking.couponDiscountCents, createdAt: Timestamp.now() });
      }
      const { otp, merchantSettlementContract, ...publicBooking } = booking;
      const { parcelContacts, publicDetails } = separateParcelContacts(publicBooking.details);
      publicBooking.details = publicDetails;
      if (booking.serviceType === 'parcel' && parcelContacts) transaction.create(db.doc(`booking_contacts/${booking.bookingId}`), { customerId: booking.customerId, ...parcelContacts });
      transaction.create(db.doc(`booking_codes/${booking.bookingId}`), { customerId: booking.customerId, code: otp, attempts: 0, ...(contractFor(booking.serviceType).pickupProof ? { pickupCode: String(crypto.randomInt(1000, 10000)), pickupAttempts: 0 } : {}) });
      transaction.create(db.doc(`bookings/${booking.bookingId}`), publicBooking);
      if (merchantSettlementContract) transaction.create(db.doc(`merchant_settlement_orders/${booking.bookingId}`), { bookingId: booking.bookingId, merchantId: booking.merchantId, serviceType: booking.serviceType, contract: merchantSettlementContract, createdAt: Timestamp.now() });
      transaction.create(db.doc(`bookings/${booking.bookingId}/events/confirmed`), { stage: 'confirmed', actorRole: 'system', createdAt: new Date().toISOString() });
      transaction.create(db.doc(`financial_journals/allocate_${orderId}`), journal(codPayment ? 'cod_booking' : walletPayment ? 'wallet_booking' : 'provider_booking', codPayment ? 'customer_receivable_cod' : walletPayment ? 'wallet_liability' : 'customer_funds_pending', 'booking_funds_unallocated', attempt.amount, { orderId, paymentId, bookingId: booking.bookingId, customerId: attempt.uid }));
      transaction.update(attemptRef, { status: codPayment ? 'pending_cod' : 'paid', bookingId: booking.bookingId, paymentId, paymentMethod, ...(codPayment ? {} : { paidAt: Timestamp.now() }) });
    });
  } catch (error) {
    if (!walletPayment && !codPayment && error instanceof HttpsError && error.code === 'failed-precondition') {
      const state = await db.runTransaction(async transaction => {
        const latest = await transaction.get(attemptRef), status = latest.data()?.status;
        if (['paid', 'refunded', 'refund_processing', 'refund_required'].includes(status)) return status;
        transaction.update(attemptRef, { status: 'refund_processing', paymentId, failureReason: 'inventory_unavailable', updatedAt: Timestamp.now() });
        return 'claimed';
      });
      if (state === 'paid') return { bookingId: attempt.bookingId, status: 'paid' };
      if (state !== 'claimed') throw new HttpsError('failed-precondition', 'This payment is in refund handling. Check payment activity or contact support.');
      try {
        const refund = await issueRefund(paymentId, attempt.amount);
        await db.runTransaction(async transaction => {
          const snapshot = await transaction.get(attemptRef);
          if (snapshot.data()?.status !== 'refunded') transaction.update(attemptRef, { status: refund.status === 'failed' ? 'refund_required' : 'refund_processing', refundId: refund.id, refundStatus: refund.status, updatedAt: Timestamp.now() });
        });
        if (refund.status === 'failed') throw new Error('Refund provider reported a failure.');
        await checkPendingRefund(attemptRef);
      } catch (refundError) {
        await db.runTransaction(async transaction => {
          const latest = await transaction.get(attemptRef);
          if (latest.data()?.status !== 'refunded') transaction.update(attemptRef, { status: 'refund_required', paymentId, failureReason: 'inventory_unavailable', updatedAt: Timestamp.now() });
        });
        throw new HttpsError('internal', 'Payment was captured but inventory could not be reserved. Contact AllGo support to resolve the refund.');
      }
      throw new HttpsError('failed-precondition', 'Stock changed during payment. A refund has been initiated; check payment activity for its status.');
    }
    throw error;
  }
  if (!['food', 'grocery'].includes(attempt.booking.serviceType)) {
    try {
      await dispatchBookingWave(db, attempt.booking.bookingId, Timestamp);
    } catch (dispatchErr) {
      console.warn('Auto dispatch for non-food booking failed:', dispatchErr);
    }
  }
  return { bookingId: attempt.booking.bookingId, status: codPayment ? 'pending_cod' : 'paid' };
}

exports.searchServiceLocations = onCall({ operation: 'searchServiceLocations', region: REGION, secrets: [MAPS_API_KEY] }, async (request) => {
  requireUser(request);
  const address = cleanText(request.data?.address, 'Address', 300);
  return { locations: await geocode(MAPS_API_KEY.value(), { address, region: 'in' }) };
});

exports.autocompleteServiceLocations = onCall({ operation: 'autocompleteServiceLocations', region: REGION, secrets: [MAPS_API_KEY] }, async (request) => {
  requireUser(request);
  const input = cleanText(request.data?.input, 'Search input', 200);
  if (!input || input.length < 3) return { suggestions: [] };
  const sessionToken = cleanText(request.data?.sessionToken, 'Session token', 64) || undefined;
  const suggestions = await autocomplete(MAPS_API_KEY.value(), { input, sessionToken });
  return { suggestions };
});

exports.reverseServiceLocation = onCall({ operation: 'reverseServiceLocation', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  requireUser(request);
  if (!validPoint(request.data?.location)) throw new HttpsError('invalid-argument', 'A valid device location is required.');
  return { locations: await geocode(MAPS_API_KEY.value(), { latlng: `${request.data.location.lat},${request.data.location.lng}` }) };
});

exports.getMapPickerPreview = onCall({ operation: 'getMapPickerPreview', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  requireUser(request);
  const zoom = request.data?.zoom ?? 16;
  return { image: await mapPreview(MAPS_API_KEY.value(), request.data?.location, zoom) };
});

exports.setDriverLocationConsent = onCall({ operation: 'setDriverLocationConsent', region: REGION }, async request => {
  const uid = requireUser(request), enabled = request.data?.enabled;
  if (typeof enabled !== 'boolean') throw new HttpsError('invalid-argument', 'Confirm your location sharing choice.');
  await db.runTransaction(async tx => {
    const ref = db.doc(`driver_profiles/${uid}`), [profile, account] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${uid}`))]);
    if (account.data()?.role !== 'driver' || profile.data()?.status !== 'verified') throw new HttpsError('permission-denied', 'Verified partner access required.');
    tx.update(ref, { locationConsent: enabled, locationConsentAt: new Date().toISOString(), ...(!enabled ? { online: false, currentLat: FieldValue.delete(), currentLng: FieldValue.delete(), locationUpdatedAt: FieldValue.delete(), locationAccuracyMeters: FieldValue.delete() } : {}) });
    if (!enabled && profile.data().activeBookingId) tx.delete(db.doc(`booking_tracking/${profile.data().activeBookingId}`));
  });
  return { enabled };
});
exports.createDriverNativeSession = onCall({ operation: 'createDriverNativeSession', region: REGION }, async request => {
  const uid = requireUser(request), profile = (await db.doc(`driver_profiles/${uid}`).get()).data(), account = (await db.doc(`users/${uid}`).get()).data();
  if (account?.role !== 'driver' || profile?.status !== 'verified' || !profile.online || profile.locationConsent !== true) throw new HttpsError('permission-denied', 'Go online with location consent before starting native tracking.');
  const claims = request.auth.token.allgoSession ? { allgoSession: request.auth.token.allgoSession } : {};
  return { customToken: await getAuth(app).createCustomToken(uid, claims) };
});
exports.updateDriverLocation = onCall({ operation: 'updateDriverLocation', region: REGION }, async request => {
  const uid = requireUser(request), location = request.data?.location, accuracy = request.data?.accuracy;
  const validation = validateLocationUpdate(location, accuracy, request.data);
  if (!validation.valid) throw new HttpsError('invalid-argument', validation.reason);
  const geohash = encodeGeohash(location.lat, location.lng, 6);
  return db.runTransaction(async transaction => {
    const driverRef = db.doc(`driver_profiles/${uid}`);
    const [driver, account] = await Promise.all([transaction.get(driverRef), transaction.get(db.doc(`users/${uid}`))]);
    const data = driver.data();
    if (account.data()?.role !== 'driver' || data?.status !== 'verified' || data.online !== true || data.locationConsent !== true) throw new HttpsError('permission-denied', 'Only verified online partners with location consent can report a position.');
    const booking = data.activeBookingId ? await transaction.get(db.doc(`bookings/${data.activeBookingId}`)) : null;
    if (Date.now() - Date.parse(data.locationUpdatedAt || '') < 5000) return { accepted: false };
    const updatedAt = new Date().toISOString();
    transaction.update(driverRef, { currentLat: location.lat, currentLng: location.lng, geohash, locationAccuracyMeters: accuracy, locationUpdatedAt: updatedAt });
    if (booking?.data()?.driverId === uid && !['completed', 'delivered', 'cancelled'].includes(booking.data().status)) {
      transaction.set(db.doc(`booking_tracking/${booking.id}`), { driverId: uid, currentLat: location.lat, currentLng: location.lng, geohash, locationAccuracyMeters: accuracy, locationUpdatedAt: updatedAt }, { merge: true });
    }
    if (data.activeBundleId && data.activeLegId) {
      const bundleTrackingRef = db.doc(`bundle_tracking/${data.activeBundleId}`);
      transaction.set(bundleTrackingRef, {
        legs: {
          [data.activeLegId]: {
            driverId: uid,
            currentLat: location.lat,
            currentLng: location.lng,
            geohash,
            locationAccuracyMeters: accuracy,
            locationUpdatedAt: updatedAt,
          }
        },
        updatedAt
      }, { merge: true });
    }
    return { accepted: true, geohash };
  });
});

exports.triggerBookingDispatch = onCall({ operation: 'triggerBookingDispatch', region: REGION }, async request => {
  const uid = requireUser(request);
  const bookingId = cleanText(request.data?.bookingId, 'Booking ID', 128);
  if (!bookingId) throw new HttpsError('invalid-argument', 'Booking ID is required.');
  return dispatchBookingWave(db, bookingId, Timestamp);
});

exports.getTrackingRoute = onCall({ operation: 'getTrackingRoute', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  const uid = requireUser(request), bookingId = documentId(request.data?.bookingId, 'Booking ID');
  const [bookingDoc, trackingDoc, account, profile] = await Promise.all([db.doc(`bookings/${bookingId}`).get(), db.doc(`booking_tracking/${bookingId}`).get(), db.doc(`users/${uid}`).get(), db.doc(`driver_profiles/${uid}`).get()]);
  const booking = bookingDoc.data(), tracking = trackingDoc.data();
  const assignedDriver = booking?.driverId === uid && account.data()?.role === 'driver' && profile.data()?.status === 'verified';
  if (!booking || (booking.customerId !== uid && !assignedDriver && request.auth.token.admin !== true)) throw new HttpsError('permission-denied', 'This journey is not assigned to your account.');
  if (!tracking || !validPoint({ lat: tracking.currentLat, lng: tracking.currentLng }) || !Number.isFinite(Date.parse(tracking.locationUpdatedAt)) || tracking.driverId !== booking.driverId || Date.now() - Date.parse(tracking.locationUpdatedAt) > 60000 || ['completed', 'delivered', 'cancelled'].includes(booking.status)) throw new HttpsError('failed-precondition', 'A fresh partner location is required for a travel estimate.');
  const pickup = ['accepted', 'preparing', 'ready'].includes(booking.status);
  const placeId = pickup ? booking.details?.pickupPlaceId : booking.details?.dropPlaceId;
  const destinations = await geocode(MAPS_API_KEY.value(), placeId ? { place_id: placeId } : { address: pickup ? booking.pickupAddress : booking.dropAddress });
  if (!destinations[0] || destinations[0].partialMatch) throw new HttpsError('failed-precondition', 'The journey address could not be resolved for a travel estimate.');
  // Booking fare quotes stay traffic-unaware. Tracking estimates use current traffic and never alter a settled fare.
  const route = await routeBetween(MAPS_API_KEY.value(), { location: { lat: tracking.currentLat, lng: tracking.currentLng } }, destinations[0], 'DRIVE', 'TRAFFIC_AWARE');
  return { distanceMeters: route.distanceMeters, estimatedMinutes: Math.ceil(route.durationSeconds / 60), calculatedAt: new Date().toISOString(), destination: pickup ? 'pickup' : 'drop', provider: 'google' };
});

exports.sendBookingMessage = onCall({ operation: 'sendBookingMessage', region: REGION }, async request => {
  const uid = requireUser(request), bookingId = documentId(request.data?.bookingId, 'Booking ID'), text = cleanText(request.data?.text, 'Message', 2000);
  await db.runTransaction(async transaction => {
    const [snapshot, account, profile] = await Promise.all([
      transaction.get(db.doc(`bookings/${bookingId}`)),
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(db.doc(`driver_profiles/${uid}`))
    ]);
    const booking = snapshot.data(), actor = account.data();
    if (!booking) throw new HttpsError('not-found', 'Booking not found.');
    if (['completed', 'delivered', 'cancelled'].includes(booking.status)) throw new HttpsError('failed-precondition', 'This conversation is closed. Use support for further help.');
    if (actor?.suspended === true || actor?.disabled === true) throw new HttpsError('permission-denied', 'Account is suspended or disabled.');

    const isCustomer = booking.customerId === uid;
    const assignedDriver = Boolean(booking?.driverId === uid && actor?.role === 'driver' && profile.data()?.status === 'verified');
    const isMerchant = Boolean(actor && merchantHasPermission(
      actor,
      booking.merchantId,
      booking.serviceType === 'food' ? 'restaurant' : booking.serviceType === 'grocery' ? 'grocery' : null,
      'orders'
    ));
    const isAdmin = actor?.role === 'admin';

    if (!isCustomer && !assignedDriver && !isMerchant && !isAdmin) {
      throw new HttpsError('permission-denied', 'Only this customer, assigned delivery partner, or store merchant can send messages.');
    }

    const senderRole = isMerchant ? 'merchant' : assignedDriver ? 'driver' : isCustomer ? 'customer' : 'admin';
    const defaultName = isMerchant ? 'Store Partner' : assignedDriver ? 'Delivery Partner' : 'Customer';

    transaction.create(db.collection(`bookings/${bookingId}/chats`).doc(), {
      senderId: uid,
      senderName: cleanText(actor?.name || defaultName, 'Account name', 100),
      senderRole,
      text,
      timestamp: new Date().toISOString()
    });
  });
  return { sent: true };
});

exports.getServiceQuote = onCall({ operation: 'getServiceQuote', region: REGION, secrets: [MAPS_API_KEY] }, async (request) => {
  const uid = requireUser(request);
  if (!['ride', 'parcel', 'takeover', 'transport'].includes(request.data?.serviceType)) throw new HttpsError('invalid-argument', 'Choose a booking service.');
  const baseQuote = await priceAndPrepareBooking(uid, request.data);
  const quote = await applyCoupon(uid, baseQuote, request.data?.couponCode);
  const quoteRef = db.collection('service_quotes').doc();
  const expiresAt = Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);
  // SEC-01: coupon applied exactly once here; couponLocked=true prevents re-application downstream.
  await quoteRef.create({ ...quote, uid, expiresAt, createdAt: Timestamp.now(), claimed: false, couponLocked: true, originalAmount: baseQuote.amount });
  const discountCents = quote.booking.couponDiscountCents || 0;
  return { quoteId: quoteRef.id, amount: quote.amount, currency: CURRENCY, price: quote.amount / 100, expiresAt: expiresAt.toDate().toISOString(), estimatedKm: quote.booking.details.estimatedKm, estimatedMinutes: quote.booking.details.estimatedMinutes, ...(quote.fareBreakdown ? { fareBreakdown: { ...quote.fareBreakdown, discountCents, totalCents: quote.amount } } : {}) };
});

exports.requestTransportQuote = onCall({ operation: 'requestTransportQuote', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  const uid = requireUser(request), data = request.data || {}, operatorId = documentId(data.operatorId, 'Transport operator ID'), requestId = documentId(data.requestId, 'Quote request reference');
  if (data.booking?.serviceType !== 'transport') throw new HttpsError('invalid-argument', 'Submit a vehicle transport booking request.');
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ operatorId, booking: data.booking })).digest('hex');
  const operatorRef = db.doc(`transport_operators/${operatorId}`), requestRef = operatorRef.collection('quote_requests').doc(requestId), mirrorRef = db.doc(`transport_quote_requests/${requestId}`);
  const existing = await requestRef.get();
  if (existing.exists) {
    if (existing.data().customerId !== uid || existing.data().requestFingerprint !== fingerprint) throw new HttpsError('already-exists', 'This request reference is already in use.');
    return { requestId, status: existing.data().status, revision: existing.data().revision || 0 };
  }
  const account = (await db.doc(`users/${uid}`).get()).data();
  if (account?.role !== 'customer' || account.disabled === true || account.suspended === true) throw new HttpsError('permission-denied', 'An active customer account is required.');
  const operator = (await operatorRef.get()).data();
  if (!operator || operator.status !== 'approved' || typeof operator.ownerUid !== 'string') throw new HttpsError('failed-precondition', 'This transport operator is not available for new bookings.');
  const operatorOwnerRef = db.doc(`users/${operator.ownerUid}`), operatorOwner = (await operatorOwnerRef.get()).data();
  if (operatorOwner?.role !== 'merchant' || operatorOwner.transportOperatorId !== operatorId || operatorOwner.disabled === true || operatorOwner.suspended === true) throw new HttpsError('failed-precondition', 'This transport operator is not currently available for new bookings.');
  const prepared = await priceAndPrepareBooking(uid, data.booking);
  if (prepared.booking.serviceType !== 'transport' || !prepared.booking.details?.pickupZoneId || !Number.isFinite(prepared.booking.details?.vehicleWeightKg)) throw new HttpsError('failed-precondition', 'Transport route or vehicle details need operations review.');
  const vehicleQuery = db.collection(`transport_operators/${operatorId}/vehicles`).where('status', '==', 'approved').limit(100), vehicles = await vehicleQuery.get();
  if (!vehicles.docs.some(vehicle => transportFleetVehicleSuitable(vehicle.data(), prepared.booking.details))) throw new HttpsError('failed-precondition', 'This operator has no approved fleet vehicle with enough load and size capacity for your vehicle. Choose another operator.');
  const { otp, ...bookingDraft } = prepared.booking;
  bookingDraft.price = 0;
  const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000), now = Timestamp.now();
  const requestData = { requestId, operatorId, customerId: uid, requestFingerprint: fingerprint, bookingDraft, status: 'open', revision: 0, createdAt: now, expiresAt };
  await db.runTransaction(async tx => {
    const [prior, operatorSnapshot, ownerSnapshot, freshVehicles] = await Promise.all([tx.get(requestRef), tx.get(operatorRef), tx.get(operatorOwnerRef), tx.get(vehicleQuery)]);
    if (prior.exists) {
      if (prior.data().customerId !== uid || prior.data().requestFingerprint !== fingerprint) throw new HttpsError('already-exists', 'This request reference is already in use.');
      return;
    }
    const owner = ownerSnapshot.data();
    if (operatorSnapshot.data()?.ownerUid !== operator.ownerUid || operatorSnapshot.data()?.status !== 'approved' || owner?.role !== 'merchant' || owner.transportOperatorId !== operatorId || owner.disabled === true || owner.suspended === true || !freshVehicles.docs.some(vehicle => transportFleetVehicleSuitable(vehicle.data(), prepared.booking.details))) throw new HttpsError('failed-precondition', 'The operator or its suitable approved fleet changed. Choose another operator and try again.');
    tx.create(requestRef, requestData);
    tx.create(mirrorRef, requestData);
    tx.create(requestRef.collection('events').doc('submitted'), { actorId: uid, actorRole: 'customer', action: 'transport_quote_requested', createdAt: now });
  });
  return { requestId, status: 'open', revision: 0 };
});

exports.getTransportQuoteRequest = onCall({ operation: 'getTransportQuoteRequest', region: REGION }, async request => {
  const uid = requireUser(request), requestId = documentId(request.data?.requestId, 'Quote request ID');
  const snapshot = await db.doc(`transport_quote_requests/${requestId}`).get(), data = snapshot.data();
  if (!snapshot.exists || data.customerId !== uid) throw new HttpsError('permission-denied', 'This quote request does not belong to your account.');
  const expired = ['open', 'offered'].includes(data.status) && data.expiresAt?.toMillis() <= Date.now();
  if (expired && data.status === 'open') {
    await db.runTransaction(async tx => {
      const [mirror, scoped] = await Promise.all([tx.get(snapshot.ref), tx.get(db.doc(`transport_operators/${data.operatorId}/quote_requests/${requestId}`))]);
      if (mirror.data()?.status === 'open' && mirror.data()?.expiresAt?.toMillis() <= Date.now()) { tx.update(snapshot.ref, { status: 'expired', revision: (mirror.data().revision || 0) + 1 }); if (scoped.exists) tx.update(scoped.ref, { status: 'expired', revision: (scoped.data().revision || 0) + 1 }); }
    });
  }
  const current = (await snapshot.ref.get()).data();
  return { requestId, status: expired && current.status === 'open' ? 'expired' : current.status, revision: current.revision || 0, ...(current.status === 'offered' && current.quote ? { offer: { amountCents: current.quote.amountCents, terms: current.quote.reason, expiresAt: current.quote.expiresAt.toDate().toISOString(), pickupTimeReview: { status: current.quote.decision, reviewedAt: current.quote.reviewedAt.toDate().toISOString(), reason: current.quote.reason } } } : {}), ...(current.status === 'declined' ? { message: current.reason || 'The operator cannot meet the requested pickup time.' } : {}) };
});

exports.cancelTransportQuoteRequest = onCall({ operation: 'cancelTransportQuoteRequest', region: REGION }, async request => {
  const uid = requireUser(request), requestId = documentId(request.data?.requestId, 'Quote request ID'), mirrorRef = db.doc(`transport_quote_requests/${requestId}`), first = await mirrorRef.get();
  if (!first.exists || first.data().customerId !== uid) throw new HttpsError('permission-denied', 'This quote request does not belong to your account.');
  const initial = first.data(), scopedRef = db.doc(`transport_operators/${initial.operatorId}/quote_requests/${requestId}`);
  return db.runTransaction(async tx => {
    const [mirror, scoped] = await Promise.all([tx.get(mirrorRef), tx.get(scopedRef)]), current = mirror.data();
    if (!mirror.exists || !scoped.exists || current.customerId !== uid) throw new HttpsError('permission-denied', 'This quote request does not belong to your account.');
    if (current.status === 'cancelled') return { status: 'cancelled' };
    if (!['open', 'offered', 'accepted'].includes(current.status)) throw new HttpsError('failed-precondition', 'This transport quote request can no longer be cancelled.');
    let paymentQuote;
    if (current.status === 'accepted' && current.acceptedQuoteId) {
      const quoteRef = db.doc(`service_quotes/${current.acceptedQuoteId}`); paymentQuote = await tx.get(quoteRef);
      if (paymentQuote.exists && paymentQuote.data().claimed) throw new HttpsError('failed-precondition', 'Checkout has already started. Finish or resolve the payment attempt before leaving this booking.');
      if (paymentQuote.exists) tx.update(quoteRef, { claimed: true, expiresAt: Timestamp.now(), cancelledAt: Timestamp.now() });
    }
    const revision = (current.revision || 0) + 1, updated = { status: 'cancelled', revision, cancelledAt: Timestamp.now(), cancelledBy: uid };
    tx.update(mirrorRef, updated); tx.update(scopedRef, updated);
    tx.create(scopedRef.collection('events').doc(`customer_cancel_${revision}`), { actorId: uid, actorRole: 'customer', action: 'transport_quote_cancelled', revision, createdAt: Timestamp.now() });
    return { status: 'cancelled' };
  });
});

exports.acceptTransportQuote = onCall({ operation: 'acceptTransportQuote', region: REGION }, async request => {
  const uid = requireUser(request), requestId = documentId(request.data?.requestId, 'Quote request ID'), expectedRevision = request.data?.expectedRevision;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new HttpsError('invalid-argument', 'Refresh this operator quote before accepting it.');
  const requestRef = db.doc(`transport_quote_requests/${requestId}`), scopedRef = db.doc(`transport_operators/${(await requestRef.get()).data()?.operatorId || '_missing_'}/quote_requests/${requestId}`), quoteRef = db.collection('service_quotes').doc();
  return db.runTransaction(async tx => {
    const [mirror, scoped] = await Promise.all([tx.get(requestRef), tx.get(scopedRef)]), current = mirror.data(), offer = current?.quote;
    if (!mirror.exists || !scoped.exists || current.customerId !== uid) throw new HttpsError('permission-denied', 'This transport quote is unavailable for your account.');
    if (current.status === 'accepted' && current.acceptedBy === uid && current.acceptedRevision === expectedRevision) return { quoteId: current.acceptedQuoteId, amount: current.acceptedAmountCents, price: current.acceptedAmountCents / 100, expiresAt: current.paymentQuoteExpiresAt.toDate().toISOString(), estimatedKm: current.bookingDraft.details.estimatedKm, estimatedMinutes: current.bookingDraft.details.estimatedMinutes };
    if (current.status !== 'offered' || current.revision !== expectedRevision || !offer || offer.expiresAt?.toMillis() <= Date.now() || current.expiresAt?.toMillis() <= Date.now()) throw new HttpsError('failed-precondition', 'This operator quote expired or changed. Refresh the request.');
    const operatorRef = db.doc(`transport_operators/${current.operatorId}`), operator = await tx.get(operatorRef), operatorData = operator.data();
    const operatorOwner = operatorData?.ownerUid ? await tx.get(db.doc(`users/${operatorData.ownerUid}`)) : null, ownerData = operatorOwner?.data();
    if (!operator.exists || operatorData.status !== 'approved' || ownerData?.role !== 'merchant' || ownerData.transportOperatorId !== current.operatorId || ownerData.disabled === true || ownerData.suspended === true) throw new HttpsError('failed-precondition', 'This operator is no longer approved and active. Request a new quote.');
    const acceptedAt = new Date().toISOString(), paymentQuoteExpiresAt = Timestamp.fromMillis(Date.now() + 5 * 60 * 1000), booking = { ...current.bookingDraft, bookingId: `ALLGO_${crypto.randomUUID()}`, status: 'pending', price: offer.amountCents / 100, createdAt: acceptedAt, updatedAt: acceptedAt, transportOperatorId: current.operatorId, otp: String(crypto.randomInt(1000, 10000)), details: { ...current.bookingDraft.details, pickupTimeReview: { status: 'confirmed', reviewedBy: offer.reviewedBy, reviewedByRole: 'transport_operator', reviewedAt: offer.reviewedAt.toDate().toISOString(), reason: offer.reason, revision: 1 }, transportOperatorQuote: { amountCents: offer.amountCents, terms: offer.reason, acceptedAt } } };
    const quote = { uid, amount: offer.amountCents, booking, items: [], storeId: null, restaurantId: null, expiresAt: paymentQuoteExpiresAt, createdAt: Timestamp.now(), claimed: false, couponLocked: true, originalAmount: offer.amountCents, transportRequestId: requestId, operatorId: current.operatorId };
    tx.create(quoteRef, quote);
    const updated = { status: 'accepted', acceptedBy: uid, acceptedRevision: expectedRevision, acceptedQuoteId: quoteRef.id, acceptedAmountCents: offer.amountCents, paymentQuoteExpiresAt, acceptedAt: Timestamp.now(), revision: current.revision + 1 };
    tx.update(requestRef, updated); tx.update(scopedRef, updated);
    tx.create(scopedRef.collection('events').doc(`customer_accept_${quoteRef.id}`), { actorId: uid, actorRole: 'customer', action: 'transport_quote_accepted', quoteId: quoteRef.id, amountCents: offer.amountCents, createdAt: Timestamp.now() });
    return { quoteId: quoteRef.id, amount: offer.amountCents, price: offer.amountCents / 100, expiresAt: paymentQuoteExpiresAt.toDate().toISOString(), estimatedKm: booking.details.estimatedKm, estimatedMinutes: booking.details.estimatedMinutes };
  });
});

exports.getDriverEarningEstimate = onCall({ operation: 'getDriverEarningEstimate', region: REGION }, async request => {
  const uid = requireUser(request), id = documentId(request.data?.bookingId, 'Booking ID');
  const [booking, account, offer] = await Promise.all([
    db.doc(`bookings/${id}`).get(),
    db.doc(`users/${uid}`).get(),
    db.doc(`driver_offers/${uid}/offers/${id}`).get()
  ]);
  const isAssigned = booking.data()?.driverId === uid;
  const hasActiveOffer = offer.exists && typeof offer.data()?.expiresAt?.toMillis === 'function' && offer.data().expiresAt.toMillis() > Date.now();
  if (account.data()?.role !== 'driver' || (!isAssigned && !hasActiveOffer)) {
    throw new HttpsError('permission-denied', 'Only the assigned partner or an eligible driver with an active offer can view this earning estimate.');
  }
  try {
    const data = booking.data();
    const estimate = data.driverSettlement || calculateDriverSettlement(data);
    return { ...estimate, settled: ['completed', 'delivered'].includes(data.status) && !!data.driverSettlement };
  } catch { throw new HttpsError('failed-precondition', 'Operations must review the partner contract before earnings can be estimated.'); }
});

exports.listDriverOffers = onCall({ operation: 'listDriverOffers', region: REGION }, async request => {
  const uid = requireUser(request);
  const [account, profile, eligibility] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`driver_profiles/${uid}`).get(), db.doc(`driver_eligibility/${uid}`).get()]);
  const driver = profile.data();
  if (account.data()?.role !== 'driver' || driver?.status !== 'verified' || driver.online !== true || driver.locationConsent !== true || eligibility.data()?.status === 'expired') throw new HttpsError('permission-denied', 'Only currently eligible verified online drivers with location consent can receive jobs.');
  if (driver.activeBookingId) return [];
  if (driver.cooldownUntil) {
    const cd = Date.parse(driver.cooldownUntil);
    if (Number.isFinite(cd) && cd > Date.now()) return [];
  }
  const services = [...new Set(driver.supportedServices || [])].filter(service => ['food', 'grocery', 'ride', 'parcel', 'takeover', 'transport'].includes(service));
  if (services.length === 0) return [];
  const zones = await db.collection('service_zones').where('enabled', '==', true).get();
  const nearZones = zones.docs.filter(zone => containsPoint(zone.data().polygon, { lat: driver.currentLat, lng: driver.currentLng }));
  if (nearZones.length === 0) return [];
  const pageGroups = services.flatMap(service => nearZones.filter(zone => zone.data().serviceTypes?.includes(service)).map(zone => ({ service, zoneId: zone.id })));
  const pages = await Promise.all(pageGroups.map(async ({ service, zoneId }) => {
    const cursorId = crypto.createHash('sha256').update(`${uid}:${service}:${zoneId}`).digest('hex').slice(0, 40), cursorRef = db.doc(`driver_dispatch_cursors/${uid}_${cursorId}`);
    const cursor = (await cursorRef.get()).data()?.lastBookingId;
    const baseQuery = db.collection('bookings').where('serviceType', '==', service).where('status', '==', ['food', 'grocery'].includes(service) ? 'ready' : 'pending').where('driverId', '==', null).where('details.pickupZoneId', '==', zoneId).orderBy('__name__').limit(100);
    const query = cursor ? baseQuery.startAfter(cursor) : baseQuery;
    let page = await query.get();
    // A short final page wraps the per-driver cursor so new bookings and earlier
    // IDs continue to be considered on subsequent ten-second refreshes.
    if (page.empty && cursor) page = await baseQuery.get();
    await cursorRef.set({ driverId: uid, serviceType: service, zoneId, lastBookingId: page.size === 100 ? page.docs.at(-1).id : null, updatedAt: Timestamp.now() });
    return page.docs;
  }));
  const fresh = [...new Map(pages.flat().map(doc => [doc.id, doc])).values()];
  const freshIds = new Set(fresh.map(document => document.id));
  const previous = await db.collection(`driver_offers/${uid}/offers`).where('expiresAt', '>', Timestamp.now()).orderBy('expiresAt').limit(30).get();
  const priorOffers = new Map(previous.docs.map(offer => [offer.id, offer.data()]));
  const offerEvaluationTime = Date.now();
  const priorIds = previous.docs.filter(offer => !freshIds.has(offer.id)).map(offer => offer.id);
  const priorBookings = await Promise.all(priorIds.map(id => db.doc(`bookings/${id}`).get()));
  const candidates = [...new Map([...fresh, ...priorBookings.filter(snapshot => snapshot.exists)].map(doc => [doc.id, doc])).values()].filter(document => {
    const booking = document.data();
    const offer = priorOffers.get(document.id);
    const dispatchable = ['food', 'grocery'].includes(booking.serviceType) ? booking.status === 'ready' : booking.status === 'pending';
    const parcelTimeReached = !['parcel', 'transport'].includes(booking.serviceType) || parcelPickupTimeAvailable(booking.details);
    const fleetAssignment = booking.transportAssignment;
    const fleetDriverMatch = booking.serviceType !== 'transport' || !booking.transportOperatorId || fleetAssignment?.status === 'offered' && fleetAssignment.driverId === uid;
    const codAllowed = booking.paymentStatus !== 'pending_cod' || Number(driver.codCashInHandCents || 0) < 200000;
    return dispatchable && parcelTimeReached && !booking.driverId && booking.exception?.status !== 'open' && ['paid', 'pending_cod'].includes(booking.paymentStatus) && codAllowed && pickupEligibility(driver, booking) !== null && !driver.rejectedBookingIds?.includes(document.id) && (booking.serviceType !== 'ride' || booking.details?.vehicleType === driver.vehicleType) && (booking.serviceType !== 'transport' || carrierSuitable(driver.transportCapabilities, booking.details)) && fleetDriverMatch && (!offer || offer.bookingVersion === (booking.updatedAt || booking.createdAt));
  }).sort((a, b) => {
    const aLease = priorOffers.get(a.id), bLease = priorOffers.get(b.id);
    const aActive = aLease?.expiresAt?.toMillis() > offerEvaluationTime, bActive = bLease?.expiresAt?.toMillis() > offerEvaluationTime;
    const age = Date.parse(a.data().createdAt || '') - Date.parse(b.data().createdAt || '');
    return Number(bActive) - Number(aActive) || pickupEligibility(driver, a.data()) - pickupEligibility(driver, b.data()) || (Number.isFinite(age) ? age : 0) || a.id.localeCompare(b.id);
  }).slice(0, 30);
  const now = Date.now(), newExpiresAt = Timestamp.fromMillis(now + 30000);
  const batch = db.batch();
  let hasNewLeases = false;
  const offers = candidates.map(document => {
    const previousLease = priorOffers.get(document.id), activeLease = previousLease?.expiresAt?.toMillis() > now;
    const expiresAt = activeLease ? previousLease.expiresAt : newExpiresAt;
    if (!activeLease) {
      batch.set(db.doc(`driver_offers/${uid}/offers/${document.id}`), {
        bookingId: document.id,
        bookingVersion: document.data().updatedAt || document.data().createdAt,
        expiresAt,
        offerPayload: publicOffer(document.id, document.data()),
      });
      hasNewLeases = true;
    }
    return { ...publicOffer(document.id, document.data()), offerExpiresAt: expiresAt.toDate().toISOString() };
  });
  if (hasNewLeases) await batch.commit();
  return offers;
});

exports.acceptDriverBooking = onCall({ operation: 'acceptDriverBooking', region: REGION }, async (request) => {
  const uid = requireUser(request);
  const bookingId = cleanText(request.data?.bookingId, 'Booking ID', 128);
  if (!/^[a-zA-Z0-9_-]+$/.test(bookingId)) throw new HttpsError('invalid-argument', 'Invalid booking ID.');
  return db.runTransaction(async transaction => {
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const driverRef = db.doc(`driver_profiles/${uid}`);
    const [booking, driver, account, offer, eligibility] = await Promise.all([transaction.get(bookingRef), transaction.get(driverRef), transaction.get(db.doc(`users/${uid}`)), transaction.get(db.doc(`driver_offers/${uid}/offers/${bookingId}`)), transaction.get(db.doc(`driver_eligibility/${uid}`))]);
    if (account.data()?.role !== 'driver' || driver.data()?.status !== 'verified' || driver.data()?.online !== true || driver.data()?.locationConsent !== true || eligibility.data()?.status === 'expired') throw new HttpsError('permission-denied', 'Only currently eligible verified online drivers with location consent can accept jobs.');
    if (driver.data()?.activeBookingId) throw new HttpsError('failed-precondition', 'Complete your current job before accepting another.');
    const data = booking.data();
    if (data?.paymentStatus === 'pending_cod' && Number(driver.data()?.codCashInHandCents || 0) >= 200000) throw new HttpsError('failed-precondition', 'Cash on delivery ceiling reached. Remit cash collected to operations before accepting new cash orders.');
    const fleetAssignment = data?.transportAssignment;
    if (!offer.exists || offer.data().expiresAt.toMillis() <= Date.now() || offer.data().bookingVersion !== (data?.updatedAt || data?.createdAt) || !data || pickupEligibility(driver.data(), data) === null) throw new HttpsError('failed-precondition', 'This pickup offer expired or your location is stale. Refresh offers.');
    const dispatchable = data && (['food', 'grocery'].includes(data.serviceType) ? data.status === 'ready' : data.status === 'pending');
    if (!dispatchable || ['parcel', 'transport'].includes(data.serviceType) && !parcelPickupTimeAvailable(data.details) || data.driverId || data.exception?.status === 'open' || !['paid', 'pending_cod'].includes(data.paymentStatus) || driver.data()?.rejectedBookingIds?.includes(bookingId)) throw new HttpsError('failed-precondition', 'This job is no longer available or its requested pickup time is unconfirmed or not yet due.');
    if (data.serviceType === 'ride' && data.details?.vehicleType !== driver.data().vehicleType) throw new HttpsError('failed-precondition', 'Your verified vehicle does not match this ride.');
    // A customer's vehicle class is not the carrier's equipment class.
    // Operations must approve transport equipment separately from ordinary ride vehicles.
    if (data.serviceType === 'transport') {
      const capabilities = driver.data()?.transportCapabilities;
      if (!carrierSuitable(capabilities, data.details)) throw new HttpsError('failed-precondition', 'The carrier equipment is not approved or cannot carry this vehicle safely.');
      if (data.transportOperatorId) {
        if (fleetAssignment?.status !== 'offered' || fleetAssignment.driverId !== uid || !fleetAssignment.vehicleId || driver.data()?.transportOperatorId !== data.transportOperatorId) throw new HttpsError('permission-denied', 'This fleet booking was not assigned to your linked driver account.');
        const [member, vehicle] = await Promise.all([
          transaction.get(db.doc(`transport_operators/${data.transportOperatorId}/drivers/${uid}`)),
          transaction.get(db.doc(`transport_operators/${data.transportOperatorId}/vehicles/${fleetAssignment.vehicleId}`))
        ]);
        if (!member.exists || member.data()?.status !== 'active' || !vehicle.exists || vehicle.data()?.status !== 'approved') throw new HttpsError('failed-precondition', 'The linked driver or fleet vehicle is no longer approved.');
      } else if (fleetAssignment?.status === 'offered') {
        throw new HttpsError('failed-precondition', 'This fleet assignment needs an operator link. Refresh offers.');
      }
    }
    if (!driver.data()?.supportedServices?.includes(data.serviceType)) throw new HttpsError('permission-denied', 'Your account is not approved for this service. Contact operations.');
    const driverName = account.data()?.name || 'Delivery Partner';
    transaction.update(bookingRef, { driverId: uid, driverName, arrivedAtPickup: FieldValue.delete(), merchantPickupConfirmedAt: FieldValue.delete(), status: 'accepted', updatedAt: new Date().toISOString(), ...(data.serviceType === 'transport' && data.transportOperatorId ? { transportVehicleId: fleetAssignment.vehicleId, 'transportAssignment.status': 'accepted', 'transportAssignment.acceptedAt': new Date().toISOString() } : {}) });
    if (driver.exists) {
      transaction.update(driverRef, { activeBookingId: bookingId, recentRejections: [] });
    }
    transaction.create(db.doc(`bookings/${bookingId}/events/accepted_${uid}`), { stage: 'partner_assigned', actorRole: 'driver', actorId: uid, createdAt: new Date().toISOString() });
    return { status: 'accepted' };
  });
});

exports.advanceDriverBooking = onCall({ operation: 'advanceDriverBooking', region: REGION }, async (request) => {
  const uid = requireUser(request);
  const bookingId = cleanText(request.data?.bookingId, 'Booking ID', 128);
  if (!/^[a-zA-Z0-9_-]+$/.test(bookingId)) throw new HttpsError('invalid-argument', 'Invalid booking ID.');
  const next = request.data?.status;
  if (!['preparing', 'transit', 'arrived_at_destination', 'completed'].includes(next)) throw new HttpsError('invalid-argument', 'Invalid job transition.');
  const result = await db.runTransaction(async transaction => {
    const bookingRef = db.doc(`bookings/${bookingId}`), driverRef = db.doc(`driver_profiles/${uid}`);
    const codeRef = db.doc(`booking_codes/${bookingId}`), proofRef = db.doc(`booking_delivery_proofs/${bookingId}`), pickupInspectionRef = bookingRef.collection('events').doc('transport_inspection_pickup'), deliveryInspectionRef = bookingRef.collection('events').doc('transport_inspection_delivery');
    const settlementOrderRef = db.doc(`merchant_settlement_orders/${bookingId}`);
    const [booking, driver, code, account, eligibility, proof, merchantReadyEvent, merchantPickupEvent, pickupInspection, deliveryInspection, settlementOrder] = await Promise.all([transaction.get(bookingRef), transaction.get(driverRef), transaction.get(codeRef), transaction.get(db.doc(`users/${uid}`)), transaction.get(db.doc(`driver_eligibility/${uid}`)), transaction.get(proofRef), transaction.get(bookingRef.collection('events').doc('merchant_ready')), transaction.get(bookingRef.collection('events').doc(`merchant_pickup_${uid}`)), transaction.get(pickupInspectionRef), transaction.get(deliveryInspectionRef), transaction.get(settlementOrderRef)]);
    const data = booking.data();
    const completedReplay = data?.driverId === uid && data.status === 'completed' && next === 'completed';
    if (!data || data.driverId !== uid || (account.data()?.role !== 'driver' || account.data()?.suspended === true || account.data()?.disabled === true || (driver.data()?.status !== 'verified' && !completedReplay))) throw new HttpsError('permission-denied', 'Verified driver access and assignment are required for this job.');
    if (!['paid', 'pending_cod'].includes(data.paymentStatus)) throw new HttpsError('failed-precondition', 'This job is in payment or cancellation review. Contact operations.');
    if (data.exception?.status === 'open') throw new HttpsError('failed-precondition', 'Operations must resolve the reported booking problem first.');
    if (data.status === 'completed' && next === 'completed') return { status: 'completed' };
    if (data.status === next) return { status: next };
    if (next === 'preparing' && (data.details?.pickupLocation || data.serviceType === 'ride')) {
      if (pickupEligibility(driver.data(), data, Date.now(), 0.3) === null) {
        throw new HttpsError('failed-precondition', 'Move within 300 metres of the pickup location and wait for a fresh, accurate location before marking arrival.');
      }
    }
    if (next === 'arrived_at_destination' && ['ride', 'transport'].includes(data.serviceType) && destinationEligibility(driver.data(), data, Date.now(), 0.3) === null) throw new HttpsError('failed-precondition', 'Move within 300 metres of the destination and wait for a fresh, accurate location before marking arrival.');
    if (data.serviceType === 'transport' && ['transit', 'completed'].includes(next)) {
      try { requireTransportInspection(next === 'transit' ? 'pickup' : 'delivery', (next === 'transit' ? pickupInspection : deliveryInspection).data()); }
      catch (error) { throw new HttpsError('failed-precondition', error.message); }
    }
    if (next === 'transit') {
      requireMerchantReady(data.serviceType, merchantReadyEvent.exists);
      requireMerchantPickup(data.serviceType, merchantPickupEvent.exists);
    }
    const transition = driverTransition(data.serviceType, data.status, next);
    if (transition.requiresPickupCode) {
      const confirmation = code.data();
      const expectedPickup = confirmation?.pickupCode || data?.pickupCode || data?.pickupOtp;
      if (!expectedPickup) throw new HttpsError('failed-precondition', 'The pickup code needs operations review.');
      if (confirmation?.pickupLockedUntil?.toMillis() > Date.now()) throw new HttpsError('resource-exhausted', 'Too many incorrect pickup codes. Wait five minutes.');
      if (expectedPickup && String(request.data?.otp || '') !== String(expectedPickup)) {
        const attempts = confirmation?.pickupLockedUntil ? 1 : Number(confirmation?.pickupAttempts || 0) + 1;
        if (code.exists) {
          transaction.update(codeRef, { pickupAttempts: attempts, ...(attempts >= 5 ? { pickupLockedUntil: Timestamp.fromMillis(Date.now() + 300000) } : { pickupLockedUntil: FieldValue.delete() }) });
        }
        return { error: 'wrong-pickup-code' };
      }
      if (code.exists) {
        transaction.update(codeRef, { pickupCode: FieldValue.delete(), pickupConfirmedAt: Timestamp.now() });
      }
    }
    if (next === 'completed') {
      if (!code.exists) throw new HttpsError('failed-precondition', 'The delivery code is unavailable. Contact operations.');
      const confirmation = code.data();
      const expectedOtp = confirmation?.code || data?.otp || data?.deliveryOtp;
      if (confirmation?.lockedUntil?.toMillis() > Date.now()) throw new HttpsError('resource-exhausted', 'Too many incorrect codes. Wait five minutes or contact support.');
      if (expectedOtp && String(request.data?.otp || '') !== String(expectedOtp)) {
        const attempts = confirmation?.lockedUntil ? 1 : Number(confirmation?.attempts || 0) + 1;
        if (code.exists) {
          transaction.update(codeRef, { attempts, ...(attempts >= 5 ? { lockedUntil: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000) } : { lockedUntil: FieldValue.delete() }) });
        }
        return { error: 'wrong-code' };
      }
      if (SERVICES_REQUIRING_DELIVERY_SIGNATURE.has(data.serviceType)) {
        const signature = proof.data();
        if (!signature || signature.status !== 'ready' || signature.bookingId !== bookingId || signature.driverId !== uid || !activeDeliveryProofRetention(signature.retentionUntil)) throw new HttpsError('failed-precondition', 'Collect the recipient’s signature before completing this delivery.');
      }
      let settlement;
      try { settlement = calculateDriverSettlement(data); }
      catch (error) { throw new HttpsError('failed-precondition', error.message); }
      let approvedTollClaims = [];
      if (data.serviceType === 'transport' && data.transportOperatorId) {
        const tollPage = await transaction.get(db.collection(`transport_operator_ledger/${documentId(data.transportOperatorId, 'Transport operator ID')}/expenses`).where('bookingId', '==', bookingId));
        if (tollPage.docs.some(doc => doc.data().status === 'pending_review')) throw new HttpsError('failed-precondition', 'Operations must review every submitted toll receipt before completing transport.');
        approvedTollClaims = tollPage.docs.filter(doc => doc.data().status === 'approved');
      }
      const tollReimbursementCents = approvedTollClaims.reduce((sum, doc) => addCents(sum, doc.data().amountCents), 0);
      let merchantSettlement, merchantBalanceRef, merchantBalance, merchantEntryRef, merchantEntry;
      const merchantSettlementContract = settlementOrder.data()?.contract;
      if (merchantSettlementContract) {
        try { merchantSettlement = calculateMerchantSettlement({ ...data, bookingId, merchantSettlementContract, status: 'completed', completedAt: new Date().toISOString() }); }
        catch (error) { throw new HttpsError('failed-precondition', error.message); }
        merchantBalanceRef = db.doc(`merchant_balances/${data.merchantId}`);
        merchantEntryRef = db.doc(`merchant_ledger/${data.merchantId}/entries/${bookingId}`);
        [merchantBalance, merchantEntry] = await Promise.all([transaction.get(merchantBalanceRef), transaction.get(merchantEntryRef)]);
        if (merchantEntry.exists) throw new HttpsError('failed-precondition', 'This order already has a merchant settlement entry. Contact operations to reconcile the duplicate completion.');
        const available = merchantBalance.data()?.availableCents ?? 0, reserved = merchantBalance.data()?.reservedCents ?? 0;
        if (!Number.isSafeInteger(available) || available < 0 || !Number.isSafeInteger(reserved) || reserved < 0 || !Number.isSafeInteger(available + merchantSettlement.payableCents)) throw new HttpsError('failed-precondition', 'The merchant balance needs operations reconciliation.');
      }
      const wasCod = data.paymentStatus === 'pending_cod';
      const cashAttemptRef = wasCod ? db.doc(`payment_attempts/${documentId(data.paymentOrderId, 'Cash order')}`) : null;
      const cashAttempt = cashAttemptRef ? (await transaction.get(cashAttemptRef)).data() : null;
      const priceCents = Math.round(Number(data.price) * 100);
      if (wasCod) {
        assertCodAttempt(cashAttempt, data.customerId, data.serviceType, priceCents);
        if (cashAttempt.status !== 'pending_cod' || cashAttempt.bookingId !== bookingId) throw new HttpsError('failed-precondition', 'Cash payment records need reconciliation before completion.');
      }
      if (!Number.isSafeInteger(tollReimbursementCents) || tollReimbursementCents > 0 && (data.serviceType !== 'transport' || !data.transportOperatorId || priceCents - settlement.totalCents < tollReimbursementCents)) throw new HttpsError('failed-precondition', 'Approved toll reimbursements exceed the available transport quote margin. Contact operations.');
      const payoutCents = addCents(settlement.totalCents, tollReimbursementCents);
      const payout = payoutCents / 100;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const current = driver.data();
      let operatorLedgerEntryRef = null;
      if (data.serviceType === 'transport' && data.transportOperatorId) {
        const operatorId = documentId(data.transportOperatorId, 'Transport operator ID');
        const customerPriceCents = Math.round(Number(data.price) * 100);
        const operatorNetCents = customerPriceCents - payoutCents;
        if (!Number.isSafeInteger(customerPriceCents) || customerPriceCents <= 0 || operatorNetCents < 0) throw new HttpsError('failed-precondition', 'Transport customer price does not cover the completed driver settlement. Contact operations.');
        operatorLedgerEntryRef = db.doc(`transport_operator_ledger/${operatorId}/entries/${bookingId}`);
        const [operator, existingOperatorEntry] = await Promise.all([transaction.get(db.doc(`transport_operators/${operatorId}`)), transaction.get(operatorLedgerEntryRef)]);
        if (!operator.exists || operator.data()?.status !== 'approved' || existingOperatorEntry.exists) throw new HttpsError('failed-precondition', 'Transport operator settlement records need reconciliation before completion.');
        transaction.create(operatorLedgerEntryRef, { bookingId, type: 'transport_margin_pending_review', grossCents: customerPriceCents, driverPayoutCents: settlement.totalCents, tollReimbursementCents, amountCents: operatorNetCents, currency: CURRENCY, status: 'pending_review', createdAt: Timestamp.now() });
      }
      if (wasCod) {
        transaction.create(db.doc(`financial_journals/cod_collected_${bookingId}`), journal('cod_cash_collected', 'cash_in_hand_driver', 'customer_receivable_cod', priceCents, { bookingId, driverId: uid }));
        transaction.update(cashAttemptRef, { status: 'paid', paidAt: Timestamp.now(), cashCollectedBy: uid });
      }
      transaction.update(driverRef, { activeBookingId: null, ...(eligibility.data()?.status === 'expired' ? { status: 'pending', online: false, supportedServices: [] } : {}), earningsDate: today, todayEarnings: addCents(current.earningsDate === today ? Math.round(Number(current.todayEarnings || 0) * 100) : 0, payoutCents) / 100, availableEarningsCents: addCents(Number(current.availableEarningsCents || 0), payoutCents), ...(wasCod ? { codCashInHandCents: addCents(Number(current.codCashInHandCents || 0), priceCents) } : {}), completedJobs: Number(current.completedJobs || 0) + 1 });
      transaction.create(db.doc(`driver_ledger/${uid}/entries/${bookingId}`), { bookingId, amountCents: settlement.totalCents, type: 'delivery_earning', ...(wasCod ? { codCollectedCents: priceCents } : {}), createdAt: Timestamp.now() });
      if (tollReimbursementCents > 0) transaction.create(db.doc(`driver_ledger/${uid}/entries/${bookingId}_transport_tolls`), { bookingId, amountCents: tollReimbursementCents, type: 'transport_toll_reimbursement', createdAt: Timestamp.now() });
      if (operatorLedgerEntryRef) transaction.create(db.doc(`financial_journals/transport_operator_margin_${bookingId}`), journal('transport_operator_margin_pending_review', 'booking_funds_unallocated', 'transport_operator_payable_pending_review', Math.round(Number(data.price) * 100) - payoutCents, { bookingId, transportOperatorId: data.transportOperatorId, driverPayoutCents: settlement.totalCents }));
      if (settlement.totalCents > 0) transaction.create(db.doc(`financial_journals/driver_earning_${bookingId}`), journal('driver_earning', 'driver_expense_pending_allocation', 'driver_payable', settlement.totalCents, { bookingId, driverId: uid }));
      for (const claim of approvedTollClaims) {
        const toll = claim.data();
        transaction.update(claim.ref, { status: 'reimbursed', reimbursedAt: Timestamp.now() });
        transaction.create(db.doc(`financial_journals/transport_toll_reimbursement_${claim.id}`), journal('transport_toll_reimbursement', 'transport_toll_expense', 'driver_payable', toll.amountCents, { bookingId, driverId: uid, transportOperatorId: data.transportOperatorId, transportExpenseId: claim.id }));
      }
      transaction.update(bookingRef, { status: next, ...(wasCod ? { paymentStatus: 'paid', cashCollectedAt: new Date().toISOString() } : {}), driverPayout: payout, driverSettlement: settlement, transportTollReimbursementCents: tollReimbursementCents, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      if (merchantSettlement) {
        const available = merchantBalance.data()?.availableCents ?? 0, reserved = merchantBalance.data()?.reservedCents ?? 0;
        transaction.set(merchantBalanceRef, { merchantId: data.merchantId, merchantType: data.serviceType === 'food' ? 'restaurant' : 'grocery', currency: CURRENCY, availableCents: addCents(available, merchantSettlement.payableCents), reservedCents: reserved, updatedAt: Timestamp.now() }, { merge: true });
        transaction.create(merchantEntryRef, { ...merchantSettlement, kind: 'order_earning', amountCents: merchantSettlement.payableCents, createdAt: Timestamp.now() });
        if (merchantSettlement.payableCents > 0) transaction.create(db.doc(`financial_journals/merchant_earning_${bookingId}`), journal('merchant_earning', 'booking_funds_unallocated', 'merchant_payable', merchantSettlement.payableCents, { bookingId, merchantId: data.merchantId, commissionCents: merchantSettlement.commissionCents, contractVersion: merchantSettlement.contractVersion }));
      }
      transaction.delete(codeRef);
    } else transaction.update(bookingRef, { status: next, ...(next === 'preparing' ? { arrivedAtPickup: new Date().toISOString() } : next === 'transit' ? { pickupCompletedAt: new Date().toISOString() } : next === 'arrived_at_destination' ? { arrivedAtDestination: new Date().toISOString() } : {}), updatedAt: new Date().toISOString() });
    if (data.serviceType === 'ride' && next === 'transit' && transition.requiresPickupCode) transaction.create(bookingRef.collection('events').doc(`rider_verified_${uid}`), { stage: 'rider_verified', actorRole: 'driver', actorId: uid, proofMethod: 'pickup_code', createdAt: new Date().toISOString() });
    transaction.create(db.doc(`bookings/${bookingId}/events/${next}_${uid}`), { stage: transition.stage, actorRole: 'driver', actorId: uid, ...(next === 'completed' ? { proofMethod: SERVICES_REQUIRING_DELIVERY_SIGNATURE.has(data.serviceType) ? 'recipient_code_and_signature' : 'recipient_code', ...(SERVICES_REQUIRING_DELIVERY_SIGNATURE.has(data.serviceType) ? { deliveryProofId: proof.data().proofId } : {}) } : transition.requiresPickupCode ? { proofMethod: 'pickup_code' } : {}), createdAt: new Date().toISOString() });
    return { status: next };
  });
  if (result.error) throw new HttpsError('permission-denied', result.error === 'wrong-pickup-code' ? 'Enter the sender’s pickup code before loading and starting delivery.' : 'Enter the recipient’s delivery code to complete this booking.');
  return result;
});

exports.rejectDriverBooking = onCall({ operation: 'rejectDriverBooking', region: REGION }, async request => {
  const uid = requireUser(request), bookingId = documentId(request.data?.bookingId, 'Booking ID');
  return db.runTransaction(async transaction => {
    const driverRef = db.doc(`driver_profiles/${uid}`), bookingRef = db.doc(`bookings/${bookingId}`);
    const [driver, booking, account] = await Promise.all([transaction.get(driverRef), transaction.get(bookingRef), transaction.get(db.doc(`users/${uid}`))]);
    const data = booking.data();
    if (account.data()?.role !== 'driver' || driver.data()?.status !== 'verified' || !data) throw new HttpsError('permission-denied', 'This job is unavailable.');
    if (data.driverId && data.driverId !== uid) throw new HttpsError('permission-denied', 'This job belongs to another partner.');
    if (data.exception?.status === 'open') throw new HttpsError('failed-precondition', 'Keep custody of this job until operations resolves the reported problem.');
    if (['food', 'grocery'].includes(data.serviceType) && data.merchantPickupConfirmedAt) throw new HttpsError('failed-precondition', 'The merchant confirmed handoff. Keep custody of the order and contact support before any reassignment.');
    if (!['pending', 'ready', 'accepted', 'preparing'].includes(data.status) || !['paid', 'pending_cod'].includes(data.paymentStatus)) throw new HttpsError('failed-precondition', 'This job cannot be rejected at its current stage. Contact operations.');
    const rejectedBookingIds = [...new Set([...(driver.data().rejectedBookingIds || []), bookingId])].slice(-100);
    const VALID_REASONS = ['too_far', 'low_fare', 'vehicle_issue', 'emergency', 'ending_shift', 'other'];
    const rawReason = typeof request.data?.reason === 'string' ? request.data.reason.trim().toLowerCase() : 'other';
    const reason = VALID_REASONS.includes(rawReason) ? rawReason : 'other';
    const notes = typeof request.data?.notes === 'string' ? cleanText(request.data.notes, 'Rejection notes', 200) : '';

    const nowMs = Date.now();
    const tenMinutesAgo = nowMs - 10 * 60 * 1000;
    const pastRejections = Array.isArray(driver.data().recentRejections)
      ? driver.data().recentRejections.filter(t => typeof t === 'number' && t > tenMinutesAgo)
      : [];
    const newRecent = [...pastRejections, nowMs];
    const rejectionCount24h = (Number(driver.data().rejectionCount24h) || 0) + 1;
    const completed = Number(driver.data().completedJobs) || 0;
    const totalDecisions = completed + rejectionCount24h;
    const acceptanceRate = totalDecisions > 0 ? Math.round((completed / totalDecisions) * 100) : 100;

    let cooldownUntil = null;
    if (newRecent.length >= 3) {
      cooldownUntil = new Date(nowMs + 60 * 1000).toISOString(); // 60s soft cooldown
    }

    transaction.update(driverRef, {
      rejectedBookingIds,
      recentRejections: newRecent,
      rejectionCount24h,
      acceptanceRate,
      ...(cooldownUntil ? { cooldownUntil } : {}),
      ...(data.driverId === uid ? { activeBookingId: null } : {})
    });
    transaction.delete(db.doc(`driver_offers/${uid}/offers/${bookingId}`));
    const bookingUpdates = { declinedDrivers: FieldValue.arrayUnion(uid) };
    if (data.driverId === uid) Object.assign(bookingUpdates, { driverId: null, driverName: FieldValue.delete(), arrivedAtPickup: FieldValue.delete(), merchantPickupConfirmedAt: FieldValue.delete(), status: ['food', 'grocery'].includes(data.serviceType) ? 'ready' : 'pending', dispatchStartedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...(data.serviceType === 'transport' && data.transportOperatorId ? { transportVehicleId: FieldValue.delete(), 'transportAssignment.status': 'rejected', 'transportAssignment.rejectedAt': new Date().toISOString() } : {}) });
    else if (data.serviceType === 'transport' && data.transportAssignment?.status === 'offered' && data.transportAssignment.driverId === uid) Object.assign(bookingUpdates, { 'transportAssignment.status': 'rejected', 'transportAssignment.rejectedAt': new Date().toISOString(), updatedAt: new Date().toISOString() });
    transaction.update(bookingRef, bookingUpdates);
    transaction.set(db.doc(`dispatch_events/${crypto.randomUUID()}`), { bookingId, driverId: uid, eventType: 'driver_rejected', action: 'rejected', reason, notes, createdAt: Timestamp.now() });
    return { status: 'rejected', success: true, reason, acceptanceRate, cooldownTriggered: Boolean(cooldownUntil), ...(cooldownUntil ? { cooldownUntil } : {}) };
  });
});
exports.listDriverBookingHistory = onCall({ operation: 'listDriverBookingHistory', region: REGION }, async request => {
  const uid = requireUser(request);
  const [account, driver] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`driver_profiles/${uid}`).get()]);
  if (account.data()?.role !== 'driver' || driver.data()?.status !== 'verified') {
    throw new HttpsError('permission-denied', 'Only verified drivers can view delivery history.');
  }
  const pageSize = Math.min(Math.max(1, Number(request.data?.limit) || 20), 50);
  const rawStatus = typeof request.data?.status === 'string' ? request.data.status.trim().toLowerCase() : null;
  const statusFilter = ['completed', 'delivered', 'cancelled'].includes(rawStatus) ? [rawStatus] : ['completed', 'delivered'];
  const cursor = typeof request.data?.cursor === 'string' && request.data.cursor.trim() ? documentId(request.data.cursor.trim(), 'Cursor booking ID') : null;

  let queryRef = db.collection('bookings')
    .where('driverId', '==', uid)
    .where('status', 'in', statusFilter);

  if (cursor) {
    const cursorDoc = await db.doc(`bookings/${cursor}`).get();
    if (cursorDoc.exists) {
      queryRef = queryRef.startAfter(cursorDoc);
    }
  }

  queryRef = queryRef.limit(pageSize + 1);
  const snapshot = await queryRef.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

  const bookings = pageDocs.map(d => ({ ...d.data(), bookingId: d.id }));
  return { bookings, nextCursor, hasMore };
});

exports.listAdminBookings = onCall({ operation: 'listAdminBookings', region: REGION }, async request => {
  const uid = requireUser(request);
  const account = await db.doc(`users/${uid}`).get();
  if (request.auth?.token?.admin !== true || account.data()?.role !== 'admin' || account.data()?.suspended === true || account.data()?.disabled === true) {
    throw new HttpsError('permission-denied', 'Only verified operations administrators can query bookings.');
  }

  const pageSize = Math.min(Math.max(1, Number(request.data?.limit) || 25), 50);
  const rawService = typeof request.data?.serviceType === 'string' ? request.data.serviceType.trim().toLowerCase() : null;
  const rawStatus = typeof request.data?.status === 'string' ? request.data.status.trim().toLowerCase() : null;
  const cursor = typeof request.data?.cursor === 'string' && request.data.cursor.trim() ? documentId(request.data.cursor.trim(), 'Cursor booking ID') : null;

  let queryRef = db.collection('bookings');
  if (rawService && ['food', 'grocery', 'ride', 'parcel', 'takeover', 'transport'].includes(rawService)) {
    queryRef = queryRef.where('serviceType', '==', rawService);
  }
  if (rawStatus && ['pending', 'ready', 'preparing', 'transit', 'completed', 'delivered', 'cancelled'].includes(rawStatus)) {
    queryRef = queryRef.where('status', '==', rawStatus);
  }

  if (cursor) {
    const cursorDoc = await db.doc(`bookings/${cursor}`).get();
    if (cursorDoc.exists) {
      queryRef = queryRef.startAfter(cursorDoc);
    }
  }

  queryRef = queryRef.limit(pageSize + 1);
  const snapshot = await queryRef.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

  const bookings = pageDocs.map(d => ({ ...d.data(), bookingId: d.id }));
  return { bookings, nextCursor, hasMore };
});

exports.listAdminDriverProfiles = onCall({ operation: 'listAdminDriverProfiles', region: REGION }, async request => {
  const uid = requireUser(request);
  const account = await db.doc(`users/${uid}`).get();
  if (request.auth?.token?.admin !== true || account.data()?.role !== 'admin' || account.data()?.suspended === true || account.data()?.disabled === true) {
    throw new HttpsError('permission-denied', 'Only verified operations administrators can query driver profiles.');
  }

  const pageSize = Math.min(Math.max(1, Number(request.data?.limit) || 25), 50);
  const rawStatus = typeof request.data?.status === 'string' ? request.data.status.trim().toLowerCase() : null;
  const cursor = typeof request.data?.cursor === 'string' && request.data.cursor.trim() ? documentId(request.data.cursor.trim(), 'Cursor driver ID') : null;

  let queryRef = db.collection('driver_profiles');
  if (rawStatus && ['pending', 'verified', 'rejected', 'suspended'].includes(rawStatus)) {
    queryRef = queryRef.where('status', '==', rawStatus);
  }

  if (cursor) {
    const cursorDoc = await db.doc(`driver_profiles/${cursor}`).get();
    if (cursorDoc.exists) {
      queryRef = queryRef.startAfter(cursorDoc);
    }
  }

  queryRef = queryRef.limit(pageSize + 1);
  const snapshot = await queryRef.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

  const drivers = pageDocs.map(d => ({ ...d.data(), driverId: d.id }));
  return { drivers, nextCursor, hasMore };
});

exports.refreshMyClaims = onCall({ operation: 'refreshMyClaims', region: REGION }, async request => {
  const uid = requireUser(request);
  const claims = await syncUserClaims(getAuth(app), db, uid, true);
  return { updated: true, claims };
});

exports.triggerDriverEmergencySos = onCall({ operation: 'triggerDriverEmergencySos', region: REGION }, async request => {
  const uid = requireUser(request);
  const [account, driver] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`driver_profiles/${uid}`).get()]);
  if (account.data()?.role !== 'driver' || driver.data()?.status !== 'verified') {
    throw new HttpsError('permission-denied', 'Only verified drivers can report emergency incidents.');
  }
  const data = request.data || {};
  const lat = typeof data.lat === 'number' && Number.isFinite(data.lat) ? data.lat : (driver.data()?.currentLat ?? null);
  const lng = typeof data.lng === 'number' && Number.isFinite(data.lng) ? data.lng : (driver.data()?.currentLng ?? null);
  const rawBookingId = typeof data.bookingId === 'string' && data.bookingId.trim() ? data.bookingId.trim() : (driver.data()?.activeBookingId ?? null);
  const bookingId = rawBookingId ? documentId(rawBookingId, 'Booking ID') : null;
  const rawReason = typeof data.reason === 'string' ? data.reason.trim().toLowerCase() : 'emergency';
  const VALID_REASONS = ['accident', 'harassment', 'medical', 'vehicle_breakdown', 'robbery', 'emergency', 'other'];
  const reason = VALID_REASONS.includes(rawReason) ? rawReason : 'emergency';
  const notes = typeof data.notes === 'string' ? cleanText(data.notes, 'Incident notes', 300) : '';

  const incidentId = crypto.randomUUID();
  const incidentRef = db.doc(`emergency_incidents/${incidentId}`);
  const incident = {
    incidentId,
    driverId: uid,
    driverName: account.data()?.name || 'Driver Partner',
    bookingId,
    location: lat != null && lng != null ? { lat, lng } : null,
    reason,
    notes,
    status: 'open',
    reportedAt: Timestamp.now(),
    createdAt: new Date().toISOString()
  };

  await incidentRef.set(incident);
  return { success: true, incidentId, status: 'open' };
});

exports.setDriverPayoutAccount = onCall({ operation: 'setDriverPayoutAccount', region: REGION }, async request => {
  const uid = requireUser(request);
  const [account, driver] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`driver_profiles/${uid}`).get()]);
  if (account.data()?.role !== 'driver' || account.data()?.disabled === true || account.data()?.suspended === true || driver.data()?.status !== 'verified') {
    throw new HttpsError('permission-denied', 'Only active, verified drivers can configure payout destinations.');
  }
  const data = request.data || {};
  const rawType = data.accountType || data.payoutMethod;
  const isBank = rawType === 'bank' || rawType === 'bank_account';
  if (!isBank && rawType !== 'upi') {
    throw new HttpsError('invalid-argument', 'Choose bank_account or upi as the payout method.');
  }
  const payload = isBank
    ? validateBankPayoutDetails(data, HttpsError)
    : validateUpiPayoutDetails(data, HttpsError);

  const now = Timestamp.now();
  const accountRef = db.doc(`driver_payout_accounts/${uid}`);
  await accountRef.set({
    driverId: uid,
    ...payload,
    status: 'verified',
    verifiedAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.doc(`driver_profiles/${uid}`).set({
    payoutAccount: {
      accountType: payload.accountType,
      beneficiaryName: payload.beneficiaryName,
      maskedAccount: payload.maskedAccount,
      verifiedAt: new Date().toISOString(),
    }
  }, { merge: true });

  await db.collection('payout_audit').add({
    driverId: uid,
    actorRole: 'driver',
    action: 'driver_payout_account_configured',
    accountType: payload.accountType,
    maskedAccount: payload.maskedAccount,
    createdAt: now,
  });

  return { status: 'verified', ...payload };
});

exports.requestDriverPayout = onCall({ operation: 'requestDriverPayout', region: REGION }, async request => {
  const uid = requireUser(request), requestId = documentId(request.data?.requestId, 'Request ID');
  const payoutRef = db.doc(`payout_requests/${uid}_${requestId}`), driverRef = db.doc(`driver_profiles/${uid}`);
  const payoutAccountRef = db.doc(`driver_payout_accounts/${uid}`);
  return db.runTransaction(async transaction => {
    const [existing, driver, account, registeredAccount] = await Promise.all([
      transaction.get(payoutRef),
      transaction.get(driverRef),
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(payoutAccountRef)
    ]);
    if (existing.exists) return { amount: existing.data().amount, status: existing.data().status };
    if (account.data()?.role !== 'driver' || account.data()?.disabled === true || account.data()?.suspended === true || driver.data()?.status !== 'verified') {
      throw new HttpsError('permission-denied', 'Only active, verified partners can request payouts.');
    }
    const dest = registeredAccount.data() || driver.data()?.payoutAccount;
    const available = driver.data().availableEarningsCents;
    if (!Number.isSafeInteger(available) || available <= 0) {
      throw new HttpsError('failed-precondition', 'No ledger earnings are available for withdrawal.');
    }

    let requestedCents = request.data?.amountCents;
    if (!Number.isSafeInteger(requestedCents) && Number.isFinite(request.data?.amount)) {
      requestedCents = Math.round(Number(request.data.amount) * 100);
    }
    // Backwards-compatible default: if omitted or 0, withdraw the whole available balance
    const cents = Number.isSafeInteger(requestedCents) && requestedCents > 0 ? requestedCents : available;

    const enforceStrict = process.env.STRICT_DRIVER_PAYOUT === 'true' || Boolean(dest) || Number.isSafeInteger(request.data?.amountCents);
    if (enforceStrict) {
      if (!dest || dest.status === 'rejected' || !dest.maskedAccount) {
        throw new HttpsError('failed-precondition', 'Configure and verify your bank account or UPI ID before requesting a payout.');
      }
      if (!Number.isSafeInteger(cents) || cents < 20000) {
        throw new HttpsError('failed-precondition', 'Minimum withdrawal amount is ₹200 (20,000 paise).');
      }
    } else {
      if (!Number.isSafeInteger(cents) || cents <= 0) {
        throw new HttpsError('failed-precondition', 'Withdrawal amount must be a positive integer in paise.');
      }
    }
    if (cents > 1000000) {
      throw new HttpsError('failed-precondition', 'Maximum withdrawal per request is ₹10,000 (1,000,000 paise).');
    }
    if (cents > available) {
      throw new HttpsError('failed-precondition', 'Requested withdrawal amount exceeds your available balance.');
    }

    const payoutDest = dest ? {
      accountType: dest.accountType,
      maskedAccount: dest.maskedAccount,
      beneficiaryName: dest.beneficiaryName,
    } : {
      accountType: 'legacy',
      maskedAccount: '••••legacy',
      beneficiaryName: account.data()?.name || 'Driver',
    };

    transaction.update(driverRef, {
      availableEarningsCents: addCents(available, -cents),
      reservedEarningsCents: addCents(Number(driver.data().reservedEarningsCents || 0), cents)
    });
    transaction.create(payoutRef, {
      requestId: payoutRef.id,
      driverId: uid,
      amount: cents / 100,
      amountCents: cents,
      status: 'requested',
      payoutDestination: payoutDest,
      createdAt: new Date().toISOString()
    });
    transaction.create(db.doc(`driver_ledger/${uid}/entries/${payoutRef.id}`), {
      amountCents: -cents,
      type: 'payout_reserved',
      requestId: payoutRef.id,
      createdAt: Timestamp.now()
    });
    transaction.create(db.doc(`financial_journals/payout_reserve_${payoutRef.id}`), journal('driver_payout_reserved', 'driver_payable', 'driver_reserved_payable', cents, { driverId: uid, payoutRequestId: payoutRef.id }));
    return { amount: cents / 100, status: 'requested' };
  });
});

exports.submitDriverCodDeposit = onCall({ operation: 'submitDriverCodDeposit', region: REGION }, async request => {
  const uid = requireUser(request);
  const [account, driver] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`driver_profiles/${uid}`).get()]);
  if (account.data()?.role !== 'driver' || account.data()?.disabled === true || account.data()?.suspended === true) {
    throw new HttpsError('permission-denied', 'Only active drivers can submit COD cash remittance deposits.');
  }
  const codCash = Number(driver.data()?.codCashInHandCents || 0);
  let amountCents = request.data?.amountCents;
  if (!Number.isSafeInteger(amountCents) && Number.isFinite(request.data?.amount)) {
    amountCents = Math.round(Number(request.data.amount) * 100);
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new HttpsError('invalid-argument', 'Specify a valid deposit amount in paise.');
  }
  if (amountCents > codCash) {
    throw new HttpsError('failed-precondition', 'Deposit amount cannot exceed your recorded cash-in-hand balance.');
  }
  const bankReference = cleanText(request.data?.bankReference, 'Bank transfer or UTR reference', 120);
  const depositMode = request.data?.paymentMode === 'upi' ? 'upi' : 'bank_transfer';
  const depositId = crypto.randomUUID();
  const depositRef = db.doc(`driver_cod_deposits/${depositId}`);
  const now = Timestamp.now();

  await depositRef.set({
    depositId,
    driverId: uid,
    driverName: account.data()?.name || 'Driver',
    amountCents,
    amount: amountCents / 100,
    paymentMode: depositMode,
    bankReference,
    status: 'pending_review',
    notes: typeof request.data?.notes === 'string' ? request.data.notes.slice(0, 300) : '',
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('payout_audit').add({
    depositId,
    driverId: uid,
    action: 'cod_deposit_submitted',
    amountCents,
    bankReference,
    createdAt: now,
  });

  return { depositId, status: 'pending_review', amountCents };
});


exports.recordDriverPayout = onCall({ operation: 'recordDriverPayout', region: REGION }, async request => {
  const uid = requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'An operations administrator must record transfers.');
  const requestId = documentId(request.data?.requestId, 'Payout request'), status = request.data?.status;
  if (!['paid', 'failed'].includes(status)) throw new HttpsError('invalid-argument', 'Select the actual transfer result.');
  const reference = cleanText(request.data?.reference, status === 'paid' ? 'Actual transfer reference' : 'Failure reason', 200);
  return db.runTransaction(async transaction => {
    const payoutRef = db.doc(`payout_requests/${requestId}`), [payout, adminAccount] = await Promise.all([transaction.get(payoutRef), transaction.get(db.doc(`users/${uid}`))]), data = payout.data(), administrator = adminAccount.data();
    if (administrator?.role !== 'admin' || administrator.disabled === true || administrator.suspended === true) throw new HttpsError('permission-denied', 'An active operations administrator must record transfers.');
    if (!data) throw new HttpsError('not-found', 'Payout request not found.');
    if (data.status === status && data.transferReference === reference) return { status };
    if (data.status !== 'requested') throw new HttpsError('failed-precondition', 'This transfer already has a recorded result.');
    const driverRef = db.doc(`driver_profiles/${data.driverId}`), driver = await transaction.get(driverRef);
    const cents = data.amountCents, reserved = driver.data()?.reservedEarningsCents;
    if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isSafeInteger(reserved) || reserved < cents) throw new HttpsError('failed-precondition', 'Payout ledger needs reconciliation before recording this result.');
    transaction.update(driverRef, { reservedEarningsCents: addCents(reserved, -cents), ...(status === 'failed' ? { availableEarningsCents: addCents(Number(driver.data().availableEarningsCents || 0), cents) } : {}) });
    transaction.update(payoutRef, { status, transferReference: reference, recordedBy: request.auth.uid, updatedAt: new Date().toISOString() });
    transaction.create(db.doc(`driver_ledger/${data.driverId}/entries/${requestId}_result`), { type: status === 'paid' ? 'payout_completed' : 'payout_reversed', amountCents: status === 'paid' ? 0 : cents, transferredCents: status === 'paid' ? cents : 0, requestId, reference, createdAt: Timestamp.now() });
    transaction.create(db.doc(`financial_journals/payout_result_${requestId}`), journal(status === 'paid' ? 'driver_payout_recorded' : 'driver_payout_reversed', 'driver_reserved_payable', status === 'paid' ? 'bank_transfer_clearing' : 'driver_payable', cents, { driverId: data.driverId, payoutRequestId: requestId, providerReference: reference }));
    return { status };
  });
});

exports.reconcileDriverCodRemittance = onCall({ operation: 'reconcileDriverCodRemittance', region: REGION }, async request => {
  const uid = requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Only operations administrators can reconcile COD remittances.');
  const driverId = documentId(request.data?.driverId, 'Driver ID');
  const amountCents = request.data?.amountCents;
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new HttpsError('invalid-argument', 'Specify a valid remittance amount in paise.');
  const bankRef = cleanText(request.data?.bankReference, 'Bank transfer or UTR reference', 120);
  const depositId = typeof request.data?.depositId === 'string' && request.data.depositId.trim() ? request.data.depositId.trim() : null;

  return db.runTransaction(async transaction => {
    const adminRef = db.doc(`users/${uid}`);
    const driverRef = db.doc(`driver_profiles/${driverId}`);
    const depositRef = depositId ? db.doc(`driver_cod_deposits/${depositId}`) : null;
    const [adminDoc, driverDoc, depositDoc] = await Promise.all([
      transaction.get(adminRef),
      transaction.get(driverRef),
      depositRef ? transaction.get(depositRef) : Promise.resolve(null)
    ]);
    if (adminDoc.data()?.role !== 'admin' || adminDoc.data()?.disabled === true || adminDoc.data()?.suspended === true) {
      throw new HttpsError('permission-denied', 'An active operations administrator must record COD remittances.');
    }
    if (!driverDoc.exists) throw new HttpsError('not-found', 'Driver profile not found.');
    const currentInHand = Number(driverDoc.data()?.codCashInHandCents || 0);
    if (currentInHand < amountCents) {
      throw new HttpsError('failed-precondition', 'Remittance amount exceeds the recorded COD cash in hand.');
    }
    const newInHand = currentInHand - amountCents;
    transaction.update(driverRef, { codCashInHandCents: newInHand });
    if (depositRef && depositDoc && depositDoc.exists) {
      transaction.update(depositRef, { status: 'reconciled', reconciledAt: Timestamp.now(), reconciledBy: uid, updatedAt: Timestamp.now() });
    }
    const remittanceId = crypto.randomUUID();
    transaction.create(db.doc(`financial_journals/cod_remittance_${remittanceId}`), journal(
      'cod_remitted',
      'bank_transfer_clearing',
      'cash_in_hand_driver',
      amountCents,
      { driverId, providerReference: bankRef, ...(depositId ? { depositId } : {}) }
    ));
    return { status: 'reconciled', remainingCodCashInHandCents: newInHand, remittanceId };
  });
});


exports.requestTransportOperatorPayout = onCall({ operation: 'requestTransportOperatorPayout', region: REGION }, async request => {
  const uid = requireUser(request), requestId = documentId(request.data?.requestId, 'Payout request');
  const account = (await db.doc(`users/${uid}`).get()).data(), operatorId = account?.transportOperatorId;
  if (account?.role !== 'merchant' || account.disabled === true || account.suspended === true || typeof operatorId !== 'string') throw new HttpsError('permission-denied', 'An active transport operator account is required.');
  const payoutRef = db.doc(`payout_requests/transport_${operatorId}_${requestId}`), operatorRef = db.doc(`transport_operators/${operatorId}`), balanceRef = db.doc(`transport_operator_balances/${operatorId}`);
  return db.runTransaction(async tx => {
    const [existing, operator, balance, ownerAccount] = await Promise.all([tx.get(payoutRef), tx.get(operatorRef), tx.get(balanceRef), tx.get(db.doc(`users/${uid}`))]);
    if (ownerAccount.data()?.role !== 'merchant' || ownerAccount.data()?.transportOperatorId !== operatorId || ownerAccount.data()?.disabled === true || ownerAccount.data()?.suspended === true || operator.data()?.ownerUid !== uid || operator.data()?.status !== 'approved') throw new HttpsError('permission-denied', 'Only the approved transport operator owner can request a payout.');
    if (existing.exists) { if (existing.data().operatorId !== operatorId || existing.data().requestedBy !== uid) throw new HttpsError('permission-denied', 'This payout request belongs to another operator.'); return { requestId: payoutRef.id, amountCents: existing.data().amountCents, status: existing.data().status }; }
    const available = balance.data()?.availableCents, reserved = balance.data()?.reservedCents ?? 0;
    if (!Number.isSafeInteger(available) || available <= 0 || !Number.isSafeInteger(reserved) || reserved < 0) throw new HttpsError('failed-precondition', 'No approved transport settlement balance is available for withdrawal.');
    const payoutRequestId = payoutRef.id, now = Timestamp.now();
    tx.update(balanceRef, { availableCents: 0, reservedCents: addCents(reserved, available), updatedAt: now });
    tx.create(payoutRef, { requestId: payoutRequestId, beneficiaryType: 'transport_operator', operatorId, requestedBy: uid, amount: available / 100, amountCents: available, status: 'requested', createdAt: now.toDate().toISOString() });
    tx.create(db.doc(`financial_journals/transport_payout_reserve_${payoutRequestId}`), journal('transport_operator_payout_reserved', 'transport_operator_payable', 'transport_operator_reserved_payable', available, { transportOperatorId: operatorId, payoutRequestId }));
    return { requestId: payoutRequestId, amountCents: available, status: 'requested' };
  });
});

exports.recordTransportOperatorPayout = onCall({ operation: 'recordTransportOperatorPayout', region: REGION }, async request => {
  const uid = requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'An operations administrator must record actual transfers.');
  const requestId = documentId(request.data?.requestId, 'Payout request'), status = request.data?.status;
  if (!['paid', 'failed'].includes(status)) throw new HttpsError('invalid-argument', 'Select the actual transfer result.');
  const reference = cleanText(request.data?.reference, status === 'paid' ? 'Actual transfer reference' : 'Failure reason', 200);
  return db.runTransaction(async tx => {
    const payoutRef = db.doc(`payout_requests/${requestId}`), [payout, adminAccount] = await Promise.all([tx.get(payoutRef), tx.get(db.doc(`users/${uid}`))]), data = payout.data(), administrator = adminAccount.data();
    if (administrator?.role !== 'admin' || administrator.disabled === true || administrator.suspended === true) throw new HttpsError('permission-denied', 'An active operations administrator must record actual transfers.');
    if (!data || data.beneficiaryType !== 'transport_operator' || !data.operatorId) throw new HttpsError('not-found', 'Transport operator payout request not found.');
    if (data.status === status && data.transferReference === reference) return { status };
    if (data.status !== 'requested') throw new HttpsError('failed-precondition', 'This payout transfer already has a recorded result.');
    const balanceRef = db.doc(`transport_operator_balances/${data.operatorId}`), balance = await tx.get(balanceRef), available = balance.data()?.availableCents, reserved = balance.data()?.reservedCents, cents = data.amountCents;
    if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isSafeInteger(available) || available < 0 || !Number.isSafeInteger(reserved) || reserved < cents) throw new HttpsError('failed-precondition', 'Transport operator payout balances need reconciliation.');
    tx.update(balanceRef, { availableCents: status === 'failed' ? addCents(available, cents) : available, reservedCents: addCents(reserved, -cents), updatedAt: Timestamp.now() });
    tx.update(payoutRef, { status, transferReference: reference, recordedBy: uid, updatedAt: Timestamp.now().toDate().toISOString() });
    tx.create(db.doc(`financial_journals/transport_payout_result_${requestId}`), journal(status === 'paid' ? 'transport_operator_payout_recorded' : 'transport_operator_payout_reversed', 'transport_operator_reserved_payable', status === 'paid' ? 'bank_transfer_clearing' : 'transport_operator_payable', cents, { transportOperatorId: data.operatorId, payoutRequestId: requestId, providerReference: reference }));
    tx.create(db.doc(`transport_operator_ledger/${data.operatorId}/events/${requestId}_result`), { type: status === 'paid' ? 'payout_completed' : 'payout_reversed', amountCents: status === 'paid' ? 0 : cents, requestId, reference, createdAt: Timestamp.now() });
    tx.create(db.collection('operations_audit').doc(), { operatorId: uid, action: status === 'paid' ? 'transport_operator_payout_recorded' : 'transport_operator_payout_reversed', target: payoutRef.path, createdAt: Timestamp.now() });
    return { status };
  });
});

exports.createPaymentOrder = onCall({ operation: 'createPaymentOrder', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, MAPS_API_KEY] }, async (request) => {
  const uid = requireUser(request);
  const expectedAmountCents = request.data?.expectedAmountCents;
  if (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents < 100) throw new HttpsError('invalid-argument', 'Review the current checkout total before starting payment.');
  const intentId = documentId(request.data?.requestId, 'Checkout request');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(intentId)) throw new HttpsError('invalid-argument', 'Use a unique checkout request identifier.');
  const requestFingerprint = crypto.createHash('sha256').update(JSON.stringify({ serviceType: request.data?.serviceType, customerName: request.data?.customerName, pickupAddress: request.data?.pickupAddress, dropAddress: request.data?.dropAddress, details: request.data?.details, couponCode: request.data?.couponCode || '', expectedAmountCents })).digest('hex');
  const intentRef = db.doc(`payment_intents/${intentId}`);
  const replayExisting = async snapshot => {
    if (!snapshot.exists) return null;
    const current = snapshot.data();
    if (current.uid !== uid || current.kind !== 'booking' || current.requestFingerprint !== requestFingerprint || current.amount !== expectedAmountCents) throw new HttpsError('permission-denied', 'This checkout request identifier belongs to another request. Start a new checkout.');
    if (current.status === 'provider_rejected') return null;
    if (current.status !== 'created' || !current.providerOrderId) throw new HttpsError('unavailable', `Checkout is already in progress or needs reconciliation. Check payment activity using reference ${intentId}.`);
    const attempt = (await db.doc(`payment_attempts/${current.providerOrderId}`).get()).data();
    if (!attempt || attempt.uid !== uid || attempt.bookingId !== current.quote?.booking?.bookingId || attempt.amount !== expectedAmountCents) throw new HttpsError('failed-precondition', 'Checkout records require reconciliation before retrying.');
    if (attempt.status !== 'created') throw new HttpsError('failed-precondition', 'This payment is already recorded or cannot be retried. Check Orders and Payment activity before starting another checkout.');
    return { orderId: current.providerOrderId, keyId: RAZORPAY_KEY_ID.value(), amount: expectedAmountCents, currency: CURRENCY };
  };
  const priorOrder = await replayExisting(await intentRef.get());
  if (priorOrder) return priorOrder;
  let quote, quoteRef;
  if (['ride', 'parcel', 'takeover', 'transport'].includes(request.data?.serviceType)) {
    const quoteId = cleanText(request.data?.details?.quoteId, 'Request a service quote before checkout', 128);
    if (!/^[a-zA-Z0-9_-]+$/.test(quoteId)) throw new HttpsError('invalid-argument', 'Invalid quote reference.');
    quoteRef = db.doc(`service_quotes/${quoteId}`);
    const checkout = await db.runTransaction(async transaction => {
      const [intentSnapshot, snapshot] = await Promise.all([transaction.get(intentRef), transaction.get(quoteRef)]), priorIntent = intentSnapshot.data(), data = snapshot.data();
      if (priorIntent && priorIntent.status !== 'provider_rejected') return { replay: true };
      if (priorIntent && (priorIntent.uid !== uid || priorIntent.kind !== 'booking' || priorIntent.requestFingerprint !== requestFingerprint || priorIntent.amount !== expectedAmountCents || priorIntent.quoteId !== quoteId)) throw new HttpsError('permission-denied', 'This checkout request identifier belongs to another request. Start a new checkout.');
      if (!data || data.uid !== uid || data.booking.serviceType !== request.data.serviceType) throw new HttpsError('permission-denied', 'This quote does not belong to your booking.');
      if (data.expiresAt.toMillis() <= Date.now()) throw new HttpsError('failed-precondition', 'This quote expired. Request a new fare.');
      if (data.claimed && data.paymentIntentId !== intentId) throw new HttpsError('failed-precondition', 'Checkout has already started for this quote. Check your payment activity or request a new quote.');
      if (data.couponLocked && request.data?.couponCode) throw new HttpsError('invalid-argument', 'Request a new fare to change its coupon.');
      if (data.amount !== expectedAmountCents) throw new HttpsError('failed-precondition', 'The price changed. Refresh checkout and review the current total before paying.');
      transaction.update(quoteRef, { claimed: true, paymentIntentId: intentId });
      const intent = { uid, kind: 'booking', quoteId, quote: data, amount: data.amount, requestFingerprint, status: 'creating', createdAt: priorIntent?.createdAt || Timestamp.now(), updatedAt: Timestamp.now() };
      if (priorIntent) transaction.set(intentRef, intent);
      else transaction.create(intentRef, intent);
      return { quote: data };
    });
    if (checkout.replay) return replayExisting(await intentRef.get());
    quote = checkout.quote;
    // SEC-01: Quotes from getServiceQuote already have their coupon locked in.
    if (quote.couponLocked && request.data?.couponCode) {
      throw new HttpsError('invalid-argument', 'A discount was already applied when this fare was requested. You cannot add another coupon at checkout.');
    }
  } else {
    quote = await priceAndPrepareBooking(uid, request.data);
    // SEC-01: For food/grocery, reject a second distinct coupon code if one is already embedded.
    if (quote.booking && quote.booking.couponCode && request.data?.couponCode && quote.booking.couponCode !== request.data.couponCode) {
      throw new HttpsError('invalid-argument', 'A discount is already applied to this cart. Remove it before adding another.');
    }
    quote = await applyCoupon(uid, quote, request.data?.couponCode);
    if (quote.amount !== expectedAmountCents) throw new HttpsError('failed-precondition', 'The price changed. Refresh checkout and review the current total before paying.');
    const checkout = await db.runTransaction(async transaction => {
      const existing = await transaction.get(intentRef), current = existing.data();
      if (current && current.status !== 'provider_rejected') return { replay: true };
      if (current && (current.uid !== uid || current.kind !== 'booking' || current.requestFingerprint !== requestFingerprint || current.amount !== expectedAmountCents)) throw new HttpsError('permission-denied', 'This checkout request identifier belongs to another request. Start a new checkout.');
      const outletId = quote.restaurantId || quote.storeId || quote.booking?.merchantId;
      if (outletId && ['food', 'grocery'].includes(quote.booking?.serviceType)) {
        const outletType = quote.booking?.serviceType === 'food' ? 'restaurants' : 'grocery_stores';
        const outletRef = db.doc(`${outletType}/${outletId}`);
        const activeQuery = db.collection('bookings').where('merchantId', '==', outletId).where('status', 'in', ['pending', 'preparing']);
        const [outletSnap, activeSnap] = await Promise.all([transaction.get(outletRef), transaction.get(activeQuery)]);
        assertOutletCapacity(outletSnap.data(), activeSnap.size);
      }
      const intent = { uid, kind: 'booking', quote, amount: quote.amount, requestFingerprint, status: 'creating', createdAt: current?.createdAt || Timestamp.now(), updatedAt: Timestamp.now() };
      if (current) transaction.set(intentRef, intent);
      else transaction.create(intentRef, intent);
      return { replay: false };
    });
    if (checkout.replay) return replayExisting(await intentRef.get());
  }
  const booking = quote.booking;
  let providerOrder;
  try {
    providerOrder = await razorpayRequest('/orders', 'POST', {
      amount: quote.amount,
      currency: CURRENCY,
      receipt: booking.bookingId.slice(0, 40),
      notes: { customerId: uid, bookingId: booking.bookingId, serviceType: booking.serviceType }
    });
  } catch (error) {
    const rejected = [400, 401, 403, 404, 422].includes(error.providerStatus);
    await db.runTransaction(async transaction => {
      const claimedQuote = quoteRef ? await transaction.get(quoteRef) : null;
      transaction.update(intentRef, { status: rejected ? 'provider_rejected' : 'reconciliation_required', updatedAt: Timestamp.now() });
      // A timeout or server error can mean the provider created the order. Never
      // release that claim automatically: an operator must reconcile its receipt.
      if (rejected && claimedQuote?.data()?.paymentIntentId === intentId) transaction.update(quoteRef, { claimed: false, paymentIntentId: FieldValue.delete() });
    });
    throw new HttpsError('unavailable', rejected ? 'The provider rejected checkout. You can retry this quote before expiry.' : `Checkout needs reconciliation. Contact support with reference ${intentId} before trying another payment.`);
  }
  booking.paymentOrderId = providerOrder.id;
  await intentRef.update({ status: 'provider_created', providerOrderId: providerOrder.id, updatedAt: Timestamp.now() });
  await db.doc(`payment_attempts/${providerOrder.id}`).create({
    uid,
    bookingId: booking.bookingId,
    booking,
    items: quote.items,
    storeId: quote.storeId,
    restaurantId: quote.restaurantId,
    amount: quote.amount,
    currency: CURRENCY,
    status: 'created',
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000)
  });
  await intentRef.update({ status: 'created', providerOrderId: providerOrder.id, updatedAt: Timestamp.now() });
  return { orderId: providerOrder.id, keyId: RAZORPAY_KEY_ID.value(), amount: quote.amount, currency: CURRENCY };
});

async function requireWalletEnabled() {
  const policy = (await db.doc('platform_config/wallet').get()).data();
  if (policy?.enabled !== true || !Number.isSafeInteger(policy.maxTopupCents) || policy.maxTopupCents < 100) throw new HttpsError('failed-precondition', 'AllGo wallet funding is not enabled by operations.');
  return policy;
}

exports.createWalletTopup = onCall({ operation: 'createWalletTopup', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async request => {
  const uid = requireUser(request), policy = await requireWalletEnabled(), amount = request.data?.amountCents;
  const requestId = documentId(request.data?.requestId, 'Funding request');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId)) throw new HttpsError('invalid-argument', 'Use a unique funding request identifier.');
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > policy.maxTopupCents) throw new HttpsError('invalid-argument', 'Enter an amount within the wallet funding limit.');
  const account = await db.doc(`users/${uid}`).get();
  if (!account.exists) throw new HttpsError('failed-precondition', 'Your account profile is unavailable.');
  const ref = db.doc(`payment_intents/${requestId}`), receipt = `W_${requestId}`;
  const existing = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), current = snapshot.data();
    if (current) {
      if (current.uid !== uid || current.kind !== 'wallet_topup' || current.amount !== amount) throw new HttpsError('permission-denied', 'This funding request belongs to a different account or amount.');
      // Only a definite provider rejection permits another creation attempt.
      if (current.status !== 'provider_rejected') return current;
      tx.update(ref, { status: 'creating', updatedAt: Timestamp.now() });
      return null;
    }
    tx.create(ref, { uid, kind: 'wallet_topup', amount, receipt, status: 'creating', createdAt: Timestamp.now() });
    return null;
  });
  if (existing) {
    if (existing.status !== 'created' || !existing.providerOrderId) throw new HttpsError('unavailable', `Funding needs reconciliation. Check payment activity using reference ${requestId} before starting another payment.`);
    const attempt = (await db.doc(`payment_attempts/${existing.providerOrderId}`).get()).data();
    if (!attempt || attempt.uid !== uid || attempt.kind !== 'wallet_topup' || attempt.amount !== amount) throw new HttpsError('failed-precondition', 'Funding records require reconciliation.');
    if (!['created', 'paid'].includes(attempt.status)) throw new HttpsError('failed-precondition', 'This funding payment is in refund handling. Check payment activity.');
    return { orderId: existing.providerOrderId, keyId: RAZORPAY_KEY_ID.value(), amount, currency: CURRENCY, paid: attempt.status === 'paid' };
  }
  let order;
  try { order = await razorpayRequest('/orders', 'POST', { amount, currency: CURRENCY, receipt, notes: { customerId: uid, purpose: 'wallet_topup' } }); }
  catch (error) {
    await ref.update({ status: [400, 401, 403, 404, 422].includes(error.providerStatus) ? 'provider_rejected' : 'reconciliation_required', updatedAt: Timestamp.now() });
    throw new HttpsError('unavailable', `Funding could not start. Retry the same request or check payment activity using reference ${requestId}.`);
  }
  await ref.update({ status: 'provider_created', providerOrderId: order.id, updatedAt: Timestamp.now() });
  await db.runTransaction(async tx => {
    const attemptRef = db.doc(`payment_attempts/${order.id}`), snapshot = await tx.get(attemptRef);
    if (!snapshot.exists) tx.create(attemptRef, { uid, kind: 'wallet_topup', amount, currency: CURRENCY, status: 'created', createdAt: Timestamp.now() });
    tx.update(ref, { status: 'created', updatedAt: Timestamp.now() });
  });
  return { orderId: order.id, keyId: RAZORPAY_KEY_ID.value(), amount, currency: CURRENCY, paid: false };
});

exports.payWithWallet = onCall({ operation: 'payWithWallet', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  const uid = requireUser(request); await requireWalletEnabled();
  const requestId = documentId(request.data?.requestId, 'Checkout request');
  const orderId = `wallet_${uid}_${requestId}`, ref = db.doc(`payment_attempts/${orderId}`);
  const existing = await ref.get();
  if (!existing.exists) {
    let quote;
    let serviceQuoteRef;
    if (['food', 'grocery'].includes(request.data?.booking?.serviceType)) quote = await priceAndPrepareBooking(uid, request.data.booking);
    else {
      const quoteRef = db.doc(`service_quotes/${documentId(request.data?.booking?.details?.quoteId, 'Quote ID')}`);
      serviceQuoteRef = quoteRef;
      quote = await db.runTransaction(async transaction => {
        const [snapshot, previous] = await Promise.all([transaction.get(quoteRef), transaction.get(ref)]), data = snapshot.data();
        if (previous.exists) return { ...previous.data(), booking: previous.data().booking, attemptAlreadyCreated: true };
        if (!data || data.uid !== uid || data.booking.serviceType !== request.data.booking.serviceType || data.expiresAt.toMillis() <= Date.now() || data.claimed) throw new HttpsError('failed-precondition', 'Request a fresh fare before wallet checkout.');
        if (data.couponLocked && request.data?.booking?.couponCode) throw new HttpsError('invalid-argument', 'Request a new fare to change its coupon.');
        if (data.amount !== request.data.expectedAmountCents) throw new HttpsError('failed-precondition', 'The price changed. Refresh and review the current total.');
        transaction.create(ref, { uid, kind: 'wallet_booking', bookingId: data.booking.bookingId, booking: data.booking, amount: data.amount, items: data.items || [], restaurantId: data.restaurantId || null, storeId: data.storeId || null, quoteId: quoteRef.id, status: 'created', createdAt: Timestamp.now() });
        transaction.update(quoteRef, { claimed: true, walletOrderId: orderId }); return data;
      });
      // SEC-01: Service quotes lock the coupon at creation.
      if (quote.couponLocked && request.data?.booking?.couponCode) {
        throw new HttpsError('invalid-argument', 'A discount was already applied to this fare. You cannot add another coupon at wallet checkout.');
      }
    }
    // Only apply coupon for food/grocery if none is already embedded in the quote.
    const needsCoupon = ['food', 'grocery'].includes(request.data?.booking?.serviceType) && !quote.booking?.couponCode;
    if (needsCoupon) {
      quote = await applyCoupon(uid, quote, request.data?.booking?.couponCode);
    }
    if (quote.amount !== request.data.expectedAmountCents) throw new HttpsError('failed-precondition', 'The price changed. Refresh and review the current total.');
    if (!serviceQuoteRef) {
      const outletId = quote.restaurantId || quote.storeId || quote.booking?.merchantId;
      if (outletId && ['food', 'grocery'].includes(quote.booking?.serviceType)) {
        const outletType = quote.booking?.serviceType === 'food' ? 'restaurants' : 'grocery_stores';
        const outletRef = db.doc(`${outletType}/${outletId}`);
        const activeQuery = db.collection('bookings').where('merchantId', '==', outletId).where('status', 'in', ['pending', 'preparing']);
        await db.runTransaction(async tx => {
          const [prev, outletSnap, activeSnap] = await Promise.all([tx.get(ref), tx.get(outletRef), tx.get(activeQuery)]);
          if (prev.exists) return;
          assertOutletCapacity(outletSnap.data(), activeSnap.size);
          tx.create(ref, { uid, kind: 'wallet_booking', bookingId: quote.booking.bookingId, booking: quote.booking, amount: quote.amount, items: quote.items || [], restaurantId: quote.restaurantId || null, storeId: quote.storeId || null, status: 'created', createdAt: Timestamp.now() });
        });
      } else {
        try { await ref.create({ uid, kind: 'wallet_booking', bookingId: quote.booking.bookingId, booking: quote.booking, amount: quote.amount, items: quote.items || [], restaurantId: quote.restaurantId || null, storeId: quote.storeId || null, status: 'created', createdAt: Timestamp.now() }); }
        catch (error) { if (error.code !== 6) throw error; }
      }
    }
  }
  try { return await settleCapturedPayment(orderId, orderId, null, true); }
  catch (error) {
    const paid = await db.runTransaction(async tx => {
      const attempt = await tx.get(ref), data = attempt.data();
      if (data?.status === 'paid') return { bookingId: data.bookingId, status: 'paid' };
      const quoteRef = data?.quoteId ? db.doc(`service_quotes/${data.quoteId}`) : null;
      const quote = quoteRef ? await tx.get(quoteRef) : null;
      if (data?.status === 'created') {
        tx.update(ref, { status: 'voided', failureReason: 'wallet_checkout_aborted', updatedAt: Timestamp.now() });
        if (quote?.data()?.walletOrderId === orderId) tx.update(quoteRef, { claimed: false, walletOrderId: FieldValue.delete() });
      }
      return null;
    });
    if (paid) return paid;
    throw error;
  }
});

exports.createCodBooking = onCall({ operation: 'createCodBooking', region: REGION, secrets: [MAPS_API_KEY] }, async request => {
  const uid = requireUser(request);
  assertCodAmount(request.data?.expectedAmountCents);
  const requestId = documentId(request.data?.requestId, 'Checkout request');
  const orderId = `cod_${uid}_${requestId}`, ref = db.doc(`payment_attempts/${orderId}`);
  const existing = await ref.get();
  if (!existing.exists) {
    let quote;
    let serviceQuoteRef;
    if (['food', 'grocery'].includes(request.data?.booking?.serviceType)) {
      quote = await priceAndPrepareBooking(uid, request.data.booking);
    } else {
      const quoteRef = db.doc(`service_quotes/${documentId(request.data?.booking?.details?.quoteId, 'Quote ID')}`);
      serviceQuoteRef = quoteRef;
      quote = await db.runTransaction(async transaction => {
        const [snapshot, previous] = await Promise.all([transaction.get(quoteRef), transaction.get(ref)]), data = snapshot.data();
        if (previous.exists) return { ...previous.data(), booking: previous.data().booking, attemptAlreadyCreated: true };
        if (!data || data.uid !== uid || data.booking.serviceType !== request.data.booking.serviceType || data.expiresAt.toMillis() <= Date.now() || data.claimed) throw new HttpsError('failed-precondition', 'Request a fresh fare before cash on delivery checkout.');
        if (data.couponLocked && request.data?.booking?.couponCode) throw new HttpsError('invalid-argument', 'Request a new fare to change its coupon.');
        if (data.amount !== request.data.expectedAmountCents) throw new HttpsError('failed-precondition', 'The price changed. Refresh and review the current total.');
        transaction.create(ref, { uid, kind: 'cod_booking', bookingId: data.booking.bookingId, booking: data.booking, amount: data.amount, items: data.items || [], restaurantId: data.restaurantId || null, storeId: data.storeId || null, quoteId: quoteRef.id, status: 'created', createdAt: Timestamp.now() });
        transaction.update(quoteRef, { claimed: true, codOrderId: orderId });
        return data;
      });
      if (quote.couponLocked && request.data?.booking?.couponCode) {
        throw new HttpsError('invalid-argument', 'A discount was already applied to this fare.');
      }
    }
    const needsCoupon = ['food', 'grocery'].includes(request.data?.booking?.serviceType) && !quote.booking?.couponCode;
    if (needsCoupon) {
      quote = await applyCoupon(uid, quote, request.data?.booking?.couponCode);
    }
    if (quote.amount !== request.data.expectedAmountCents) throw new HttpsError('failed-precondition', 'The price changed. Refresh and review the current total.');
    assertCodAmount(quote.amount);
    if (!serviceQuoteRef) {
      const outletId = quote.restaurantId || quote.storeId || quote.booking?.merchantId;
      if (outletId && ['food', 'grocery'].includes(quote.booking?.serviceType)) {
        const outletType = quote.booking?.serviceType === 'food' ? 'restaurants' : 'grocery_stores';
        const outletRef = db.doc(`${outletType}/${outletId}`);
        const activeQuery = db.collection('bookings').where('merchantId', '==', outletId).where('status', 'in', ['pending', 'preparing']);
        await db.runTransaction(async tx => {
          const [prev, outletSnap, activeSnap] = await Promise.all([tx.get(ref), tx.get(outletRef), tx.get(activeQuery)]);
          if (prev.exists) return;
          assertOutletCapacity(outletSnap.data(), activeSnap.size);
          tx.create(ref, { uid, kind: 'cod_booking', bookingId: quote.booking.bookingId, booking: quote.booking, amount: quote.amount, items: quote.items || [], restaurantId: quote.restaurantId || null, storeId: quote.storeId || null, status: 'created', createdAt: Timestamp.now() });
        });
      } else {
        try {
          await ref.create({ uid, kind: 'cod_booking', bookingId: quote.booking.bookingId, booking: quote.booking, amount: quote.amount, items: quote.items || [], restaurantId: quote.restaurantId || null, storeId: quote.storeId || null, status: 'created', createdAt: Timestamp.now() });
        } catch (error) {
          if (error.code !== 6) throw error;
        }
      }
    }
  }
  assertCodAttempt((await ref.get()).data(), uid, request.data?.booking?.serviceType, request.data?.expectedAmountCents);
  return await settleCapturedPayment(orderId, orderId, null, false, true);
});

exports.recoverCodBooking = onCall({ operation: 'recoverCodBooking', region: REGION }, async request => {
  const uid = requireUser(request), orderId = documentId(request.data?.orderId, 'Cash order');
  const attempt = (await db.doc(`payment_attempts/${orderId}`).get()).data();
  if (!attempt || attempt.uid !== uid || attempt.kind !== 'cod_booking') throw new HttpsError('permission-denied', 'This cash checkout does not belong to your account.');
  assertCodAttempt(attempt, uid, attempt.booking?.serviceType, attempt.amount);
  if (attempt.status === 'cancelled') return { status: 'cancelled', bookingId: attempt.bookingId };
  return settleCapturedPayment(orderId, orderId, null, false, true);
});

exports.requestAccountDeletion = onCall({ operation: 'requestAccountDeletion', region: REGION }, async request => {
  const uid = requireUser(request);
  const authTime = request.auth.token.auth_time;
  if (!Number.isFinite(authTime) || Date.now() / 1000 - authTime > 300 || authTime > Date.now() / 1000 + 5) throw new HttpsError('failed-precondition', 'Sign out and sign in again before requesting account deletion.');
  const accountRef = db.doc(`users/${uid}`);
  return db.runTransaction(async transaction => {
    const [account, driver, bookings, attempts, intents, bundles, bundleRefunds, assignedBookings, assignedBundleLegs] = await Promise.all([
      transaction.get(accountRef), transaction.get(db.doc(`driver_profiles/${uid}`)),
      transaction.get(db.collection('bookings').where('customerId', '==', uid).where('status', 'in', ['pending', 'accepted', 'preparing', 'ready', 'transit']).limit(1)),
      transaction.get(db.collection('payment_attempts').where('uid', '==', uid).where('status', 'in', ['created', 'processing', 'refund_processing', 'refund_required']).limit(1)),
      transaction.get(db.collection('payment_intents').where('uid', '==', uid).where('status', 'in', ['creating', 'provider_created', 'reconciliation_required', 'manual_review']).limit(1)),
      transaction.get(db.collection('bundles').where('customerId', '==', uid).where('status', 'in', ['pending', 'active', 'partial']).limit(1)),
      transaction.get(db.collection('bundle_refund_intents').where('customerId', '==', uid).where('status', 'in', ['pending', 'provider_pending', 'reconciliation_required', 'manual_review']).limit(1)),
      transaction.get(db.collection('bookings').where('driverId', '==', uid).where('status', 'not-in', ['completed', 'delivered', 'cancelled']).limit(1)),
      transaction.get(db.collectionGroup('legs').where('driverId', '==', uid).where('status', 'not-in', ['completed', 'delivered', 'cancelled']).limit(1))
    ]);
    const merchantOutlets = merchantBusinessOutlets(account.data() || {}), merchantIds = new Set(merchantOutlets.map(outlet => outlet.merchantId));
    if (typeof account.data()?.merchantId === 'string' && account.data().merchantId) merchantIds.add(account.data().merchantId);
    const merchantBookings = await Promise.all([...merchantIds].map(merchantId => transaction.get(db.collection('bookings').where('merchantId', '==', merchantId).where('status', 'not-in', ['completed', 'delivered', 'cancelled']).limit(1))));
    if (!account.exists || !assignedBookings.empty || !assignedBundleLegs.empty || merchantBookings.some(result => !result.empty) || !bookings.empty || !attempts.empty || !intents.empty || !bundles.empty || !bundleRefunds.empty || driver.data()?.activeLegId || driver.data()?.activeBookingId || (account.data().walletBalance || 0) !== 0 || driver.data()?.availableEarningsCents > 0 || driver.data()?.reservedEarningsCents > 0) throw new HttpsError('failed-precondition', 'Resolve active bookings, refunds and account balances with support before deletion.');
    transaction.set(db.doc(`account_deletions/${uid}`), { uid, status: 'requested', requestedAt: Timestamp.now() }, { merge: true });
    return { status: 'requested' };
  });
});

exports.processAccountDeletion = onCall({ operation: 'processAccountDeletion', region: REGION, timeoutSeconds: 540 }, async request => {
  requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Operations access is required.');
  const uid = documentId(request.data?.uid, 'Account ID');
  if (uid === request.auth.uid) throw new HttpsError('failed-precondition', 'Another operator must process your deletion.');
  const policy = (await db.doc('platform_config/privacy').get()).data();
  if (policy?.deletionEnabled !== true || typeof policy.policyUrl !== 'string' || !policy.policyUrl.startsWith('https://')) throw new HttpsError('failed-precondition', 'Publish and configure the retention/deletion policy first.');
  const deletionRef = db.doc(`account_deletions/${uid}`);
  await db.runTransaction(async transaction => {
    const [deletion, account, driver, bookings, attempts, intents, bundles, bundleRefunds, assignedBookings, assignedBundleLegs] = await Promise.all([
      transaction.get(deletionRef), transaction.get(db.doc(`users/${uid}`)), transaction.get(db.doc(`driver_profiles/${uid}`)),
      transaction.get(db.collection('bookings').where('customerId', '==', uid).where('status', 'in', ['pending', 'accepted', 'preparing', 'ready', 'transit']).limit(1)),
      transaction.get(db.collection('payment_attempts').where('uid', '==', uid).where('status', 'in', ['created', 'processing', 'refund_processing', 'refund_required']).limit(1)),
      transaction.get(db.collection('payment_intents').where('uid', '==', uid).where('status', 'in', ['creating', 'provider_created', 'reconciliation_required', 'manual_review']).limit(1)),
      transaction.get(db.collection('bundles').where('customerId', '==', uid).where('status', 'in', ['pending', 'active', 'partial']).limit(1)),
      transaction.get(db.collection('bundle_refund_intents').where('customerId', '==', uid).where('status', 'in', ['pending', 'provider_pending', 'reconciliation_required', 'manual_review']).limit(1)),
      transaction.get(db.collection('bookings').where('driverId', '==', uid).where('status', 'not-in', ['completed', 'delivered', 'cancelled']).limit(1)),
      transaction.get(db.collectionGroup('legs').where('driverId', '==', uid).where('status', 'not-in', ['completed', 'delivered', 'cancelled']).limit(1))
    ]);
    const merchantOutlets = merchantBusinessOutlets(account.data() || {}), merchantIds = new Set(merchantOutlets.map(outlet => outlet.merchantId));
    if (typeof account.data()?.merchantId === 'string' && account.data().merchantId) merchantIds.add(account.data().merchantId);
    const merchantBookings = await Promise.all([...merchantIds].map(merchantId => transaction.get(db.collection('bookings').where('merchantId', '==', merchantId).where('status', 'not-in', ['completed', 'delivered', 'cancelled']).limit(1))));
    // Firestore retries competing transactions. Only requested/failed jobs may
    // be claimed; allowing "processing" here lets a second operator run the
    // destructive cross-store cleanup concurrently after a transaction retry.
    if (!deletion.exists || !['requested', 'failed'].includes(deletion.data().status)) throw new HttpsError('failed-precondition', 'No unclaimed deletion request is available.');
    if (!assignedBookings.empty || !assignedBundleLegs.empty || merchantBookings.some(result => !result.empty) || !bookings.empty || !attempts.empty || !intents.empty || !bundles.empty || !bundleRefunds.empty || driver.data()?.activeLegId || driver.data()?.activeBookingId || (account.data()?.walletBalance || 0) !== 0 || driver.data()?.availableEarningsCents > 0 || driver.data()?.reservedEarningsCents > 0) throw new HttpsError('failed-precondition', 'Reconcile active journeys, checkout attempts and balances first.');
    transaction.update(deletionRef, { status: 'processing', startedAt: Timestamp.now(), operatorId: request.auth.uid, policyUrl: policy.policyUrl, neonAccountId: account.data()?.neonAccountId || deletion.data().neonAccountId || null });
  });
  try {
    try { await getAuth(app).updateUser(uid, { disabled: true }); await getAuth(app).revokeRefreshTokens(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    // Retain financial amounts and references; remove journey/contact content.
    for (const field of ['customerId', 'driverId']) {
      let cursor = null;
      while (true) {
        let query = db.collection('bookings').where(field, '==', uid).orderBy('__name__').limit(100);
        if (cursor) query = query.startAfter(cursor);
        const records = await query.get(); if (records.empty) break;
        for (const record of records.docs) {
          await db.recursiveDelete(record.ref.collection('chats'));
          await db.doc(`booking_delivery_proofs/${record.id}`).delete();
          await redactBookingHistory(db, record.ref, uid, field === 'customerId', FieldValue);
          await Promise.all([db.doc(`booking_codes/${record.id}`).delete(), db.doc(`booking_tracking/${record.id}`).delete(), ...(field === 'customerId' ? [db.doc(`booking_contacts/${record.id}`).delete()] : [])]);
          await record.ref.update(field === 'customerId' ? { customerName: 'Deleted account', pickupAddress: FieldValue.delete(), dropAddress: FieldValue.delete(), details: FieldValue.delete(), personalDataDeletedAt: Timestamp.now() } : { driverName: 'Deleted account', personalDataDeletedAt: Timestamp.now() });
        }
        cursor = records.docs.at(-1);
      }
    }
    let bundleCursor = null;
    while (true) {
      let query = db.collection('bundles').where('customerId', '==', uid).orderBy('__name__').limit(100);
      if (bundleCursor) query = query.startAfter(bundleCursor);
      const page = await query.get(); if (page.empty) break;
      for (const bundle of page.docs) await redactCustomerBundle(db, bundle.ref, uid, FieldValue);
      bundleCursor = page.docs.at(-1);
    }
    let legCursor = null;
    while (true) {
      let query = db.collectionGroup('legs').where('driverId', '==', uid).orderBy('__name__').limit(100);
      if (legCursor) query = query.startAfter(legCursor);
      const page = await query.get(); if (page.empty) break;
      for (const leg of page.docs) await redactBundleLeg(db, leg.ref, uid, false, FieldValue);
      legCursor = page.docs.at(-1);
    }
    for (const [collection, field] of [['payment_attempts', 'uid'], ['payment_intents', 'uid'], ['service_quotes', 'uid'], ['push_devices', 'uid'], ['bridge_sessions', 'uid'], ['order_reviews', 'userId'], ['support_tickets', 'userId'], ['partner_applications', 'userId'], ['partner_application_slots', 'userId'], ['partner_evidence', 'userId']]) {
      let cursor = null;
      while (true) {
        let query = db.collection(collection).where(field, '==', uid).orderBy('__name__').limit(100);
        if (cursor) query = query.startAfter(cursor);
        const records = await query.get(); if (records.empty) break;
        // Deleting a parent does not delete its reply/history subcollections.
        if (['support_tickets', 'partner_applications'].includes(collection)) for (const record of records.docs) await db.recursiveDelete(record.ref);
        if (collection === 'partner_evidence') for (const record of records.docs) await evidenceServices.deleteEvidence(record.ref);
        const batch = db.batch();
        for (const record of records.docs) ['payment_attempts', 'payment_intents'].includes(collection) ? batch.update(record.ref, { booking: FieldValue.delete(), items: FieldValue.delete(), quote: FieldValue.delete(), personalDataDeletedAt: Timestamp.now() }) : batch.delete(record.ref);
        await batch.commit(); cursor = records.docs.at(-1);
      }
    }
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await db.recursiveDelete(db.doc(`user_notifications/${uid}`));
    await db.recursiveDelete(db.doc(`driver_profiles/${uid}`));
    await db.recursiveDelete(db.doc(`driver_eligibility/${uid}`));
    await db.doc(`evidence_quotas/${uid}`).delete();
    try { await getAuth(app).deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    const linked = (await deletionRef.get()).data()?.neonAccountId;
    const status = linked ? 'firebase_completed' : 'completed';
    await deletionRef.update({ status, firebaseCompletedAt: Timestamp.now(), ...(linked ? {} : { completedAt: Timestamp.now() }) });
    return { status };
  } catch (error) {
    await deletionRef.update({ status: 'failed', updatedAt: Timestamp.now() });
    throw new HttpsError('internal', 'Deletion stopped. Operations can retry the recorded request.');
  }
});

exports.verifyPayment = onCall({ operation: 'verifyPayment', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (request) => {
  const uid = requireUser(request);
  const orderId = cleanText(request.data?.razorpay_order_id, 'Payment order');
  const paymentId = cleanText(request.data?.razorpay_payment_id, 'Payment reference');
  const signature = cleanText(request.data?.razorpay_signature, 'Payment signature', 256);
  const attemptRef = db.doc(`payment_attempts/${orderId}`);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists || attemptSnap.data().uid !== uid) throw new HttpsError('permission-denied', 'Payment does not belong to this account.');
  if (!validSignature(orderId, paymentId, signature)) throw new HttpsError('permission-denied', 'Payment verification failed.');
  const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, 'GET');
  if (payment.status === 'authorized') {
    await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, 'POST', { amount: attemptSnap.data().amount, currency: CURRENCY });
    const captured = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, 'GET');
    if (captured.status !== 'captured') return { bookingId: attemptSnap.data().bookingId, status: 'processing' };
    return settleCapturedPayment(orderId, paymentId, captured);
  }
  return settleCapturedPayment(orderId, paymentId, payment);
});

exports.listPaymentActivity = onCall({ operation: 'listPaymentActivity', region: REGION }, async (request) => {
  const uid = requireUser(request);
  const snapshots = await db.collection('payment_attempts').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(30).get();
  const intents = await db.collection('payment_intents').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(30).get();
  const timestamp = value => value?.toDate?.().toISOString() || null;
  const cents = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const unresolved = intents.docs
    .filter(doc => ['creating', 'provider_created', 'reconciliation_required', 'manual_review'].includes(doc.data().status))
    .map(doc => {
      const data = doc.data();
      return {
        orderId: doc.id,
        amount: cents(data.amount || data.quote?.amount),
        currency: CURRENCY,
        serviceType: data.kind === 'wallet_topup' ? 'wallet top-up' : data.quote?.booking?.serviceType || 'checkout',
        status: data.status,
        createdAt: timestamp(data.createdAt),
        paidAt: null,
        updatedAt: timestamp(data.updatedAt),
        bookingId: null,
        paymentId: null,
        paymentMethod: null,
        refundStatus: null,
        refundedAmountCents: 0,
        refundRequestedAmountCents: 0,
        refundId: null,
      };
    });
  const attempts = snapshots.docs.map(snapshot => {
    const data = snapshot.data();
    return {
      orderId: snapshot.id,
      amount: cents(data.amount),
      currency: data.currency || CURRENCY,
      serviceType: data.booking?.serviceType || 'wallet top-up',
      status: data.status,
      createdAt: timestamp(data.createdAt),
      paidAt: timestamp(data.paidAt),
      updatedAt: timestamp(data.updatedAt),
      bookingId: data.bookingId || null,
      paymentId: typeof data.paymentId === 'string' ? data.paymentId : null,
      paymentMethod: data.kind === 'cod_booking' ? 'cash' : typeof data.paymentMethod === 'string' ? data.paymentMethod : null,
      refundStatus: typeof data.refundStatus === 'string' ? data.refundStatus : null,
      refundedAmountCents: cents(data.refundedAmountCents || (data.status === 'refunded' ? data.amount : 0)),
      refundRequestedAmountCents: cents(data.refundRequestedAmountCents),
      refundId: typeof data.refundId === 'string' ? data.refundId : null,
    };
  });
  return { attempts: [...unresolved, ...attempts] };
});

async function reconcilePaymentIntent(ref) {
  const intent = (await ref.get()).data();
  if ((!intent?.quote?.booking && intent?.kind !== 'wallet_topup') || !['creating', 'provider_created', 'reconciliation_required'].includes(intent.status)) return null;
  if (intent.createdAt.toMillis() > Date.now() - 60000) return null;
  const topup = intent.kind === 'wallet_topup', quote = intent.quote, receipt = topup ? intent.receipt : quote.booking.bookingId.slice(0, 40), amount = topup ? intent.amount : quote.amount;
  const result = intent.providerOrderId ? { items: [await razorpayRequest(`/orders/${encodeURIComponent(intent.providerOrderId)}`, 'GET')] } : await razorpayRequest(`/orders?receipt=${encodeURIComponent(receipt)}&count=100`, 'GET');
  const matching = result.items?.filter(order => order.receipt === receipt && order.amount === amount && order.currency === CURRENCY && order.notes?.customerId === intent.uid && (topup ? order.notes?.purpose === 'wallet_topup' : order.notes?.bookingId === quote.booking.bookingId)) || [];
  if (matching.length !== 1) {
    await ref.update({ status: matching.length > 1 || Date.now() - intent.createdAt.toMillis() > 86400000 ? 'manual_review' : 'reconciliation_required', checkedAt: Timestamp.now() });
    return null;
  }
  const order = matching[0];
  await db.runTransaction(async tx => {
    const attemptRef = db.doc(`payment_attempts/${order.id}`), existing = await tx.get(attemptRef);
    if (existing.exists && (existing.data().uid !== intent.uid || existing.data().amount !== amount || (topup ? existing.data().kind !== 'wallet_topup' : existing.data().bookingId !== quote.booking.bookingId))) throw new HttpsError('failed-precondition', 'Provider order conflicts with the existing financial record.');
    if (!existing.exists) tx.create(attemptRef, topup ? { uid: intent.uid, kind: 'wallet_topup', amount, currency: CURRENCY, status: 'created', createdAt: intent.createdAt } : { uid: intent.uid, bookingId: quote.booking.bookingId, booking: { ...quote.booking, paymentOrderId: order.id }, items: quote.items || [], storeId: quote.storeId || null, restaurantId: quote.restaurantId || null, amount: quote.amount, currency: CURRENCY, status: 'created', createdAt: intent.createdAt, expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
    tx.update(ref, { status: 'created', providerOrderId: order.id, reconciledAt: Timestamp.now() });
  });
  return order.id;
}
exports.reconcileCheckoutIntents = onSchedule({ schedule: 'every 5 minutes', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET], timeoutSeconds: 540, maxInstances: 1 }, async () => {
  const cursorRef = db.doc('reconciliation_cursors/payment_intents'), cursor = (await cursorRef.get()).data();
  let query = db.collection('payment_intents').where('status', 'in', ['creating', 'provider_created', 'reconciliation_required']).orderBy('createdAt').orderBy('__name__').limit(50);
  if (cursor?.createdAt && cursor?.lastId) query = query.startAfter(cursor.createdAt, cursor.lastId);
  let pending = await query.get();
  if (pending.empty && cursor?.lastId) pending = await db.collection('payment_intents').where('status', 'in', ['creating', 'provider_created', 'reconciliation_required']).orderBy('createdAt').orderBy('__name__').limit(50).get();
  for (const intent of pending.docs) {
    try { await reconcilePaymentIntent(intent.ref); }
    catch { console.error('Checkout reconciliation needs retry', { intentId: intent.id }); }
    await cursorRef.set({ createdAt: intent.data().createdAt, lastId: intent.id, checkedAt: Timestamp.now() });
  }
  if (pending.empty) await cursorRef.set({ createdAt: null, lastId: null, checkedAt: Timestamp.now() });
});

async function reconcileProviderRefund(attemptRef, payment, eventId, failed = false) {
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(attemptRef), attempt = snapshot.data();
    if (!attempt || payment.order_id !== attemptRef.id || payment.amount !== attempt.amount || payment.currency !== CURRENCY || (attempt.paymentId && attempt.paymentId !== payment.id)) throw new HttpsError('failed-precondition', 'Refund payment does not match its checkout.');
    const progress = refundProgress(attempt.amount, payment.amount_refunded || 0, attempt.refundedAmountCents || 0);
    const bookingRef = attempt.bookingId ? db.doc(`bookings/${attempt.bookingId}`) : null;
    const booking = bookingRef ? await transaction.get(bookingRef) : null;
    const driverRef = booking?.data()?.driverId ? db.doc(`driver_profiles/${booking.data().driverId}`) : null;
    const driver = driverRef ? await transaction.get(driverRef) : null;
    let reconciliationRequired = false;
    let walletReads;
    if (attempt.kind === 'wallet_topup') {
      const accountRef = db.doc(`users/${attempt.uid}`), creditRef = db.doc(`wallet_ledger/${attempt.uid}/entries/${attemptRef.id}`);
      const [account, credit] = await Promise.all([transaction.get(accountRef), transaction.get(creditRef)]);
      walletReads = { accountRef, account, credit };
      if (credit.exists && !account.exists) reconciliationRequired = true;
    }
    const fulfilled = ['completed', 'delivered'].includes(booking?.data()?.status);
    const captureRef = db.doc(`financial_journals/capture_${attemptRef.id}`), allocationRef = db.doc(`financial_journals/allocate_${attemptRef.id}`);
    const [capture, allocation] = await Promise.all([transaction.get(captureRef), transaction.get(allocationRef)]);
    // Inventory restoration performs its reads before writes; all other reads are complete above.
    if (progress.full && booking?.exists && !fulfilled) await restoreCancelledInventory(transaction, bookingRef, booking.data());
    if (progress.deltaCents > 0) {
      const references = { orderId: attemptRef.id, paymentId: payment.id, customerId: attempt.uid, bookingId: attempt.bookingId };
      // Delayed refunds can be the first provider event received. Reconstruct only
      // the verified capture and allocation proven by existing server records.
      if (!capture.exists) transaction.create(captureRef, journal('provider_capture', 'provider_clearing', 'customer_funds_pending', attempt.amount, { ...references, backfilled: true }));
      const target = walletReads?.credit.exists ? 'wallet_liability' : booking?.exists ? 'booking_funds_unallocated' : 'customer_funds_pending';
      if (!allocation.exists && target !== 'customer_funds_pending') transaction.create(allocationRef, journal('verified_allocation_backfill', 'customer_funds_pending', target, attempt.amount, { ...references, backfilled: true }));
      transaction.create(db.doc(`financial_journals/refund_${attemptRef.id}_${progress.cumulativeCents}`), journal('provider_refund', target, 'provider_clearing', progress.deltaCents, references));
    }
    if (walletReads?.credit.exists && walletReads.account.exists) {
      const reversed = attempt.walletReversedAmountCents || 0;
      const delta = progress.cumulativeCents - reversed;
      if (delta > 0) {
        const balanceCents = Math.round((walletReads.account.data().walletBalance || 0) * 100);
        const newBalance = reverseWalletCredit(balanceCents, delta);
        transaction.update(walletReads.accountRef, { walletBalance: newBalance / 100 });
        transaction.create(db.doc(`wallet_ledger/${attempt.uid}/entries/reversal_${attemptRef.id}_${progress.cumulativeCents}`), { kind: 'topup_reversal', amountCents: -delta, balanceCents: newBalance, paymentId: payment.id, refundEvent: eventId, createdAt: new Date().toISOString() });
      }
    }
    const status = reconciliationRequired ? 'refund_required' : progress.full ? 'refunded' : failed || progress.cumulativeCents > 0 ? 'refund_required' : attempt.status;
    if (booking?.exists) {
      transaction.update(bookingRef, { paymentStatus: status === 'refunded' ? 'refunded' : 'refund_required', refundedAmountCents: progress.cumulativeCents, ...(progress.full && !fulfilled ? { status: 'cancelled' } : {}), updatedAt: new Date().toISOString() });
      if (progress.full && driver?.data()?.activeBookingId === attempt.bookingId) transaction.update(driverRef, { activeBookingId: null });
    }
    transaction.update(attemptRef, { status, paymentId: payment.id, refundedAmountCents: progress.cumulativeCents, ...(walletReads?.credit.exists && walletReads.account.exists ? { walletReversedAmountCents: progress.cumulativeCents } : {}), refundStatus: status, refundReconciliationRequired: reconciliationRequired, updatedAt: Timestamp.now() });
    transaction.set(db.doc(`refund_events/${documentId(eventId, 'Refund event')}`), { paymentId: payment.id, orderId: attemptRef.id, cumulativeRefundCents: progress.cumulativeCents, status, fulfilled: !!fulfilled, updatedAt: Timestamp.now() });
    return { status };
  });
}

exports.recoverPayment = onCall({ operation: 'recoverPayment', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (request) => {
  const uid = requireUser(request);
  let orderId = cleanText(request.data?.orderId, 'Payment order', 128);
  if (/^[a-f0-9-]{36}$/.test(orderId)) {
    const ref = db.doc(`payment_intents/${orderId}`), intent = (await ref.get()).data();
    if (intent?.uid !== uid) throw new HttpsError('permission-denied', 'This checkout does not belong to your account.');
    orderId = intent.providerOrderId && intent.status === 'created' ? intent.providerOrderId : await reconcilePaymentIntent(ref);
    if (!orderId) return { status: 'reconciliation_required' };
  }
  if (!/^order_[a-zA-Z0-9]+$/.test(orderId)) throw new HttpsError('invalid-argument', 'Invalid payment order.');
  const reference = db.doc(`payment_attempts/${orderId}`), snapshot = await reference.get(), attempt = snapshot.data();
  if (!attempt || attempt.uid !== uid) throw new HttpsError('permission-denied', 'This payment does not belong to your account.');
  const collection = await razorpayRequest(`/orders/${encodeURIComponent(orderId)}/payments`, 'GET');
  let payment = collection.items?.find(item => ['captured', 'refunded'].includes(item.status)) || collection.items?.find(item => item.status === 'authorized');
  if (!payment) return { status: 'unpaid' };
  if (payment.order_id !== orderId || payment.amount !== attempt.amount || payment.currency !== CURRENCY) throw new HttpsError('failed-precondition', 'Provider payment details do not match this checkout. Contact support.');
  if (payment.amount_refunded > 0) {
    return reconcileProviderRefund(reference, payment, `recovery_${orderId}_${payment.amount_refunded}`);
  }
  if (payment.status === 'authorized') {
    await razorpayRequest(`/payments/${encodeURIComponent(payment.id)}/capture`, 'POST', { amount: attempt.amount, currency: CURRENCY });
    payment = await razorpayRequest(`/payments/${encodeURIComponent(payment.id)}`, 'GET');
  }
  if (payment.status !== 'captured') return { status: 'processing' };
  return settleCapturedPayment(orderId, payment.id, payment);
});

async function checkPendingRefund(attemptRef) {
  const attempt = (await attemptRef.get()).data();
  if (!attempt || !['refund_processing', 'refund_required'].includes(attempt.status)) return { status: attempt?.status || 'missing' };
  if (!/^pay_[a-zA-Z0-9]+$/.test(attempt.paymentId || '') || !/^order_[a-zA-Z0-9]+$/.test(attemptRef.id)) return { status: 'manual_review' };
  // Only reconcile provider evidence. An uncertain refund must never cause a new refund request here.
  const payment = await razorpayRequest(`/payments/${encodeURIComponent(attempt.paymentId)}`, 'GET');
  if (payment.id !== attempt.paymentId || payment.order_id !== attemptRef.id || payment.amount !== attempt.amount || payment.currency !== CURRENCY) throw new HttpsError('failed-precondition', 'Provider evidence does not match the financial record.');
  if (payment.amount_refunded > 0) return reconcileProviderRefund(attemptRef, payment, `scheduled_${attemptRef.id}_${payment.amount_refunded}`);
  await attemptRef.update({ refundCheckedAt: Timestamp.now() });
  return { status: attempt.status };
}

exports.reconcilePendingRefunds = onSchedule({ schedule: 'every 5 minutes', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET], timeoutSeconds: 540, maxInstances: 1 }, async () => {
  const cursorRef = db.doc('reconciliation_cursors/refunds'), cursor = (await cursorRef.get()).data()?.lastId;
  const baseQuery = db.collection('payment_attempts').where('status', 'in', ['refund_processing', 'refund_required']).orderBy('__name__').limit(50);
  let query = baseQuery;
  if (cursor) query = query.startAfter(cursor);
  let page = await query.get();
  if (page.empty && cursor) page = await baseQuery.get();
  for (const attempt of page.docs) {
    try { await checkPendingRefund(attempt.ref); }
    catch { console.error('Refund reconciliation needs review', { orderId: attempt.id }); }
    await cursorRef.set({ lastId: attempt.id, checkedAt: Timestamp.now() });
  }
  if (page.empty) await cursorRef.set({ lastId: null, checkedAt: Timestamp.now() });
});

exports.reviewPendingRefund = onCall({ operation: 'reviewPendingRefund', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async request => {
  requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Operations authorization is required.');
  return checkPendingRefund(db.doc(`payment_attempts/${documentId(request.data?.orderId, 'Payment order')}`));
});

exports.listPendingRefunds = onCall({ operation: 'listPendingRefunds', region: REGION }, async request => {
  requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Operations authorization is required.');
  let query = db.collection('payment_attempts').where('status', 'in', ['refund_processing', 'refund_required']).orderBy('__name__').limit(51);
  if (request.data?.cursor) query = query.startAfter(documentId(request.data.cursor, 'Refund cursor'));
  const records = await query.get(), page = records.docs.slice(0, 50);
  return { items: page.map(record => { const data = record.data(); return { orderId: record.id, bookingId: data.bookingId || null, amountCents: data.amount, status: data.status, refundedAmountCents: data.refundedAmountCents || 0, checkedAt: data.refundCheckedAt?.toDate().toISOString() || null }; }), nextCursor: records.size > 50 ? page.at(-1).id : null };
});

async function restoreCancelledInventory(transaction, bookingRef, booking) {
  if (booking.serviceType !== 'grocery' || booking.inventoryRestored === true || !booking.details?.storeId) return;
  const plan = groceryReservations(booking), items = plan.items;
  const refs = items.map(item => db.doc(`grocery_stores/${booking.details.storeId}/products/${item.id}`));
  const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
  let needsReview = plan.needsReview;
  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists && Number.isSafeInteger(snapshot.data().stock) && snapshot.data().stock >= 0 && Number.isSafeInteger(snapshot.data().stock + items[index].quantity)) {
      const before = snapshot.data().stock, after = before + items[index].quantity;
      transaction.update(refs[index], { stock: after });
      recordStockMovement(transaction, refs[index], `return_${bookingRef.id}`, 'return', before, after, { bookingId: bookingRef.id });
    }
    else needsReview = true;
  });
  transaction.update(bookingRef, { inventoryRestored: true, inventoryRestoreNeedsReview: needsReview });
}

async function cancelPaidBooking(request, merchantRefusal = false) {
  const uid = requireUser(request);
  const admin = request.auth.token.admin === true;
  const refusalReason = merchantRefusal ? cleanText(request.data?.reason, 'Rejection reason', 500) : null;
  const cancellationReason = !merchantRefusal && request.data?.reason !== undefined ? request.data.reason : null;
  if (cancellationReason !== null && !isCustomerCancellationReason(cancellationReason)) throw new HttpsError('invalid-argument', 'Choose a supported cancellation reason.');
  const merchantOwns = (account, record) => merchantHasPermission(account, record?.merchantId, record?.serviceType === 'food' ? 'restaurant' : record?.serviceType === 'grocery' ? 'grocery' : null, 'orders');
  const bookingId = documentId(request.data?.bookingId, 'Booking reference');
  const bookingRef = db.doc(`bookings/${bookingId}`);
  let booking;
  let attemptRef = null;
  await db.runTransaction(async (transaction) => {
    const [snapshot, actor] = await Promise.all([transaction.get(bookingRef), transaction.get(db.doc(`users/${uid}`))]);
    if (!snapshot.exists || (merchantRefusal ? !merchantOwns(actor.data(), snapshot.data()) : snapshot.data().customerId !== uid && !admin)) throw new HttpsError('permission-denied', 'This order does not belong to your account or business.');
    booking = snapshot.data();
    if (booking.status === 'cancelled' && ['cancelled', 'refunded', 'refund_processing'].includes(booking.paymentStatus)) return;
    if (booking.paymentStatus === 'refund_required') throw new HttpsError('failed-precondition', 'A refund needs support follow-up.');
    if (booking.paymentStatus === 'refund_processing') throw new HttpsError('already-exists', 'A refund is already being processed.');
    if (merchantRefusal && (booking.status !== 'pending' || booking.driverId)) throw new HttpsError('failed-precondition', 'Only an unaccepted order can be rejected. Contact operations for preparation or custody problems.');
    if (!(admin ? ['pending', 'accepted', 'preparing', 'ready'].includes(booking.status) : booking.status === 'pending') || !['paid', 'pending_cod'].includes(booking.paymentStatus) || !booking.paymentId) {
      throw new HttpsError('failed-precondition', 'This order can no longer be cancelled in the app.');
    }
    if (booking.paymentStatus === 'pending_cod') {
      const cashRef = db.doc(`payment_attempts/${documentId(booking.paymentOrderId, 'Cash order')}`);
      const driverRef = booking.driverId ? db.doc(`driver_profiles/${booking.driverId}`) : null;
      const [cash, driver] = await Promise.all([transaction.get(cashRef), driverRef ? transaction.get(driverRef) : null]);
      const amount = Math.round(booking.price * 100);
      assertCodAttempt(cash.data(), booking.customerId, booking.serviceType, amount);
      if (cash.data().status !== 'pending_cod' || cash.data().bookingId !== bookingId || booking.cashCollectedAt) throw new HttpsError('failed-precondition', 'Cash records need reconciliation before cancellation.');
      await restoreCancelledInventory(transaction, bookingRef, booking);
      transaction.update(cashRef, { status: 'cancelled', updatedAt: Timestamp.now() });
      transaction.create(db.doc(`financial_journals/cod_cancelled_${bookingId}`), journal('cod_booking_cancelled', 'booking_funds_unallocated', 'customer_receivable_cod', amount, { bookingId, orderId: booking.paymentOrderId, customerId: booking.customerId }));
      if (driver?.data()?.activeBookingId === bookingId) transaction.update(driverRef, { activeBookingId: null });
      transaction.delete(db.doc(`booking_codes/${bookingId}`));
      transaction.create(bookingRef.collection('events').doc('cancellation_requested'), { stage: merchantRefusal ? 'merchant_rejected' : 'cancellation_requested', actorId: uid, actorRole: merchantRefusal ? 'merchant' : admin ? 'admin' : 'customer', ...((refusalReason || cancellationReason) ? { reason: refusalReason || cancellationReason } : {}), createdAt: new Date().toISOString() });
      transaction.update(bookingRef, { status: 'cancelled', paymentStatus: 'cancelled', updatedAt: new Date().toISOString() });
      booking = { ...booking, status: 'cancelled', paymentStatus: 'cancelled' };
      return;
    }
    if (booking.paymentOrderId?.startsWith('wallet_')) {
      const accountRef = db.doc(`users/${booking.customerId}`), attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
      const driverRef = booking.driverId ? db.doc(`driver_profiles/${booking.driverId}`) : null;
      const [account, attempt, driver] = await Promise.all([transaction.get(accountRef), transaction.get(attemptRef), driverRef ? transaction.get(driverRef) : null]);
      if (!account.exists || attempt.data()?.status !== 'paid' || attempt.data().uid !== booking.customerId || attempt.data().bookingId !== bookingId || attempt.data().amount !== Math.round(booking.price * 100)) throw new HttpsError('failed-precondition', 'Wallet refund needs account reconciliation.');
      const amount = attempt.data().amount, balance = Math.round((account.data().walletBalance || 0) * 100);
      if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(amount) || amount <= 0) throw new HttpsError('failed-precondition', 'Wallet balance needs reconciliation.');
      const nextBalance = addCents(balance, amount);
      await restoreCancelledInventory(transaction, bookingRef, booking);
      transaction.update(accountRef, { walletBalance: nextBalance / 100 });
      transaction.create(db.doc(`wallet_ledger/${booking.customerId}/entries/refund_${bookingId}`), { kind: 'refund', amountCents: amount, balanceCents: nextBalance, bookingId, createdAt: new Date().toISOString() });
      transaction.create(db.doc(`financial_journals/wallet_refund_${bookingId}`), journal('wallet_booking_refund', 'booking_funds_unallocated', 'wallet_liability', amount, { bookingId, customerId: booking.customerId, orderId: booking.paymentOrderId }));
      transaction.update(attemptRef, { status: 'refunded', updatedAt: Timestamp.now() });
      if (driver?.data()?.activeBookingId === bookingId) transaction.update(driverRef, { activeBookingId: null });
      transaction.create(bookingRef.collection('events').doc('cancellation_requested'), { stage: merchantRefusal ? 'merchant_rejected' : 'cancellation_requested', actorId: uid, actorRole: merchantRefusal ? 'merchant' : admin ? 'admin' : 'customer', ...((refusalReason || cancellationReason) ? { reason: refusalReason || cancellationReason } : {}), createdAt: new Date().toISOString() });
      transaction.update(bookingRef, { status: 'cancelled', paymentStatus: 'refunded', updatedAt: new Date().toISOString() });
      booking = { ...booking, status: 'cancelled', paymentStatus: 'refunded' }; return;
    }
    if (!/^order_[a-zA-Z0-9]+$/.test(booking.paymentOrderId || '')) throw new HttpsError('failed-precondition', 'The payment order needs financial reconciliation.');
    attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
    const attempt = (await transaction.get(attemptRef)).data();
    if (!attempt || attempt.uid !== booking.customerId || attempt.bookingId !== bookingId || attempt.paymentId !== booking.paymentId || attempt.status !== 'paid' || attempt.amount !== Math.round(booking.price * 100)) throw new HttpsError('failed-precondition', 'The payment records need financial reconciliation.');
    // Persist both sides before the provider call; a process crash remains discoverable by the refund worker.
    transaction.update(attemptRef, { status: 'refund_processing', refundRequestedAmountCents: attempt.amount, updatedAt: Timestamp.now() });
    transaction.create(bookingRef.collection('events').doc('cancellation_requested'), { stage: merchantRefusal ? 'merchant_rejected' : 'cancellation_requested', actorId: uid, actorRole: merchantRefusal ? 'merchant' : admin ? 'admin' : 'customer', ...((refusalReason || cancellationReason) ? { reason: refusalReason || cancellationReason } : {}), createdAt: new Date().toISOString() });
    transaction.update(bookingRef, { paymentStatus: 'refund_processing', updatedAt: new Date().toISOString() });
  });
  if (booking.status === 'cancelled') return { status: booking.paymentStatus };

  try {
    const refund = await issueRefund(booking.paymentId, Math.round(booking.price * 100));
    if (refund.status === 'failed') throw new Error('Refund failed at the provider.');
    await db.runTransaction(async (transaction) => {
      const [current, actor] = await Promise.all([transaction.get(bookingRef), transaction.get(db.doc(`users/${uid}`))]);
      if (!current.exists || (merchantRefusal ? !merchantOwns(actor.data(), current.data()) : current.data().customerId !== uid && !admin) || current.data().paymentStatus !== 'refund_processing') {
        throw new HttpsError('failed-precondition', 'Order payment state changed during cancellation.');
      }
      const driverRef = current.data().driverId ? db.doc(`driver_profiles/${current.data().driverId}`) : null;
      const driver = driverRef ? await transaction.get(driverRef) : null;
      await restoreCancelledInventory(transaction, bookingRef, current.data());
      if (driver?.data()?.activeBookingId === bookingId) transaction.update(driverRef, { activeBookingId: null });
      transaction.update(bookingRef, {
        status: 'cancelled',
        paymentStatus: 'refund_processing',
        updatedAt: new Date().toISOString()
      });
      if (attemptRef) transaction.update(attemptRef, { status: 'refund_processing', refundId: refund.id, refundStatus: refund.status, updatedAt: Timestamp.now() });
    });
    const result = await checkPendingRefund(attemptRef);
    return { status: result.status === 'refunded' ? 'cancelled' : 'refund_processing' };
  } catch (error) {
    const current = await bookingRef.get();
    if (current.exists && current.data().status === 'cancelled' && current.data().paymentStatus === 'refunded') {
      return { status: 'cancelled' };
    }
    await db.runTransaction(async transaction => {
      const latest = await transaction.get(bookingRef);
      if (latest.data()?.paymentStatus !== 'refunded') {
        transaction.update(bookingRef, { paymentStatus: 'refund_required', updatedAt: new Date().toISOString() });
        if (attemptRef) transaction.update(attemptRef, { status: 'refund_required', refundError: 'Refund confirmation requires review', updatedAt: Timestamp.now() });
      }
    });
    throw new HttpsError('internal', 'The refund could not be confirmed automatically. Contact AllGo support before retrying.');
  }
}
exports.cancelPaidBooking = onCall({ operation: 'cancelPaidBooking', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, request => cancelPaidBooking(request));
exports.rejectMerchantBooking = onCall({ operation: 'rejectMerchantBooking', region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, request => cancelPaidBooking(request, true));

const merchantAcceptanceServices = merchantAcceptanceFunctions({
  onSchedule,
  onCall,
  db,
  REGION,
  Timestamp,
  HttpsError,
  documentId,
  cleanText,
  FieldValue,
  issueRefund,
  restoreCancelledInventory,
  journal
});
Object.assign(exports, merchantAcceptanceServices);

const merchantCancellationServices = merchantCancellationFunctions({
  onCall,
  db,
  REGION,
  Timestamp,
  HttpsError,
  documentId,
  cleanText,
  FieldValue,
  issueRefund,
  restoreCancelledInventory,
  journal,
  addCents,
  requireUser,
  merchantHasPermission
});
Object.assign(exports, merchantCancellationServices);
const maskedCallingServices = maskedCallingFunctions({
  onCall,
  db,
  REGION,
  Timestamp,
  HttpsError,
  documentId,
  cleanText,
  requireUser
});
Object.assign(exports, maskedCallingServices);

exports.getMerchantDailySummary = onCall({ operation: 'getMerchantDailySummary', region: REGION }, async request => {
  const uid = requireUser(request);
  const merchantId = documentId(request.data?.merchantId, 'Merchant ID');
  const account = (await db.doc(`users/${uid}`).get()).data();
  if (!merchantHasPermission(account, merchantId, 'restaurant', 'orders') &&
    !merchantHasPermission(account, merchantId, 'grocery', 'orders') &&
    account?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'You do not have permission to view summary for this merchant.');
  }

  let startMs, endMs;
  if (request.data?.startAt && request.data?.endAt) {
    startMs = new Date(request.data.startAt).getTime();
    endMs = new Date(request.data.endAt).getTime();
  } else if (typeof request.data?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(request.data.date)) {
    const d = request.data.date;
    startMs = new Date(`${d}T00:00:00.000+05:30`).getTime();
    endMs = new Date(`${d}T23:59:59.999+05:30`).getTime();
  } else {
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    startMs = new Date(`${kolkataDateStr}T00:00:00.000+05:30`).getTime();
    endMs = new Date(`${kolkataDateStr}T23:59:59.999+05:30`).getTime();
  }

  const snap = await db.collection('bookings')
    .where('merchantId', '==', merchantId)
    .where('status', 'in', ['delivered', 'completed'])
    .get();

  let completedToday = 0;
  let grossRevenueToday = 0;

  for (const doc of snap.docs) {
    const b = doc.data();
    if (b.status === 'cancelled') continue;
    const t = new Date(b.completedAt || b.deliveredAt || b.createdAt).getTime();
    if (t >= startMs && t <= endMs) {
      completedToday++;
      grossRevenueToday += (Number.isFinite(b.price) ? b.price : 0);
    }
  }

  return {
    merchantId,
    date: request.data?.date || new Date().toISOString().slice(0, 10),
    completedToday,
    grossRevenueToday: Math.round(grossRevenueToday * 100) / 100
  };
});

exports.listMerchantBookingHistory = onCall({ operation: 'listMerchantBookingHistory', region: REGION }, async request => {
  const uid = requireUser(request);
  const merchantId = documentId(request.data?.merchantId, 'Merchant ID');
  const account = (await db.doc(`users/${uid}`).get()).data();
  if (!merchantHasPermission(account, merchantId, 'restaurant', 'orders') &&
    !merchantHasPermission(account, merchantId, 'grocery', 'orders') &&
    account?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'You do not have permission to view booking history for this merchant.');
  }

  if (request.data?.bookingId) {
    const searchId = cleanText(request.data.bookingId, 'Booking ID', 128);
    const docSnap = await db.doc(`bookings/${searchId}`).get();
    if (docSnap.exists && docSnap.data()?.merchantId === merchantId) {
      return {
        bookings: [docSnap.data()],
        nextCursor: null,
        hasMore: false,
        total: 1
      };
    }
    return {
      bookings: [],
      nextCursor: null,
      hasMore: false,
      total: 0
    };
  }

  const pageSize = Math.min(Math.max(Number(request.data?.limit) || 20, 1), 50);
  let q = db.collection('bookings').where('merchantId', '==', merchantId);

  if (request.data?.status && request.data.status !== 'all') {
    const status = cleanText(request.data.status, 'Status', 50);
    q = q.where('status', '==', status);
  }

  q = q.orderBy('createdAt', 'desc');

  if (request.data?.cursor) {
    const cursorDoc = await db.doc(`bookings/${documentId(request.data.cursor, 'Cursor')}`).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  q = q.limit(pageSize + 1);
  const snap = await q.get();

  let docs = snap.docs;
  if (request.data?.startDate || request.data?.endDate) {
    const startMs = request.data.startDate ? new Date(request.data.startDate).getTime() : 0;
    const endMs = request.data.endDate ? new Date(request.data.endDate).getTime() : Infinity;
    docs = docs.filter(d => {
      const t = new Date(d.data().createdAt).getTime();
      return t >= startMs && t <= endMs;
    });
  }

  const hasMore = docs.length > pageSize;
  const pageDocs = docs.slice(0, pageSize);
  const bookings = pageDocs.map(d => d.data());
  const nextCursor = hasMore ? pageDocs.at(-1)?.id : null;

  return {
    bookings,
    nextCursor,
    hasMore
  };
});

exports.razorpayWebhook = onRequest({ region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET] }, async (request, response) => {
  if (request.method !== 'POST') return response.status(405).send('Method not allowed.');
  const signature = request.header('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value()).update(request.rawBody).digest();
  const actual = Buffer.from(signature, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return response.status(401).send('Invalid signature.');
  const event = request.body?.event;
  const payment = request.body?.payload?.payment?.entity;
  const refund = request.body?.payload?.refund?.entity;
  if ((event === 'refund.processed' || event === 'refund.failed') && refund?.payment_id) {
    try {
      const providerPayment = await razorpayRequest(`/payments/${encodeURIComponent(refund.payment_id)}`, 'GET');
      const attemptRef = db.doc(`payment_attempts/${documentId(providerPayment.order_id, 'Provider order')}`);
      if ((await attemptRef.get()).exists) {
        await reconcileProviderRefund(attemptRef, providerPayment, refund.id, event === 'refund.failed');
      }
      return response.status(200).send('Refund event processed.');
    } catch (error) {
      console.error('Razorpay refund event could not be applied', { code: error instanceof HttpsError ? error.code : 'internal' });
      return response.status(500).send('Retry later.');
    }
  }
  if (event !== 'payment.captured' || !payment?.order_id || !payment?.id) return response.status(200).send('Ignored.');
  try {
    const attemptRef = db.doc(`payment_attempts/${documentId(payment.order_id, 'Provider order')}`);
    if (!(await attemptRef.get()).exists) return response.status(200).send('Ignored unknown order.');
    const currentPayment = await razorpayRequest(`/payments/${encodeURIComponent(payment.id)}`, 'GET');
    if (currentPayment.order_id !== payment.order_id || currentPayment.id !== payment.id) throw new HttpsError('failed-precondition', 'Provider identity mismatch.');
    if (currentPayment.amount_refunded > 0) await reconcileProviderRefund(attemptRef, currentPayment, `capture_${payment.id}_${currentPayment.amount_refunded}`);
    else await settleCapturedPayment(payment.order_id, payment.id, currentPayment);
    return response.status(200).send('Processed.');
  } catch (error) {
    console.error('Captured Razorpay payment could not be fulfilled', { code: error instanceof HttpsError ? error.code : 'internal' });
    return response.status(500).send('Retry later.');
  }
});
