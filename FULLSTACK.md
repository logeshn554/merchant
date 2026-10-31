# AllGo Merchant

Separate full-stack application. Android package: in.allgo.merchant.

Orders, catalog editing, inventory, preparation, store hours, closures, partner approval and support.

## Application code

- src: actual authenticated app, role guard and live workflows.
- server: PostgreSQL account API, secure sessions, OTP proof verification, Firebase identity bridge, email/account recovery and account data handling.
- server/schema.sql: database schema.
- functions: complete shared authoritative order, dispatch, inventory, payments/refunds, evidence, fulfillment and support backend.
- Android: independent native app and secure session integration.
- Firestore/Storage rules and indexes: server-owned role, identity and record-access controls.
- Dockerfile/compose.yaml: container deployment for the production account API.

## Configure before deployment

Create .env.production.local from .env.production.example and fill real resources. Web port is 3001; account API port is 3005. Configure the same canonical PostgreSQL identity database and Firebase order store used by the Customer app and the other partner app. Supply Firebase Android registration for in.allgo.merchant, phone authentication, trusted server identity credentials, email delivery, HTTPS endpoints and required provider secrets. Backend credentials must never use a VITE_ prefix.

Install application dependencies with npm install and service dependencies with npm run install:backend. The production API starts with npm start. The default npm run build runs the production release configuration gate; npm run android:sync uses that production build. Native signing and verified release evidence are required for a production APK. These are setup commands for the operator; they have not been executed in this change.

Local code development is available through npm run dev:api and npm run dev, with real connected APIs. npm run build:development is a development build of the actual app, without sample data. There is no demo mode, sample order flow or simulated payment route. Demo sources, commands, preview APKs and stale generated bundles were removed.

Deploy the shared Firebase service Functions once against the canonical order database. Do not create competing payment webhook or dispatch deployments for each client. The complete shared backend source is included in both projects for ownership and deployment, while their account APIs and mobile clients have distinct identities.

Container deployment reads .env.production.local at runtime; place the API behind HTTPS ingress. Use managed workload identity for Firebase Application Default Credentials, or explicitly mount an operator-managed credential file read-only. The image does not include credentials. PostgreSQL is an externally configured persistent database, not disposable sample storage.

## Status

Production application source generated. No tests were run, as requested. No deployment, real SMS, live payment or fulfillment acceptance was performed. Missing owner/provider configuration and release evidence must be supplied before this can be called a verified production deployment. No ready production APK is currently supplied; rebuild after configuring the project.
