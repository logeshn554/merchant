'use strict';

const crypto = require('node:crypto');
const { merchantHasPermission } = require('./merchantAccess');

const MASKED_CALL_VIRTUAL_NUMBER = '+918047485000';
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function maskedCallingFunctions({
  onCall,
  db,
  REGION,
  Timestamp,
  HttpsError,
  documentId,
  cleanText,
  requireUser
}) {
  const initiateMaskedCall = onCall({ operation: 'initiateMaskedCall', region: REGION }, async request => {
    const uid = requireUser(request);
    const bookingId = documentId(request.data?.bookingId, 'Booking reference');
    const recipientRole = cleanText(request.data?.recipientRole, 'Recipient role', 20).toLowerCase();

    if (!['customer', 'driver', 'merchant'].includes(recipientRole)) {
      throw new HttpsError('invalid-argument', 'Recipient role must be customer, driver, or merchant.');
    }

    const bookingRef = db.doc(`bookings/${bookingId}`);
    const [bookingSnap, accountSnap, profileSnap] = await Promise.all([
      bookingRef.get(),
      db.doc(`users/${uid}`).get(),
      db.doc(`driver_profiles/${uid}`).get()
    ]);

    if (!bookingSnap.exists) {
      throw new HttpsError('not-found', 'Booking not found.');
    }
    const booking = bookingSnap.data();
    const account = accountSnap.data();
    const driverProfile = profileSnap.data();

    if (['cancelled', 'completed', 'delivered'].includes(booking.status)) {
      throw new HttpsError('failed-precondition', `Calls are not available for ${booking.status} orders.`);
    }

    if (account?.suspended === true || account?.disabled === true) {
      throw new HttpsError('permission-denied', 'Account is suspended or disabled.');
    }

    // Determine caller role
    let callerRole = null;
    if (booking.customerId === uid) {
      callerRole = 'customer';
    } else if (booking.driverId === uid && account?.role === 'driver' && driverProfile?.status === 'verified') {
      callerRole = 'driver';
    } else if (merchantHasPermission(
      account,
      booking.merchantId,
      booking.serviceType === 'food' ? 'restaurant' : booking.serviceType === 'grocery' ? 'grocery' : null,
      'orders'
    )) {
      callerRole = 'merchant';
    } else if (account?.role === 'admin') {
      callerRole = 'admin';
    }

    if (!callerRole) {
      throw new HttpsError('permission-denied', 'Only active order participants can initiate privacy-protected calls.');
    }

    if (callerRole === recipientRole) {
      throw new HttpsError('invalid-argument', 'Cannot initiate a call to your own role.');
    }

    if (recipientRole === 'driver' && !booking.driverId) {
      throw new HttpsError('failed-precondition', 'No driver is currently assigned to this order.');
    }

    if (recipientRole === 'merchant' && !booking.merchantId) {
      throw new HttpsError('failed-precondition', 'This order is not associated with a merchant.');
    }

    const now = Date.now();
    const expiresAtMs = now + SESSION_EXPIRY_MS;
    const sessionId = `call_${bookingId}_${callerRole}_${recipientRole}_${crypto.randomBytes(4).toString('hex')}`;
    const sessionRef = db.doc(`masked_call_sessions/${sessionId}`);

    const sessionData = {
      sessionId,
      bookingId,
      callerUid: uid,
      callerRole,
      recipientRole,
      virtualNumber: MASKED_CALL_VIRTUAL_NUMBER,
      status: 'ready',
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      createdAt: Timestamp.fromMillis(now)
    };

    await sessionRef.set(sessionData);

    return {
      success: true,
      sessionId,
      virtualNumber: MASKED_CALL_VIRTUAL_NUMBER,
      callerRole,
      recipientRole,
      expiresInMinutes: 30
    };
  });

  return {
    initiateMaskedCall
  };
}

module.exports = {
  maskedCallingFunctions,
  MASKED_CALL_VIRTUAL_NUMBER
};
