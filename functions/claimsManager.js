// AllGo Custom Claims Manager
// Provides server-authoritative custom claims on Firebase Authentication tokens.
// Eliminates runtime database lookups in Firestore security rules.

/**
 * Builds standard custom claims object from user profile and driver/merchant attributes.
 * Claims are kept minimal to stay well under Firebase Auth 1000-byte token limit.
 *
 * @param {object} user - User document data from users/{uid}
 * @param {object|null} driverProfile - Optional driver profile from driver_profiles/{uid}
 * @returns {object} Claims payload
 */
function buildUserCustomClaims(user = {}, driverProfile = null) {
  const role = user.role || 'customer';
  const claims = {
    role,
    admin: role === 'admin',
    suspended: user.suspended === true,
    disabled: user.disabled === true
  };

  if (user.phoneVerified === true) {
    claims.phoneVerified = true;
  }

  if (role === 'driver' || driverProfile?.status) {
    claims.driverStatus = driverProfile?.status || 'pending_kyc';
    claims.driverOnline = driverProfile?.online === true;
  }

  if (role === 'merchant' || (user.merchantBusinessIds && typeof user.merchantBusinessIds === 'object')) {
    if (user.merchantId) claims.merchantId = user.merchantId;
    if (user.merchantType) claims.merchantType = user.merchantType;
    if (user.transportOperatorId) claims.transportOperatorId = user.transportOperatorId;
    if (user.merchantBusinessIds && typeof user.merchantBusinessIds === 'object') {
      claims.merchantBusinessIds = user.merchantBusinessIds;
    }
    if (user.merchantStaffAccess && typeof user.merchantStaffAccess === 'object') {
      claims.merchantStaffAccess = user.merchantStaffAccess;
    }
  }

  return claims;
}

/**
 * Applies custom claims and optionally revokes refresh tokens.
 *
 * @param {object} auth - Firebase Admin Auth instance
 * @param {string} uid - Target user ID
 * @param {object} claims - Custom claims payload
 * @param {boolean} revokeTokens - If true, revokes refresh tokens to force immediate re-authentication
 */
async function applyUserClaims(auth, uid, claims, revokeTokens = false) {
  await auth.setCustomUserClaims(uid, claims);
  if (revokeTokens) {
    await auth.revokeRefreshTokens(uid);
  }
  return claims;
}

/**
 * Synchronizes custom claims from Firestore user and driver profile into Firebase Auth.
 *
 * @param {object} auth - Firebase Admin Auth instance
 * @param {object} db - Firestore instance
 * @param {string} uid - Target user ID
 * @param {boolean} revokeOnSuspension - Whether to revoke tokens if account is suspended
 */
async function syncUserClaims(auth, db, uid, revokeOnSuspension = true) {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    throw new Error(`Cannot sync claims: user ${uid} does not exist.`);
  }

  const userData = userSnap.data();
  let driverData = null;

  if (userData.role === 'driver') {
    const driverSnap = await db.doc(`driver_profiles/${uid}`).get();
    if (driverSnap.exists) {
      driverData = driverSnap.data();
    }
  }

  const claims = buildUserCustomClaims(userData, driverData);
  const shouldRevoke = revokeOnSuspension && (claims.suspended || claims.disabled);
  await applyUserClaims(auth, uid, claims, shouldRevoke);
  return claims;
}

/**
 * Suspends an account, sets suspended claim, updates Firestore, and immediately revokes refresh tokens.
 *
 * @param {object} auth - Firebase Admin Auth instance
 * @param {object} db - Firestore instance
 * @param {string} uid - Target user ID
 * @param {string} reason - Suspension reason for audit log
 */
async function suspendUserAccount(auth, db, uid, reason = 'Operator action') {
  await db.doc(`users/${uid}`).update({
    suspended: true,
    suspendedAt: new Date().toISOString(),
    suspensionReason: reason
  });

  const currentClaims = (await auth.getUser(uid)).customClaims || {};
  await auth.setCustomUserClaims(uid, {
    ...currentClaims,
    suspended: true
  });
  await auth.revokeRefreshTokens(uid);
  return { uid, suspended: true };
}

module.exports = {
  buildUserCustomClaims,
  applyUserClaims,
  syncUserClaims,
  suspendUserAccount
};
