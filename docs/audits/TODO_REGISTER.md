# AllGo Merchant TODO Register

Date: 2026-11-01
Scope: source and repository documentation, excluding generated artifacts and dependencies.

The repository-wide source scan found no actionable `TODO`, `FIXME`, or `TBD` markers. The remaining work is tracked here from the architecture audit and is classified by risk.

## Security and Correctness

- **Closed:** Vite audience injection and merchant-build regression guard.
- **Closed:** Firestore merchant profile-role fallback and bounded query fixture.
- **Closed:** Legacy adapter guard prevents unsupported seller verticals entering restaurant/grocery booking code.
- **Closed:** Added additive aggregate authorization and Firestore rules for `home_kitchen` and `handmade` records.
- **Open P1:** Add positive and negative cross-seller tests for new business and outlet assignment projections.

## Backend and Domain

- **Closed:** Shared seller verticals, catalog item types, order types, fulfillment methods, and delivery providers are defined.
- **Closed:** Backend catalog envelope validates vertical/item-type binding, identity, price, publication, availability, revision, and images.
- **Closed:** Persist new vertical businesses under `merchant_businesses` without renaming legacy collections.
- **Closed:** Partner applications and eligibility review accept home kitchens and handmade sellers through the existing evidence workflow.
- **Open P1:** Reconcile the canonical backend with the companion repository before changing shared Functions deployment ownership.

## Catalog and Checkout

- **Closed:** Handmade and home-kitchen product-specific validators and behavior tests.
- **Closed:** Existing food/grocery checkout continues to re-read authoritative legacy catalog records.
- **Closed:** Legacy food/grocery quote path now records explicit order and fulfillment dimensions while remaining platform-delivery-only.
- **Closed:** Added authorized revisioned catalog envelope writes and approved aggregate catalog reads.
- **Closed:** Checkout validates publication, availability, stock, price, customization, and seller snapshots for new vertical items.
- **Open P1:** Add reservation transactions and richer variant/customization validation.
- **Open P1:** Generalize search indexing and published catalog reads.

## Fulfillment and Payments

- **Closed:** Fulfillment contract validator independently checks order type, fulfillment method, and delivery provider.
- **Closed:** Unsupported legacy fulfillment combinations fail closed.
- **Closed:** New commerce services enter shared readiness, dispatch, notification, and settlement paths.
- **Open P1:** Add returns/refunds and shipping-provider-specific handoff transitions.
- **Open P1:** Keep single-seller checkout until multi-seller parent/child orders and independent settlement/refund legs exist.
- **External:** Payment providers, payout providers, courier/shipping providers, push, SMS, and bank verification remain unverified.

## UI and Mobile

- **Closed:** Merchant build audience is verified at build time.
- **Open P1:** Add vertical-aware onboarding and catalog forms without showing irrelevant fields.
- **Open P1:** Replace restaurant-only navigation and delivery labels in shared merchant workspace.
- **Open P1:** Decide whether Expo is supported, legacy, or experimental; enforce API/UI parity if supported.
- **Open P2:** Add browser interaction tests at the requested responsive viewport matrix.

## Documentation and Testing

- **Closed:** Audit, seller model, catalog/order model, fulfillment model, migration plan, test matrix, progress report, TODO register, and CI quality workflow.
- **Closed:** Lint, UI tests, Functions tests, Firestore rules tests, build, and merchant audience assertion pass locally.
- **Open P1:** Add isolated end-to-end seller scenarios for each vertical.
- **Open P2:** Resolve or explicitly isolate the local `NODE_ENV` warning and large Firebase bundle warning.
- **Open P2:** Add release acceptance and secret/dependency scanning to CI after repository policy is confirmed.

## Production Blockers

Home-kitchen and handmade backend foundations are implemented. Vertical-aware merchant UI, search indexing, reservations/returns, mobile parity, E2E scenarios, and external provider verification remain production blockers. No production deployment or external provider verification is claimed.
