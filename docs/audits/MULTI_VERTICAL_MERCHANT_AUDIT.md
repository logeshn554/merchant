# AllGo Merchant Multi-Vertical Audit

Date: 2026-11-01
Scope: `e:\merchant app` source repository only. No deployment, production data, or companion repository was modified.

## Executive Summary

The repository is a working merchant partner application with meaningful restaurant and grocery workflows. It is not yet a complete unified multi-vertical seller platform. The frontend, server API, and Expo client remain restaurant/grocery-shaped, while additive Cloud Functions, Firestore rules, aggregate business persistence, catalog writes, checkout, dispatch, and settlement foundations now support handmade and home-kitchen records.

The first correctness defect was confirmed and fixed: Vite did not define `__ALLGO_AUDIENCE__`, while `src/App.tsx` defaulted the missing value to `customer`. The build now injects the canonical audience from `src/app/audience.ts`, supports an explicit `VITE_ALLGO_AUDIENCE` override, and fails an executable post-build assertion if the merchant build selects `CustomerApp`. The Firestore role fallback was also fixed and the rules test query was corrected to exercise the required list limit.

## 1. Architecture and Entry Points

- Web/Capacitor entry: `src/main.tsx` -> `src/App.tsx`.
- Audience declaration: `src/app/audience.ts`; runtime workspace routing: `src/app/workspace.ts`.
- Merchant UI: `src/components/MerchantPortal.tsx`, with `MerchantAppShell.tsx`, catalog, order, preparation, picking, settlement, staff, evidence, and support components.
- Browser build: Vite via `vite.config.ts`; Firebase hosting configuration is in `firebase.json`.
- Server account API: `server/accounts.mjs`, PostgreSQL-backed routes and identity bridge.
- Firebase backend: `functions/index.js` composes catalog, checkout, dispatch, fulfillment, settlement, notification, evidence, and account functions.
- Mobile: Capacitor Android/iOS shells consume the web build. `mobile/` is a separate Expo application with its own API client and screens.

## 2. Audience Bug Verification

Finding: **P1 fixed**.

Evidence before fix:

- `src/App.tsx` declared `__ALLGO_AUDIENCE__` and used `customer` when undefined.
- `src/app/audience.ts` declared `appAudience = 'merchant'`.
- `vite.config.ts` had no `define` entry, so the global was not injected.
- The selected lazy imports therefore depended on an unresolved build-time global.

Correction:

- `vite.config.ts` now injects `__ALLGO_AUDIENCE__` from `VITE_ALLGO_AUDIENCE || appAudience` and rejects unsupported values.
- `scripts/assert-merchant-build.mjs` verifies the generated App chunk contains `MerchantPortal`, excludes `CustomerApp`, and contains the merchant splash marker.
- `npm run build` runs the assertion after Vite.

Evidence after fix: fresh production build passed and printed `Merchant audience verified in dist/assets/App-CvcnGxdc.js`.

## 3. Current Seller and Business Model

Finding: **P1 incomplete architecture**.

Current model:

- `UserProfile.merchantType` is only `'restaurant' | 'grocery'`.
- `merchantBusinessIds` is a map with only `restaurant` and `grocery` arrays.
- `merchantStaffAccess` grants are tied to those two types.
- `functions/merchantAccess.js`, provisioning, role assignment, Firestore rules, booking subscription, notification scope, and merchant UI repeat those unions.
- Approval status exists, but business records and seller vertical capability configuration are not normalized across all requested verticals.

Impact: new verticals can now be represented and authorized in the additive aggregate path, but the remaining frontend and legacy server adapters cannot yet provide complete vertical-aware operations.

## 4. Catalog and Product Schemas

Current authoritative validation is `functions/catalogPolicy.js`.

- Restaurant items are stored under `restaurants/{id}/menu_items` and validate dish availability, vegetarian flag, serving size, variants, and add-ons.
- Grocery products are stored under `grocery_stores/{id}/products` and validate stock, unit, brand, storage, origin, and expiry.
- `src/types.ts` repeats `MenuItem` and `GroceryProduct` as separate interfaces.
- `functions/checkoutCatalog.js` only accepts `food` and `grocery` and applies food or grocery-specific validation.
- Merchant bulk import and editor logic in `MerchantPortal.tsx` only supports those two catalog types.

The shared catalog envelope, item discriminator, publication state, revisions, and new vertical validators now exist. Legacy catalog writes remain restaurant/grocery-specific; new vertical catalog writes use `merchant_businesses/{id}/catalog_items`.

## 5. Orders, Checkout, and Fulfillment

Working behavior:

