# Plan: AllGo Merchant App — Production Login & Onboarding Implementation

**Goal:** Implement a production-grade merchant partner authentication and onboarding flow matching Swiggy Partner and Zomato Restaurant Partner, with mobile-number-first login, OTP verification, multi-step business registration, server-controlled status handling, and seamless transition to the merchant dashboard.

---

### Step 1: Design and Implement Merchant Partner Login Screen (`src/components/AuthScreen.tsx`)
- Headline: "Welcome to AllGo Partner"
- Subtitle: "Grow your business with AllGo."
- Input: `+91 | Enter your mobile number` (10-digit Indian phone validation).
- Action: "Continue" button with loading state.
- Secondary action: "New to AllGo? Register your business" toggle.
- OTP Verification view:
  - Masked mobile number (e.g. `+91 98*** **321`).
  - 6-digit OTP code input.
  - 60-second resend countdown with rate limiting.
  - "Change mobile number" button.
  - Error messages for expired/invalid OTP.
- Strictly exclude consumer promotional banners. Clean purple & white merchant branding.

---

### Step 2: Implement Multi-Step Merchant Registration Wizard (`src/components/MerchantRegistrationWizard.tsx`)
Multi-step progress indicator (Steps 1 to 6) with local draft persistence and validation:
- **Step 1: Business Information**
  - Business/Restaurant name, Category (Restaurant, Cloud Kitchen, Grocery Store, Supermarket, Bakery, Handmade / Home Kitchen, Packaged Foods), Owner name, Mobile number, Email address, Business type (Sole Proprietorship, Partnership, Private Limited, LLP, Individual / Home Chef), Description.
- **Step 2: Business Address & Location**
  - Shop/Unit number, Building/Street, Area/Landmark, City, State, PIN code (6 digits), Latitude, Longitude, Map picker toggle / GPS detect.
- **Step 3: Business Verification & Documents**
  - FSSAI license/registration number and expiry date (for food businesses).
  - GSTIN (15-character format, optional for home kitchens).
  - Business / Owner PAN (10-character alphanumeric).
  - Identity document type (Aadhaar, Voter ID, PAN).
- **Step 4: Bank & Payout Details**
  - Account holder name, Bank account number, Confirm account number, IFSC code (11 characters), Bank name.
  - Masked account display (`•••• •••• 1234`).
- **Step 5: Store Setup**
  - Store display name, Opening time, Closing time, Weekly off days, Delivery radius (km), Minimum order value (₹), Average preparation time (mins), Order contact phone.
- **Step 6: Review, Agreement & Submission**
  - Complete review summary of all entered details.
  - Partner Agreement terms checkbox.
  - Submit application via Firebase callable function (`submitPartnerApplication` / Firestore).
  - Transition to "Application Submitted" state.

---

### Step 3: Implement Server-Controlled Merchant Account Status Screen (`src/components/MerchantStatusScreen.tsx`)
Support all server-controlled statuses:
- `SUBMITTED` / `UNDER_REVIEW`:
  - Show "Application under review" confirmation with reference ID, submission timestamp, and review steps (Document verification -> Store setup -> Activation).
- `DOCUMENTS_REQUIRED` / `NEEDS_INFORMATION`:
  - Display reviewer feedback, allow uploading/amending missing documents, and resubmit via `amendPartnerApplication`.
- `APPROVED`:
  - Show approval congratulations with "Go to Store Dashboard" / "Activate Store".
- `REJECTED`:
  - Display rejection reason and permitted resubmission process.
- `SUSPENDED`:
  - Show account suspended notice with reason and AllGo support contact.

---

### Step 4: Integrate Status-Based Routing in `src/App.tsx`
- When `!currentUser`:
  - Render `AuthScreen` (supports both Login and "Register your business" modes).
- When `currentUser` authenticated:
  - Query merchant's profile and active application / business records:
    - If user has assigned active outlets (`workspace === 'merchant'`): open `MerchantPortal`.
    - If user has a pending, submitted, or needs-information application: open `MerchantStatusScreen`.
    - If user has no application and no assigned outlets: open `MerchantRegistrationWizard`.

---

### Step 5: Automated Testing and Verification
- Update UI test suite:
  - Test merchant partner login screen elements ("Welcome to AllGo Partner", `+91`, 10-digit validation).
  - Test OTP masking and countdown.
  - Test multi-step merchant registration wizard.
  - Test merchant status handling (`SUBMITTED`, `UNDER_REVIEW`, `DOCUMENTS_REQUIRED`, `APPROVED`, `REJECTED`, `SUSPENDED`).
- Run `npm run lint` (`tsc --noEmit`).
- Run `npm test` (all 33+ UI tests and 57 Functions tests).
- Run `node scripts/run-rules-tests.mjs` (Firestore security rules).
- Run `npm run build` (production build and audience check).
