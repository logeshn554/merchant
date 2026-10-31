const crypto = require('node:crypto');

const SUPPORTED_ANALYTICS_EVENTS = [
  'order_created',
  'order_cancelled',
  'offer_dispatched',
  'offer_accepted',
  'offer_rejected',
  'trip_started',
  'trip_completed',
  'refund_requested',
  'refund_settled'
];

/**
 * Validates and formats an analytics event according to the AllGo BigQuery ingestion schema.
 */
function createAnalyticsEvent(eventType, payload = {}) {
  if (!SUPPORTED_ANALYTICS_EVENTS.includes(eventType)) {
    throw new Error(`Unsupported analytics event type: ${eventType}`);
  }
  if (!payload.bookingId || typeof payload.bookingId !== 'string') {
    throw new Error('Analytics event requires a valid bookingId.');
  }

  const timestamp = payload.timestamp || new Date().toISOString();
  const eventId = payload.eventId || crypto.randomUUID();
  const serviceType = payload.serviceType || 'unknown';
  const actorRole = payload.actorRole || 'system';
  const actorId = payload.actorId || 'system';
  const amountPaise = Number.isSafeInteger(payload.amountPaise) ? payload.amountPaise : 0;
  const geoZoneId = payload.geoZoneId || 'default';

  // Sanitize metadata to strip any sensitive customer PII before warehousing
  const sanitizedMetadata = {};
  if (payload.metadata && typeof payload.metadata === 'object') {
    for (const [key, value] of Object.entries(payload.metadata)) {
      if (['phone', 'email', 'otp', 'name', 'address'].includes(key.toLowerCase())) continue;
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        sanitizedMetadata[key] = value;
      }
    }
  }

  return {
    eventId,
    eventType,
    timestamp,
    bookingId: payload.bookingId,
    serviceType,
    actorId,
    actorRole,
    amountPaise,
    geoZoneId,
    metadata: sanitizedMetadata,
    schemaVersion: 1,
  };
}

/**
 * Calculates conversion funnel metrics across a sequence of booking events.
 */
function calculateFunnelMetrics(events = []) {
  const counts = {
    ordersCreated: 0,
    offersDispatched: 0,
    offersAccepted: 0,
    tripsStarted: 0,
    tripsCompleted: 0,
    ordersCancelled: 0,
  };

  for (const event of events) {
    if (event.eventType === 'order_created') counts.ordersCreated++;
    else if (event.eventType === 'offer_dispatched') counts.offersDispatched++;
    else if (event.eventType === 'offer_accepted') counts.offersAccepted++;
    else if (event.eventType === 'trip_started') counts.tripsStarted++;
    else if (event.eventType === 'trip_completed') counts.tripsCompleted++;
    else if (event.eventType === 'order_cancelled') counts.ordersCancelled++;
  }

  const offerConversionRate = counts.ordersCreated > 0
    ? (counts.offersAccepted / counts.ordersCreated) * 100
    : 0;

  const fulfillmentRate = counts.ordersCreated > 0
    ? (counts.tripsCompleted / counts.ordersCreated) * 100
    : 0;

  return {
    ...counts,
    offerConversionRate: Math.round(offerConversionRate * 10) / 10,
    fulfillmentRate: Math.round(fulfillmentRate * 10) / 10,
  };
}

/**
 * Evaluates ETA accuracy between estimated duration and recorded journey duration.
 */
function evaluateEtaAccuracy(estimatedMinutes, actualMinutes) {
  if (!Number.isFinite(estimatedMinutes) || !Number.isFinite(actualMinutes) || estimatedMinutes <= 0 || actualMinutes <= 0) {
    return { varianceMinutes: 0, accurateWithinThreshold: false };
  }
  const variance = Math.round((actualMinutes - estimatedMinutes) * 10) / 10;
  // Accurate if within ± 5 minutes of prediction
  const accurateWithinThreshold = Math.abs(variance) <= 5;
  return {
    estimatedMinutes,
    actualMinutes,
    varianceMinutes: variance,
    accurateWithinThreshold,
  };
}

module.exports = {
  SUPPORTED_ANALYTICS_EVENTS,
  createAnalyticsEvent,
  calculateFunnelMetrics,
  evaluateEtaAccuracy,
};
