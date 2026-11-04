# AllGo Merchant Platform: Production Go-Live Gate & Checklist

**Date:** 2026-11-04  
**Release Target:** AllGo Multi-Vendor Marketplace Production Release  

---

## 1. Go-Live Gate Status Definitions

- **STATUS 1 (Implemented in Code):** Source code written, reviewed, and integrated into repository.
- **STATUS 2 (Passed Automated Tests):** Verified via local unit, UI, and Functions test suites.
- **STATUS 3 (Staging Verified):** Exercised against staging emulators or sandbox providers.
- **STATUS 4 (Production Verified):** Tested against real production infrastructure.
- **STATUS 5 (Requires External Business Config):** Requires legal, banking, or corporate configuration.
- **STATUS 6 (Requires Regulatory / CA Approval):** Requires signoff from Indian Chartered Accountant or legal counsel.
- **STATUS 7 (BLOCKED):** Production blocker that strictly forbids go-live until resolved.

---

## 2. Release Acceptance Checklist

| Item | Category | Status | Details / Blocker |
| :--- | :--- | :--- | :--- |
| **Consolidate Identity to Firebase Auth** | Security | **STATUS 1 (In Progress)** | Stripping synthetic tokens and demo fallbacks. |
| **Remove All Demo & Fallback Auth** | Security | **STATUS 1 (In Progress)** | Deleting `signInDemoAccount` and test OTP bypasses. |
| **Multi-Vertical Merchant Catalog** | Product | **STATUS 1 (Ready)** | Food & grocery schemas and validators implemented. |
| **Multi-Vertical Onboarding Panel** | Operations | **STATUS 1 (Ready)** | Onboarding UI updated for home kitchens, makers, etc. |
| **Automated UI & Functions Tests** | Quality | **STATUS 2 (Passed)** | 26 UI tests, 57 Functions tests passing locally. |
| **Firestore Security Rules Unit Tests** | Security | **STATUS 2 (Passed)** | 5/5 tenant isolation and staff permission tests passing. |
| **Merchant Build Audience Assertion** | Architecture | **STATUS 2 (Passed)** | Verified `npm run build` excludes `CustomerApp`. |
| **Production Firebase SMS Quota (Blaze)** | External | **STATUS 5 (Config Required)** | Requires billing activation and SMS quota in Firebase console. |
| **Payment Gateway Webhook Secret** | Finance | **STATUS 5 (Config Required)** | Razorpay live webhook secret must be configured in secrets. |
| **Bank Payout Account Verification** | Finance | **STATUS 5 (Config Required)** | Requires corporate current account with nodal payout integration. |
| **Chartered Accountant GST Review** | Compliance | **STATUS 6 (Approval Required)** | Qualified Indian CA must approve Section 9(5) & Section 52 TCS config. |
| **Legal Counsel E-Commerce Terms** | Legal | **STATUS 6 (Approval Required)** | Final review of Merchant Agreement and Seller Terms & Conditions. |
| **Android Release Keystore & App Signing** | Mobile | **STATUS 7 (BLOCKED)** | Production keystore and signed release APK/AAB build pending. |
| **iOS Distribution Provisioning Profile** | Mobile | **STATUS 7 (BLOCKED)** | Apple Developer team provisioning and device testing pending. |

---

## 3. Go-Live Decision Gate

> [!CAUTION]
> **GO-LIVE DECISION: BLOCKED**  
> Under no circumstances may the application be deployed to production or commercial customer traffic until all Status 5, 6, and 7 items are resolved and signed off by the platform owner. Local development, staging verification, and internal QA testing may proceed safely.
