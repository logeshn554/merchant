# Plan: Complete Removal of Neon and Demo/Sample Logins

**Goal:** Completely eliminate Neon PostgreSQL as an authentication/identity mechanism and remove all demo/sample accounts, synthetic tokens, and bypasses across frontend, Cloud Functions, and server, making AllGo Merchant a real-world, production-only application backed solely by Firebase Authentication and Firestore.

---

### Task 1: Clean Frontend Components from Neon and Custom Reset Tokens
- Modify `src/components/AuthScreen.tsx`:
  - Remove all `useNeonAccounts` imports and conditionals.
  - Simplify password reset to standard Firebase `sendPasswordResetEmail(auth, email)`.
  - Remove custom 64-character token input and reset state.
  - Standardize email signup/signin purely on `createUserWithEmailAndPassword` and `signInWithEmailAndPassword`.
- Modify `src/components/PhoneAccountFlow.tsx`:
  - Remove `useNeonAccounts` import and checks.
  - Remove secondary `allgo-phone-verification` app hack; use standard Firebase `auth`.
  - On OTP submit, use `confirmation.current.confirm(code)` directly on standard Firebase Auth.
- Modify `src/components/AccountActionScreen.tsx`, `AccountDataExport.tsx`, `nativeNotifications.ts`:
  - Remove `useNeonAccounts` and direct Neon calls.

### Task 2: Remove Neon and Dual Identity from `src/accounts.ts` and `src/App.tsx`
- Modify `src/accounts.ts`:
  - Delete `useNeonAccounts`.
  - Remove deprecated Neon endpoints (`signInAccount`, `signInPhoneAccount`, `forgotPasswordAccount`, `resetPasswordAccount`, `verifyEmailAccount`, `refreshAccountVerification`, `connectServiceIdentity`).
  - Keep only essential device session teardown and Firebase Auth state synchronization.
- Modify `src/App.tsx`:
  - Remove `useNeonAccounts` import and references.

### Task 3: Strip All `isDemo` and `demo-` Bypasses from Cloud Functions and Client
- Modify `functions/index.js`:
  - Remove all `isDemo` checks in `confirmMerchantPickup`, `sendBookingMessage`, `acceptDriverJob`, and `advanceDriverBooking`.
  - Enforce real driver eligibility, merchant ownership, and OTP confirmation unconditionally.
- Modify `src/data/firebaseHelper.ts`:
  - Remove all `isDemo` and `demo-` checks in `getOrCreateDriverProfile`, `listenToAccountProfile`, driver dispatch listener, and `sendChatMessage`.

### Task 4: Decommission Neon Identity and Sample Account Files in `server/` and `scripts/`
- Delete `server/seedSampleAccounts.mjs` and `scripts/seed-usb-login.mjs`.
- Modify `server/accounts.mjs` and `server/firebaseIdentity.mjs`:
  - Remove custom token bridge endpoints and Neon account identity pool.

### Task 5: Update Tests and Full Verification
- Update `tests/ui/firebaseIdentityAuthority.test.ts`, `tests/ui/authSecurity.test.ts`, and `tests/ui/serverAuthSecurity.test.ts`.
- Run `npm run lint` (`tsc --noEmit`).
- Run `npm test` (all UI tests and Functions tests).
- Run `npm run build` (production build and audience check).
- Run `node scripts/run-rules-tests.mjs` (Firestore rules emulator).

