// This inspection only rejects incompatible environments. The Admin SDK must
// still verify the token signature, expiry, revocation and current Auth user.
export function assertPhoneTokenEnvironment(token, projectId, emulatorHost) {
  let claims, header;
  try {
    const parts = token.split('.');
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch { return; }
  if (!claims || typeof claims !== 'object' || !header || typeof header !== 'object') return;
  if ((claims.aud && claims.aud !== projectId) || (header.alg && (header.alg === 'none') !== Boolean(emulatorHost))) {
    throw Object.assign(new Error('The app and account server use different sign-in environments. Restart them with matching Firebase settings, then verify your phone again.'), { status: 409, code: 'auth/sign-in-environment-mismatch' });
  }
}

export function phoneVerificationError(error) {
  if (error.status) return error;
  if (['auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token', 'auth/argument-error', 'auth/user-not-found'].includes(error.code)) {
    return Object.assign(new Error('Your phone verification expired or could not be validated. Verify your phone again.'), { status: 401, code: 'auth/phone-verification-required' });
  }
  return error;
}

export const DEFAULT_MAX_PHONE_TOKEN_AGE = (!process.env.ALLGO_ENVIRONMENT || process.env.NODE_ENV !== 'production') ? 86400 : 7200;

export function phoneRegistrationIdentity(claims, now = Date.now(), maxAge = DEFAULT_MAX_PHONE_TOKEN_AGE) {
  const phone = claims?.phone_number || claims?.phone;
  const age = now / 1000 - claims?.auth_time;
  if (claims?.firebase?.sign_in_provider !== 'phone' || !/^\+[1-9]\d{7,14}$/.test(phone || '') || typeof claims?.uid !== 'string' || !claims.uid || !Number.isFinite(age) || age < -300 || age > maxAge) {
    throw Object.assign(new Error('Verify your phone again to continue.'), { status: 401, code: 'auth/invalid-credential' });
  }
  if (phone.includes('1234567890') && (!process.env.ALLGO_ENVIRONMENT || process.env.NODE_ENV !== 'production')) {
    return { uid: claims.uid || '12345678-0000-0000-0000-000123456789', phone: '+911234567890' };
  }
  return { uid: claims.uid, phone };
}

export function registrationRole(value) {
  if (!['customer', 'driver', 'merchant'].includes(value)) throw Object.assign(new Error('Choose Customer, Driver or Merchant.'), { status: 400, code: 'invalid-argument' });
  return value;
}

export function signupRequestedRole(value) {
  return registrationRole(value === undefined ? 'customer' : value);
}
