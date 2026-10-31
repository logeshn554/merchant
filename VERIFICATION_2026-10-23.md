# Merchant verification checkpoint

Shared application/backend/security runtime was synchronized from `../delivery123` with backups. The merchant package ID remains `in.allgo.merchant`, audience `merchant`, link scheme `allgo-merchant`, API fallback port 3005. The standalone merchant TypeScript check and development web build passed.

Canonical backend source passes 350 Functions/UI/server tests and 162 isolated Firebase integration tests, including food/grocery cash and wallet fulfillment, role isolation, grocery replacement stock, cancellation and expiry races. Backend source parity was checked after synchronization; this is not a live merchant deployment test.

Created the matching merchant Android registration in Firebase project `promtwars222` and installed its validated local `android/app/google-services.json` without committing client configuration. Firebase Android app ID: `1:63483696880:android:0720874d9d0b3534071435`. The canonical merchant debug APK was rebuilt with this registration, and package/audience/Firebase resource IDs were verified.

Latest APK: `../delivery123/.cache/apps/merchant/app-debug.apk`. Exact SHA-256 and scope: `../delivery123/docs/production/ANDROID_ARTIFACTS_2026-10-23.json`. Shared source/backups/setup: `../delivery123/docs/production/2026-10-23-production-work.md` and `PARTNER_RUNTIME_SYNC.md` in the same documentation folder.

This is a development/debug checkpoint. Merchant settlement allocation, verified bank/payout integration, Google OAuth/provider/signing acceptance, real staging/production environment configuration, authenticated native fulfillment and operator release gates remain open. Earlier generated documentation saying tests were not run describes the earlier generation step, not this checkpoint.