- Checkout re-reads authoritative catalog data and validates price, variants, add-ons, expiry, and grocery stock in `functions/checkoutCatalog.js` and related checkout tests.
- Integer paise/cents and transaction-oriented stock/picking logic are present.
- `functions/fulfillmentPolicy.js` has explicit service contracts for food, grocery, ride, takeover, parcel, and transport.
- Merchant transitions currently permit only food and grocery preparation: pending -> preparing -> ready.
- Food/grocery readiness and pickup handoff are server-backed and tested.
- Merchant order UI treats all merchant orders as delivery and labels the catalog as Menu in the current portal navigation.

Gaps:

- Handmade and home-kitchen order types are accepted by the additive checkout and shared readiness/dispatch paths.
- Reservations, returns, richer variants, and shipping-provider-specific handoff remain open.
- Fulfillment method is not separated from seller vertical; `serviceType` is doing too much work.
- Scheduled production, made-to-order dispatch, pickup, seller delivery, shipping dimensions, and parcel/courier eligibility are not modeled for products.
- The PostgreSQL API has explicit single-restaurant and single-store cart/order paths. Cross-seller checkout is not proven safe.

Decision: retain a **single seller per checkout** until parent/child orders, allocation, partial refunds, fulfillment legs, and settlements are implemented and tested.

## 6. Delivery and Dispatch

The shared Functions dispatch path is authoritative for existing food/grocery delivery transitions and driver offers. Firestore rules require merchant readiness and merchant permissions. The server API has separate food/grocery paths and restaurant naming assumptions.

Not verified: companion repository `../delivery123`, deployed Functions ownership, provider webhooks, courier/shipping providers, or live dispatch. No claim is made that those integrations are production-verified.

## 7. Payments, Refunds, and Settlements

Working behavior:

- Server-side quote/checkout validation, payment status, refund-required states, versioned settlement agreements, ledger entries, payout requests, and Firestore privacy tests exist.
- Settlement tests passed: 48 Functions tests include merchant settlement contract checks.

Risks:

- Settlement records use food/grocery service assumptions in the current UI and ledger query paths.
- Payout UI contains a success-oriented display but the source also states operations/provider verification is required; external payout evidence was not exercised.
- Commission configuration is not yet vertical/capability aware.
- Partial seller allocation for multi-seller orders is not implemented.

## 8. Authentication, Roles, and Staff Authorization

The server-side model is stronger than the UI: callable entry points perform account/session/suspension checks, and merchant mutations call `merchantHasPermission`.

Confirmed fix: Firestore `isMerchantFor` and `isMerchantForLeg` now accept the server-side user profile role when custom claims are absent or stale, matching existing permission fallback behavior. This resolved the valid merchant rules test failure without permitting non-merchant users.

Remaining gap: the role and assignment schema only recognizes restaurant/grocery. Staff grants are outlet-scoped but not yet vertical/capability normalized.

## 9. Firestore and Storage Security

- Firestore uses a default deny catch-all.
- Protected order writes are server-only; merchant reads are permission and service-type scoped.
- Storage is fully denied to direct clients; private uploads are mediated by server scanning/quarantine functions.
- Rules tests now pass 5/5.

Remaining risk: rules and validators must be migrated additively before new vertical records can be exposed. Public catalog reads currently have restaurant/grocery collection-specific rules and do not provide a generalized published-item predicate.

## 10. API and Cloud Functions

Cloud Functions are composed once from `functions/index.js`, with rate limits, App Check configuration, account/session checks, and audit logging. The codebase includes both Firebase Functions and a PostgreSQL account/order API. README states the canonical order backend is shared, but the companion repository was not available in this workspace and was not changed.

The PostgreSQL API still contains restaurant-specific identifiers and seed/demo account data in source. This is a compatibility and documentation concern; it must not be used as evidence that handmade or home-kitchen workflows work.

## 11. Mobile Architecture

- Capacitor Android/iOS shells package the Vite web application and appear to be the primary native merchant distribution path.
- `mobile/` is a separate Expo app with `DashboardScreen`, `OrdersScreen`, `MenuScreen`, and `SettlementsScreen`, its own API client, and a distinct approval guard.
- The Expo client is not contract-equivalent to the web/Capacitor portal and still uses Menu terminology. Its active/support status is undocumented and requires an explicit product decision.
- Android generated assets exist in the repository; they should be treated as generated artifacts and refreshed only through the documented sync process.

## 12. UX and Responsive Review

The web portal has a responsive shell, desktop order board, mobile navigation, loading/error/empty states, notifications, and dark/light theme controls. Existing UI tests are source-oriented and do not replace browser interaction testing at the requested viewport matrix.

Confirmed UX debt for multi-vertical work:

- Menu, restaurant, grocery, delivery, and kitchen labels are hard-coded in merchant flows.
- There is no vertical-aware catalog form for handmade or home-kitchen products.
- No production schedule, customization workflow, shipping profile, or pickup/scheduled fulfillment UI exists.
- No Playwright/browser runtime test currently proves authenticated merchant interactions.

