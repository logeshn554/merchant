# AllGo Merchant: Comprehensive Identity & Authentication Dependency Audit

**Date:** 2026-11-04  
**Scope:** `src/`, `server/`, `functions/`, `android/`, `ios/`  
**Classification:** P0 Security & Production Readiness Audit  

---

## 1. Executive Summary

This audit identifies all existing identity dependencies, authentication flows, session handling mechanisms, and security bypasses present in the AllGo Merchant repository. The goal is to eliminate all non-authoritative identity paths and consolidate 100% of identity, authentication, and session authority into **Firebase Authentication / Identity Platform**, backed by **Firestore** canonical profiles and security rules.

---

## 2. Identified Authentication Bypass Vulnerabilities (Critical P0)

| Vulnerability ID | Location | Description & Impact | Required Action |
| :--- | :--- | :--- | :--- |
| **VULN-AUTH-01** | `src/accounts.ts:40-77` | `signInDemoAccount(role)` creates a hardcoded demo profile (`demo-merchant`, `res-1`, `approvalStatus: 'active'`, full permissions) whenever offline or server fails. | **Permanently remove** `signInDemoAccount` and all fallback references. Failed auth must fail closed. |
| **VULN-AUTH-02** | `src/accounts.ts:133-140` | `signInAccount` catch block catches server error and executes `return await signInDemoAccount(appAudience);`. | **Remove fallback.** Rethrow standard `auth/network-request-failed` or display reconnection notice. |
| **VULN-AUTH-03** | `src/accounts.ts:142-154` | `signInPhoneAccount` detects `'123456'` or `'1234567890'` and substitutes `'test-token-+911234567890'`; on error falls back to demo account. | **Remove token substitution and fallback.** Require genuine Firebase ID token verification. |
| **VULN-AUTH-04** | `src/accounts.ts:175-189` | `watchAccount` catch block automatically executes `void signInDemoAccount(appAudience)` on initial app load if the account API is offline. | **Remove auto-demo sign-in.** If no valid session exists, route user to `AuthScreen`. |
| **VULN-AUTH-05** | `src/components/PhoneAccountFlow.tsx:20-25, 78-85` | Detects `isTestPhone` (`+911234567890`) and autofills static code `123456`; submits synthetic token `test-token-+911234567890`. | **Remove test phone check and synthetic token.** Use real Firebase Phone Auth (or Firebase Emulator in dev). |
| **VULN-AUTH-06** | `server/firebaseIdentity.mjs:10-18` | `verifyPhoneIdentity` explicitly accepts `'123456'`, `'1234567890'`, `'demo-'`, or `'test-token'` and returns a fake UID and phone without verification. | **Remove bypass.** Strictly verify token signature via `admin.auth().verifyIdToken(token)`. |
| **VULN-AUTH-07** | `server/accounts.mjs:290-315` | `/api/auth/phone-login` creates a new account with `approvalStatus: 'approved'` and `dummyPassword` upon first phone login. | **Disable auto-approval.** New accounts must be created with `approvalStatus: 'pending_onboarding'`. |
| **VULN-AUTH-08** | `server/accounts.mjs:195-215` | Default seed of hardcoded accounts with password `AllGo@123` (`customer@allgo.in`, `merchant@allgo.in`, `driver@allgo.in`, `admin@allgo.in`). | **Disable production seeding.** Restrict test seeds strictly to emulator or isolated test suites. |

---

## 3. Dependency Inventory: Firebase vs. Neon

### Current Identity Split:
1. **Frontend (`src/`):**
   - `src/firebase.ts`: Initializes Firebase Client SDK (`auth`, `db`, `functions`).
   - `src/accounts.ts`: Controls session state via `useNeonAccounts = env.VITE_AUTH_PROVIDER === 'neon'`.
   - When `useNeonAccounts` is true:
     - Auth requests go to `server/accounts.mjs` (`/api/auth/login`, `/api/auth/signup`, `/api/auth/phone-login`).
     - A custom session token (64 hex characters) is stored in native secure storage or cookies.
     - `connectServiceIdentity` requests `/auth/service-identity` to obtain a Firebase Custom Token and logs in to Firebase via `signInWithCustomToken(auth, token)` with in-memory persistence.
   - When `useNeonAccounts` is false:
     - Uses Firebase Authentication directly (`signInWithEmailAndPassword`, `signInWithPhoneNumber`, etc.).
2. **Backend Server (`server/`):**
   - `server/accounts.mjs`: Node/Express server storing users in PostgreSQL `allgo_accounts`, sessions in `allgo_sessions`, and password hashes via `scrypt`.
   - `server/firebaseIdentity.mjs`: Bridge generating custom tokens for Firebase.
3. **Cloud Functions (`functions/`):**
   - Authoritative for all business transactions (orders, dispatch, settlements, catalog).
   - Validates requests using `context.auth.uid`.

---

## 4. Target Architecture: Consolidated Firebase Identity Authority

### Target State:
1. **Single Identity Authority:** All login, registration, phone OTP, password recovery, and session persistence are handled directly by Firebase Authentication.
2. **Profile & Permission Authority:**
   - Canonical user profile resides in Firestore at `users/{uid}`.
   - Global role stored in Firestore: `role: 'customer' | 'merchant' | 'driver' | 'admin'`.
   - Custom claims set by Cloud Function trigger: `{ role: string }` (compact only).
   - Merchant permissions and outlet memberships are looked up by Cloud Functions and Firestore rules from `users/{uid}` and `merchant_businesses/{id}`.
3. **Neon PostgreSQL Role:**
   - Stripped of authentication, user password hashing, and session management.
   - Retained strictly for relational financial ledgering, reporting, and accounting reconciliation.
   - Express server endpoints (`/api/auth/*`) deprecated and replaced by Firebase Client SDK calls.

---

## 5. Migration and Backward Compatibility Plan

1. **Mapping Existing Accounts:**
   - For existing users in Neon `allgo_accounts`, map them to Firebase Auth users using their verified phone or email.
   - If a Firebase Auth record does not exist for an existing Neon user, a migration script creates the Firebase Auth user preserving UID where possible.
2. **Preserving Firestore Records:**
   - Existing `users/{uid}` profiles in Firestore remain untouched.
   - All merchant outlet ownership (`merchantBusinessIds`, `merchantBusinessAssignments`) and staff access maps (`merchantStaffAccess`) remain intact.
3. **Zero Impact on Active Orders:**
   - Orders in `bookings/{id}` are keyed on `customerId`, `merchantId`, and `driverId`.
   - Since `merchantId` and `uid` linkages remain preserved in Firestore, ongoing orders and historical settlements will not be disrupted.
