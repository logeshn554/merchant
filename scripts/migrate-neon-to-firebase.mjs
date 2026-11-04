#!/usr/bin/env node
/**
 * scripts/migrate-neon-to-firebase.mjs
 * 
 * Safe, repeatable, non-destructive account migration from Neon PostgreSQL
 * to Firebase Authentication and Firestore `users/{uid}` profiles.
 * 
 * Usage:
 *   node scripts/migrate-neon-to-firebase.mjs --dry-run   (Preview changes without writes)
 *   node scripts/migrate-neon-to-firebase.mjs --apply     (Execute migration and update Firestore/Neon)
 */

import { createRequire } from 'node:module';
import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true });

export async function runMigration(options = {}) {
  const isApply = options.apply === true || process.argv.includes('--apply');
  const isDryRun = options.dryRun === true || process.argv.includes('--dry-run') || !isApply;

  console.log(`=== AllGo Neon to Firebase Account Migration ===`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (read-only preview)' : 'APPLY (live migration)'}\n`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required to connect to Neon PostgreSQL.');
  }

  // Initialize Firebase Admin
  let app;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'promtwars222';
    if (serviceAccountJson) {
      try {
        app = initializeApp({
          credential: cert(JSON.parse(serviceAccountJson)),
          projectId
        });
      } catch (err) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, initializing default app:', err.message);
        app = initializeApp({ projectId });
      }
    } else {
      app = initializeApp({ projectId });
    }
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  const stats = {
    scanned: 0,
    matchedAuth: 0,
    createdAuth: 0,
    syncedFirestore: 0,
    errors: []
  };

  try {
    const { rows: accounts } = await pool.query(
      `SELECT id, email, name, profile, created_at FROM allgo_accounts ORDER BY created_at ASC`
    );
    stats.scanned = accounts.length;
    console.log(`Found ${accounts.length} accounts in Neon PostgreSQL (allgo_accounts).\n`);

    for (const acc of accounts) {
      const email = acc.email?.toLowerCase().trim();
      const profile = typeof acc.profile === 'object' && acc.profile !== null ? acc.profile : {};
      const phone = profile.phone ? String(profile.phone).trim() : undefined;
      const role = profile.role || 'customer';
      const approvalStatus = profile.approvalStatus || 'pending';

      console.log(`Processing [Neon ID: ${acc.id}] email: ${email || 'none'}, phone: ${phone || 'none'}, role: ${role}`);

      let firebaseUser = null;
      let uid = profile.firebaseUid || null;

      // 1. Locate existing Firebase Auth user
      if (uid) {
        try {
          firebaseUser = await auth.getUser(uid);
        } catch {
          uid = null;
        }
      }
      if (!firebaseUser && email) {
        try {
          firebaseUser = await auth.getUserByEmail(email);
          uid = firebaseUser.uid;
        } catch {}
      }
      if (!firebaseUser && phone && profile.phoneVerified) {
        try {
          firebaseUser = await auth.getUserByPhoneNumber(phone);
          uid = firebaseUser.uid;
        } catch {}
      }

      if (firebaseUser) {
        stats.matchedAuth++;
        console.log(`  -> Matched existing Firebase Auth user: UID ${uid}`);
      } else {
        if (!isDryRun) {
          try {
            const createPayload = {
              displayName: acc.name || 'AllGo User',
              email: email || undefined,
              emailVerified: profile.emailVerified === true,
              phoneNumber: (phone && profile.phoneVerified) ? phone : undefined,
              disabled: approvalStatus === 'suspended'
            };
            firebaseUser = await auth.createUser(createPayload);
            uid = firebaseUser.uid;
            stats.createdAuth++;
            console.log(`  -> Created new Firebase Auth user: UID ${uid}`);
          } catch (createErr) {
            console.error(`  -> Failed to create Firebase Auth user for ${acc.id}:`, createErr.message);
            stats.errors.push({ id: acc.id, error: createErr.message });
            continue;
          }
        } else {
          uid = `dry-run-uid-${acc.id}`;
          console.log(`  -> [Dry-Run] Would create Firebase Auth user for ${email || phone || acc.id}`);
        }
      }

      // 2. Prepare canonical Firestore profile
      const firestoreProfile = {
        uid,
        email: email || null,
        name: acc.name || 'AllGo User',
        role,
        approvalStatus,
        createdAt: acc.created_at ? new Date(acc.created_at).toISOString() : new Date().toISOString(),
        migratedAt: new Date().toISOString(),
        source: 'neon_migration',
        neonAccountId: acc.id
      };

      if (phone) {
        firestoreProfile.phone = phone;
        firestoreProfile.phoneVerified = profile.phoneVerified === true;
      }
      if (profile.merchantBusinessIds) {
        firestoreProfile.merchantBusinessIds = profile.merchantBusinessIds;
      } else if (profile.merchantId && profile.merchantType) {
        firestoreProfile.merchantBusinessIds = { [profile.merchantType]: [profile.merchantId] };
      }
      if (profile.merchantStaffAccess) {
        firestoreProfile.merchantStaffAccess = profile.merchantStaffAccess;
      }
      if (profile.merchantType) {
        firestoreProfile.merchantType = profile.merchantType;
      }
      if (profile.merchantId) {
        firestoreProfile.merchantId = profile.merchantId;
      }

      if (!isDryRun) {
        const userRef = db.doc(`users/${uid}`);
        await userRef.set(firestoreProfile, { merge: true });
        await pool.query(
          `UPDATE allgo_accounts SET profile = profile || $1::jsonb WHERE id = $2`,
          [JSON.stringify({ firebaseUid: uid, migratedToFirebase: true }), acc.id]
        );
        stats.syncedFirestore++;
        console.log(`  -> Synced to Firestore users/${uid} and updated Neon record.\n`);
      } else {
        console.log(`  -> [Dry-Run] Would upsert to Firestore users/${uid}:`, JSON.stringify(firestoreProfile, null, 2), '\n');
      }
    }
  } catch (err) {
    console.error('Fatal error during migration:', err);
    throw err;
  } finally {
    await pool.end();
  }

  console.log('=== Migration Summary Report ===');
  console.log(`Total accounts scanned:     ${stats.scanned}`);
  console.log(`Matched to Firebase Auth:   ${stats.matchedAuth}`);
  console.log(`Created in Firebase Auth:   ${stats.createdAuth}`);
  console.log(`Synced to Firestore:        ${stats.syncedFirestore}`);
  console.log(`Errors encountered:         ${stats.errors.length}`);
  return stats;
}

if (process.argv[1] && process.argv[1].endsWith('migrate-neon-to-firebase.mjs')) {
  runMigration().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

