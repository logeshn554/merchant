const { HttpsError } = require('firebase-functions/v2/https');

// These retain existing persisted statuses while making actor ownership explicit.
// Food/grocery preparation is merchant-owned; other services require arrival first.
const contracts = Object.freeze({
  food: { dispatch: 'ready', pickupProof: false },
  grocery: { dispatch: 'ready', pickupProof: false },
  homemade_food: { dispatch: 'ready', pickupProof: false },
  handmade: { dispatch: 'ready', pickupProof: false },
  ride: { dispatch: 'pending', pickupProof: true },
  takeover: { dispatch: 'pending', pickupProof: true },
  parcel: { dispatch: 'pending', pickupProof: true },
  transport: { dispatch: 'pending', pickupProof: true }
});
const orderContracts = Object.freeze({
  prepared_food: { productionStage: 'preparation', readyStage: 'ready' },
  grocery: { productionStage: 'picking', readyStage: 'packed' },
  made_to_order: { productionStage: 'production', readyStage: 'packed' },
  physical_product: { productionStage: 'packing', readyStage: 'packed' },
});
const fulfillmentMethods = new Set(['platform_delivery', 'seller_delivery', 'third_party_shipping', 'customer_pickup', 'scheduled_delivery', 'scheduled_pickup']);
const deliveryProviders = new Set(['allgo', 'seller', 'third_party', 'none']);

function orderContract(orderType, fulfillmentMethod, deliveryProvider = 'none') {
  const contract = orderContracts[orderType];
  if (!contract || !fulfillmentMethods.has(fulfillmentMethod) || !deliveryProviders.has(deliveryProvider)) throw new HttpsError('invalid-argument', 'The order and fulfillment contract is invalid.');
  if (fulfillmentMethod === 'customer_pickup' || fulfillmentMethod === 'scheduled_pickup') {
    if (deliveryProvider !== 'none') throw new HttpsError('invalid-argument', 'Pickup orders cannot use a delivery provider.');
  } else if (deliveryProvider === 'none') {
    throw new HttpsError('invalid-argument', 'A delivery or shipping method needs a provider.');
  }
  return { orderType, fulfillmentMethod, deliveryProvider, ...contract };
}
function contractFor(service) {
  const contract = contracts[service];
  if (!contract) throw new HttpsError('failed-precondition', 'Unknown service requires operations review.');
  return contract;
}
function driverTransition(service, current, next) {
  const contract = contractFor(service);
  const allowed = {
    preparing: ['accepted'],
    transit: ['preparing'],
    arrived_at_destination: ['ride', 'transport'].includes(service) ? ['transit'] : [],
    completed: ['ride', 'transport'].includes(service) ? ['arrived_at_destination'] : ['transit'],
  };
  if (!allowed[next]?.includes(current)) throw new HttpsError('failed-precondition', 'The order has changed. Refresh before continuing.');
  const stage = next === 'preparing' ? 'arrived_at_pickup'
    : next === 'transit' ? (service === 'ride' || service === 'takeover' ? 'trip_started' : 'picked_up')
      : next === 'arrived_at_destination' ? 'arrived_at_destination'
        : (service === 'ride' || service === 'takeover' ? 'trip_completed' : 'delivery_confirmed');
  return { stage, requiresPickupCode: next === 'transit' && contract.pickupProof };
}
function requireMerchantReady(service, readyEventExists) {
  if (['food', 'grocery', 'homemade_food', 'handmade'].includes(service) && !readyEventExists) {
    throw new HttpsError('failed-precondition', 'The merchant has not confirmed this order is ready for pickup.');
  }
}
function requireMerchantPickup(service, pickupEventExists) {
  if (['food', 'grocery', 'homemade_food', 'handmade'].includes(service) && !pickupEventExists) {
    throw new HttpsError('failed-precondition', 'The merchant must confirm the packed order was handed to you before delivery can start.');
  }
}
function merchantTransition(service, current, next) {
  contractFor(service);
  if (!['food', 'grocery', 'homemade_food', 'handmade'].includes(service) || !({ preparing: ['pending'], ready: ['preparing'] }[next]?.includes(current))) throw new HttpsError('failed-precondition', 'This merchant transition is not allowed.');
  if (service === 'food') return next === 'preparing' ? 'restaurant_preparing' : 'restaurant_ready';
  if (service === 'grocery') return next === 'preparing' ? 'store_picking' : 'store_packed';
  return next === 'preparing' ? 'seller_production' : 'seller_packed';
}
module.exports = { contractFor, driverTransition, merchantTransition, requireMerchantReady, requireMerchantPickup, orderContract };
