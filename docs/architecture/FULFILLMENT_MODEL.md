# Fulfillment Model

Status: contract foundation implemented; vertical transitions pending
Date: 2026-11-01

## Separate Dimensions

- Order acceptance: seller accepts or rejects.
- Preparation/production: seller makes, picks, or produces the order.
- Packing: seller packages the order.
- Ready: seller confirms handover eligibility.
- Assignment: a delivery or shipping provider is selected.
- Pickup/handover: custody changes with proof where required.
- Transit: provider is moving the order.
- Receipt: customer or authorized recipient confirms delivery/pickup.
- Completion, cancellation, return, and refund are separate terminal or recovery states.

`FulfillmentMethod` is selected from business capabilities, service area, item characteristics, customer location, schedule, and platform policy. Seller vertical does not imply a delivery provider.

`functions/fulfillmentPolicy.js` now validates the independent order type, fulfillment method, and delivery provider dimensions. Existing food/grocery orders remain constrained to the currently supported AllGo platform-delivery path.

## Vertical Profiles

Restaurant: preparation time, kitchen capacity, freshness distance, pickup readiness.

Home kitchen: batch quantity, cutoff, pre-order schedule, production capacity, storage/freshness metadata.

Grocery: pick/pack, shortage, substitution, perishable handling, cold/frozen constraints.

Handmade: ready-to-ship vs made-to-order, lead time, packaging, dimensions, weight, fragile handling, shipping tracking, pickup.

## Compatibility

Existing `food` and `grocery` state machines remain valid for legacy orders. Add a fulfillment contract to new orders and use a shared transition engine with vertical-specific capability checks. Do not create a separate delivery engine per vertical. Do not use `parcel` to represent handmade merchandise.

## Safety Rules

- A seller cannot mark an order ready without the required preparation/packing evidence.
- A provider cannot start transit without assignment and handover proof when configured.
- Scheduled orders cannot enter production before their schedule window.
- Fulfillment method changes are server-authorized and audited.
- Cancellation, return, and refund eligibility is calculated from order snapshots and current state, not client labels.
