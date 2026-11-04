# Multi-Vertical Migration Plan

Status: not started beyond Phase 0 fixes
Date: 2026-11-01

## Principles

Additive, deterministic, idempotent, receipt-backed, and reversible. No production deployment or record migration is included in this audit slice.

## Phases

1. Inventory real business, catalog, order, staff, settlement, and index shapes in the canonical backend and companion repository.
2. Introduce shared constants, validators, and adapters without changing legacy reads.
3. Add `merchant_businesses` and assignment projections for approved records.
4. Backfill restaurant/grocery records with receipts containing source path, target ID, version, checksum, timestamp, and failure reason.
5. Add home-kitchen and handmade applications behind operations-configured verification and capability flags.
6. Add new catalog item collections or a versioned envelope; keep legacy collections readable.
7. Add order snapshots and fulfillment contracts to new orders only.
8. Validate counts, ownership, permissions, index coverage, and settlement totals before enabling reads.
9. Roll back by disabling the new projection/read path; never delete legacy records during the transition.
10. Remove legacy compatibility only after an operator-approved deprecation window and historical-read test.

## Mapping

- restaurant -> seller vertical `restaurant`, item type `prepared_food`, legacy service `food`.
- grocery -> seller vertical `grocery`, item type `grocery_product`, legacy service `grocery`.
- home_kitchen -> new business and item records; do not map to restaurant.
- handmade -> new business and item records; do not map to parcel.

## Required Receipts and Tests

Every migration batch records a stable request ID and input fingerprint. Tests must cover rerun, partial failure, duplicate IDs, wrong owner, suspended business, malformed legacy record, and rollback/read compatibility.
