'use strict';

const MIN_TIP_PAISE = 1000;    // ₹10 minimum tip
const MAX_TIP_PAISE = 50000;   // ₹500 maximum tip

/**
 * Validate customer tip input.
 * @param {number} amountPaise
 * @returns {{ valid: boolean, error?: string, amountPaise?: number }}
 */
function validateTipAmount(amountPaise) {
  if (!Number.isInteger(amountPaise)) {
    return { valid: false, error: 'Tip amount must be an integer in paise.' };
  }
  if (amountPaise < MIN_TIP_PAISE) {
    return { valid: false, error: `Minimum tip is ₹${MIN_TIP_PAISE / 100}.` };
  }
  if (amountPaise > MAX_TIP_PAISE) {
    return { valid: false, error: `Maximum tip is ₹${MAX_TIP_PAISE / 100} to protect against input errors.` };
  }
  return { valid: true, amountPaise };
}

/**
 * Build journal entry for driver tip.
 * 100% of tip is credited to the driver partner without commission deductions.
 * @param {object} params
 */
function buildTipJournalEntry({ bookingId, driverId, customerId, amountPaise, paymentIntentId }) {
  const validation = validateTipAmount(amountPaise);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  if (!bookingId || !driverId || !customerId) {
    throw new Error('bookingId, driverId, and customerId are required for tip journal entry.');
  }

  return {
    entryType: 'driver_tip',
    bookingId,
    driverId,
    customerId,
    amountPaise,
    platformFeePaise: 0,
    driverPayablePaise: amountPaise,
    paymentIntentId: paymentIntentId || null,
    currency: 'INR',
    description: `Customer tip for delivery #${bookingId}`,
    createdAt: new Date().toISOString()
  };
}

/**
 * Check if a booking is eligible for receiving a post-delivery or in-flight tip.
 * @param {object} booking
 */
function isBookingEligibleForTip(booking) {
  if (!booking) return { eligible: false, reason: 'Booking does not exist.' };
  if (booking.status === 'cancelled') {
    return { eligible: false, reason: 'Cancelled bookings cannot receive tips.' };
  }
  if (!booking.driverId) {
    return { eligible: false, reason: 'No driver is assigned to this booking yet.' };
  }
  return { eligible: true };
}

module.exports = {
  MIN_TIP_PAISE,
  MAX_TIP_PAISE,
  validateTipAmount,
  buildTipJournalEntry,
  isBookingEligibleForTip
};
