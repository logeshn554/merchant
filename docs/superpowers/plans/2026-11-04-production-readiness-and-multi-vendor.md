# AllGo Merchant: Production Readiness and Multi-Vendor Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AllGo Merchant application into a secure, production-grade multi-vendor platform with Firebase Authentication as the sole identity authority, zero demo bypasses, and verified onboarding for food and grocery businesses.

**Architecture:** Client authenticates exclusively with Firebase Authentication (Phone OTP, Email/Password), persisting canonical profiles in Firestore (`users/{uid}`). Cloud Functions and Firestore rules enforce role-based tenant isolation. Multi-vertical seller models are categorized under 4 canonical backend verticals (`restaurant`, `home_kitchen`, `grocery`, `handmade`) with granular sub-type configurations stored in `merchant_businesses/{id}`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Capacitor 8 (Android/iOS), Firebase Authentication, Cloud Firestore, Cloud Functions (Node.js), Neon PostgreSQL (reporting/ledger).

**Spec:** `docs/superpowers/specs/2026-11-04-production-identity-and-multi-vendor-design.md`

## Global Constraints

- Firebase Authentication / Identity Platform is the sole authority for user identity, credentials, and sessions.
- Neon PostgreSQL must never independently own passwords, authentication sessions, or user identities.
- All demo account fallbacks (`signInDemoAccount`), hardcoded OTPs (`123456`), synthetic tokens (`test-token-+911234567890`), and auto-approvals must be permanently removed.
- An unauthenticated user, customer, or unapproved applicant must never gain access to an active merchant dashboard.
- Monies are stored and computed strictly as integer minor units (paise/cents).
- Preserve backward compatibility with existing shared backend contracts in `functions/` and Firestore security rules.

## Review Focus

1. **Unreachable Account API on Login:** When the network drops or backend is offline, the client must display an explicit network error (`auth/network-request-failed`), never falling back to a demo merchant session.
2. **Unapproved Merchant Sign-In:** A newly registered user opening the merchant app must be directed to partner onboarding (`PartnerApplicationPanel`), never into an active `MerchantPortal`.
3. **Hardcoded Test Phone Bypass Attempt:** Attempting to verify phone `+911234567890` with code `123456` without a valid Firebase verification session must be rejected with `auth/invalid-verification-code`.
4. **Cross-Tenant Catalog Mutation:** A merchant assigned to business A attempting to modify or publish catalog items for business B must be rejected with `permission-denied`.
5. **Multi-Vertical Item Type Mismatch:** Attempting to save a `prepared_food` item under a `handmade` or `grocery` vertical must be rejected by the catalog validator.

---

### Task 1: Strip Insecure Auth Fallbacks, Synthetic Tokens & Test Phone Bypasses

**Files:**
- Modify: `src/accounts.ts:35-190`
- Modify: `src/components/PhoneAccountFlow.tsx:20-125`
- Modify: `src/components/AuthScreen.tsx:25-50`
- Test: `tests/ui/authSecurity.test.ts`

**Interfaces:**
- Consumes: Firebase Auth client functions (`signInWithPhoneNumber`, `signInWithEmailAndPassword`, `signOut`)
- Produces: Safe authentication handlers without demo fallbacks or synthetic credentials

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/authSecurity.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const accountsSrc = readFileSync(new URL("../../src/accounts.ts", import.meta.url), "utf8");
const phoneFlowSrc = readFileSync(new URL("../../src/components/PhoneAccountFlow.tsx", import.meta.url), "utf8");

