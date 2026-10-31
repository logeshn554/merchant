'use strict';

const SUPPORTED_SERVICES = ['food', 'grocery'];
const DEFAULT_DEADLINE_MINUTES = {
  food: 10,
  grocery: 15
};

function getMerchantAcceptanceDeadlineMinutes(policy, serviceType) {
  const configured = policy?.services?.[serviceType]?.deadlineMinutes;
  if (Number.isInteger(configured) && configured >= 1 && configured <= 120) {
    return configured;
  }
  return DEFAULT_DEADLINE_MINUTES[serviceType] || 10;
}

function validateMerchantAcceptanceInput({ service, deadlineMinutes, expectedVersion, reason, requestId }) {
  if (!SUPPORTED_SERVICES.includes(service)) {
    throw new Error('Choose a supported service: food or grocery.');
  }
  if (deadlineMinutes !== null && (!Number.isInteger(deadlineMinutes) || deadlineMinutes < 1 || deadlineMinutes > 120)) {
    throw new Error('Acceptance deadline must be between 1 and 120 minutes, or null to disable.');
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error('A valid expected policy version is required.');
  }
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
    throw new Error('A policy change reason of 1 to 500 characters is required.');
  }
  if (typeof requestId !== 'string' || !requestId.trim()) {
    throw new Error('A valid idempotency request ID is required.');
  }
  return {
    service,
    deadlineMinutes,
    expectedVersion,
    reason: reason.trim(),
    requestId: requestId.trim()
  };
}

function isOrderExpiredUnaccepted(booking, policy, nowMs = Date.now()) {
  if (!booking || booking.status !== 'pending') return false;
  if (!SUPPORTED_SERVICES.includes(booking.serviceType)) return false;
  if (booking.exception?.status === 'open') return false;

  const placedAtMs = booking.createdAt ? Date.parse(booking.createdAt) : NaN;
  if (!Number.isFinite(placedAtMs)) return false;

  const deadlineMinutes = getMerchantAcceptanceDeadlineMinutes(policy, booking.serviceType);
  const deadlineMs = deadlineMinutes * 60 * 1000;

  return (nowMs - placedAtMs) >= deadlineMs;
}

module.exports = {
  SUPPORTED_SERVICES,
  DEFAULT_DEADLINE_MINUTES,
  getMerchantAcceptanceDeadlineMinutes,
  validateMerchantAcceptanceInput,
  isOrderExpiredUnaccepted
};
