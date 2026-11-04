# AllGo Merchant: Production Identity Consolidation and Multi-Vendor Platform Design

**Date:** 2026-11-04  
**Author:** Antigravity Engineering Agent  
**Status:** Approved  
**Audience:** AllGo Engineering, Operations, and Production Reviewers  

---

## 1. Intent and The Why

The AllGo platform is transitioning from a development/prototype hybrid into a secure, reliable, and compliant production-grade multi-vendor merchant marketplace in India. 

Historically, the application accumulated competing authentication layers: a legacy Express/Neon PostgreSQL account API with custom sessions, and Firebase Authentication with custom token bridges. This duality led to significant vulnerabilities, including:
- Client-side fallback to hardcoded demo profiles (`signInDemoAccount`) when the account server was unreachable or login failed.
- Hardcoded test phone numbers (`+911234567890`) and static verification codes (`123456`).
- Synthetic phone tokens (`test-token-+911234567890`) that bypassed OTP verification.
- Automatic creation and activation of accounts with full merchant permissions and dummy credentials.
- Duplicated session management (`allgo_sessions` in PostgreSQL vs. Firebase tokens).

Furthermore, the existing merchant dashboard and onboarding workflows were artificially restricted to `restaurant` and `grocery` models, whereas the business requires comprehensive support for food businesses (restaurants, cloud kitchens, home kitchens, homemade food sellers, bakers, pickle makers, catering) and grocery/retail merchants.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Sole Identity Authority:** Establish Firebase Authentication / Identity Platform as the single source of truth for user credentials, Firebase UIDs, Phone OTP, Email/Password, Password Reset, and secure sessions.
- **Canonical Application Profiles & Authorization:** Use Firestore (`users/{uid}`) as the canonical store for user profiles, roles, merchant ownership, outlet assignments, staff permissions, and verification status.
- **Minimal Custom Claims:** Store only compact global roles (`customer`, `merchant`, `driver`, `admin`) in Firebase Custom Claims. Never pack volatile or unbounded lists of merchant IDs or permissions into claims.
- **Eliminate All Auth Bypasses:** Completely remove `signInDemoAccount`, synthetic tokens, hardcoded OTPs, auto-approvals, and offline demo fallbacks from production code paths.
- **Multi-Vertical Expansion:** Generalize the merchant portal and onboarding flows to natively handle all required food and grocery business models without breaking legacy restaurant/grocery contracts.
- **Production Compliance & Accounting:** Establish clear boundaries for India regulatory compliance (FSSAI, GST, Legal Metrology, DPDP Act 2023) and double-entry immutable financial reconciliation (using Neon PostgreSQL solely for relational ledgering and reporting).

### Non-Goals
- We will **not** maintain Neon PostgreSQL as an independent identity provider, user password store, or custom-token issuer.
- We will **not** rewrite the working frontend UI or replace the existing React 19 / Vite / Tailwind / Capacitor stack.
- We will **not** perform destructive database drops or delete legacy user records before migration reconciliation is validated.
- We will **not** initiate live financial payouts or deploy to cloud production without explicit operator authorization.

### Anti-Goals
- Never allow an unauthenticated or failed login attempt to grant access to a simulated or demo merchant session.
- Never grant a customer merchant portal access simply by switching the app client.
- Never display an active merchant dashboard to an unverified or unapproved merchant applicant.
- Never mark an order paid or a payout completed based on unverified frontend signals.

---

## 3. Constraints

- **Single-Seller Checkout:** Keep checkout bounded to a single merchant per order until multi-seller parent/child order settlement is implemented.
- **Shared Backend Compatibility:** Shared backend Cloud Functions in `functions/` and Firestore rules must remain strictly coordinated with the companion customer and driver repositories.
- **Paise Precision:** All monetary amounts must be stored and computed as exact integer minor units (paise/cents). Floating-point currency calculations are strictly prohibited.
- **Platform Parity:** Changes must preserve compatibility across web browsers, Capacitor Android (`in.allgo.merchant`), and iOS shells.

---

## 4. Approaches Considered

### Approach A: Dual Hybrid with Neon Primary (Rejected)
- **Concept:** Keep Neon PostgreSQL as the primary authentication authority; on login, generate a Firebase Custom Token via Firebase Admin SDK to log into Firebase on the client.
- **Tradeoffs:** High complexity, fragile token exchange, dual session invalidation hurdles, network latency on mobile, and the root cause of the previous offline fallback bypasses. Rejected by architectural decision.

### Approach B: Direct Firebase Authentication & Firestore Profiles (Approved)
- **Concept:** Client authenticates directly against Firebase Authentication (native phone OTP, web reCAPTCHA phone verification, email/password). Firestore holds the authoritative `UserProfile` and outlet access maps. Cloud Functions and Firestore security rules enforce role-based access control. Neon PostgreSQL is retained exclusively for append-only financial ledgering, reporting, and relational analytics.
- **Tradeoffs:** Clean separation of concerns, native Capacitor Firebase Auth plugin support, zero session synchronization drift, complete removal of synthetic token bypasses.

---

