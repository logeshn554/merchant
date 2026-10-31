const { HttpsError } = require('firebase-functions/v2/https');

function assertOutletCapacity(outletData, activeCount) {
  const maxOrders = Number.isSafeInteger(outletData?.maxPreparationOrders) && outletData.maxPreparationOrders > 0
    ? outletData.maxPreparationOrders
    : 50;
  if (activeCount >= maxOrders) {
    throw new HttpsError('failed-precondition', 'This partner is currently busy and at capacity. Please try again shortly.');
  }
  return { maxPreparationOrders: maxOrders, activeCount };
}

module.exports = { assertOutletCapacity };