## 13. Testing and Deployment Baseline

Commands run on 2026-11-01:

- `npm run lint`: passed.
- `npm test`: passed, 26 UI tests and 57 Functions tests.
- `node scripts/run-rules-tests.mjs`: passed, 5/5 rules tests.
- `npm run build`: passed; audience assertion passed.
- Build warnings: environment reports `NODE_ENV=production` in `.env`; Vite reports a Firebase chunk above 500 kB.
- Native hardware, iOS host build, push/SMS/payment/bank providers, companion repository, and production deployment were not exercised.

The package script documents the plain `build` as a production release gate, but it does not run `check-release.mjs`; `build:production` does. Documentation should distinguish artifact compilation from release acceptance.

## 14. Vertical Readiness

| Vertical | Current state | Blocking gaps |
| --- | --- | --- |
| Restaurant | Working baseline | Shared model migration and generic fulfillment labels |
| Home kitchen | Not supported | Business type, production capacity, pre-orders, cutoffs, scheduled orders, catalog schema, authorization |
| Grocery | Working baseline | Preserve stock/substitution while migrating to shared catalog envelope |
| Handmade | Backend foundation | Vertical UI, search, reservations, shipping handoff, returns |

## 15. Prioritized Risk Register

| ID | Severity | Evidence | Impact | Correction | Tests/migration |
| --- | --- | --- | --- | --- | --- |
| AUD-001 | P1 fixed | Missing Vite define plus customer fallback in `src/App.tsx` | Merchant build could open customer app | Inject and assert audience | Production build assertion |
| AUTH-001 | P1 fixed | Rules required role claim despite profile fallback | Valid merchant/staff reads denied when claims stale | Shared `isMerchantAccount` fallback | 5 Firestore rules tests |
| DOMAIN-001 | P1 open | Remaining frontend/API unions are restaurant/grocery | New vertical UI and legacy adapters remain incomplete | Finish shared type migration | Domain/parity tests |
| CATALOG-001 | P1 open | Legacy `catalogPolicy.js` remains restaurant/grocery-specific | New catalog needs richer variants/reservations | Extend envelope validators and reservations | Schema/inventory tests |
| COMMERCE-001 | P1 open | New checkout path lacks reservation/returns depth | Concurrent inventory and refund edge cases remain | Add transactional reservations and return policy | Checkout/idempotency tests |
| FULFILL-001 | P1 open | Shared readiness/dispatch exists; shipping-specific handoff is pending | Physical orders need courier/return lifecycle | Add provider adapters | Transition tests |
| API-001 | P1 open | `server/ordersEngine.mjs` has single restaurant/store routes | Backend/client drift and unsafe expansion risk | Establish canonical order contract | API contract and integration tests |
| MOBILE-001 | P1 open | Expo app has separate screens/API | Supported clients may diverge | Declare canonical client and parity gate | Mobile config/API tests |
| TEST-001 | P1 open | Existing UI tests read source text | Static assertions do not prove runtime UX | Add behavior tests after domain contract | Playwright/emulator scenarios |
| RELEASE-001 | P2 open | `.env` NODE_ENV warning and build/release script distinction | Release status can be misunderstood | Correct env/docs and CI gates | CI dry run and secret scan |

## 16. Changes Made in This Audit Slice

- Updated `vite.config.ts` to inject and validate the application audience.
- Added `scripts/assert-merchant-build.mjs`.
- Added `test:audience` and chained it into `npm run build`.
- Updated `firestore.rules` to use profile role fallback for merchant order/leg reads.
- Updated the Firestore query fixture to include the production list bound.
- Added shared frontend seller vertical/catalog item type definitions and backend validation primitives for home-kitchen and handmade items.
- Added legacy guards so new vertical identities cannot enter restaurant/grocery-only booking adapters.
- Added additive aggregate business persistence, approval, catalog writes, checkout reads, dispatch/notification support, and settlement contracts for home-kitchen and handmade services.

No production records, deployments, companion repositories, or native signing artifacts were changed.

## 17. Recommended Roadmap

1. Freeze a shared domain contract and compatibility adapter for legacy restaurant/grocery records.
2. Add SellerVertical, CatalogItemType, OrderType, FulfillmentMethod, DeliveryProvider, capabilities, verification, and outlet assignment types.
3. Implement server validators and authorization before UI forms.
4. Add home-kitchen and handmade business/catalog flows behind approved capability flags.
5. Keep single-seller checkout; add order-time snapshots, reservations, and idempotency receipts.
6. Generalize fulfillment transitions and dispatch legs.
7. Migrate search/indexing and published catalog reads.
8. Add browser, emulator, API contract, and end-to-end seller tests.
9. Declare the canonical mobile client and enforce parity in CI.
10. Re-audit companion backend ownership and provider evidence before release.
