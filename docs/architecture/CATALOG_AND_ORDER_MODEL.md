# Catalog and Order Model

Status: foundation implemented; legacy checkout compatibility retained
Date: 2026-11-01

## Catalog Envelope

The backend validator in `functions/catalogEnvelope.js` now enforces the vertical/item-type binding, bounded identities, integer cents, HTTPS images, publication state, availability state, and revision. It is intentionally not connected to legacy Firestore writes yet; that connection requires the additive business aggregate and authorization migration.

Use one authoritative catalog identity with discriminated item payloads:

```ts
interface CatalogItemBase {
  id: string;
  businessId: string;
  outletId?: string;
  sellerVertical: SellerVertical;
  itemType: CatalogItemType;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  priceCents: number;
  images: string[];
  publicationStatus: 'draft' | 'pending_review' | 'published' | 'unpublished' | 'suspended';
  availabilityStatus: 'available' | 'unavailable' | 'sold_out';
  variants?: CatalogVariant[];
  sku?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
```

Payloads are discriminated, not one oversized optional object:

- `prepared_food`: ingredients, allergens, dietary labels, serving size, modifiers, prep time, quantity/batch limits.
- `homemade_food`: ingredients, allergens, portions, batch quantity, production capacity, lead time, cutoff, pre-order and storage fields.
- `grocery_product`: brand, unit, quantity, stock, reservations, expiry/batch data, storage, origin, substitutions.
- `handmade_product`: materials, technique, dimensions, weight, color/size variants, customization, made-to-order, lead time, packaging, fragile handling, shipping profile, returns policy.

## Order Snapshot

The shared frontend types now expose `orderType`, `fulfillmentMethod`, and `deliveryProvider`. The existing food/grocery quote path writes the legacy-compatible dimensions as `prepared_food|grocery`, `platform_delivery`, and `allgo`; other combinations fail closed until their storage and fulfillment adapters are available.

At quote/checkout, the server re-reads each published item and stores immutable order-time snapshots: business identity, seller vertical, item type, name, description, selected variant/customization, unit price cents, quantity, fulfillment eligibility, and revision.

The client never supplies authoritative price, ownership, publication, inventory, or seller identity.

## Checkout Decision

The current architecture has single-restaurant and single-store paths and does not prove safe multi-seller allocation. Keep one seller/business per checkout. A future multi-seller design requires a parent order, child seller orders, allocation ledger, independent acceptance, fulfillment legs, partial refunds, and separate settlements before enabling it.

## Idempotency and Reservations

Every quote commit, order creation, inventory reservation, refund, and settlement mutation gets a caller request ID and a server receipt. Transactions must reject reused IDs with different payload fingerprints. Inventory and production capacity reservations expire or are released through authoritative state transitions.

## Legacy Adapter

Read legacy `restaurants/{id}/menu_items` and `grocery_stores/{id}/products` through adapters. Do not rename collections or rewrite historical orders. New catalog writes should be dual-read compatible until the migration receipt confirms parity.
