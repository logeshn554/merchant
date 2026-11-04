# Implementation Progress

Date: 2026-11-01

## Completed

- [x] Confirmed the audience fallback defect in `src/App.tsx` and missing Vite injection.
- [x] Added canonical audience injection and validation in `vite.config.ts`.
- [x] Added `scripts/assert-merchant-build.mjs`.
- [x] Added the audience assertion to `npm run build`.
- [x] Fresh production build verified `MerchantPortal` selection and excluded `CustomerApp`.
- [x] Fixed Firestore merchant role fallback for valid profile-backed accounts.
- [x] Corrected the rules fixture to include the enforced merchant query limit.
- [x] Ran lint, UI/Functions tests, build, and Firestore emulator rules tests.
- [x] Created the audit, seller model, catalog/order model, fulfillment model, migration plan, and test matrix documents.
- [x] Added shared frontend seller vertical and catalog item type definitions.
- [x] Added backend handmade and home-kitchen validation primitives with behavior tests.
- [x] Added explicit legacy guards so unsupported verticals are not coerced into restaurant/grocery workflows.
- [x] Added a validated catalog envelope for common catalog identity, publication, availability, revision, and image fields.
- [x] Added explicit order type, fulfillment method, and delivery provider contracts with behavior tests.
- [x] Attached legacy-compatible commerce dimensions to food/grocery quote records while rejecting unsupported combinations.
- [x] Added a categorized TODO register.
- [x] Added additive `merchant_businesses` persistence and new-vertical eligibility support.
- [x] Added authorized revisioned catalog envelope writes for home-kitchen and handmade businesses.
- [x] Extended checkout, dispatch, notifications, fulfillment, and settlement contracts to new commerce services.

## Evidence

- `npm run lint`: passed.
- `npm test`: passed, 26 UI and 57 Functions tests.
- `node scripts/run-rules-tests.mjs`: passed, 5/5.
- `npm run build`: passed; audience assertion passed.

## Open Work

- [ ] Replace remaining backend restaurant/grocery unions with shared validated seller and catalog types.
- [x] Migrate backend business assignment and Firestore schemas to the new seller vertical contract foundation.
- [x] Add first-class home-kitchen and handmade business onboarding and approval foundation.
- [x] Add discriminated catalog validators and server-authoritative checkout support.
- [x] Separate order type, fulfillment method, and delivery provider at the contract and quote boundary.
- [ ] Preserve single-seller checkout until multi-seller accounting is implemented.
- [ ] Generalize search/indexing and vertical-aware merchant UI.
- [ ] Decide whether Expo is supported, legacy, or experimental and enforce client parity.
- [ ] Verify canonical backend ownership with the companion repository.
- [ ] Add runtime browser and isolated end-to-end seller scenarios.
- [ ] Resolve release documentation/environment warnings and add CI gates.

## Remaining Production Blockers

Home-kitchen and handmade backend foundations are implemented. Vertical-aware merchant UI, search indexing, reservations/returns, mobile parity, E2E scenarios, and external provider verification remain release blockers. External payment, payout, push, SMS, courier, native hardware, iOS, production data, and companion-repository behavior remain unverified.
