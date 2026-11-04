# Multi-Vertical Test Matrix

Status: baseline plus planned coverage
Date: 2026-11-01

## Passing Baseline

- `npm run lint`: pass.
- `npm test`: 26 UI tests and 57 Functions tests pass.
- `node scripts/run-rules-tests.mjs`: 5/5 Firestore rules tests pass.
- `npm run build`: pass with merchant audience assertion.

## Required Domain and API Coverage

| Area | Restaurant | Home kitchen | Grocery | Handmade |
| --- | --- | --- | --- | --- |
| Vertical validation | pass | planned | pass | planned |
| Catalog schema | pass | planned | pass | planned |
| Variants/customization | variants/add-ons pass | planned | planned | planned |
| Inventory/capacity | stock/capacity pass | planned batch capacity | stock/substitution pass | planned production capacity |
| Checkout snapshot | food pass | planned | grocery pass | planned |
| Fulfillment transitions | food pass | planned schedule | grocery picking pass | planned production/shipping |
| Authorization | rules pass | planned positive/negative | rules pass | planned positive/negative |
| Settlements | contract tests pass | planned configuration | contract tests pass | planned configuration |

The contract foundation now has behavior coverage for catalog envelope validation, additive assignment authorization, settlement calculation, and independent order type, fulfillment method, and delivery provider validation. New vertical end-to-end UI coverage remains blocked until vertical merchant screens are implemented.

## Security Cases

Every new vertical must test owner, manager, staff, wrong outlet, wrong business, wrong vertical, suspended account, unapproved business, forged assignment, unpublished catalog, direct protected write, and cross-seller order read.

## Runtime UI Cases

Add behavior tests for business application, business switching, vertical-specific catalog forms, image quarantine, publishing, order acceptance, production/picking, pickup/shipping handoff, cancellation, staff permissions, settlements, notifications, loading/error/empty/offline states, and keyboard access.

Use isolated Firebase/PostgreSQL test services. Do not use fake success states as evidence of provider verification.

## Known Test Gap

The current UI tests are mostly source-contract assertions. They do not prove browser runtime behavior at 360, 390, 768, 1024, 1280, and 1440 pixels. Add Playwright only after the shared domain/API contract is implemented.