test("authentication codebase strictly excludes demo fallbacks and synthetic tokens", () => {
  assert.doesNotMatch(accountsSrc, /signInDemoAccount/, "signInDemoAccount must be deleted");
  assert.doesNotMatch(accountsSrc, /test-token-/, "Synthetic test tokens must be deleted");
  assert.doesNotMatch(accountsSrc, /'a'\.repeat\(64\)/, "Fake 64-char session tokens must be deleted");
  assert.doesNotMatch(phoneFlowSrc, /isTestPhone.*1234567890/, "Test phone detection must be removed");
  assert.doesNotMatch(phoneFlowSrc, /setCode\('123456'\)/, "Hardcoded OTP autofill must be removed");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ui/authSecurity.test.ts`  
Expected: FAIL with assertion error that `signInDemoAccount` or `test-token-` matches.

- [ ] **Step 3: Remove demo fallbacks and synthetic tokens in `src/accounts.ts` and `src/components/PhoneAccountFlow.tsx`**

Delete `signInDemoAccount` function entirely. Replace error catch blocks in `signInAccount` and `signInPhoneAccount` so that network errors rethrow `auth/network-request-failed` rather than loading a demo profile. In `PhoneAccountFlow.tsx`, delete `isTestPhone`, hardcoded `'123456'` code branching, and synthetic token emission.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ui/authSecurity.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/accounts.ts src/components/PhoneAccountFlow.tsx src/components/AuthScreen.tsx tests/ui/authSecurity.test.ts
git commit -m "security: remove demo fallbacks, synthetic tokens and hardcoded OTP bypasses"
```

---

### Task 2: Standardize Single Identity Authority via Firebase Authentication in Frontend

**Files:**
- Modify: `src/accounts.ts`
- Modify: `src/App.tsx:80-140`
- Modify: `src/components/AuthScreen.tsx`
- Test: `tests/ui/firebaseIdentityAuthority.test.ts`

**Interfaces:**
- Consumes: `auth` from `src/firebase.ts`, `onAuthStateChanged`, `UserProfile`
- Produces: Direct Firebase Auth lifecycle; `watchAccount` observes `onAuthStateChanged` and Firestore profile

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/firebaseIdentityAuthority.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const accountsSrc = readFileSync(new URL("../../src/accounts.ts", import.meta.url), "utf8");
const appSrc = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");

test("frontend exclusively uses Firebase Authentication for identity and sessions", () => {
  assert.match(accountsSrc, /onAuthStateChanged/, "accounts.ts must observe Firebase Auth state");
  assert.doesNotMatch(accountsSrc, /useNeonAccounts\s*=\s*env\.VITE_AUTH_PROVIDER === 'neon'/, "Neon accounts must not be used as identity authority");
  assert.doesNotMatch(appSrc, /watchAccount/, "App.tsx must use Firebase Auth listener directly");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ui/firebaseIdentityAuthority.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement direct Firebase Auth delegation in `src/accounts.ts` and `src/App.tsx`**

Set `useNeonAccounts = false` (or retire the flag). In `App.tsx`, route all authentication checks through `onAuthStateChanged(auth, ...)`. When a user signs in, load their profile from `listenToAccountProfile(uid)` in Firestore. If no session exists, display `AuthScreen`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ui/firebaseIdentityAuthority.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/accounts.ts src/App.tsx src/components/AuthScreen.tsx tests/ui/firebaseIdentityAuthority.test.ts
git commit -m "refactor: consolidate frontend identity authority to Firebase Authentication"
```

---

### Task 3: Strip Bypasses from Server Identity Bridge & Deprecate Legacy Auth Endpoints

**Files:**
- Modify: `server/firebaseIdentity.mjs:10-25`
- Modify: `server/accounts.mjs:260-320`
- Test: `tests/ui/serverAuthSecurity.test.ts`

**Interfaces:**
- Consumes: Firebase Admin SDK `auth.verifyIdToken(token, true)`
- Produces: Server phone verification that strictly validates genuine Firebase ID tokens and rejects synthetic bypasses

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/serverAuthSecurity.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridgeSrc = readFileSync(new URL("../../server/firebaseIdentity.mjs", import.meta.url), "utf8");
const serverSrc = readFileSync(new URL("../../server/accounts.mjs", import.meta.url), "utf8");

test("server identity bridge strictly verifies Firebase tokens without bypasses", () => {
  assert.doesNotMatch(bridgeSrc, /12345678-0000-0000-0000-000123456789/, "Hardcoded fake UID must be removed");
  assert.doesNotMatch(bridgeSrc, /token === '123456'/, "Hardcoded OTP token check must be removed");
  assert.doesNotMatch(serverSrc, /dummyPassword/, "dummyPassword auto-creation must be removed");
  assert.doesNotMatch(serverSrc, /Alex Sharma.*Chef Rajesh/, "Hardcoded sample accounts seeding must be removed in production");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ui/serverAuthSecurity.test.ts`  
Expected: FAIL

- [ ] **Step 3: Remove synthetic token handling and dummy passwords in `server/firebaseIdentity.mjs` and `server/accounts.mjs`**

In `server/firebaseIdentity.mjs`, strip the static check for `'123456'`, `'test-token'`, and fake UIDs. In `server/accounts.mjs`, remove `dummyPassword` account auto-generation.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ui/serverAuthSecurity.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/firebaseIdentity.mjs server/accounts.mjs tests/ui/serverAuthSecurity.test.ts
git commit -m "security: remove server identity bridge bypasses and dummy account seeding"
```

---

### Task 4: Create Repeatable Neon-to-Firebase Account Migration Tooling

**Files:**
- Create: `scripts/migrate-neon-to-firebase.mjs`
- Test: `tests/ui/migrationScript.test.ts`

**Interfaces:**
- Consumes: Neon PostgreSQL `allgo_accounts`, Firebase Admin SDK (`auth`, `firestore`)
- Produces: Automated migration script mapping legacy accounts to canonical Firebase UIDs and Firestore `users/{uid}` profiles

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/migrationScript.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("migration script exists and implements safe reconciliation without destructive writes", () => {
  const scriptPath = new URL("../../scripts/migrate-neon-to-firebase.mjs", import.meta.url);
  assert.ok(existsSync(scriptPath), "scripts/migrate-neon-to-firebase.mjs must exist");
  const scriptContent = readFileSync(scriptPath, "utf8");
  assert.match(scriptContent, /allgo_accounts/);
  assert.match(scriptContent, /getAuth/);
  assert.match(scriptContent, /users/);
  assert.match(scriptContent, /dry-run|--dry-run/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ui/migrationScript.test.ts`  
Expected: FAIL with script not found.

- [ ] **Step 3: Implement `scripts/migrate-neon-to-firebase.mjs`**

Implement migration script supporting `--dry-run` and `--apply`. Connects to Neon PostgreSQL, reads `allgo_accounts`, matches existing Firebase Auth users by email/phone or imports them via Admin Auth, and upserts corresponding Firestore `users/{uid}` records preserving `merchantBusinessIds` and `merchantStaffAccess`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ui/migrationScript.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-neon-to-firebase.mjs tests/ui/migrationScript.test.ts
git commit -m "feat: add repeatable neon to firebase account migration script"
```

---

### Task 5: Enable Multi-Vertical Onboarding in Partner Application Panel

**Files:**
- Modify: `src/components/PartnerApplicationPanel.tsx:40-60`
- Modify: `src/components/MerchantBusinessSetup.tsx:15-40`
- Test: `tests/ui/multiVerticalOnboarding.test.ts`

**Interfaces:**
- Consumes: `submitPartnerApplication` Cloud Function, `SellerVertical`
- Produces: Onboarding UI supporting all 4 structural verticals (`restaurant`, `home_kitchen`, `grocery`, `handmade`) and granular business categories

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/multiVerticalOnboarding.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const panelSrc = readFileSync(new URL("../../src/components/PartnerApplicationPanel.tsx", import.meta.url), "utf8");
const setupSrc = readFileSync(new URL("../../src/components/MerchantBusinessSetup.tsx", import.meta.url), "utf8");

test("partner onboarding UI supports all seller verticals including home kitchen and handmade", () => {
  assert.match(panelSrc, /home_kitchen/);
  assert.match(panelSrc, /handmade/);
  assert.match(setupSrc, /home_kitchen/);
  assert.match(setupSrc, /handmade/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ui/multiVerticalOnboarding.test.ts`  
Expected: FAIL because `PartnerApplicationPanel.tsx` only has `['restaurant', 'grocery', 'transport']`.

- [ ] **Step 3: Update `PartnerApplicationPanel.tsx` and `MerchantBusinessSetup.tsx`**

Add `home_kitchen` and `handmade` options to the partner type selector in `PartnerApplicationPanel.tsx` and `MerchantBusinessSetup.tsx`. Include optional business sub-category fields (e.g., bakery, pickle maker, cloud kitchen).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ui/multiVerticalOnboarding.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PartnerApplicationPanel.tsx src/components/MerchantBusinessSetup.tsx tests/ui/multiVerticalOnboarding.test.ts
git commit -m "feat: expand partner onboarding panel to support home kitchens and handmade sellers"
```

---

### Task 6: Generalize Merchant Portal Workspace for Multi-Vertical Outlets

**Files:**
- Modify: `src/components/MerchantPortal.tsx:40-85`
- Modify: `src/types.ts:40-60`
- Test: `tests/ui/multiVerticalPortal.test.ts`

**Interfaces:**
- Consumes: `SellerVertical`, `MerchantBusinessSummary`
- Produces: Merchant portal shell that renders for all approved seller verticals (`restaurant`, `home_kitchen`, `grocery`, `handmade`)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/multiVerticalPortal.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const portalSrc = readFileSync(new URL("../../src/components/MerchantPortal.tsx", import.meta.url), "utf8");

test("merchant portal accepts all seller verticals in props and outlet selector", () => {
  assert.match(portalSrc, /merchantType\?:\s*SellerVertical/);
  assert.match(portalSrc, /Home kitchen operations|Handmade operations/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/ui/multiVerticalPortal.test.ts`  
Expected: FAIL because `merchantType` is typed as `'restaurant' | 'grocery'`.

- [ ] **Step 3: Implement multi-vertical portal support in `src/components/MerchantPortal.tsx`**

Import `SellerVertical` from `../domain/merchant`. Update `MerchantPortalProps` to accept `merchantType?: SellerVertical`. Update header branding and navigation to display operational titles for home kitchens and handmade sellers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/ui/multiVerticalPortal.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MerchantPortal.tsx src/types.ts tests/ui/multiVerticalPortal.test.ts
git commit -m "feat: generalize merchant portal workspace for all seller verticals"
```

---

### Task 7: Full Regression Suite Verification & Release Acceptance Gate

**Files:**
- Test: Run entire UI test suite (`npm run test:ui`)
- Test: Run entire Functions test suite (`npm --prefix functions test`)
- Test: Run TypeScript compilation check (`npm run lint`)
- Test: Run production build & audience assertion (`npm run build`)
- Test: Run Firestore rules tests (`node scripts/run-rules-tests.mjs`)

**Interfaces:**
- Consumes: All updated components, tests, and configurations
- Produces: Verified local release state without regressions

- [ ] **Step 1: Run TypeScript lint**

Run: `npm run lint`  
Expected: PASS with 0 errors.

- [ ] **Step 2: Run full test suite**

Run: `npm test`  
Expected: PASS (all UI tests and all Functions tests pass).

- [ ] **Step 3: Run production build & merchant audience assertion**

Run: `npm run build`  
Expected: Build succeeds; `scripts/assert-merchant-build.mjs` verifies `MerchantPortal` audience.

- [ ] **Step 4: Run Firestore emulator rules tests**

Run: `node scripts/run-rules-tests.mjs` (if emulator is active) or verify static rules syntax.  
Expected: Rules unit tests pass.

- [ ] **Step 5: Commit and update implementation documentation**

```bash
git add docs/production-readiness/
git commit -m "docs: finalize production readiness reports and go-live acceptance checklist"
```