## 5. Architectural Specifications & Builder Clarifications

### 5.1 Identity & Authentication Flow
1. **User Sign-In:** 
   - Phone verification: Native `FirebaseAuthentication` plugin on Android/iOS, or Firebase JS SDK `signInWithPhoneNumber` with RecaptchaVerifier on web.
   - Email/Password: Firebase `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`.
2. **Session Persistence:** Managed directly by Firebase Auth (`setPersistence`, `indexedDB` on web, native keychain/keystore on mobile). No synthetic session tokens (`'a'.repeat(64)`).
3. **User Profile Creation & Onboarding Lifecycle:**
   - Any new user registering directly via Firebase Auth gets initialized in Firestore with default role `customer`.
   - When opened in the merchant app (`appAudience === 'merchant'`), `workspaceFor('merchant', profile)` evaluates the user profile:
     - If the user has `role: 'customer'`, the workspace safely directs them to `PartnerApplicationPanel` ("Apply to become an AllGo partner").
     - The applicant submits business details, operating city, FSSAI registration/license, and KYC evidence.
     - Platform operations reviews the application via `reviewPartnerApplication`.
     - Upon approval, the backend Cloud Function (with Admin SDK authority) provisions `merchant_businesses/{id}`, creates `merchantBusinessAssignments`, and elevates the user's role to `merchant`.
     - `firestore.rules` enforces that clients cannot self-assign `merchantId` or merchant roles on user creation.
4. **Role & Tenant Enforcement:**
   - `workspaceFor(appAudience, userProfile)` checks:
     - If `userProfile.role !== 'merchant'`, redirect to partner onboarding application.
     - If merchant has no approved business assignments (`merchantBusinessAssignments`, `merchantBusinessIds`, or `merchantStaffAccess`), redirect to application/unassigned view.
     - Only approved merchants with active outlet assignments enter `MerchantPortal`.

### 5.2 Multi-Vertical Merchant Taxonomy & Cross-Repository Contracts
To preserve strict backward compatibility with shared Cloud Functions, companion apps, and Firestore security rules:
- **Core Structural Verticals (`SellerVertical`):** Strictly bounded to the 4 canonical values supported by the backend:
  1. `restaurant` (Food preparation, immediate fulfillment)
  2. `home_kitchen` (Batch preparation, scheduled production)
  3. `grocery` (Retail inventory, units/weights, short-picking/substitutions)
  4. `handmade` (Packaged goods, manufactured edibles, crafts)
- **Granular Business Models (`businessCategory`):**
  - Under `restaurant`: `cloud_kitchen`, `bakery`, `catering`.
  - Under `home_kitchen`: `home_baker`, `homemade_sweets`, `meal_tiffin`.
  - Under `handmade`: `pickles_condiments`, `packaged_foods`, `artisan_goods`.
  - Under `grocery`: `supermarket`, `produce_store`, `convenience_store`.
  These granular models are stored as metadata inside `merchant_businesses/{id}`, configuring custom onboarding fields (e.g. FSSAI type, batch numbers, allergens) without breaking shared cross-app dispatch logic.

### 5.3 Existing Account Migration Strategy
1. **Phone-Based Cutover:** In India, phone number is the primary identity key. Existing users in Neon `allgo_accounts` with verified phone numbers sign in via Phone OTP. Firebase Auth verifies the OTP and matches the user's canonical Firestore profile.
2. **Automated Migration Tooling:** A dedicated script `scripts/migrate-neon-to-firebase.mjs` extracts records from Neon PostgreSQL `allgo_accounts`, validates existing user UIDs and email/phone attributes, and upserts corresponding Firestore `users/{uid}` records with preserved merchant outlet linkages (`merchantBusinessIds`, `merchantStaffAccess`).
3. **Email/Password Accounts:** Existing password hashes in Neon remain preserved in the legacy database. Users signing in via email/password can trigger Firebase password reset (`sendPasswordResetEmail`) to establish their Firebase Auth password seamlessly.

### 5.4 Financial Ledger & Neon PostgreSQL
- Authoritative double-entry ledger entries are generated exclusively by Cloud Functions in Firestore under `financial_journals/{id}`.
- Relational ingestion into Neon PostgreSQL is performed via a dedicated serverless synchronization function or batch export script, ensuring the database holds historical audit records for SQL reconciliation without running public authentication endpoints.

---

## 6. What's Left to The Builder

The builder (implementing agent) must:
1. Conduct Phase 1 dependency audit and write the production readiness documentation.
2. Refactor `src/accounts.ts`, `src/components/AuthScreen.tsx`, and `src/components/PhoneAccountFlow.tsx` to strip all synthetic bypasses, demo fallbacks, and dummy credentials.
3. Migrate `server/accounts.mjs` to eliminate legacy login/signup endpoints while preserving any approved non-auth ledger endpoints.
4. Extend `PartnerApplicationPanel.tsx` and `MerchantPortal.tsx` to support the full range of food and grocery verticals.
5. Add automated unit and integration tests covering positive and negative authentication, role boundaries, and multi-vertical catalog schemas.
