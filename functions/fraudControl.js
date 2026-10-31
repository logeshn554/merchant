'use strict';

const MAX_COD_ORDER_PAISE = 200000; // ₹2,000 COD limit per order
const MAX_REFUNDS_PER_24H = 3;
const MAX_REFUND_AMOUNT_24H_PAISE = 300000; // ₹3,000 max refunds in 24h
const MAX_FAILED_LOGINS_BEFORE_LOCKOUT = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * In-memory / cache store for account login failures (can be backed by Redis / Firestore in distributed cluster).
 */
const loginAttemptTracker = new Map();

/**
 * Record a login failure and determine if the account is throttled.
 * @param {string} email
 * @param {number} now
 * @returns {{ throttled: boolean, remainingCooldownMs?: number }}
 */
function recordLoginFailure(email, now = Date.now()) {
  const key = String(email).trim().toLowerCase();
  const existing = loginAttemptTracker.get(key) || { count: 0, lockedUntil: 0 };

  if (existing.lockedUntil > now) {
    return { throttled: true, remainingCooldownMs: existing.lockedUntil - now };
  }

  const nextCount = existing.count + 1;
  if (nextCount >= MAX_FAILED_LOGINS_BEFORE_LOCKOUT) {
    const lockedUntil = now + LOGIN_LOCKOUT_MS;
    loginAttemptTracker.set(key, { count: nextCount, lockedUntil });
    return { throttled: true, remainingCooldownMs: LOGIN_LOCKOUT_MS };
  }

  loginAttemptTracker.set(key, { count: nextCount, lockedUntil: 0 });
  return { throttled: false };
}

/**
 * Check if an email account is currently throttled before attempting auth.
 * @param {string} email
 * @param {number} now
 */
function isAccountThrottled(email, now = Date.now()) {
  const key = String(email).trim().toLowerCase();
  const existing = loginAttemptTracker.get(key);
  if (!existing || existing.lockedUntil <= now) {
    return false;
  }
  return true;
}

/**
 * Clear login failures on successful authentication.
 * @param {string} email
 */
function clearLoginFailures(email) {
  const key = String(email).trim().toLowerCase();
  loginAttemptTracker.delete(key);
}

/**
 * Validate Cash On Delivery (COD) limits.
 * @param {number} amountPaise
 */
function validateCodCeiling(amountPaise) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return { valid: false, error: 'COD amount must be a positive integer in paise.' };
  }
  if (amountPaise > MAX_COD_ORDER_PAISE) {
    return {
      valid: false,
      error: `Cash on Delivery is limited to ₹${MAX_COD_ORDER_PAISE / 100} per order. Please use digital payment.`
    };
  }
  return { valid: true };
}

/**
 * Enforce refund velocity limits for a customer.
 * @param {Array<{ amountPaise: number, createdAt: string }>} recentRefunds
 * @param {number} requestedRefundPaise
 * @param {number} now
 */
function validateRefundVelocity(recentRefunds, requestedRefundPaise, now = Date.now()) {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const cutoff = now - ONE_DAY_MS;

  const validPast = (recentRefunds || []).filter(r => {
    const time = new Date(r.createdAt).getTime();
    return time >= cutoff;
  });

  if (validPast.length >= MAX_REFUNDS_PER_24H) {
    return {
      allowed: false,
      error: `Maximum of ${MAX_REFUNDS_PER_24H} refunds permitted in a 24-hour window. Escalated to support review.`
    };
  }

  const pastTotalPaise = validPast.reduce((sum, r) => sum + (r.amountPaise || 0), 0);
  if (pastTotalPaise + requestedRefundPaise > MAX_REFUND_AMOUNT_24H_PAISE) {
    return {
      allowed: false,
      error: `Cumulative 24h refund limit of ₹${MAX_REFUND_AMOUNT_24H_PAISE / 100} exceeded. Escalated to finance review.`
    };
  }

  return { allowed: true };
}

module.exports = {
  MAX_COD_ORDER_PAISE,
  MAX_REFUNDS_PER_24H,
  MAX_REFUND_AMOUNT_24H_PAISE,
  recordLoginFailure,
  isAccountThrottled,
  clearLoginFailures,
  validateCodCeiling,
  validateRefundVelocity
};
