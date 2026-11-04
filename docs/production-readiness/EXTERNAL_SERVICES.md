# AllGo Production Readiness: External Services & Integration Inventory

**Date:** 2026-11-04  
**Scope:** Third-Party Providers, Credentials, Sandboxes, and Production Requirements  

---

## 1. External Services Inventory

| Service / Provider | Capability / Purpose | Credentials Required | Sandbox / Dev Mode | Production Go-Live Status | Failure Procedure |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Firebase Auth (Identity Platform)** | Phone OTP (SMS), Email/Password, Sessions | Google Services JSON, Web API Key, Service Account | Firebase Auth Emulator (`127.0.0.1:9099`) | **Ready in Code; Requires SMS Quota / Blaze Plan** | If SMS fails, user prompted to retry or contact support. Never bypass with fake tokens. |
| **Cloud Firestore** | Realtime database, canonical profiles, bookings, catalog | Project ID, Service Account credentials | Firestore Emulator (`127.0.0.1:8080`) | **Active in Dev/Staging; Rules Verified** | Offline persistence with cached UI, writes fail closed if rules reject. |
| **Firebase Cloud Storage** | Private KYC documents, product images | Storage Bucket URL, Security Rules | Storage Emulator (`127.0.0.1:9199`) | **Active in Dev; Private Bucket Rules Enforced** | Image uploads show retry progress; KYC docs rejected if malformed. |
| **Razorpay / UPI Payment Gateway** | Customer checkout payments, webhooks, refund automation | Key ID, Key Secret, Webhook Secret | Razorpay Test Mode Keys (`rzp_test_...`) | **Code Implemented; Real Credentials Pending Approval** | Unverified or failed webhook halts order progression; refund queued. |
| **RazorpayX / Cashfree Payouts** | Bank transfers (IMPS/NEFT/UPI) for merchant settlements | Payout Key, Secret, Account Number | Payout Sandbox API | **Pending Operator Bank Approval** | Payout requests stay in `pending_verification` until maker-checker operator approves. |
| **Firebase Cloud Messaging (FCM)** | Order alerts, rider dispatch chime, customer tracking | VAPID Key, FCM Project Config, APNs Certificate | Simulated local alerts / Mock notifications | **Capacitor Plugin Integrated; APNs/FCM Production Keys Pending** | Foreground polling backstop (10-second interval) ensures no missed orders if push fails. |
| **Mapbox / Google Maps API** | Address autocomplete, reverse geocoding, route distance | API Key / Access Token | OpenStreetMap / Nominatim fallback | **Integrated in `location/` and `reverseServiceLocation`** | If Maps API is unreachable, manual PIN code and landmark entry enabled. |
| **Resend / SendGrid** | Transactional email for account verification and statements | API Key, From Address | Local log output / Mock emailer | **Integrated in `sendAccountEmail`** | If email provider fails, error 503 returned; password reset link expires safely. |
| **Neon PostgreSQL** | Relational financial ledger, SQL reconciliation, audit | `DATABASE_URL` (SSL mode require) | Local Postgres / Dev Neon branch | **Connected; Relational schema initialized** | Database connection pooling with auto-reconnect and health check endpoint. |

---

## 2. Environment Configuration Matrix

The application separates environments using `.env` files:
- `.env.development` / `.env.local`: Local testing with Firebase Emulators.
- `.env.staging`: Connected to staging Firebase project and test payment sandbox.
- `.env.production.local`: Production resources behind HTTPS ingress. **Never commit to Git.**

*Rule:* Never prefix sensitive server secrets (API keys, service account JSON, webhook secrets) with `VITE_`. Any credential with `VITE_` is bundled into the client bundle and accessible to end users.
