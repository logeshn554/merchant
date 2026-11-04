# Multi-Vertical Seller Model

Status: proposed, backward-compatible foundation
Date: 2026-11-01

## Design Rules

Seller vertical, catalog item type, order type, fulfillment method, delivery provider, and capabilities are separate dimensions. No new vertical should be represented by `serviceType` or `parcel`.

## Core Types

```ts
type SellerVertical = 'restaurant' | 'home_kitchen' | 'grocery' | 'handmade';
type CatalogItemType = 'prepared_food' | 'homemade_food' | 'grocery_product' | 'handmade_product';
type OrderType = 'prepared_food' | 'grocery' | 'made_to_order' | 'physical_product';
type FulfillmentMethod = 'platform_delivery' | 'seller_delivery' | 'third_party_shipping' | 'customer_pickup' | 'scheduled_delivery' | 'scheduled_pickup';
type DeliveryProvider = 'allgo' | 'seller' | 'third_party' | 'none';
type VerificationStatus = 'draft' | 'submitted' | 'needs_information' | 'approved' | 'rejected' | 'suspended';
```

## Business Aggregate

`merchant_businesses/{businessId}` is the future canonical aggregate. Existing `restaurants/{id}` and `grocery_stores/{id}` remain readable through adapters during migration.

Required fields:

- `id`, `ownerUid`, `vertical`, `name`, `description`, `address`, `city`, `timeZone`.
- `verificationStatus`, `onboardingStatus`, `applicationId`, `suspendedAt`.
- `capabilities`, `supportedFulfillmentMethods`, `serviceArea`.
- `outlets[]` or `merchant_outlets/{outletId}` for multi-location sellers.
- `createdAt`, `updatedAt`, `revision`.

Capabilities are explicit, for example `catalog`, `inventory`, `production_capacity`, `scheduled_orders`, `customization`, `substitutions`, `shipping`, `pickup`, `seller_delivery`, and `settlements`.

## Account and Assignment

`users/{uid}` remains the identity record. Additive fields should be:

```ts
merchantBusinessAssignments: Record<string, {
  businessId: string;
  outletIds: string[];
  role: 'owner' | 'manager' | 'staff';
  permissions: string[];
  vertical: SellerVertical;
}>;
```

During transition, preserve `merchantId`, `merchantType`, `merchantBusinessIds`, and `merchantStaffAccess`. Server adapters should read both forms and emit the new form only after migration validation.

Owner access is derived from the business owner UID. Staff access is explicit, outlet-scoped, permission-scoped, and never writable by the staff member. Approval and suspension are business-level controls, not merely frontend states.

## Verification and Approval

A business may be created as a draft, but cannot publish or accept real orders until the server confirms the business is approved, active, and capability-eligible. Vertical-specific requirements are configuration data reviewed by operations; this model does not invent jurisdictional legal requirements.

## Compatibility

- Map legacy `restaurant` business records to `SellerVertical = restaurant`.
- Map legacy `grocery` business records to `SellerVertical = grocery`.
- Preserve historical `serviceType = food|grocery` on old orders.
- Do not rewrite old order IDs or settlement entries.
- New orders carry both the legacy service field where required and the new `orderType`, `sellerVertical`, and `fulfillmentMethod` snapshot.
