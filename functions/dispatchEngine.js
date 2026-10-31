const { pickupEligibility, publicOffer, distanceKm } = require('./dispatchPolicy');
const { parcelPickupTimeAvailable } = require('./parcelPickupPolicy');
const { carrierSuitable } = require('./transportPolicy');
const { encodeGeohash, getGeohashNeighbors } = require('./locationGeo');

/**
 * Checks whether a booking is currently eligible for driver dispatch.
 */
function isBookingDispatchable(booking, now = Date.now()) {
  if (!booking) return false;
  if (booking.driverId) return false;
  if (booking.exception?.status === 'open') return false;
  if (!['paid', 'pending_cod'].includes(booking.paymentStatus)) return false;

  const isMerchantOrder = ['food', 'grocery'].includes(booking.serviceType);
  const correctStage = isMerchantOrder ? booking.status === 'ready' : booking.status === 'pending';
  if (!correctStage) return false;

  if (['parcel', 'transport'].includes(booking.serviceType)) {
    if (!parcelPickupTimeAvailable(booking.details, now)) return false;
  }
  return true;
}

/**
 * Validates whether a specific driver is eligible to receive this booking offer.
 */
function isDriverEligibleForBooking(driver, booking, now = Date.now()) {
  if (!driver || driver.status !== 'verified' || driver.online !== true || driver.locationConsent !== true) {
    return false;
  }
  if (driver.activeBookingId) return false;

  // Check cooldown
  if (driver.cooldownUntil) {
    const cd = Date.parse(driver.cooldownUntil);
    if (Number.isFinite(cd) && cd > now) return false;
  }

  // Check service match
  if (!driver.supportedServices?.includes(booking.serviceType)) return false;

  // Check rejection history
  if (driver.rejectedBookingIds?.includes(booking.bookingId || booking.id)) return false;

  // COD limit check: maximum ₹2,000 in hand (200,000 paise)
  if (booking.paymentStatus === 'pending_cod') {
    const codInHand = Number(driver.codCashInHandCents || 0);
    if (codInHand >= 200000) return false;
  }

  // Vehicle type match for rides and takeover
  if (booking.serviceType === 'ride' && booking.details?.vehicleType && driver.vehicleType !== booking.details.vehicleType) {
    return false;
  }

  // Transport carrier suitability
  if (booking.serviceType === 'transport' && !carrierSuitable(driver.transportCapabilities, booking.details)) {
    return false;
  }

  // Fleet operator matching for transport
  if (booking.serviceType === 'transport' && booking.transportOperatorId) {
    const assignment = booking.transportAssignment;
    const matched = assignment?.status === 'offered' && assignment.driverId === (driver.driverId || driver.uid);
    if (!matched) return false;
  }

  // Proximity check (must be within 10km of pickup)
  const distance = pickupEligibility(driver, booking, now);
  if (distance === null) return false;

  return true;
}

/**
 * Ranks eligible drivers for a booking based on proximity (distance/ETA) and fairness.
 */
function rankDriversForBooking(drivers, booking, now = Date.now()) {
  return [...drivers].sort((a, b) => {
    const distA = pickupEligibility(a, booking, now) ?? 999;
    const distB = pickupEligibility(b, booking, now) ?? 999;
    // Primary: closest driver
    if (Math.abs(distA - distB) > 0.5) {
      return distA - distB;
    }
    // Secondary: higher acceptance rate / performance
    const rateA = a.acceptanceRate ?? 100;
    const rateB = b.acceptanceRate ?? 100;
    if (rateA !== rateB) {
      return rateB - rateA;
    }
    // Tertiary: idle time (older location update or tie break)
    const idA = a.driverId || a.uid || '';
    const idB = b.driverId || b.uid || '';
    return idA.localeCompare(idB);
  });
}

/**
 * Server-authoritative matching and wave offer creation for a dispatchable booking.
 * Returns the list of driver IDs offered to.
 */
async function dispatchBookingWave(db, bookingId, Timestamp, options = {}) {
  const now = options.now || Date.now();
  const waveSize = options.waveSize || 3;
  const leaseDurationMs = options.leaseDurationMs || 30000;

  const bookingDoc = await db.doc(`bookings/${bookingId}`).get();
  if (!bookingDoc.exists) return { success: false, reason: 'Booking not found' };
  const booking = { id: bookingId, bookingId, ...bookingDoc.data() };

  if (!isBookingDispatchable(booking, now)) {
    return { success: false, reason: 'Booking is not dispatchable' };
  }

  // Check existing active wave
  const waveRef = db.doc(`dispatch_waves/${bookingId}`);
  const waveDoc = await waveRef.get();
  const waveData = waveDoc.exists ? waveDoc.data() : null;
  const currentWave = waveData?.wave || 0;
  const previouslyOffered = new Set(waveData?.offeredTo || []);

  // Fetch online verified drivers for this service
  const snapshot = await db.collection('driver_profiles')
    .where('online', '==', true)
    .where('status', '==', 'verified')
    .where('supportedServices', 'array-contains', booking.serviceType)
    .get();

  const allDrivers = snapshot.docs.map(doc => ({ uid: doc.id, driverId: doc.id, ...doc.data() }));

  // Filter eligible drivers who haven't already rejected or timed out in an earlier wave
  const eligible = allDrivers.filter(driver => {
    const uid = driver.driverId || driver.uid;
    if (previouslyOffered.has(uid)) return false;
    return isDriverEligibleForBooking(driver, booking, now);
  });

  if (eligible.length === 0) {
    return { success: false, reason: 'No eligible drivers available in wave' };
  }

  const ranked = rankDriversForBooking(eligible, booking, now);
  const selectedWave = ranked.slice(0, waveSize);
  const expiresAtMillis = now + leaseDurationMs;
  const expiresAtTimestamp = Timestamp.fromMillis(expiresAtMillis);
  const bookingVersion = booking.updatedAt || booking.createdAt || new Date(now).toISOString();

  const batch = db.batch();
  const selectedUids = [];

  for (const driver of selectedWave) {
    const uid = driver.driverId || driver.uid;
    selectedUids.push(uid);
    const offerRef = db.doc(`driver_offers/${uid}/offers/${bookingId}`);
    batch.set(offerRef, {
      bookingId,
      bookingVersion,
      serviceType: booking.serviceType,
      expiresAt: expiresAtTimestamp,
      wave: currentWave + 1,
      createdAt: Timestamp.fromMillis(now),
      offerPayload: publicOffer(bookingId, booking),
    });
  }

  // Update dispatch wave tracking
  batch.set(waveRef, {
    bookingId,
    wave: currentWave + 1,
    offeredTo: [...previouslyOffered, ...selectedUids],
    currentWaveDrivers: selectedUids,
    expiresAt: expiresAtTimestamp,
    updatedAt: Timestamp.fromMillis(now),
  }, { merge: true });

  await batch.commit();

  return {
    success: true,
    wave: currentWave + 1,
    offeredTo: selectedUids,
    expiresAt: new Date(expiresAtMillis).toISOString(),
  };
}

module.exports = {
  isBookingDispatchable,
  isDriverEligibleForBooking,
  rankDriversForBooking,
  dispatchBookingWave,
};
